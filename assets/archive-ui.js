/* Original-file archive, isolated from operational ingestion and metric stores. */
(function(){
  'use strict';
  let busy=false,editingId=null,savingDetails=false,editRequest=0;
  const element=id=>document.getElementById(id);
  const status=message=>{const target=element('archiveStatus');if(target)target.textContent=message;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function refreshEditControls(){
    for(const id of ['archiveSaveDetails','archiveCancelEdit','archiveChoose','archiveFacility','archiveReportDate','archiveShift','archiveKind','archiveNotes']){const control=element(id);if(control)control.disabled=busy||savingDetails;}
    element('archiveList')?.querySelectorAll('[data-archive-edit]').forEach(button=>{button.disabled=busy||savingDetails||button.dataset.archivePending==='true';});
  }
  function readLabels(){return {site:element('archiveFacility').value,reportDate:element('archiveReportDate').value,shift:element('archiveShift').value,reportKind:element('archiveKind').value,notes:element('archiveNotes').value};}
  function publishedRows(){return (window.OPS_SOURCE_SNAPSHOT?.archive||[]).map(row=>({...row,category:OpsArchiveCore.category,published:true}));}
  function mergedRows(local){const map=new Map(publishedRows().map(row=>[row.id,row]));local.filter(OpsArchiveCore.isArchive).forEach(row=>map.set(row.id,row));return [...map.values()];}
  function publishedUrl(row){if(!/^assets\/reports\/[a-f0-9]{64}\.(pdf|jpg|jpeg)$/.test(row.publicUrl||""))throw new Error("Invalid published report path");return row.publicUrl;}
  function archiveId(value){return /^report-[a-f0-9]{64}$/.test(value)?value:Number(value);}
  function archiveRows(){return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();request.onsuccess=()=>resolve(mergedRows(request.result));request.onerror=()=>reject(request.error);});}
  async function saveOriginal(file,labels){
    await openDB();
    const bytes=await file.arrayBuffer();
    if(!globalThis.crypto?.subtle)throw new Error('Secure file fingerprinting is unavailable in this browser. Nothing was saved.');
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    return new Promise((resolve,reject)=>{
      // Deduplication and add share one read-write transaction, including between tabs.
      const transaction=db.transaction(STORE,'readwrite'),store=transaction.objectStore(STORE);
      const request=store.getAll();let result;
      request.onsuccess=()=>{
        try{result=OpsArchiveCore.stageFile(mergedRows(request.result),file,labels,hash,new Date().toISOString());
          if(result.status==='new'){const add=store.add(result.record);add.onsuccess=()=>{result.record.id=add.result;};}
        }catch(error){transaction.abort();reject(error);}
      };
      transaction.oncomplete=()=>resolve(result);
      transaction.onerror=()=>reject(transaction.error||new Error('Could not save the original file.'));
      transaction.onabort=()=>reject(transaction.error||new Error('Archive save was cancelled.'));
    });
  }
  async function archiveReportFiles(files){
    if(busy||savingDetails){status("Please wait for the current archive action to finish.");return;}
    if(editingId!=null){status('Save or cancel the label edit before adding files.');return;}
    let labels;try{labels=OpsArchiveCore.metadata(readLabels());}catch(error){status(error.message);return;}
    busy=true;refreshEditControls();
    let added=0,duplicates=0,review=0;
    try{
      for(const file of [...files]){status(`Saving original: ${file.name}`);const result=await saveOriginal(file,labels);if(result.status==='new')added++;else if(result.status==='duplicate')duplicates++;else review++;}
      status(`${added} original(s) saved; ${duplicates} already archived.${review?` ${review} identical file(s) already have different labels; use Edit details to review.`:''} Dashboard metrics were not changed.`);
      await renderReportArchive();
    }catch(error){const message=`Archive incomplete: ${error.message}. ${added} file(s) saved. Dashboard metrics were not changed.`;try{await renderReportArchive();}catch(_){}status(message);}
    finally{busy=false;refreshEditControls();const input=element('archiveFileInput');if(input)input.value='';}
  }
  async function renderReportArchive(){
    if(!element('archiveList'))return;
    await openDB();
    const records=await archiveRows();
    const shift=element('archiveFilterShift'),previous=shift.value;
    shift.innerHTML='<option value="">All shifts</option><option value="__unknown">Shift unknown</option>'+[...new Set(records.map(row=>row.shift).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=>`<option value="${esc(value)}">Shift ${esc(value)}</option>`).join('');
    shift.value=previous;
    const rows=OpsArchiveCore.select(records,{site:currentSite,shift:shift.value,reportKind:element('archiveFilterKind').value,from:element('archiveFrom').value,to:element('archiveTo').value,search:element('archiveSearch').value});
    const groups=new Map();
    rows.forEach(row=>{const key=[row.site,row.reportDate||'Date unknown',row.shift||'Shift unknown'].join('|');const values=groups.get(key)||[];values.push(row);groups.set(key,values);});
    element('archiveCount').textContent=`${rows.filter(row=>row.publicUrl||row.blob).length} available / ${rows.length} catalog entries · Remaining originals pending publication`;
    element('archiveList').innerHTML=[...groups.values()].map(group=>{
      const first=group[0];
      return `<div class="panel" style="margin-bottom:14px"><h3>${esc(SITE_NAMES[first.site]||'Location not known')} · ${esc(first.reportDate||'Report date unknown')} · ${first.shift?'Shift '+esc(first.shift):'Shift unknown'}</h3>${group.map(row=>`<div class="file-row" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line)"><div style="flex:1;min-width:200px"><strong>${esc(row.name)}</strong><div class="file-meta">${esc(row.reportKind||'Other / older source file')} · ${(row.size/1048576).toFixed(2)} MB · ${row.uploadPending?'Original file pending publication':row.published?'Published original':'Stored in this browser'}</div>${row.notes?`<div class="file-meta">${esc(row.notes)}</div>`:''}</div>${row.publicUrl?`<a class="small-btn" href="${esc(publishedUrl(row))}" target="_blank" rel="noopener">Open</a><a class="small-btn" href="${esc(publishedUrl(row))}" download="${esc(row.name)}">Download original</a>`:(row.blob?`<button class="small-btn" data-archive-open="${row.id}" type="button">Open / download</button><button class="small-btn" data-archive-download="${row.id}" type="button">Download original</button>`:`<span class="file-meta">Original file pending publication</span>`)}<button class="small-btn" data-archive-pending="${!row.publicUrl&&!row.blob}" ${!row.publicUrl&&!row.blob?'disabled':''} data-archive-edit="${row.id}" type="button">Edit details</button></div>`).join('')}</div>`;
    }).join('')||'<div class="panel empty">No original reports match these filters. Add a Word or PDF report to archive it without changing dashboard metrics.</div>';
    element('archiveList').querySelectorAll('[data-archive-download]').forEach(button=>button.onclick=()=>downloadOriginal(Number(button.dataset.archiveDownload)));
    element('archiveList').querySelectorAll('[data-archive-open]').forEach(button=>button.onclick=()=>openOriginal(Number(button.dataset.archiveOpen)));
    element('archiveList').querySelectorAll('[data-archive-edit]').forEach(button=>button.onclick=()=>editDetails(archiveId(button.dataset.archiveEdit)));
    refreshEditControls();
  }
  async function original(id){await openDB();const record=(await archiveRows()).find(row=>row.id===id);if(!record||!OpsArchiveCore.isArchive(record)||(!record.blob&&!record.publicUrl))throw new Error('Original file not found in this browser.');return record;}
  async function downloadOriginal(id){try{const row=await original(id),url=URL.createObjectURL(row.blob),link=document.createElement('a');link.href=url;link.download=row.name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){status(error.message);}}
  async function openOriginal(id){
    try{const row=await original(id);const signature=new TextDecoder().decode(await row.blob.slice(0,5).arrayBuffer());
      if(signature==='%PDF-'){const url=URL.createObjectURL(new Blob([row.blob],{type:'application/pdf'}));const opened=window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),300000);status('PDF opened in a new tab. If your browser blocked it, use Download original.');}
      else{await downloadOriginal(id);status('Original downloaded. Open Word and other document files with their normal application.');}
    }catch(error){status(error.message);}
  }
  async function editDetails(id){
    if(busy||savingDetails){status('Wait for the current archive action to finish before editing another file.');return;}
    const request=++editRequest;
    try{const row=await original(id);if(request!==editRequest||busy||savingDetails)return;
      editingId=id;element('archiveFacility').value=['la26','maywood','indiana','sacramento','newyork'].includes(row.site)?row.site:'unassigned';element('archiveReportDate').value=row.reportDate||'';element('archiveShift').value=row.shift||'';element('archiveKind').value=row.reportKind||'other';element('archiveNotes').value=row.notes||'';element('archiveSaveDetails').hidden=false;element('archiveCancelEdit').hidden=false;status(`Editing labels for ${row.name}. The original file and dashboard values remain unchanged.`);element('archiveFacility').focus();
    }catch(error){status(error.message);}
  }
  async function saveDetails(){
    if(savingDetails||busy||editingId==null)return;
    const targetId=editingId;let labels;
    try{labels=OpsArchiveCore.metadata(readLabels());}catch(error){status(error.message);return;}
    savingDetails=true;editRequest++;refreshEditControls();let saved=false;
    try{await openDB();
      await new Promise((resolve,reject)=>{const transaction=db.transaction(STORE,'readwrite'),store=transaction.objectStore(STORE),request=store.get(targetId);request.onsuccess=()=>{try{store.put(OpsArchiveCore.editMetadata(request.result||publishedRows().find(row=>row.id===targetId),labels,new Date().toISOString()));}catch(error){transaction.abort();reject(error);}};transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('Details were not saved.'));});
      saved=true;status('Archive labels saved. Original bytes and dashboard metrics are unchanged.');await renderReportArchive();
    }catch(error){status(error.message);}
    finally{savingDetails=false;refreshEditControls();if(saved&&editingId===targetId)cancelEdit();}
  }
  function cancelEdit(){if(savingDetails||busy)return;editRequest++;editingId=null;element('archiveSaveDetails').hidden=true;element('archiveCancelEdit').hidden=true;}
  function setup(){
    if(!element('archiveFileInput'))return;
    if(currentSite!=='all')element('archiveFacility').value=currentSite;
    element('archiveChoose').onclick=()=>{if(editingId!=null){status('Save or cancel the label edit before adding files.');return;}element('archiveFileInput').click();};
    element('archiveFileInput').onchange=event=>archiveReportFiles(event.target.files);
    const drop=element('archiveDrop');drop.ondragover=event=>event.preventDefault();drop.ondrop=event=>{event.preventDefault();event.stopPropagation();if(editingId!=null){status('Save or cancel the label edit first.');return;}archiveReportFiles(event.dataTransfer.files);};
    ['archiveSearch','archiveFilterShift','archiveFilterKind','archiveFrom','archiveTo'].forEach(id=>element(id).addEventListener(id==='archiveSearch'?'input':'change',()=>renderReportArchive().catch(error=>status(error.message))));
    element('archiveSaveDetails').onclick=saveDetails;element('archiveCancelEdit').onclick=cancelEdit;
    element('siteSelector')?.addEventListener('change',()=>{if(currentSite!=='all'&&editingId==null)element('archiveFacility').value=currentSite;renderReportArchive().catch(error=>status(error.message));});
    renderReportArchive().catch(error=>status(error.message));
  }
  window.archiveReportFiles=archiveReportFiles;window.renderReportArchive=renderReportArchive;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
