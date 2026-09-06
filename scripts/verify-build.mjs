import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root=resolve(import.meta.dirname,"..");
const html=readFileSync(resolve(root,"index.html"),"utf8");
const css=readFileSync(resolve(root,"assets/app.css"),"utf8");
const jsPath=resolve(root,"assets/app.js");
const js=readFileSync(jsPath,"utf8");
const failures=[];

function expect(condition,message){
  if(!condition)failures.push(message);
}

expect(html.includes('href="assets/app.css"'),"index.html must load assets/app.css");
expect(html.includes('src="assets/app.js"'),"index.html must load assets/app.js");
expect(css.includes("Premium foundation"),"premium design foundation is missing");
expect(html.includes('id="connectionState"'),"honest connection state is missing");
expect(html.includes('id="startup"'),"startup lifecycle surface is missing");

const requiredLocations=["all","indiana","la26","maywood","newyork","sacramento"];
for(const location of requiredLocations){
  expect(html.includes(`value="${location}"`),`global location option is missing: ${location}`);
}

const requiredLogic=[
  "calculateKPIs",
  "calculateProduction",
  "analyzeOpsImport",
  "renderImportPreview",
  "commitOpsImport",
  "undoLastOpsAction",
  "parseClickMaintCopiedAssetReport"
];
for(const name of requiredLogic){
  expect(js.includes(`function ${name}`),`business-critical function is missing: ${name}`);
}

const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
expect(duplicateIds.length===0,`duplicate element IDs: ${duplicateIds.join(", ")}`);

const syntax=spawnSync(process.execPath,["--check",jsPath],{encoding:"utf8"});
expect(syntax.status===0,`JavaScript syntax check failed: ${syntax.stderr.trim()}`);

if(failures.length){
  console.error(failures.map(item=>`FAIL: ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Verified ${ids.length} unique element IDs, ${requiredLocations.length} locations, and ${requiredLogic.length} critical workflows.`);
