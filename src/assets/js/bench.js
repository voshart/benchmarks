(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const UI={range:$('historyRange'),date:$('historyDate'),status:$('historyStatus'),coverage:$('coverage'),access:$('access'),search:$('modelSearch'),head:$('matrixHead'),body:$('matrixBody')};
 let data=null, view='all',changeTimer=null;
 const start='2025-10-13',end='2026-10-13';
 const isoDay=s=>Math.round((Date.parse(s+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/864e5);
 const dayIso=day=>new Date(Date.parse(start+'T00:00:00Z')+day*864e5).toISOString().slice(0,10);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=(v,r)=>!r||r[0]==null?0:r[0]===r[1]?1:Math.max(0,Math.min(1,(v-r[0])/(r[1]-r[0])));
 const fmt=(v,u)=>v==null?'—':u==='ratio'?v.toFixed(3):v.toFixed(1);
 function render(){if(!data)return;const date=dayIso(Number(UI.range.value));const result=BenchmarkRank.build(data,date,{min:UI.coverage.value,access:UI.access.value,query:UI.search.value,view});
  UI.date.textContent=date;UI.status.textContent=`${result.rows.length} models · ${result.matureCount} mature benchmark families`;
  UI.head.innerHTML='<th scope="col">Model</th><th scope="col">Rank index</th>'+result.columns.map(t=>`<th title="${esc(t.label)}">${esc(t.short)}</th>`).join('')+'<th>$/1k pages</th>';
  UI.body.innerHTML=result.rows.map(r=>'<tr><th scope="row" title="'+esc(r.name)+'">'+esc(r.name)+'</th><td class="index">'+fmt(r.rank)+'</td>'+result.columns.map(t=>{const o=r.scores[t.id],v=o?.value;const shade=v==null?0:pct(v,result.ranges[t.id]);const qualified=o&&['author_reported','vendor_internal','secondary','vendor_comparison','assumed'].includes(o.evidence);const source=o?data.sources[o.source_id]:null;const tooltip=source?`${source.title}; ${o.evidence}; ${o.note||source.note}`:'No comparable result';return `<td class="score" style="--shade:${(shade*30).toFixed(1)}%" title="${esc(tooltip)}">${fmt(v,t.unit)}${qualified?(o.evidence==='assumed'?'<sup>*</sup>':'<sup>†</sup>'):''}</td>`;}).join('')+`<td class="price" title="${esc(r.price!=null?data.pricingByModel[r.id]?.basis:'No comparable page price')}">${r.price!=null?'$'+r.price.toFixed(2):'—'}</td></tr>`).join('');
 }
 function setView(v){view=v;document.querySelectorAll('.views button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('matrixPanel').hidden=v==='price';$('pricingPanel').hidden=v!=='price';if(v!=='price')render();}
 function snap(){if(!data)return;const dates=[0,Number(UI.range.max),...data.models.map(m=>m.release_date?isoDay(m.release_date):null).filter(x=>x!=null&&x>=0&&x<=Number(UI.range.max))];const current=Number(UI.range.value);UI.range.value=dates.reduce((a,b)=>Math.abs(current-a)<=Math.abs(current-b)?a:b,dates[0]);render();}
 $('themeToggle').addEventListener('click',()=>{const d=document.documentElement;d.dataset.theme=d.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('bench-theme',d.dataset.theme)}catch(e){}});
 document.querySelectorAll('.views button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 [UI.coverage,UI.access].forEach(el=>el.addEventListener('change',render));UI.search.addEventListener('input',()=>{clearTimeout(changeTimer);changeTimer=setTimeout(render,100)});
 UI.range.max=isoDay(end);UI.range.value=UI.range.max;$('rangeStart').textContent=start;$('rangeEnd').textContent=end;
 UI.range.addEventListener('input',render);UI.range.addEventListener('change',snap);
 $('historyLatest').addEventListener('click',()=>{UI.range.value=UI.range.max;render()});
 fetch('/ocr/data.json').then(x=>{if(!x.ok)throw Error('HTTP '+x.status);return x.json()}).then(x=>{data=x;render()}).catch(err=>{UI.status.textContent='Static snapshot available · interactive filters unavailable';console.warn('OCR data load',err)});
})();
