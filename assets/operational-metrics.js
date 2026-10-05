(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpsOperationalMetrics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function select(rows,site,range){return rows.filter(r=>(site==='all'||r.location===site)&&r.date>=range.start&&r.date<=range.end);}
 function summarize(data,site,range){const rows=select(data.reconciled,site,range);const metric=name=>{const cells=rows.filter(r=>r.metric===name),known=cells.filter(r=>r.status==='nonconflicting_reported_header'&&r.value!=null);return {value:known.length?known.reduce((s,r)=>s+r.value,0):null,known:known.length,conflicts:cells.filter(r=>r.status==='unresolved').length,missing:cells.filter(r=>r.status==='not_reported').length};};return {batches:metric('batches'),packed:metric('palletsPacked'),cells:rows,observations:select(data.observations,site,range),palletsMade:null,palletsShipped:null};}
 return {summarize,select};
});
