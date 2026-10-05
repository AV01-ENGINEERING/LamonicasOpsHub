const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../assets/data-core.js');
const record=(extra={})=>core.normalizeProduction({location:'la26',date:'2026-10-04',shift:'1st',batches:40,pallets:10,...extra});
test('separate batches, mixes and production pallets from inventory and loads',()=>{
  const result=core.aggregateProduction([record(),record({shift:'2nd',batches:null,mixes:70,pallets:null}),record({shift:'log',recordType:'inventory-logistics',batches:null,pallets:null,inventoryPallets:111,shippedPallets:16})]);
  assert.equal(result.batches,40);assert.equal(result.mixes,70);assert.equal(result.pallets,10);
  assert.equal(result.metrics.batches.partial,true);assert.equal(result.metrics.pallets.missing,1);
});
test('unknown stays unknown, explicit zero remains zero',()=>{
  assert.equal(core.aggregateProduction([]).batches,null);
  assert.equal(core.aggregateProduction([record({batches:null,pallets:null})]).batches,null);
  assert.equal(core.aggregateProduction([record({batches:0,pallets:0})]).pallets,0);
});
test('invalid values and impossible dates are rejected',()=>{
  for(const batches of [-1,NaN,Infinity,'70'])assert.throws(()=>record({batches}));
  assert.throws(()=>record({date:'2026-02-30'}));
  assert.throws(()=>record({recordType:'inventory-logistics'}));
});
test('old browser-seeded fixtures are excluded without deleting them',()=>{
  const rows=[record({source:'Temporary live production baseline',batches:900}),record({shift:'2nd',batches:20})];
  assert.equal(core.aggregateProduction(rows).batches,20);assert.equal(rows.length,2);
});
test('duplicate attachments do not add output; corrections require review',()=>{
  const old=record({provenance:{sourceId:'email-A/attachment-1',contentHash:'hash-A'}});
  assert.equal(core.stageRevision([old],{...old,provenance:{sourceId:'forward/attachment-2',contentHash:'hash-A'}}).status,'duplicate');
  const next={...old,batches:41,provenance:{sourceId:'email-B/attachment-1',contentHash:'hash-B'}};
  assert.equal(core.stageRevision([old],next).status,'revision-review');
  assert.equal(old.batches,40);
  assert.equal(core.stageRevision([],record()).status,'review');
});
test('same attachment can contain different shift records',()=>{
  const old=record({provenance:{sourceId:'message/attachment',contentHash:'hash'}});
  assert.equal(core.stageRevision([old],{...old,shift:'2nd'}).status,'staged');
});
test('source coverage reports historical, empty and future without claiming completeness',()=>{
  assert.equal(core.coverage([record()],'2026-10-05').status,'historical');
  assert.equal(core.coverage([],'2026-10-05').status,'empty');
  assert.equal(core.coverage([record()],'2026-10-03').status,'future');
});
test('Word staging makes no inferred rows and preserves source metadata',()=>{
  const metadata={filename:'shift.docx',messageId:'m',attachmentId:'a',contentHash:'h'};
  const staged=core.stageWordAttachment(metadata);
  assert.equal(staged.status,'awaiting-template-review');assert.deepEqual(staged.records,[]);assert.deepEqual(staged.metadata,metadata);
  assert.equal(core.stageWordAttachment({filename:'shift.doc'}).format,'doc');
  assert.throws(()=>core.stageWordAttachment({filename:'run.exe'}));
});
test('mapped ClickMaint records namespace source IDs and retain unknown metrics',()=>{
  const a=core.normalizeClickMaint({id:'42',location:'la26',status:'Open'},'entity-A');
  const b=core.normalizeClickMaint({id:'42',location:'maywood'},'entity-B');
  assert.notEqual(a.id,b.id);assert.equal(a.cost,null);assert.equal(a.completedDate,null);
});
test('actual app calculator honors saved correction and selected facility',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const start=source.indexOf('async function calculateProduction(filters)');
  const end=source.indexOf('\nfunction productionMetricText',start);
  const context={OpsDataCore:core,OPS_STORES:{production:'production'},currentSite:'la26',opsRange:()=>({}),opsInRange:()=>true,
    opsGetAll:async()=>[record({batches:999,pallets:999}),record({shift:'old',source:'Temporary live production baseline',batches:95}),record({location:'maywood',batches:12})]};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  const result=await context.calculateProduction({date:'2026-10-05'});
  assert.equal(result.batches,999);assert.equal(result.pallets,999);assert.equal(result.records.length,1);
  assert.ok(!source.includes('function finalProductionHome'));
  assert.ok(!source.includes('function forceLiveProductionKPIs'));
  assert.ok(!source.includes('seedHardcodedProduction'));
});
test('actual structured importer keeps mixes separate and missing pallets unknown',()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const context={OpsDataCore:core,window:{}};vm.createContext(context);
  const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  vm.runInContext(block('function opsDateString','function opsCanonical'),context);
  vm.runInContext(block('function opsHeaderIndex','function clickMaintSummaryFromRows'),context);
  vm.runInContext(block('function opsProductionDate','const OPS_IMPORT_AREAS'),context);
  const parsed=context.parseProductionRows(['Location','Date','Shift','Mixes'],[['LA Maywood','10/04/2026','M-C','70']]);
  assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].mixes,70);
  assert.equal(parsed.records[0].batches,null);assert.equal(parsed.records[0].pallets,null);
  const invalid=context.parseProductionRows(['Location','Date','Shift','Batches','Pallets'],[['LA 26','2026-02-30','1st','10','2'],['LA 26','2026-10-04','1st','-1','2']]);
  assert.equal(invalid.records.length,0);assert.equal(invalid.rejected.length,2);
  const ambiguous=context.parseProductionRows(['Location','Date','Shift','Inventory pallets','Batches / Mixes'],[['LA Maywood','2026-10-04','M-C','111','140']]);
  assert.ok(ambiguous.fatal);assert.equal(ambiguous.records.length,0);
  const aliases=context.parseProductionRows(['location','date','shift','batches_of_dough','pallets_made'],[['LA 26','10/04/2026','1st','10','2']]);
  assert.equal(aliases.records.length,1);
  const rolled=context.parseProductionRows(['location','date','shift','batches'],[['LA 26','February 30, 2026','1st','10']]);
  assert.equal(rolled.records.length,0);assert.equal(rolled.rejected.length,1);
});
test('render formatting labels partial coverage and preserves known zero',()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const context={};vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function productionMetricText'),source.indexOf('function renderBacklog')),context);
  assert.equal(context.productionMetricText({value:null,partial:true}),'—');
  assert.equal(context.productionMetricText({value:0,partial:false}),'0');
  assert.equal(context.productionMetricText({value:10,partial:true}),'10 (partial)');
});
test('partial corrections preserve omitted output/details but explicit blanks clear',()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const context={OpsDataCore:core};vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function mergeProductionImport'),source.indexOf('async function previewAgainstStore')),context);
  const old=record({pallets:24,productLine:'sample line',totalEmployees:8});
  const incoming=record({batches:99,pallets:null,_providedFields:['key','location','date','shift','batches']});
  const merged=context.mergeProductionImport(old,incoming);
  assert.equal(merged.batches,99);assert.equal(merged.pallets,24);assert.equal(merged.totalEmployees,8);assert.equal(merged.productLine,'sample line');
  assert.equal(context.mergeProductionImport(old,{...incoming,_providedFields:[...incoming._providedFields,'pallets']}).pallets,null);
  const baseline={...old,source:'Temporary live production baseline'};
  const fresh=context.mergeProductionImport(baseline,incoming);
  assert.equal(fresh.pallets,null);assert.equal(fresh.source,undefined);assert.equal(fresh.totalEmployees,undefined);
});
test('manual correction uses merge and preserves richer production fields',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const values={productionLocation:'la26',productionDate:'2026-10-04',productionShift:'1st',productionBatches:'50',productionPallets:'12'};
  let saved;
  const context={OpsDataCore:core,window:{},document:{getElementById:id=>({value:values[id]})},opsNumber:Number,OPS_STORES:{production:'production',history:'history'},opsGetAll:async()=>[record({mixes:7,totalEmployees:8})],opsGet:async()=>record({mixes:7,totalEmployees:8}),opsPut:async(_,row)=>{saved=row;},opsAdd:async()=>{},opsCanonical:JSON.stringify,localStorage:{setItem(){}},opsText(){},renderDashboard:async()=>{},renderImportHistory:async()=>{},renderProductionHistory:async()=>{}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function mergeProductionImport'),source.indexOf('async function previewAgainstStore')),context);
  vm.runInContext(source.slice(source.indexOf('window.saveProductionEntry=async'),source.indexOf('window.renderProductionHistory=async')),context);
  await context.window.saveProductionEntry();
  assert.equal(saved.batches,50);assert.equal(saved.pallets,12);assert.equal(saved.mixes,7);assert.equal(saved.totalEmployees,8);
});
test('legacy empty quantities remain unknown during migration',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const saved=[];
  const context={OpsDataCore:core,OPS_STORES:{production:'production'},localStorage:{getItem:()=>JSON.stringify([{location:'la26',date:'2026-10-04',shift:'1st',batches:'',pallets:' '}])},opsLocation:value=>value,opsProductionDate:value=>core.date(value),opsGetAll:async()=>[],opsGet:async()=>null,opsPut:async(_,row)=>saved.push(row),console};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function migrateLegacyProduction'),source.indexOf('function updateOpsSubmitState')),context);
  await context.migrateLegacyProduction();
  assert.equal(saved.length,1);assert.equal(saved[0].batches,null);assert.equal(saved[0].pallets,null);assert.equal(saved[0].mixes,null);
});
test('only obvious numeric ordinal shifts canonicalize',()=>{
  for(const alias of ['1','1st','Shift 1','1st shift'])assert.equal(core.canonicalShift(alias),'1');
  assert.equal(core.canonicalShift('2nd'),'2');assert.equal(core.canonicalShift('3rd'),'3');
  for(const label of ['day','night','M-C','MC','1nd'])assert.equal(core.canonicalShift(label),label);
});
test('existing ordinal key is reused for correction, avoiding a second saved row',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const old={...record(),key:'la26|2026-10-04|1st',shift:'1st'};
  const context={OpsDataCore:core,opsImportArea:()=>({store:'production'}),opsGetAll:async()=>[old],opsCanonical:JSON.stringify};vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function mergeProductionImport'),source.indexOf('function stageOpsFile')),context);
  const preview=await context.previewAgainstStore('production',[record({shift:'1',batches:55})]);
  assert.equal(preview.added,0);assert.equal(preview.updated,1);assert.equal(preview.records[0].key,old.key);assert.equal(preview.records[0].shift,'1');
  context.opsGetAll=async()=>[old,record({shift:'1'})];
  await assert.rejects(()=>context.previewAgainstStore('production',[record()]),/Multiple saved records/);
});
test('ordinal collisions require review in files and are excluded from dashboard totals',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const context={OpsDataCore:core,window:{},OPS_STORES:{production:'production'},currentSite:'la26',opsRange:()=>({}),opsInRange:()=>true,opsGetAll:async()=>[{...record(),key:'la26|2026-10-04|1st',shift:'1st'},record({shift:'1'})]};vm.createContext(context);
  const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
  vm.runInContext(block('function opsDateString','function opsCanonical'),context);
  vm.runInContext(block('function opsHeaderIndex','function clickMaintSummaryFromRows'),context);
  vm.runInContext(block('function opsProductionDate','const OPS_IMPORT_AREAS'),context);
  const parsed=context.parseProductionRows(['location','date','shift','batches'],[['LA 26','2026-10-04','1st','40'],['LA 26','2026-10-04','1','41']]);
  assert.match(parsed.fatal,/Different shift labels/);assert.equal(parsed.records.length,0);
  vm.runInContext(block('async function calculateProduction','function productionMetricText'),context);
  const totals=await context.calculateProduction({date:'2026-10-05'});
  assert.equal(totals.batches,null);assert.equal(totals.rejected.length,1);
});
test('legacy migration never overwrites a saved canonical or ordinal correction',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  for(const [savedShift,legacyShift] of [['1','1st'],['1st','1'],['1st','Shift 1']]){
    const savedRow={...record({batches:999,pallets:99}),key:`la26|2026-10-04|${savedShift}`,shift:savedShift};
    const writes=[];
    const context={OpsDataCore:core,OPS_STORES:{production:'production'},localStorage:{getItem:()=>JSON.stringify([{location:'la26',date:'2026-10-04',shift:legacyShift,batches:10,pallets:2}])},opsLocation:value=>value,opsProductionDate:value=>core.date(value),opsGetAll:async()=>[savedRow],opsPut:async(_,row)=>writes.push(row),console};
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('async function migrateLegacyProduction'),source.indexOf('function updateOpsSubmitState')),context);
    await context.migrateLegacyProduction();
    await context.migrateLegacyProduction();
    assert.equal(writes.length,0,`${legacyShift} must not overwrite ${savedShift}`);assert.equal(savedRow.batches,999);
  }
});
test('conflicting legacy labels are held before any migration write',async()=>{
  const source=fs.readFileSync(process.env.OPS_APP_SOURCE||require.resolve('../assets/app.js'),'utf8');
  const writes=[];
  const base={location:'la26',date:'2026-10-04',batches:10,pallets:2};
  const context={OpsDataCore:core,OPS_STORES:{production:'production'},localStorage:{getItem:()=>JSON.stringify([{...base,shift:'1'},{...base,shift:'1st',batches:20}])},opsLocation:value=>value,opsProductionDate:value=>core.date(value),opsGetAll:async()=>[],opsPut:async(_,row)=>writes.push(row),console:{warn(){}}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function migrateLegacyProduction'),source.indexOf('function updateOpsSubmitState')),context);
  await context.migrateLegacyProduction();await context.migrateLegacyProduction();
  assert.equal(writes.length,0);
});
