/* Original-file archive, isolated from operational ingestion and metric stores. */
(function(){
  'use strict';
  let busy=false,editingId=null,savingDetails=false,editRequest=0,restoreTarget=null;
  const element=id=>document.getElementById(id);
  const status=message=>{const target=element('archiveStatus');if(target)target.textContent=message;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function refreshEditControls(){
    for(const id of ['archiveSaveDetails','archiveCancelEdit','archiveChoose','archiveFacility','archiveReportDate','archiveShift','archiveKind','archiveNotes']){const control=element(id);if(control)control.disabled=busy||savingDetails;}
    document.querySelectorAll?.('[data-archive-edit],[data-archive-restore]').forEach(button=>{button.disabled=busy||savingDetails||button.dataset.archivePending==='true';});
  }
  function readLabels(){return {site:element('archiveFacility').value,reportDate:element('archiveReportDate').value,shift:element('archiveShift').value,reportKind:element('archiveKind').value,notes:element('archiveNotes').value};}
  function publishedRows(){return (window.OPS_SOURCE_SNAPSHOT?.archive||[]).map(row=>({...row,category:OpsArchiveCore.category,published:true}));}
  function mergedRows(local){const map=new Map(publishedRows().map(row=>[row.id,row]));local.filter(OpsArchiveCore.isArchive).forEach(row=>map.set(row.id,row));return [...map.values()];}
  function publishedUrl(row){if(!/^assets\/reports\/[a-f0-9]{64}\.(pdf|jpg|jpeg)$/.test(row.publicUrl||""))throw new Error("Invalid published report path");return row.publicUrl;}
  function archiveId(value){return /^report-[a-f0-9]{64}$/.test(value)?value:Number(value);}
  function archiveRows(){return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();request.onsuccess=()=>resolve(mergedRows(request.result));request.onerror=()=>reject(request.error);});}
  async function saveOriginal(file,labels,expectedRestore=null){
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
          if(expectedRestore&&hash!==expectedRestore.contentSha256)throw new Error('This file does not match the selected report. Choose the original file with the same content.');
          if(result.status==='new'){const add=store.add(result.record);add.onsuccess=()=>{result.record.id=add.result;};}
          else if(result.status==='restored-local'){store.put(result.record);}
        }catch(error){transaction.abort();reject(error);}
      };
      transaction.oncomplete=()=>resolve(result);
      transaction.onerror=()=>reject(transaction.error||new Error('Could not save the original file.'));
      transaction.onabort=()=>reject(transaction.error||new Error('Archive save was cancelled.'));
    });
  }
  async function archiveReportFiles(files,expectedRestore=null){
    if(busy||savingDetails){status("Please wait for the current archive action to finish.");return;}
    if(editingId!=null){status('Save or cancel the label edit before adding files.');return;}
    let labels;try{labels=OpsArchiveCore.metadata(expectedRestore||readLabels());}catch(error){status(error.message);return;}
    busy=true;refreshEditControls();
    let added=0,restored=0,duplicates=0,review=0;
    try{
      for(const file of [...files]){status(`Saving original: ${file.name}`);const result=await saveOriginal(file,labels,expectedRestore);if(result.status==='new')added++;else if(result.status==='restored-local')restored++;else if(result.status==='duplicate')duplicates++;else review++;}
      status(`${added} new original(s) saved; ${restored} catalog original(s) restored in this browser; ${duplicates} already available.${review?` ${review} identical file(s) already have different labels; use Edit details to review.`:''} Dashboard metrics were not changed.`);
      await renderReportArchive();
    }catch(error){const message=`Archive incomplete: ${error.message}. ${added} file(s) saved. Dashboard metrics were not changed.`;try{await renderReportArchive();}catch(_){}status(message);}
    finally{busy=false;restoreTarget=null;refreshEditControls();const input=element('archiveFileInput');if(input)input.value='';}
  }
  let selectedArchiveId=null,renderRequest=0,visibleArchiveRows=[];
  const available=row=>!!(row.publicUrl||row.blob);
  const dateLabel=value=>value?new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Date not specified';
  function selectOriginal(id,focus=false){selectedArchiveId=id;renderOriginalDetail();element('archiveList').querySelectorAll('[data-archive-select]').forEach(button=>{const active=archiveId(button.dataset.archiveSelect)===id;button.classList?.toggle('selected',active);button.setAttribute?.('aria-selected',String(active));if(active&&focus)button.focus();});}
  async function chooseMissingOriginal(id){
    if(busy||savingDetails)return;
    if(editingId!=null){status('Save or cancel label changes before choosing another original.');return;}
    const row=visibleArchiveRows.find(r=>r.id===id);if(!row)return;
    cancelEdit();restoreTarget=row;
    
    status('Choose the matching original. It will be saved only in this browser and will not change metrics.');element('archiveFileInput').click();
  }
  function renderOriginalDetail(){
    const panel=element('archiveDetail');if(!panel)return;const row=visibleArchiveRows.find(r=>r.id===selectedArchiveId);
    if(!row){panel.innerHTML='<div class="archive-placeholder"><strong>Select a report</strong><p>Choose a report to see its details and available actions.</p></div>';return;}
    const state=row.publicUrl?'Published original':row.blob?'Saved in this browser':'Original not available';
    const actions=row.publicUrl?`<a class="archive-primary" href="${esc(publishedUrl(row))}" target="_blank" rel="noopener">Open report ↗</a><a class="archive-secondary" href="${esc(publishedUrl(row))}" download="${esc(row.name)}">Download</a>`:row.blob?`<button class="archive-primary" data-archive-open="${esc(row.id)}" type="button">Open report ↗</button><button class="archive-secondary" data-archive-download="${esc(row.id)}" type="button">Download</button>`:`<button class="archive-primary" data-archive-restore="${esc(row.id)}" type="button">Choose matching original</button>`;
    panel.innerHTML=`<div class="archive-detail-top"><span class="archive-file-symbol">${/\.pdf$/i.test(row.name)?'PDF':'FILE'}</span><span class="archive-badge ${available(row)?'ready':'unavailable'}">${esc(state)}</span></div><h3>${esc(row.name)}</h3><dl class="archive-facts"><div><dt>Facility</dt><dd>${esc(SITE_NAMES[row.site]||'Not specified')}</dd></div><div><dt>Report date</dt><dd>${esc(dateLabel(row.reportDate))}</dd></div><div><dt>Shift</dt><dd>${esc(row.shift||'Not specified')}</dd></div><div><dt>Type</dt><dd>${esc(row.reportKind||'Other')}</dd></div><div><dt>File size</dt><dd>${Number.isFinite(row.size)?(row.size/1048576).toFixed(2)+' MB':'Unknown'}</dd></div></dl>${row.notes?`<p class="archive-detail-note">${esc(row.notes)}</p>`:''}${available(row)?'':`<p class="archive-availability-note">This is a catalog entry. Its original file has not been published, so it cannot be opened yet. You can choose the matching original from your device to make it available in this browser.</p>`}<div class="archive-detail-actions">${actions}${available(row)?`<button class="archive-secondary" data-archive-edit="${esc(row.id)}" type="button">Edit labels</button>`:''}</div><p class="archive-footnote">Storing or opening a report never changes dashboard metrics.</p>`;
    panel.querySelectorAll('[data-archive-open]').forEach(button=>button.onclick=()=>openOriginal(archiveId(button.dataset.archiveOpen)));
    panel.querySelectorAll('[data-archive-download]').forEach(button=>button.onclick=()=>downloadOriginal(archiveId(button.dataset.archiveDownload)));
    panel.querySelectorAll('[data-archive-edit]').forEach(button=>button.onclick=()=>editDetails(archiveId(button.dataset.archiveEdit)));
    panel.querySelectorAll('[data-archive-restore]').forEach(button=>{button.disabled=busy||savingDetails;button.onclick=()=>chooseMissingOriginal(archiveId(button.dataset.archiveRestore));});
  }
  async function renderReportArchive(){
    const request=++renderRequest;element('archiveList')?.setAttribute?.('aria-busy','true');
    try{let records;try{await openDB();records=await archiveRows();}catch(error){records=publishedRows();status('Browser storage is unavailable. Showing the published catalog; local files cannot be saved until storage is available.');}if(request!==renderRequest)return;
      const shift=element('archiveFilterShift'),previous=shift.value;
      shift.innerHTML='<option value="">All shifts</option><option value="__unknown">Not specified</option>'+[...new Set(records.map(row=>row.shift).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(value=>`<option value="${esc(value)}">Shift ${esc(value)}</option>`).join('');shift.value=previous;
      if(previous&&!records.some(row=>row.shift===previous)&&previous!=='__unknown')shift.value='';
      const from=element('archiveFrom').value,to=element('archiveTo').value;if(from&&to&&from>to){status('From date must be on or before Through date. Previous results are still shown.');return;}
      const site=element('archiveFilterSite')?.value||currentSite;
      let rows=OpsArchiveCore.select(records,{site,shift:shift.value,reportKind:element('archiveFilterKind').value,from,to,search:element('archiveSearch').value});
      const matching=rows.length,ready=rows.filter(available).length,state=element('archiveAvailability')?.value||'';
      if(state==='available')rows=rows.filter(available);else if(state==='missing')rows=rows.filter(row=>!available(row));
      const sort=element('archiveSort')?.value||'newest';rows.sort((a,b)=>{const byDate=(a.reportDate||'').localeCompare(b.reportDate||'')*(sort==='oldest'?1:-1),byShift=(a.shift||'').localeCompare(b.shift||'',undefined,{numeric:true});return sort==='shift'?byShift||byDate:byDate||(a.site||'').localeCompare(b.site||'')||byShift;});
      visibleArchiveRows=rows;if(!rows.some(row=>row.id===selectedArchiveId))selectedArchiveId=rows[0]?.id??null;
      element('archiveCount').textContent=`${rows.length} report${rows.length===1?'':'s'} shown · ${rows.filter(available).length} ready to open`;
      if(element('productionTabCount'))element('productionTabCount').textContent=String(records.length);
      if(element('archiveAvailabilitySummary'))element('archiveAvailabilitySummary').textContent=`Matching catalog: ${ready} original${ready===1?'':'s'} available, ${matching-ready} not published. Browser-local originals are available only on this device.`;
      element('archiveList').innerHTML=rows.map(row=>`<button class="archive-item ${row.id===selectedArchiveId?'selected':''}" data-archive-select="${esc(row.id)}" role="option" aria-selected="${row.id===selectedArchiveId}" type="button"><span class="archive-item-symbol">${/\.pdf$/i.test(row.name)?'PDF':'FILE'}</span><span class="archive-item-copy"><strong>${esc(row.name)}</strong><span>${esc(SITE_NAMES[row.site]||'Not specified')} · ${esc(dateLabel(row.reportDate))}</span><small>Shift ${esc(row.shift||'not specified')} · ${esc(row.reportKind||'Other')}</small></span><span class="archive-status-dot ${available(row)?'ready':'unavailable'}" aria-label="${available(row)?'Ready to open':'Original not available'}"></span><span aria-hidden="true">›</span></button>`).join('')||'<div class="archive-placeholder"><strong>No matching reports</strong><p>Try another date, facility or shift, or clear the search.</p></div>';
      element('archiveList').querySelectorAll('[data-archive-select]').forEach(button=>{button.onclick=()=>selectOriginal(archiveId(button.dataset.archiveSelect));button.onkeydown=event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();let index=rows.findIndex(row=>row.id===archiveId(button.dataset.archiveSelect));index=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)));selectOriginal(rows[index].id,true);};});
      renderOriginalDetail();refreshEditControls();
    }finally{if(request===renderRequest)element('archiveList')?.setAttribute?.('aria-busy','false');}
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
      editingId=id;if(element('archiveAddPanel'))element('archiveAddPanel').open=true;element('archiveFacility').value=['la26','maywood','indiana','sacramento','newyork'].includes(row.site)?row.site:'unassigned';element('archiveReportDate').value=row.reportDate||'';element('archiveShift').value=row.shift||'';element('archiveKind').value=row.reportKind||'other';element('archiveNotes').value=row.notes||'';element('archiveSaveDetails').hidden=false;element('archiveCancelEdit').hidden=false;status(`Editing labels for ${row.name}. The original file and dashboard values remain unchanged.`);element('archiveFacility').focus();
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
    if(element('archiveFilterSite'))element('archiveFilterSite').value=currentSite;
    element('archiveChoose').onclick=()=>{restoreTarget=null;if(editingId!=null){status('Save or cancel the label edit before adding files.');return;}element('archiveFileInput').click();};
    element('archiveFileInput').onchange=event=>{const target=restoreTarget;restoreTarget=null;archiveReportFiles(event.target.files,target);};
    element('archiveFileInput').addEventListener('cancel',()=>{restoreTarget=null;status('File selection cancelled. No files or metrics changed.');});
    const drop=element('archiveDrop');drop.ondragover=event=>event.preventDefault();drop.ondrop=event=>{event.preventDefault();event.stopPropagation();if(editingId!=null){status('Save or cancel the label edit first.');return;}restoreTarget=null;archiveReportFiles(event.dataTransfer.files);};
    ['archiveSearch','archiveFilterShift','archiveFilterKind','archiveFrom','archiveTo','archiveFilterSite','archiveAvailability','archiveSort'].forEach(id=>element(id)?.addEventListener(id==='archiveSearch'?'input':'change',()=>renderReportArchive().catch(error=>status(error.message))));
    if(element('archiveClearFilters'))element('archiveClearFilters').onclick=()=>{for(const id of ['archiveSearch','archiveFilterShift','archiveFilterKind','archiveFrom','archiveTo','archiveAvailability'])element(id).value='';if(element('archiveFilterSite'))element('archiveFilterSite').value=currentSite;if(element('archiveSort'))element('archiveSort').value='newest';selectedArchiveId=null;renderReportArchive().catch(error=>status(error.message));};
    element('archiveSaveDetails').onclick=saveDetails;element('archiveCancelEdit').onclick=cancelEdit;
    element('siteSelector')?.addEventListener('change',()=>{if(element('archiveFilterSite'))element('archiveFilterSite').value=currentSite;if(currentSite!=='all'&&editingId==null)element('archiveFacility').value=currentSite;renderReportArchive().catch(error=>status(error.message));});
    renderReportArchive().catch(error=>status(error.message));
  }
  window.archiveReportFiles=archiveReportFiles;window.renderReportArchive=renderReportArchive;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
