const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function renderPurchasing(){'),html.indexOf('\nfunction renderReceivingQueue(){'));
test('purchasing startup and site changes tolerate absent optional home counters',()=>{
 const counters=Object.fromEntries(['receivedCount','waitingInvoiceCount','readyToPayCount','holdCount','paidCount'].map(id=>[id,{textContent:null}]));let rendered=0;
 const context={document:{getElementById:id=>counters[id]||null},siteFilteredOrders:()=>[{status:'Received'},{status:'On Hold'}],renderReceivingQueue:()=>rendered++};vm.createContext(context);vm.runInContext(source,context);
 assert.doesNotThrow(()=>context.renderPurchasing());assert.equal(counters.receivedCount.textContent,1);assert.equal(counters.holdCount.textContent,1);assert.equal(rendered,1);
 counters.homeReceived={textContent:null};context.renderPurchasing();assert.equal(counters.homeReceived.textContent,1);assert.equal(rendered,2);
});
