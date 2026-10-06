const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const core=require('../assets/archive-core.js');
const labels={site:'la26',reportDate:'2026-10-04',shift:'1st',reportKind:'production',notes:'Test metadata'};
const fingerprint='a'.repeat(64);
test('file archive preserves original content and does not infer missing labels',async()=>{
  const file=new File(['original report bytes'],'report.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const result=core.stageFile([],file,{site:'unassigned',shift:'',reportDate:'',reportKind:'other'},fingerprint,'2026-10-05T00:00:00Z');
  assert.equal(result.status,'new');assert.equal(result.record.blob,file);assert.equal(result.record.reportDate,'');assert.equal(result.record.shift,'');
  assert.equal(await result.record.blob.text(),'original report bytes');assert.equal(result.record.name,'report.docx');
});
test('same original is deduplicated; conflicting labels require review without mutation',()=>{
  const file=new File(['same'],'report.pdf');const first=core.stageFile([],file,labels,fingerprint,'now').record;
  assert.equal(first.shift,'1');
  assert.equal(core.stageFile([first],file,labels,fingerprint,'later').status,'duplicate');
  assert.equal(core.stageFile([first],file,{...labels,shift:'2'},fingerprint,'later').status,'metadata-review');
  assert.equal(first.shift,'1');
  assert.equal(core.stageFile([first],file,labels,'b'.repeat(64),'later').status,'new');
});
test('editing labels preserves original bytes, fingerprint and prior labels',()=>{
  const original=core.stageFile([],new File(['x'],'original.doc'),labels,fingerprint,'now').record;
  const revised=core.editMetadata(original,{...labels,reportKind:'packaging',shift:'2'},'later');
  assert.equal(revised.blob,original.blob);assert.equal(revised.contentSha256,original.contentSha256);assert.equal(revised.name,original.name);
  assert.equal(revised.metadataHistory.length,1);assert.equal(revised.metadataHistory[0].previous.shift,'1');assert.equal(original.shift,'1');
});
test('search and facility/date/shift/type filters select without aggregating',()=>{
  const file=new File(['x'],'shift report.pdf');const first=core.stageFile([],file,labels,fingerprint,'now').record;
  const second={...first,site:'maywood',reportDate:'2026-10-05',shift:'M-C',reportKind:'packaging'};
  assert.equal(core.select([first,second],{site:'maywood',shift:'M-C',reportKind:'packaging',from:'2026-10-05',to:'2026-10-05',search:'shift report'}).length,1);
  assert.equal(core.select([first,{...second,shift:''}],{shift:'__unknown'}).length,1);
});
test('older archived source files remain visible and retrievable',()=>{
  const old={id:1,category:'dataupload-source',name:'old.pdf',site:'la26',blob:new Blob(['original'])};
  assert.equal(core.select([old]).length,1);assert.equal(core.isArchive(old),true);
  const updated=core.editMetadata(old,labels,'now');assert.equal(updated.blob,old.blob);
});
function harness(){
  const records=new Map(),writes=[],stores=[],controller={failName:null};let next=1;
  const db={transaction(name,mode){
    assert.equal(name,'files','Archive must never access a metric store');stores.push([name,mode]);
    const transaction={error:null,aborted:false,pending:0,abort(){this.aborted=true;this.onabort?.();}};
    const request=operation=>{const req={};transaction.pending++;setTimeout(()=>{
      if(transaction.aborted)return;
      try{req.result=operation();req.onsuccess?.({target:req});}catch(error){transaction.error=error;transaction.onerror?.();}
      transaction.pending--;if(!transaction.pending&&!transaction.aborted)setTimeout(()=>transaction.oncomplete?.(),0);
    },0);return req;};
    transaction.objectStore=()=>({getAll:()=>request(()=>[...records.values()]),get:id=>request(()=>records.get(id)),add:record=>request(()=>{if(controller.failName===record.name)throw new Error('Storage quota test failure');const id=next++;records.set(id,{...record,id});writes.push('add');return id;}),put:record=>request(()=>{records.set(record.id,record);writes.push('put');return record.id;})});
    return transaction;
  }};
  const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,querySelectorAll:()=>[],addEventListener(){},focus(){}});return elements.get(id);};
  Object.entries({archiveFacility:'la26',archiveReportDate:'2026-10-04',archiveShift:'1',archiveKind:'production',archiveNotes:''}).forEach(([id,value])=>element(id).value=value);
  const metrics={batches:47,open:12,cost:55};
  const context={window:{},document:{readyState:'loading',getElementById:element,addEventListener(){}},OpsArchiveCore:core,db,STORE:'files',openDB:async()=>{},getFile:async id=>records.get(id),currentSite:'all',SITE_NAMES:{la26:'26th'},crypto:webcrypto,File,Blob,TextDecoder,URL,setTimeout,clearTimeout,console,
    opsPut(){throw new Error('Archive attempted metric mutation');},renderDashboard(){throw new Error('Archive attempted dashboard update');}};
  vm.createContext(context);
  const source=fs.readFileSync(require.resolve('../assets/archive-ui.js'),'utf8').replace('window.archiveReportFiles=archiveReportFiles;','window.__testOriginal=original;window.__testEdit=editDetails;window.__testSave=saveDetails;window.__testCancel=cancelEdit;window.archiveReportFiles=archiveReportFiles;');
  vm.runInContext(source,context);return {context,records,writes,stores,elements,metrics,controller};
}
test('actual upload handler saves arbitrary originals only to files; metrics unchanged',async()=>{
  const h=harness();const before=JSON.stringify(h.metrics);
  const files=[new File(['%PDF-original'],'a.pdf',{type:'application/pdf'}),new File(['word bytes'],'b.docx'),new File(['batches,pallets\n999,999'],'c.csv'),new File(['<script>malicious()</script>'],'d.html')];
  await h.context.window.archiveReportFiles(files);
  assert.equal(h.records.size,4);assert.equal(JSON.stringify(h.metrics),before);
  assert.ok(h.stores.every(([name])=>name==='files'));
  for(const row of h.records.values()){const retrieved=await h.context.window.__testOriginal(row.id);assert.equal(await retrieved.blob.text(),await files.find(file=>file.name===row.name).text());}
  await h.context.window.archiveReportFiles(files);
  assert.equal(h.records.size,4);assert.equal(h.writes.length,4);assert.match(h.elements.get('archiveStatus').textContent,/Dashboard metrics were not changed/);
});
test('navigation-tab drops route to archive rather than the prior generic upload path',async()=>{
  const html=fs.readFileSync('index.html','utf8');const start=html.indexOf('async function handleFiles'),end=html.indexOf('document.querySelectorAll(".drop-target")',start);
  let called=0;const c={window:{archiveReportFiles:async()=>called++},addFile(){throw Error('Old upload path reached');},showPage(){},toast(){}};vm.createContext(c);vm.runInContext(html.slice(start,end),c);
  await c.handleFiles([new File(['x'],'x.csv')],'dataupload','dataupload');assert.equal(called,1);
});
test('repeated/interrupted label saves keep the original target and write once',async()=>{
  const h=harness();await h.context.window.archiveReportFiles([new File(['one'],'one.pdf'),new File(['two'],'two.pdf')]);
  await h.context.window.__testEdit(1);h.elements.get('archiveShift').value='2';
  let release;h.context.openDB=()=>new Promise(resolve=>{release=resolve;});
  const pending=h.context.window.__testSave();
  assert.equal(h.elements.get('archiveSaveDetails').disabled,true);assert.equal(h.elements.get('archiveCancelEdit').disabled,true);
  await h.context.window.__testEdit(2);h.context.window.__testCancel();await h.context.window.__testSave();
  h.context.openDB=async()=>{};release();await pending;
  assert.equal(h.records.get(1).shift,'2');assert.equal(h.records.get(2).shift,'1');
  assert.equal(h.records.get(1).metadataHistory.length,1);assert.equal(h.writes.filter(value=>value==='put').length,1);
  assert.equal(h.elements.get('archiveSaveDetails').hidden,true);
});
test('partial batch failure rerenders successfully saved originals',async()=>{
  const h=harness();h.controller.failName='fail.pdf';
  await h.context.window.archiveReportFiles([new File(['one'],'saved.pdf'),new File(['two'],'fail.pdf')]);
  assert.equal(h.records.size,1);assert.match(h.elements.get('archiveList').innerHTML,/saved\.pdf/);
  assert.match(h.elements.get('archiveStatus').textContent,/Archive incomplete/);assert.match(h.elements.get('archiveStatus').textContent,/1 file\(s\) saved/);
});
test('a pending catalog original is restored locally without replacing labels or duplicating rows',()=>{const file=new File(['original'],'renamed.pdf',{type:'application/pdf'});const old={id:'report-'+fingerprint,category:core.category,name:'source.pdf',site:'la26',reportDate:'2026-10-04',shift:'2',reportKind:'production',contentSha256:fingerprint,uploadPending:true};const result=core.stageFile([old],file,{site:'unassigned',shift:'',reportDate:'',reportKind:'other'},fingerprint,'now');assert.equal(result.status,'restored-local');assert.equal(result.record.id,old.id);assert.equal(result.record.blob,file);assert.equal(result.record.name,'source.pdf');assert.equal(result.record.shift,'2');assert.equal(result.record.uploadPending,false);assert.equal(old.blob,undefined);assert.equal(core.stageFile([result.record],file,old,fingerprint,'later').status,'duplicate');});
test('actual upload hydrates a pending catalog row and makes string-ID originals retrievable',async()=>{const h=harness(),file=new File(['%PDF-original'],'source.pdf',{type:'application/pdf'}),bytes=await file.arrayBuffer(),hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');const id='report-'+hash;h.context.window.OPS_SOURCE_SNAPSHOT={archive:[{id,category:core.category,name:'source.pdf',site:'la26',reportDate:'2026-10-04',shift:'1',reportKind:'production',contentSha256:hash,size:file.size,uploadPending:true}]};await h.context.window.archiveReportFiles([file]);assert.equal(h.records.size,1);assert.equal(h.records.get(id).blob,file);const restored=await h.context.window.__testOriginal(id);assert.equal(restored.id,id);assert.equal(await restored.blob.text(),'%PDF-original');assert.ok(h.stores.every(([name])=>name==='files'));});
