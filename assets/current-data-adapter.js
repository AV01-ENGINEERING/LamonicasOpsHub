(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpsCurrentPreview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const sum=(rows,get)=>rows.length&&rows.every(row=>get(row)!=null)?rows.reduce((total,row)=>total+Number(get(row)),0):null;
  function maintenance(data,site){
    const rows=data.facilities.filter(row=>site==='all'||row.id===site);
    const period=key=>sum(rows,row=>row.periodMetrics[key]);
    const backlog=key=>sum(rows,row=>row.currentBacklog[key]);
    return {source:'verified-private-preview',site,total:backlog('total'),created:period('created'),completed:period('completed'),open:backlog('openStatusCount'),overdue:backlog('overdue'),reactive:backlog('reactive'),preventive:backlog('preventive'),unassigned:backlog('unassigned'),pending:sum(rows,row=>row.pendingRequests),avgAge:rows.length===1?rows[0].currentBacklog.avgAgeDays:null,cost:sum(rows,row=>row.recordedCostOfCompletedWorkOrders.total),totalDowntime:sum(rows,row=>row.assetReport.totalDowntimeHours),plannedDowntime:sum(rows,row=>row.assetReport.plannedDowntimeHours),unplannedDowntime:sum(rows,row=>row.assetReport.unplannedDowntimeHours),completedOnTime:period('completedOnTime'),completedOverdue:period('completedOverdue'),completedNoDue:period('completedNoDueDate'),laborHours:period('laborHours'),completedReactive:period('completedReactive'),completedPreventive:period('completedPreventive'),backlogRows:rows.flatMap(row=>(row.currentBacklog.assignees||[]).map(person=>({...person,name:site==='all'?`${row.sourceLabel} · ${person.name}`:person.name,onTime:person.onTime??null,reactive:person.reactive??null,preventive:person.preventive??null}))),assetImpactRows:rows.flatMap(row=>(row.assetReport.assetCosts||[]).map(asset=>({...asset,downtime:null,area:row.sourceLabel}))),facilities:rows};
  }
  function production(records,site){
    const selected=records.filter(row=>site==='all'||row.location===site);
    const produced=selected.filter(row=>row.recordType==='production');
    const packaging=selected.filter(row=>row.recordType==='packaging');
    const metric=(rows,key)=>{const known=rows.filter(row=>row[key]!=null);return {value:known.length?known.reduce((total,row)=>total+Number(row[key]),0):null,known:known.length,missing:rows.length-known.length,partial:rows.length!==known.length};};
    const metrics={batches:metric(produced,'batches'),mixes:metric(produced,'mixes'),pallets:metric(produced,'palletsProduced'),packed:metric(packaging,'palletsPacked')};
    metrics.batches.partial=true;
    for(const key of ['totalEmployees','doughWasteLbs','plasticWasteLbs'])metrics[key]={value:null,known:0,missing:produced.length,partial:true};
    return {records:selected,metrics,batches:metrics.batches.value,mixes:metrics.mixes.value,pallets:metrics.pallets.value,packagingPallets:metrics.packed.value,rejected:[],coverage:{earliest:selected.map(row=>row.date).sort()[0]||null,latest:selected.map(row=>row.date).sort().at(-1)||null,status:'partial-provided-set',asOfDate:'2026-10-05'}};
  }
  return {maintenance,production};
});
