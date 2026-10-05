/* Archive-only contracts. They never parse reports or update dashboard metrics. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpsArchiveCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const category='dataupload-archive';
  const sites=new Set(['la26','maywood','indiana','sacramento','newyork','unassigned']);
  const kinds=new Set(['production','packaging','maintenance','other']);
  const isArchive=record=>['dataupload-archive','dataupload-source','dataupload'].includes(record.category);
  function metadata(input){
    if(!sites.has(input.site))throw new Error('Choose a facility or Location not known.');
    const reportDate=String(input.reportDate||'').trim();
    if(reportDate){const d=new Date(reportDate+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==reportDate)throw new Error('Enter a valid report date, or leave it unknown.');}
    let shift=String(input.shift||'').trim();
    const ordinal=shift.match(/^(?:shift\s*)?(1(?:st)?|2(?:nd)?|3(?:rd)?)(?:\s*shift)?$/i);if(ordinal)shift=String(parseInt(ordinal[1],10));
    return {site:input.site,reportDate,shift,reportKind:kinds.has(input.reportKind)?input.reportKind:'other',notes:String(input.notes||'').trim()};
  }
  function sameLabels(a,b){return ['site','reportDate','shift','reportKind'].every(key=>(a[key]||'')===(b[key]||''));}
  function stageFile(existing,file,input,sha256,now){
    const labels=metadata(input);
    if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('File fingerprint is unavailable. Nothing was archived.');
    const old=existing.find(row=>isArchive(row)&&row.contentSha256===sha256);
    if(old)return {status:sameLabels(old,labels)?'duplicate':'metadata-review',record:old};
    return {status:'new',record:{...labels,category,name:String(file.name||'Original report'),type:String(file.type||'application/octet-stream'),size:file.size,blob:file,contentSha256:sha256,date:now,archivedAt:now,metadataHistory:[]}};
  }
  function editMetadata(record,input,now){
    if(!isArchive(record))throw new Error('This record is not in the report archive.');
    const labels=metadata(input);
    return {...record,...labels,category,metadataHistory:[...(record.metadataHistory||[]),{at:now,previous:{site:record.site,reportDate:record.reportDate||'',shift:record.shift||'',reportKind:record.reportKind||'other',notes:record.notes||''},next:labels}]};
  }
  function select(records,filters={}){
    const q=String(filters.search||'').toLowerCase().trim();
    return records.filter(isArchive)
      .filter(row=>!filters.site||filters.site==='all'||row.site===filters.site)
      .filter(row=>!filters.shift||(filters.shift==='__unknown'?!row.shift:String(row.shift||'')===filters.shift))
      .filter(row=>!filters.reportKind||row.reportKind===filters.reportKind)
      .filter(row=>!filters.from||(row.reportDate&&row.reportDate>=filters.from))
      .filter(row=>!filters.to||(row.reportDate&&row.reportDate<=filters.to))
      .filter(row=>!q||[row.name,row.notes,row.shift,row.reportDate,row.reportKind].join(' ').toLowerCase().includes(q))
      .sort((a,b)=>(a.site||'').localeCompare(b.site||'')||(b.reportDate||'').localeCompare(a.reportDate||'')||(a.shift||'').localeCompare(b.shift||'',undefined,{numeric:true})||(b.archivedAt||'').localeCompare(a.archivedAt||''));
  }
  return {category,isArchive,metadata,stageFile,editMetadata,select};
});
