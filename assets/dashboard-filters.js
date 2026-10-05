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
  function maintenance(source,site,selected,adapter){const result=adapter(source,site);const exact=selected.start===source.period.start&&selected.end===source.period.end&&(source.period.verificationStatus||source.period.validationStatus)==='verified';
    if(!exact){for(const key of ['created','completed','cost','totalDowntime','plannedDowntime','unplannedDowntime','completedOnTime','completedOverdue','completedNoDue','laborHours','completedReactive','completedPreventive'])result[key]=null;result.assetImpactRows=[];}
    return {...result,periodAvailable:exact,period:source.period,backlogAsOf:source.observedAt};
  }
  return {range,includes,records,maintenance};
});
