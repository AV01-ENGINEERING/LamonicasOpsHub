(function(){
  'use strict';
  const data=window.OPS_SOURCE_SNAPSHOT;
  const esc=value=>escapeHTML(String(value??''));
  const fmt=value=>value==null?'—':Number(value).toLocaleString();
  const money=value=>value==null?'—':'$'+Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const previewDate='2026-10-05';
  opsCurrentFilter=()=>({period:'Oct 1–5 verified source window',date:previewDate});
  calculateKPIs=async()=>OpsCurrentPreview.maintenance(data.clickmaint,currentSite);
  calculateProduction=async()=>OpsCurrentPreview.production(data.production.records,currentSite);
  effectiveSummaryFor=async()=>null;
  function label(id,text){const number=document.getElementById(id);const target=number?.closest('.metric-card,.kpi-card')?.querySelector('.metric-label');if(target)target.textContent=text;}
  function sourceDetails(kpi){
    const issues=[];
    if(currentSite==='all'||currentSite==='la26')issues.push('LA 26th: selected Created vs Completed report gives 136 completed; History by Status gives 142. The difference is unresolved; the 136 source is used here.');
    if(currentSite==='all'||currentSite==='maywood')issues.push('Maywood: Backlog by Status gives 48 overdue; assignee overview gives 49. The 48 status-report count is used here. Asset downtime detail is 117.9h; overview is 117.97h.');
    const extra=kpi.facilities.map(row=>`<li><b>${esc(row.sourceLabel)}:</b> completed ${fmt(row.periodMetrics.completedReactive)} reactive / ${fmt(row.periodMetrics.completedPreventive)} preventive in the selected window. Asset-linked recorded cost ${money(row.assetReport.totalCost)} is a separate report scope.</li>`).join('');
    document.getElementById('previewMaintenanceNotes').innerHTML=`<strong>The Total Work Orders / Open / Overdue / Reactive / Preventive cards show the current active backlog; Created / Completed show period activity.</strong><p>Created/completed, recorded labor, asset downtime and completed-WO cost use ClickMaint’s selected Oct 1–5 dates. Backlog/open/overdue/unassigned are an all-age snapshot captured October 5 at 15:01 UTC. Exact source timezone and timestamp inclusivity were not shown.</p><p><b>Cost:</b> recorded costs of work orders completed in this window, including older work orders; not October spending. The source shows $, but its ISO currency code was not verified. A reported 0 means zero recorded, not proof that no expense, labor or downtime occurred.</p>${issues.length?`<ul>${issues.map(value=>`<li>${esc(value)}</li>`).join('')}</ul>`:''}<details><summary>Source details and completion types</summary><ul>${extra}</ul><p>Assignee rows overlap and must not be summed. Missing assignee fields and pending requests remain unknown. Daily/weekly breakdowns and older backlog snapshots were not supplied, so they are not reconstructed.</p><p><a href="https://app.clickmaint.com/reporting/created_completed" target="_blank" rel="noopener">Created / completed source</a> · <a href="https://app.clickmaint.com/reporting/backlog_by_status" target="_blank" rel="noopener">Backlog source</a> · <a href="https://app.clickmaint.com/reporting/history_by_costs" target="_blank" rel="noopener">Recorded cost source</a></p></details>`;
  }
  function productionDetails(production){
    const selected=production.records;
    const sourceRows=selected.map(row=>`<tr><td>${esc(SITE_NAMES[row.location]||row.location)}</td><td>${esc(row.date)}</td><td>${esc(row.shift)}</td><td>${fmt(row.batches)}</td><td>${esc(row.sourceEntryPath)}</td></tr>`).join('');
    const matrix=data.production.expectedTotals.perDay.filter(row=>currentSite==='all'||row.location===currentSite);
    const excluded=data.production.excludedRecords.filter(row=>currentSite==='all'||row.location===currentSite);
    document.getElementById('productionLiveDetails').innerHTML=`<p><b>Verified subset only, not total facility production.</b> ${selected.length} nonconflicting production reports contribute batches. Packaging counterparts, ambiguous report roles, unit conflicts, conflicting versions and September reports are excluded from these subtotals.</p><div class="table-scroll"><table class="backlog-table"><thead><tr><th>Facility</th><th>Report date</th><th>Partial batches</th><th>Eligible reports</th></tr></thead><tbody>${matrix.map(row=>`<tr><td>${esc(SITE_NAMES[row.location]||row.location)}</td><td>${esc(row.date)}</td><td>${fmt(row.batchesPartialSubtotal)}</td><td>${row.includedProductionReports}</td></tr>`).join('')||'<tr><td colspan="4">No provided production reports for this facility. Values are unknown, not zero.</td></tr>'}</tbody></table></div><details><summary>Included source reports (${selected.length})</summary><div class="table-scroll"><table class="backlog-table"><thead><tr><th>Facility</th><th>Date</th><th>Shift</th><th>Batches</th><th>Original source entry</th></tr></thead><tbody>${sourceRows}</tbody></table></div></details><details><summary>Excluded source reports (${excluded.length})</summary><ul>${excluded.map(row=>`<li><b>${esc(row.sourceEntryPath)}</b>: ${esc((row.reasons||[]).join('; '))}</li>`).join('')}</ul></details><details><summary>Pallet and inventory source notes</summary><p>All aggregate mixes, pallets made, pallets packed, inventory and shipped pallets remain unknown in this conservative preview. The original source’s packed/freezer values are retained below as individual observations; they are not added into production totals or summed across shifts.</p><ul>${selected.map(row=>`<li>${esc(row.sourceEntryPath)}: ${row.fieldEvidence.filter(field=>/pallet|freezer/i.test(field.label)).map(field=>`${esc(field.label)} = ${esc(field.rawValue)} (page ${field.page})`).join('; ')||'No eligible pallet observation'}</li>`).join('')}</ul></details>`;
  }
  renderDashboard=async function renderVerifiedDashboard(){
    const kpi=OpsCurrentPreview.maintenance(data.clickmaint,currentSite),production=OpsCurrentPreview.production(data.production.records,currentSite);
    const values={homeCompleted:kpi.completed,homeOverdue:null,homeDowntime:opsHours(kpi.totalDowntime),kpiBacklog:kpi.total,kpiCreated:kpi.created,homeCompletedKPI:kpi.completed,kpiOpen:kpi.open,kpiOverdue:kpi.overdue,kpiOverduePct:opsPercent(kpi.overdue,kpi.total),kpiReactive:kpi.reactive,kpiReactivePct:opsPercent(kpi.reactive,kpi.total),kpiPreventive:kpi.preventive,kpiPreventivePct:opsPercent(kpi.preventive,kpi.total),opsUnassigned:kpi.unassigned,opsAge:kpi.avgAge==null?'—':kpi.avgAge.toFixed(2)+' days',kpiPending:null,kpiTotalDowntime:opsHours(kpi.totalDowntime),kpiCost:money(kpi.cost),kpiCompletedOnTime:kpi.completedOnTime,kpiCompletedOverdue:kpi.completedOverdue,kpiCompletedNoDue:kpi.completedNoDue,kpiLaborHours:opsHours(kpi.laborHours),homeBatches:production.batches==null?'—':fmt(production.batches)+' (partial)',homePallets:'—',prodKpiBatches:production.batches==null?'—':fmt(production.batches)+' (partial)',prodKpiMixes:'—',prodKpiPallets:'—',prodKpiStaffing:'—',prodKpiDoughWaste:'—',prodKpiPlasticWaste:'—'};
    Object.entries(values).forEach(([id,value])=>opsText(id,value));
    opsText('kpiDataSourceNote','Verified source snapshot: ClickMaint custom dates Oct 1–5, 2026 · captured Oct 5, 15:01 UTC · selected-source conflicts flagged below · daily refresh not enabled');
    opsText('homeSnapshotLabel','Oct 1–5 verified source window');opsText('homeCompletedSub','Completed in selected Oct 1–5 source window');
    opsText('productionCoverage',`${production.records.length} verified production reports in the selected facility view; all batch subtotals are partial. No eligible October 5 production source. Older reports remain separate in the catalog.`);
    const body=document.getElementById('backlogRows');if(body)body.innerHTML=kpi.backlogRows.map(row=>`<tr><td>${esc(row.name)}</td><td>${fmt(row.active)}</td><td>${fmt(row.overdue)}</td><td>—</td><td>—</td><td>—</td></tr>`).join('');
    const assets=document.getElementById('assetImpactRows');if(assets)assets.innerHTML=kpi.assetImpactRows.length?kpi.assetImpactRows.map(row=>`<tr><td>${esc(row.name)}</td><td>—</td><td>${money(row.cost)}</td><td>${esc(row.area)}</td></tr>`).join(''):'<tr><td colspan="4">No asset-level impact rows supplied for this facility. Unknown detail is not zero.</td></tr>';
    sourceDetails(kpi);productionDetails(production);renderClickMaintReportDetails(null);applyKpiMetricVisibility();
  };
  window.updateDashboardForSite=renderDashboard;
  function setupVerifiedPreview(){
    document.querySelectorAll('[data-reset-kpi],[data-reset-home]').forEach(button=>{button.disabled=true;button.title='This verified snapshot is read-only.';});
    const undo=document.getElementById('undoLastActionBtn');if(undo){undo.disabled=true;undo.title='Read-only verified snapshot.';}
    renderDashboard().catch(console.error);

  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupVerifiedPreview);else setupVerifiedPreview();
})();
