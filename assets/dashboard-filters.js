(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpsDashboardFilters=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Choose a valid report date.');const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Choose a valid report date.');return d;}
  const iso=d=>d.toISOString().slice(0,10);
  function range(selection){const mode=selection.mode||'custom';let start,end;
    if(mode==='custom'){start=iso(date(selection.start));end=iso(date(selection.end));}
    else{const anchor=date(selection.date);start=new Date(anchor);end=new Date(anchor);
      if(mode==='week'){start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(end.getUTCDate()+6);}
      else if(mode==='month'){start.setUTCDate(1);end=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+1,0,12));}
      else if(mode!=='day')throw Error('Choose Day, Week, Month, or Date range.');
      start=iso(start);end=iso(end);
    }
    if(start>end)throw Error('Start date must be on or before end date.');return {mode,start,end,date:selection.date||end};
  }
  function includes(row,selected){const value=row.date||row.reportDate;return typeof value==='string'&&value>=selected.start&&value<=selected.end;}
  function records(rows,site,selected,sort='newest'){return rows.filter(row=>(site==='all'||(row.location||row.site)===site)&&includes(row,selected)).slice().sort((a,b)=>{
    const ad=a.date||a.reportDate,bd=b.date||b.reportDate;
    const byDate=ad.localeCompare(bd)*(sort==='oldest'?1:-1);
    const byShift=String(a.shift||'').localeCompare(String(b.shift||''),undefined,{numeric:true});
    const bySite=String(a.location||a.site||'').localeCompare(String(b.location||b.site||''));
    return sort==='shift'?byShift||byDate||bySite:byDate||bySite||byShift;
  });}
  function isVerified(source){const status=source.period.verificationStatus||source.period.validationStatus;return status==='verified'||String(status||'').startsWith('verified-local-calendar-days');}
  function maintenance(source,site,selected,adapter){
    const verified=isVerified(source),exact=selected.start===source.period.start&&selected.end===source.period.end;
    const dates=[];if(selected.start>=source.period.start&&selected.end<=source.period.end){for(let day=date(selected.start);iso(day)<=selected.end;day.setUTCDate(day.getUTCDate()+1))dates.push(iso(day));}
    const chosen=(source.facilities||[]).filter(r=>site==='all'||r.id===site);
    const covered=verified&&dates.length>0&&chosen.length>0&&chosen.every(r=>dates.every(d=>r.dailyCoverage?.dates?.includes(d)&&r.dailyMetrics?.some(v=>v.date===d)));
    let scoped=source;
    if(!exact&&covered){const sum=(rows,get)=>rows.every(r=>get(r)!=null)?rows.reduce((n,r)=>n+Number(get(r)),0):null;scoped={...source,facilities:source.facilities.map(row=>{const days=(row.dailyMetrics||[]).filter(r=>dates.includes(r.date)),allowed=row.dailyCoverage?.verifiedMetricNames||[];const periodMetrics={};for(const key of Object.keys(row.periodMetrics||{}))periodMetrics[key]=allowed.includes(key)?sum(days,r=>r[key]):null;const cost={...row.recordedCostOfCompletedWorkOrders};for(const key of ['total','labor','parts','other'])cost[key]=allowed.includes('recordedCostOfCompletedWorkOrders')?sum(days,r=>r.recordedCostOfCompletedWorkOrders?.[key]):null;return {...row,periodMetrics,recordedCostOfCompletedWorkOrders:cost,assetReport:{...row.assetReport,totalCost:null,totalDowntimeHours:null,plannedDowntimeHours:null,unplannedDowntimeHours:null,assetCosts:[]}};})};}
    const result=adapter(scoped,site),available=verified&&(exact||covered);
    if(!available){for(const key of ['created','completed','cost','totalDowntime','plannedDowntime','unplannedDowntime','completedOnTime','completedOverdue','completedNoDue','laborHours','completedReactive','completedPreventive'])result[key]=null;result.assetImpactRows=[];}
    return {...result,periodAvailable:available,period:source.period,backlogAsOf:source.observedAt,hasPartialDay:chosen.some(row=>(row.dailyMetrics||[]).some(day=>day.isPartialDay&&day.date>=selected.start&&day.date<=selected.end)),dailyCoverageAvailable:covered};
  }
  return {range,includes,records,maintenance,isVerified};
});
