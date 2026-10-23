/* Deployment evidence never enters the OCR quality cohorts or rank calculation. */
(function(root,make){
 const api=typeof module==='object'&&module.exports?make(require('./rank-ui.js'),require('./ranking.js')):make(root.BenchmarkRankUI,root.BenchmarkRank);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.OCRComparison=api;
})(globalThis,(RankUI,Rank)=>{
 const defaults={hourlyRate:1,inputTokens:1000,outputTokens:1000};
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2);
 const rangeFmt=v=>Number(v.toPrecision(2)).toString();
 const midpoint=e=>Math.sqrt(e.low)*Math.sqrt(e.high);
 const validEstimate=e=>e?.status==='assumed'&&e.confidence==='low'&&finite(e.low)&&e.low>0&&finite(e.high)&&e.high>=e.low;
 const validReference=r=>r?.status==='estimated'&&r.confidence==='low'&&finite(r.low)&&r.low>0&&finite(r.high)&&r.high>=r.low;
 const money=v=>'$'+(v<.01?v.toFixed(4):v.toFixed(2));
 const link=(data,id,label)=>data.sources[id]?`<a href="${esc(data.sources[id].url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`:esc(label);

 const observationLink=(data,observation,label)=>/^https?:\/\//.test(observation.source_url||'')?`<a href="${esc(observation.source_url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`:link(data,observation.source_id,label);
 const scoreFmt=(value,unit)=>String(Number(value.toFixed(unit==='percent'?2:4)));

 function assumptions(options={}){return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,finite(options[k])?Math.max(0,Math.min(k==='hourlyRate'?1e7:200000,options[k])):v]));}
 function deployment(data,model,options={}){
  const a=assumptions(options),records=(data.throughput||[]).filter(r=>r.model===model.id);
  const speed=records.filter(r=>r.comparison_default===true&&r.unit==='pages_per_second'&&finite(r.pages_per_second)&&r.pages_per_second>0)
   .sort((x,y)=>(x.selection_priority??100)-(y.selection_priority??100)||String(y.as_of).localeCompare(String(x.as_of))||x.source_id.localeCompare(y.source_id))[0]||null;
  const estimate=(data.throughputEstimates||[]).find(e=>e.model===model.id&&validEstimate(e))||null;
  const page=(data.pricing||[]).filter(p=>p.model===model.id&&p.verification_status==='verified'&&p.comparison_default!==false&&['vendor_list','benchmark_estimate'].includes(p.basis)&&finite(p.usd_per_1000_pages))
   .sort((x,y)=>(x.basis==='vendor_list'?0:1)-(y.basis==='vendor_list'?0:1)||String(y.as_of).localeCompare(String(x.as_of)))[0];
  const token=(data.tokenPricing||[]).filter(p=>p.model===model.id&&p.verification_status==='verified'&&p.comparison_default!==false)
   .sort((x,y)=>String(y.as_of).localeCompare(String(x.as_of)))[0];
  const service=(data.pricing||[]).find(p=>p.model===model.id&&p.version_scope==='current_service'&&p.verification_status==='verified');
  let cost;
  if(page){const actual=page.basis==='vendor_list',current=actual&&page.version_scope==='current_service';cost={value:page.usd_per_1000_pages,label:(current?'Service ':'')+money(page.usd_per_1000_pages)+(current?'†':''),kind:current?'current service':actual?'API':'benchmark est.',estimated:!actual,source_id:page.source_id,note:[current?'Current service tariff, not a verified tariff for the historical benchmark generation.':null,page.provider,page.mode,page.basis,'as of '+page.as_of,page.note].filter(Boolean).join(' · ')};}
  else if(token){const value=(a.inputTokens*token.input_usd_per_million_tokens+a.outputTokens*token.output_usd_per_million_tokens)/1000;cost={value,label:'≈'+money(value),kind:'token scenario',estimated:true,source_id:token.source_id,note:`Illustrative ${a.inputTokens} billable input + ${a.outputTokens} output tokens/page × 1,000 pages. Input includes image tokens; output includes billed reasoning. Not measured page usage. No caching, tool fees or additional charges included. ${token.provider} ${token.api_model} · ${token.mode} · as of ${token.as_of}. ${token.note||''}`};}
  else if(service){cost={value:null,label:'Service '+money(service.usd_per_1000_pages)+'†',kind:'current service',source_id:service.source_id,note:'Current service, not a verified tariff for this benchmarked generation. '+service.note};}
  else if(model.price_context){cost={value:null,...model.price_context,kind:'context'};}
  else if(model.access==='open'&&speed&&speed.hardware_known===true&&speed.cost_eligible===true){const value=a.hourlyRate/(speed.pages_per_second*3600)*1000;cost={value,label:'≈'+money(value),kind:'local compute',estimated:true,source_id:speed.source_id,note:`${money(a.hourlyRate)}/reported setup-hour ÷ (${speed.pages_per_second} pages/sec × 3,600) × 1,000 pages. Illustrative 100% utilization; not a hardware market price or API tariff. Applies to the complete reported setup, not a normalized machine. Excludes idle/loading, storage, licenses and rental minimums.`};}
  else if(model.access==='open'&&estimate){const low=a.hourlyRate*1000/(estimate.high*3600),high=a.hourlyRate*1000/(estimate.low*3600);cost={value:midpoint({low,high}),low,high,label:'≈'+money(low)+'–'+money(high),kind:'modeled compute',estimated:true,note:`Low-confidence planning range: ${money(a.hourlyRate)}/assumed complete setup-hour × 1,000 ÷ (modeled pages/sec × 3,600). Setup: ${estimate.hardware}. 100% utilization; no idle/loading, storage, licenses or rental minimums. Illustrative assumption, not market pricing or an API tariff. Cost range uses the modeled setup, not any differently configured observation. Sort uses geometric midpoint; overlapping ranges do not establish a winner.`};}
  else cost={value:null,label:model.access==='open'?'Self-hosted':'—',kind:'unavailable',note:'No verified comparable page cost. Unknown is not zero; imported prices remain in the source/pricing details, not the sortable comparison.'};
  const referenceMode=!!data.ocrReference,reference=data.ocrReference?.models.find(r=>r.model===model.id)||null;
  const publishedCost=(page||token||service)?cost:null;
  if(referenceMode&&validReference(reference)){
   const low=a.hourlyRate*1000/(reference.high*3600),high=a.hourlyRate*1000/(reference.low*3600);
   cost={value:midpoint({low,high}),low,high,label:'≈'+money(low)+'–'+money(high),kind:'H100 scenario',estimated:true,note:`Low-confidence reference compute: ${money(a.hourlyRate)}/complete H10080GB setup-hour at100% utilization. Range inverts ${reference.low}–${reference.high} pages/sec; excludes idle/loading, storage, licenses and rental minimums. Not a hardware market quote or API tariff. CPU-only paths still charge the allocated whole reference setup.`};
  }else if(referenceMode&&model.access==='open'&&reference?.status!=='hosted'){
   cost={value:null,label:reference?.status==='too-large'?'>80GB':reference?.status==='tight-fit'?'Fit uncertain':'—',kind:'no reference cost',note:reference?.fit||'No supported reference setup estimate; unknown is not zero.'};
  }
  return {speed,estimate,records,cost,publishedCost,referenceMode,reference,assumptions:a};
 }
 function enrich(result,data,options={}){return {...result,rows:result.rows.map(r=>({...r,deployment:deployment(data,data.models.find(m=>m.id===r.id),options)}))};}
 function value(row,key){if(key==='model')return row.name;if(key==='rank')return row.rank;if(key==='speed'){const d=row.deployment;if(d?.referenceMode)return validReference(d.reference)?midpoint(d.reference):null;return d?.speed?.pages_per_second??(d?.estimate?midpoint(d.estimate):null);}if(key==='price')return row.deployment?.cost?.value??null;return row.scores[key]?.value??null;}
 function sortRows(rows,key='rank',direction='desc'){
  return rows.map((row,i)=>({row,i})).sort((a,b)=>{const x=value(a.row,key),y=value(b.row,key);if(x==null||y==null)return x==null&&y==null?a.i-b.i:x==null?1:-1;const delta=typeof x==='string'?x.localeCompare(y):x-y;return (direction==='asc'?delta:-delta)||a.i-b.i;}).map(x=>x.row);
 }
 function defaultDirection(key,result){return key==='model'||key==='price'||result.columns.find(t=>t.id===key)?.direction==='lower'?'asc':'desc';}
 function renderHead(result,options={}){const key=options.sortKey||'rank',dir=options.sortDirection||'desc';return [{id:'model',short:'Model',label:'Model name'},{id:'rank',short:'Rank index',label:'Quality only; speed and cost never affect this index'},{id:'speed',short:'H100 pages/s',label:'Estimated 1 × H100 80GB reference throughput; not a controlled benchmark. Range sorting uses geometric midpoint; originals remain in Details'},{id:'price',short:'$/1k pages',label:'API tariffs, benchmark estimates, or explicitly assumed token/local costs'},...result.columns].map(t=>`<th scope="col" aria-sort="${t.id===key?(dir==='asc'?'ascending':'descending'):'none'}"><button type="button" class="column-sort" data-ocr-sort="${esc(t.id)}" title="${esc(t.label)}${t.primary_metric?' · '+(t.direction==='lower'?'Lower':'Higher')+' is better. Sorts the named primary protocol only; additional protocols below do not change the sort value.':''}">${esc(t.short)} ${t.id===key?(dir==='asc'?'↑':'↓'):'↕'}</button></th>`).join('');}
 const metricNames={avg3:'Average of 3 splits',clean:'Clean',digital:'Digital',real:'Real',public:'Public',private:'Private',photo:'Photo',non_latin:'Non-Latin',arxiv:'arXiv',base:'Base',headers_footers:'Headers / footers',long_tiny_text:'Long / tiny text',multi_column:'Multi-column',old_scans:'Old scans',old_scans_math:'Old scans + math',text_edit:'Text edit distance',reading_order_edit:'Reading-order edit distance',read_order_edit:'Reading-order edit distance',order_edit:'Reading-order edit distance',formula_cdm:'Formula CDM',table_teds:'Table TEDS',table_teds_s:'Table TEDS-S',table_teds_structure:'Table structure TEDS',teds_content:'Content TEDS',teds_structure:'Structure TEDS',cer:'CER',wer:'WER',ci95:'95% CI ±',reported_uncertainty:'Reported uncertainty ±',kie:'KIE',ocr:'OCR',vqa:'VQA',pp3:'PP3',own_postprocessing:'Own postprocessing'};
 const metricLabel=(test,key)=>test.metric_labels?.[key]||metricNames[key]||key.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
 const metricDirection=(test,key)=>test.metric_directions?.[key]==='lower'?' ↓':test.metric_directions?.[key]==='higher'?' ↑':'';
 const metricUnit=(test,key)=>test.metric_units?.[key]==='percent'?'%':test.metric_units?.[key]==='ratio'?' ratio':'';
 function metricBreakdown(observation,test,data){
  const metrics=Object.entries(observation.metrics||{}).filter(([key,value])=>key!==test.primary_metric&&finite(value));
  if(!metrics.length)return '';
  const items=metrics.map(([key,value])=>`<dt>${esc(metricLabel(test,key)+metricDirection(test,key))}</dt><dd data-metric="${esc(key)}">${esc(scoreFmt(value,test.metric_units?.[key]))}${esc(metricUnit(test,key))}</dd>`).join('');
  const componentSource=observation.component_source_url?`<small class="score-context">${observationLink(data,{source_url:observation.component_source_url,source_id:observation.component_source_id||observation.source_id},'Breakdown source ↗')}</small>`:observation.component_source_id&&observation.component_source_id!==observation.source_id?`<small class="score-context">${link(data,observation.component_source_id,'Breakdown source ↗')}</small>`:'';
  return `<dl class="score-metrics">${items}</dl>${componentSource}`;
 }
 const evidenceLabel=observation=>({official:'benchmark publication',third_party:'third-party report',community:'community report',author_reported:'author-reported',vendor_comparison:'vendor comparison',vendor:'vendor-operated',mixed:'mixed evidence',imported:'imported',secondary:'secondary report',research:'reported; operator unverified',vendor_internal:'vendor-internal'})[observation.evidence]||'reported';
 function visibleContext(observation,test){
  const operator=observation.measurement_operator||observation.operator;
  const provenance=[evidenceLabel(observation),operator&&('Operator: '+operator)].filter(Boolean).join(' · ');
  const context=observation.visible_context||[observation.dataset_scope||test.scope,observation.evaluation_method,observation.run_date&&('Run '+observation.run_date)].filter(Boolean).join(' · ');
  return `<small class="score-context">${esc(provenance)}</small>${observation.comparable===false?'<small class="score-context">Context only · not comparable for ranking</small>':''}${context?`<small class="score-context">${esc(context)}</small>`:''}`;
 }
 function speedNote(r){return [r.hardware,r.pipeline,r.input_type&&('input: '+r.input_type),r.configuration&&('configuration: '+r.configuration),r.dataset,r.batch&&('batch: '+r.batch),r.concurrency!=null&&('concurrency: '+r.concurrency),r.precision,r.note,'as of '+r.as_of].filter(Boolean).join(' · ');}
 function details(row,data){const d=row.deployment;let content=`<p>${esc(row.modelNote||row.name)}</p>`;
  if(row.rank==null)content+=`<p><strong>No comparable overall index.</strong> ${esc(row.rankExplanation)} Reported benchmark results, when available, remain listed below.</p>`;
  const reported=data.tests.filter(t=>row.scores[t.id]?.value!=null);
  if(reported.length)content+='<p><strong>Reported benchmark results</strong> · Separate protocols, not a combined score.</p><ul>'+reported.flatMap(t=>{const selected=row.scores[t.id],alternatives=(data.resultsByKey?.[row.id+'|'+t.id]||[]).filter(o=>finite(o.value)&&o.status!=='assumed'&&o.evidence!=='assumed'&&(o.source_id!==selected.source_id||o.value!==selected.value));return [selected,...alternatives].map((o,index)=>`<li><strong>${esc(t.label)}: ${esc(scoreFmt(o.value,t.unit))}</strong>${index?' · alternate source':''} · ${esc(o.evidence||'reported')}. ${esc(o.configuration||'')} ${esc(o.note||data.sources[o.source_id]?.note||'')} ${observationLink(data,o,'Source ↗')}${metricBreakdown(o,t,data)}${visibleContext(o,t)}</li>`);}).join('')+'</ul>';
  else content+='<p>No benchmark results recorded for this model.</p>';
  content+=`<p><strong>Cost:</strong> ${esc(d.cost.label)} /1,000 pages · ${esc(d.cost.kind)}. ${esc(d.cost.note)} ${d.cost.source_id?link(data,d.cost.source_id,'Source ↗'):''}</p>`;
  if(d.referenceMode){const p=data.ocrReference.profile,e=d.reference;content+=`<p><strong>Common reference: ${esc(p.label)}</strong>. ${esc(p.hardware)}. ${esc(p.host)}</p><p>${esc(p.precision)} ${esc(p.workload)} ${esc(p.batch)}</p>`;
   if(e?.status==='estimated')content+=`<p><strong>Low-confidence H100 estimate:</strong> ≈${esc(rangeFmt(e.low))}–${esc(rangeFmt(e.high))} pages/s. NOT a measurement or statistical confidence interval. ${esc(e.basis)}</p>`;
   content+=`<p><strong>Fit:</strong> ${esc(e?.fit||'No verified local reference scenario for this hosted or unresolved configuration.')} ${esc(p.fit_note)}</p><p>${esc(p.method)} ${esc(p.sorting)} Quality scores are unchanged and were not remeasured at this resolution, precision or batch. ${(e?.source_ids||[]).map(id=>link(data,id,'Evidence ↗')).join(' · ')}</p>`;
   if(d.publishedCost&&d.publishedCost!==d.cost)content+=`<p><strong>Published/alternate price context:</strong> ${esc(d.publishedCost.label)} · ${esc(d.publishedCost.kind)}. ${esc(d.publishedCost.note)} ${link(data,d.publishedCost.source_id,'Source ↗')}</p>`;
  }
  if(d.records.length)content+='<p><strong>Speed observations:</strong> measured/reported, not normalized across setups. A matching model name does not establish the same quality-evaluation configuration.</p><ul>'+d.records.map(r=>`<li>${esc(r.unit==='pages_per_second'?fmt(r.pages_per_second)+' pages/s':r.display_value||'Context only')} · ${esc(speedNote(r))} · ${esc(r.evidence)}. ${r.comparison_default===false?'Context only; not used in the sortable speed/cost. ':''}${link(data,r.source_id,'Source ↗')}</li>`).join('')+'</ul>';
  else content+='<p>No sourced full-page speed measurement for this model; parameter count is not a speed estimate.</p>';
  if(d.estimate){const e=d.estimate;content+=`<p><strong>Low-confidence modeled speed:</strong> ≈${esc(rangeFmt(e.low))}–${esc(rangeFmt(e.high))} pages/s. This is an educated planning range, NOT a measurement, guarantee or statistical confidence interval. ${d.referenceMode?'Original hardware scenario only; the common H100 scenario is used in the table. ':d.speed?'A reported measurement takes priority in the table. ':''}</p><p>${esc([e.hardware,e.pipeline,e.precision,'batch: '+e.batch,'workload: '+e.workload].join(' · '))}</p><p><strong>Basis:</strong> ${esc(e.basis)}</p><p>${esc(e.limitations)} Quality was not re-evaluated under this speed scenario. Sorting uses the geometric midpoint only; overlapping ranges do not establish a faster model. As of ${esc(e.as_of)}. ${e.source_ids.map(id=>link(data,id,'Evidence ↗')).join(' · ')}</p>`;}
  const id="ocr-details-"+row.id; return `<button type="button" class="ocr-details-button" popovertarget="${esc(id)}" aria-label="Benchmark, speed and cost details for ${esc(row.name)}" title="Model details"><span aria-hidden="true">ⓘ</span></button><div id="${esc(id)}" class="rank-note ocr-details" popover><button type="button" class="rank-note-close" popovertarget="${esc(id)}" popovertargetaction="hide" aria-label="Close model details">×</button><strong>${esc(row.name)} · results and deployment details</strong>${content}</div>`;
 }
 function cellObservation(row,test,data,columns){
  if(row.scores[test.id]?.value!=null)return {observation:row.scores[test.id],test,variant:false};
  const shownFamilies=new Set(columns.map(t=>t.family));
  const candidates=data.tests.filter(t=>row.scores[t.id]?.value!=null&&(test.id==='reported-other'?!shownFamilies.has(t.family):t.family===test.family));
  candidates.sort((a,b)=>(a.matrix_order??100)-(b.matrix_order??100));
  const chosen=candidates[0];return chosen?{observation:row.scores[chosen.id],test:chosen,variant:true}:null;
 }
 // The default matrix groups every published protocol into a family column.
 // A headline protocol still supplies the sort value; displaying variants never changes it.
 function cellObservations(row,test,data,columns){
  if(!columns.some(t=>t.id==='reported-other')){const cell=cellObservation(row,test,data,columns);return cell?[cell]:[];}
  const shownFamilies=new Set(columns.map(t=>t.family)),shownIds=new Set(columns.map(t=>t.id));
  return data.tests.filter(t=>row.scores[t.id]?.value!=null&&(t.id===test.id||(test.id==='reported-other'?!shownFamilies.has(t.family):t.family===test.family&&!shownIds.has(t.id))))
   .sort((a,b)=>Number(a.id!==test.id)-Number(b.id!==test.id)||(a.matrix_order??100)-(b.matrix_order??100)||a.id.localeCompare(b.id))
   .map(t=>({observation:row.scores[t.id],test:t,variant:t.id!==test.id}));
 }
 function resultDetails(row,test,observation,column,data){
  const id='ocr-result-'+[row.id,column.id,test.id].map(value=>value.replace(/[^a-zA-Z0-9_-]/g,'-')).join('--');
  const title=id+'-title',unit=test.unit==='percent'?'%':test.unit==='ratio'?' ratio':'';
  const paragraphs=[observation.configuration&&['Setup',observation.configuration],(observation.dataset_scope||observation.dataset_version)&&['Dataset',observation.dataset_scope||observation.dataset_version],observation.evaluation_method&&['Method',observation.evaluation_method],observation.run_date&&['Run date',observation.run_date],observation.verified_on&&['Source checked',observation.verified_on]].filter(Boolean);
  const notes=[observation.note||data.sources[observation.source_id]?.note,test.note].filter((note,index,all)=>note&&all.indexOf(note)===index);
  const content=`<h3 id="${esc(title)}">${esc(row.name)} · ${esc(test.label)}</h3><p class="result-headline"><strong>${esc(metricLabel(test,test.primary_metric))}: ${esc(scoreFmt(observation.value,test.unit)+unit)}</strong> · ${observationLink(data,observation,'Source ↗')}</p>${metricBreakdown(observation,test,data)}${visibleContext(observation,test)}${paragraphs.map(([label,value])=>`<p><strong>${esc(label)}:</strong> ${esc(value)}</p>`).join('')}${notes.map(note=>`<p>${esc(note)}</p>`).join('')}<p class="result-display-note">Component ↑/↓ labels indicate direction; values retain their published scales. Component values rounded for display; source data retains full precision.</p>`;
  return {button:`<button type="button" class="ocr-result-details-button" popovertarget="${esc(id)}" aria-controls="${esc(id)}" aria-haspopup="dialog" aria-label="Details for ${esc(row.name)} · ${esc(test.label)}" title="${esc(test.label)} · benchmark details"><span aria-hidden="true">ⓘ</span></button>`,popover:`<section id="${esc(id)}" class="rank-note ocr-result-details" popover="auto" role="dialog" aria-labelledby="${esc(title)}"><button type="button" class="rank-note-close" popovertarget="${esc(id)}" popovertargetaction="hide" aria-label="Close benchmark details" autofocus>×</button>${content}</section>`};
 }
 function renderScores(row,column,data,result){
  const cells=cellObservations(row,column,data,result.columns),primary=cells.find(cell=>!cell.variant),v=primary?.observation.value,range=result.ranges[column.id];
  const shade=v==null||!range?0:range[0]===range[1]?30:Math.max(0,Math.min(1,column.direction==='lower'?(range[1]-v)/(range[1]-range[0]):(v-range[0])/(range[1]-range[0])))*30;
  const content=cells.map(({observation:o,test:t,variant})=>{
   const detail=resultDetails(row,t,o,column,data),label=t.label+': '+scoreFmt(o.value,t.unit)+(t.unit==='percent'?'%':t.unit==='ratio'?' ratio':'');
   return `<div class="ocr-result" data-protocol="${esc(t.id)}" data-sort-primary="${!variant}"><div class="ocr-score-line"><span class="score-value" role="group" aria-label="${esc(label)}" title="${esc(t.label)} · ${esc(RankUI.scoreTooltip(o,data,row.id,t.id))}">${observationLink(data,o,scoreFmt(o.value,t.unit))}${o&&Rank.qualification(o)?'<sup>*</sup>':''}${t.unit==='percent'?'<span class="score-unit">%</span>':''}${o.comparable===false?'<sup class="score-context-mark" role="img" aria-label="Context-only result; excluded from ranking" title="Context-only result; excluded from ranking">‡</sup>':''}</span>${detail.button}</div>${detail.popover}</div>`;
  }).join('');
  return `<td class="score" data-protocol="${esc(primary?.test.id||cells[0]?.test.id||column.id)}" style="--shade:${shade.toFixed(1)}%">${content||'—'}</td>`;
 }
 function compactPriceLabel(cost){
  const label=String(cost.label||'').replace(/^Service\s+/,'');
  return finite(cost.value)||/^(?:≈)?[$₹€£¥]\d[\d.,]*(?:–[$₹€£¥]?\d[\d.,]*)?[†‡*]?$/.test(label)?label:'—';
 }
 function renderRows(result,data,options={}){const enriched=enrich(result,data,options);return sortRows(enriched.rows,options.sortKey||'rank',options.sortDirection||'desc').map(r=>{
  const d=r.deployment,s=d.speed,e=d.estimate,c=d.cost,ref=d.reference;
  const referenceLabel=validReference(ref)?(ref.path==='cpu'?'Estimated CPU path on reference setup':'Estimated H100 reference speed'):ref?.status==='too-large'?'>80GB':ref?.status==='tight-fit'?'Fit uncertain':ref?.status==='cpu-only'?'CPU only':ref?.status==='hosted'||r.access==='closed'?'Hosted':'No reference GPU estimate';
  const speedContext=d.referenceMode?[referenceLabel,ref?.basis||ref?.fit].filter(Boolean).join(' · '):s?speedNote(s):e?'Low-confidence modeled range; '+e.hardware:'No comparable full-page measurement';
  const speedCell=d.referenceMode?(validReference(ref)?`<button type="button" class="ocr-estimate-link" popovertarget="ocr-details-${esc(r.id)}" aria-label="H100 reference estimate and assumptions for ${esc(r.name)}">≈${esc(rangeFmt(ref.low))}–${esc(rangeFmt(ref.high))}</button>`:'—')
   :s?link(data,s.source_id,fmt(s.pages_per_second)+'†'):e?`<button type="button" class="ocr-estimate-link" popovertarget="ocr-details-${esc(r.id)}" aria-label="Low-confidence modeled speed and assumptions for ${esc(r.name)}">≈${esc(rangeFmt(e.low))}–${esc(rangeFmt(e.high))}</button>`:'—';
  const priceLabel=compactPriceLabel(c),priceCell=priceLabel==='—'?'—':link(data,c.source_id,priceLabel);
  return `<tr data-model="${esc(r.id)}"><th scope="row" title="${esc(r.modelNote||r.name)}">${link(data,r.modelSourceId,r.name)}${details(r,data)}</th><td class="index">${r.rank==null?`<span role="img" aria-label="Unranked: no comparable overall index. See Details.">—</span>`:RankUI.renderRank(r,data.sources)}</td><td class="ocr-speed" title="${esc(speedContext)}">${speedCell}</td><td class="price" title="${esc(c.kind+' · '+c.note)}">${priceCell}</td>`+result.columns.map(t=>renderScores(r,t,data,result)).join('')+'</tr>';
 }).join('');}
 return {cellObservation,cellObservations,defaults,assumptions,deployment,enrich,sortRows,defaultDirection,renderHead,renderRows};
});
