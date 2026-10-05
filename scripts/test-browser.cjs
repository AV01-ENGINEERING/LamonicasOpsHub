const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    // Local data-path QA, never send operational data to external CDNs.
    await page.route('https://**/*',route=>route.abort());
    await page.goto('http://127.0.0.1:8765',{waitUntil:'load'});
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#homeBatches').innerText(),'—');
    await page.evaluate(async()=>{
      await opsPut(OPS_STORES.production,{key:'la26|2026-08-16|3rd',location:'la26',date:'2026-08-16',shift:'3rd',batches:999,pallets:24});
      await opsPut(OPS_STORES.production,{key:'maywood|2026-08-16|log',location:'maywood',date:'2026-08-16',shift:'log',recordType:'inventory-logistics',batches:null,pallets:null,inventoryPallets:111});
      opsSaveFilter('YTD','2026-10-05');await renderDashboard();
    });
    assert.equal(await page.locator('#homeBatches').innerText(),'999');
    assert.equal(await page.locator('#homePallets').innerText(),'24');
    await page.reload({waitUntil:'load'});await page.waitForTimeout(1800);
    assert.equal(await page.locator('#homeBatches').innerText(),'999');
    await page.selectOption('#siteSelector','maywood');await page.waitForTimeout(1500);
    assert.equal(await page.locator('#homeBatches').innerText(),'—');
    await page.selectOption('#siteSelector','la26');await page.waitForTimeout(1500);
    assert.equal(await page.locator('#homeBatches').innerText(),'999');
    await page.evaluate(async()=>{
      document.getElementById('archiveFacility').value='la26';
      document.getElementById('archiveReportDate').value='2026-10-04';
      document.getElementById('archiveShift').value='1';
      await archiveReportFiles([new File(['original test bytes'],'sample.docx')]);
    });
    assert.match(await page.locator('#archiveStatus').innerText(),/1 original\(s\) saved/);
    assert.equal(await page.locator('#homeBatches').innerText(),'999');
    assert.equal(await page.locator('#confirmImportBtn').count(),0);
    await page.reload({waitUntil:'load'});await page.waitForTimeout(1800);
    assert.match(await page.locator('#archiveList').innerText(),/sample.docx/);
    assert.equal(await page.locator('#homeBatches').innerText(),'999');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/lamonicas-patch.png'});
    console.log('Browser checks passed: initial unknown, corrected record, reload, facility switching, no inventory counting, archive persistence and metric isolation, no page errors. External CDN libraries were blocked in this test.');
  }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
