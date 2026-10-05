/* Pure normalization/staging contracts. No network, credentials or automatic writes. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OpsDataCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const sites=new Set(['indiana','la26','maywood','newyork','sacramento']);
  const outputFields=['batches','mixes','pallets'];
  function date(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Expected a report date in YYYY-MM-DD format');
    const parsed=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new Error('Invalid report date');
    return value;
  }
  function quantity(value){
    if(value==null||value==='')return null;
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Quantity must be a non-negative number or unknown');
    return value;
  }
  function isHistorical(record){return record.source==='Temporary live production baseline'||record.sourceKind==='historical-fixture';}
  function canonicalShift(value){
    const shift=String(value||'').trim();
    const match=shift.match(/^(?:shift\s*)?(1(?:st)?|2(?:nd)?|3(?:rd)?)(?:\s*shift)?$/i);
    return match?String(parseInt(match[1],10)):shift;
  }
  function normalizeProduction(input){
    if(!sites.has(input.location))throw new Error('Unknown facility');
    const reportDate=date(input.date),shift=canonicalShift(input.shift);
    if(!shift)throw new Error('Missing shift');
    const record={...input,date:reportDate,shift,key:`${input.location}|${reportDate}|${shift}`};
    outputFields.forEach(field=>{record[field]=quantity(input[field]);});
    if(record.recordType==='inventory-logistics'&&outputFields.some(field=>record[field]>0))throw new Error('Inventory/logistics cannot be classified as production output');
    return record;
  }
  function metric(records,field){
    const values=records.map(record=>record[field]).filter(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0);
    const known=values.length,missing=records.length-known;
    return {value:known?values.reduce((sum,value)=>sum+value,0):null,known,missing,partial:missing>0};
  }
  function aggregateProduction(records){
    const rows=records.filter(record=>!isHistorical(record)&&record.recordType!=='inventory-logistics');
    const metrics={};
    [...outputFields,'totalEmployees','doughWasteLbs','plasticWasteLbs'].forEach(field=>{metrics[field]=metric(rows,field);});
    return {records,metrics,batches:metrics.batches.value,mixes:metrics.mixes.value,pallets:metrics.pallets.value};
  }
  function coverage(records,asOfDate){
    date(asOfDate);
    const dates=records.filter(record=>!isHistorical(record)).map(record=>date(record.date)).sort();
    const latest=dates.at(-1)||null;
    return {earliest:dates[0]||null,latest,asOfDate,status:!latest?'empty':latest<asOfDate?'historical':latest>asOfDate?'future':'reported-through-date'};
  }
  function stageRevision(existing,incoming){
    const record=normalizeProduction(incoming);
    const source=record.provenance;
    if(!source?.contentHash||!source?.sourceId)return {status:'review',reason:'Source identity and content hash required',record};
    const keyOf=row=>normalizeProduction(row).key;
    const duplicate=existing.find(row=>keyOf(row)===record.key&&row.provenance?.contentHash===source.contentHash);
    if(duplicate)return {status:'duplicate',record:duplicate};
    const matches=existing.filter(row=>keyOf(row)===record.key&&!isHistorical(row));
    if(matches.length>1)return {status:"review",reason:"Multiple saved records identify this shift",record};
    const previous=matches[0];
    return {status:previous?'revision-review':'staged',record,previous:previous||null};
  }
  function stageWordAttachment(metadata){
    const filename=String(metadata.filename||'');
    if(!/\.(docx|doc)$/i.test(filename))throw new Error('Expected a Word attachment');
    return {status:'awaiting-template-review',format:/\.docx$/i.test(filename)?'docx':'doc',metadata:{...metadata},records:[],reason:'An approved sample and field mapping are required. No quantities were inferred.'};
  }
  function normalizeClickMaint(input,entityId){
    if(!entityId||!input.id||!sites.has(input.location))throw new Error('ClickMaint entity, source work-order ID and facility are required');
    // This accepts a mapped record, not an unverified vendor response schema.
    const record={...input,id:`${entityId}:${input.id}`,sourceId:String(input.id),entityId:String(entityId),sourceKind:'clickmaint'};
    ['createdDate','completedDate','dueDate'].forEach(field=>{record[field]=input[field]?date(input[field]):null;});
    ['downtimeHours','plannedDowntimeHours','unplannedDowntimeHours','laborHours','cost'].forEach(field=>{record[field]=quantity(input[field]);});
    return record;
  }
  return {date,quantity,isHistorical,canonicalShift,normalizeProduction,aggregateProduction,coverage,stageRevision,stageWordAttachment,normalizeClickMaint};
});
