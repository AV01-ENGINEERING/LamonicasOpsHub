(function(){
 'use strict';
 function setup(){
  const header=document.querySelector('body > header');
  if(!header)return;
  const sync=()=>document.documentElement.style.setProperty('--ops-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  document.addEventListener?.('keydown',event=>{
   const drawer=['settingsDrawer','shiftNotesDrawer'].map(id=>document.getElementById?.(id)).find(el=>el?.classList.contains('open'));
   if(!drawer)return;
   if(event.key==='Escape'){event.preventDefault();if(drawer.id==='settingsDrawer')closeSettings();else closeShiftNotes();}
   if(event.key==='Tab'){const items=[...drawer.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);if(!items.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||!drawer.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!drawer.contains(document.activeElement))){event.preventDefault();first.focus();}}
  });
  sync();
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(sync).observe(header);
  window.addEventListener('resize',sync);
  document.fonts?.ready?.then(sync);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
