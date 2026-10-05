const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
let inline=0;
for(const [,attrs,body]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(!body.trim()||/type="application\//.test(attrs))continue;
  new vm.Script(body);inline++;
}
new vm.Script(fs.readFileSync('assets/data-core.js','utf8'));
assert.ok(html.indexOf('src="assets/data-core.js"')<html.indexOf('function calculateProduction'));
for(const id of ['siteSelector','homeBatches','homePallets','productionCoverage','productionImportFile']){
  assert.equal([...html.matchAll(new RegExp(`id="${id}"`,'g'))].length,1,`${id} must occur exactly once`);
}
for(const name of ['calculateKPIs','calculateProduction','analyzeOpsImport','commitOpsImport','undoLastOpsAction'])assert.ok(html.includes(`function ${name}`));
for(const old of ['function finalProductionHome','function forceLiveProductionKPIs','function applyAuthoritativeProductionOverall','seedHardcodedProduction'])assert.ok(!html.includes(old));
console.log(`Verified ${inline} inline scripts, data-core syntax, required metric elements/workflows and removal of historical overrides.`);
