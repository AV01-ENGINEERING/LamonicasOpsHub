const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
const block=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function context(values={}){const c={...values};vm.createContext(c);return c;}
test('historical site seeds never overwrite any saved summary',async()=>{
  for(const saved of [{site:'sacramento',data:{workOrders:1234}},{site:'newyork',data:{}},{site:'sacramento',data:{seedBatch:'older-version'}}]){
    const writes=[];const c=context({ensureOpsDbReady:async()=>{},opsGet:async()=>saved,opsPut:async(_,row)=>writes.push(row),OPS_STORES:{summaries:'summaries'}});
    vm.runInContext(block('async function seedPersistentSiteSummary','function seedShiftNotes'),c);
    await c.seedPersistentSiteSummary(saved.site,{workOrders:709},['workOrders'],'seed');
    assert.equal(writes.length,0);
  }
});
test('missing legacy values stay unknown and reported zero remains zero',()=>{
  const c=context({opsNumber:value=>value==null||value===''?null:Number(String(value).replace(/[$,]/g,''))});
  vm.runInContext(block('function legacyToKpi','function calculateRecordKpis'),c);
  const missing=c.legacyToKpi('la26',{workOrders:10});
  assert.equal(missing.overdue,null);assert.equal(missing.unassigned,null);
  const zero=c.legacyToKpi('la26',{workOrders:0,overdue:0,avgAge:0});
  assert.equal(zero.total,0);assert.equal(zero.overdue,0);assert.equal(zero.avgAge,0);
});
test('multi-facility totals do not present unknown sites as zero',()=>{
  const c=context();vm.runInContext(block('function combineKpis','function calculateRecordKpis'),c);
  const result=c.combineKpis([{source:'records',total:10,overdue:2,reactive:5},{source:'records',total:null,overdue:null,reactive:null}]);
  assert.equal(result.total,null);assert.equal(result.overdue,null);assert.equal(result.reactive,null);
  assert.equal(c.combineKpis([{total:0},{total:0}]).total,0);
});
test('period with no accepted records is unknown, not fabricated zero activity',async()=>{
  const c=context({opsGetAll:async()=>[],OPS_STORES:{workOrders:'workOrders'},opsRange:()=>({}),currentSite:'la26',calculateRecordKpis:()=>null,applyMetricResetsToKpi:value=>value});
  vm.runInContext(block('function combineKpis','function calculateRecordKpis'),c);
  vm.runInContext(block('async function calculateKPIs','async function calculateProduction'),c);
  const result=await c.calculateKPIs({period:'Daily',date:'2026-10-05'});
  assert.equal(result.total,null);assert.equal(result.completed,null);assert.equal(result.overdue,null);
});
test('maintenance source note exists visibly in KPI markup',()=>{
  assert.equal([...source.matchAll(/id="kpiDataSourceNote"/g)].length,1);
  assert.match(source,/Historical legacy summary; not live/);
});
test('unknown metric percentages are not rendered as zero percent',()=>{
  const c=context();vm.runInContext(block('function opsPercent','function opsDateString'),c);
  assert.equal(c.opsPercent(null,10),'—');assert.equal(c.opsPercent(1,null),'—');
  assert.equal(c.opsPercent(0,10),'0%');assert.equal(c.opsPercent(2,10),'20%');assert.equal(c.opsPercent(0,0),'—');
});
test('uncovered YTD facility remains unknown in all-location totals',async()=>{
  const c=context({opsGetAll:async()=>[],OPS_STORES:{workOrders:'workOrders'},opsRange:()=>({}),currentSite:'all',KPI_SITES:['la26','newyork'],calculateRecordKpis:()=>null,storedSummaryFor:async()=>null,legacySummaryFor:site=>site==='la26'?{workOrders:10}:null,opsNumber:value=>value==null?null:Number(value),applyMetricResetsToKpi:value=>value});
  vm.runInContext(block('function importedSummaryFields','function calculateRecordKpis'),c);
  vm.runInContext(block('async function calculateKPIs','async function calculateProduction'),c);
  const result=await c.calculateKPIs({period:'YTD',date:'2026-10-05'});
  assert.equal(result.total,null);
});
test('a partial summary does not fabricate unrelated zero metrics',()=>{
  const c=context({opsNumber:value=>value==null?null:Number(value)});
  vm.runInContext(block('function importedSummaryFields','function legacyToKpi'),c);
  const result=c.mergeImportedSummaryIntoKpi(null,{cost:25,importedFields:['cost']},'la26');
  assert.equal(result.cost,25);assert.equal(result.total,null);assert.equal(result.overdue,null);assert.equal(result.pending,null);
});
