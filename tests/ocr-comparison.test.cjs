const {test}=require('node:test');
const assert=require('node:assert/strict');
const OCR=require('../src/assets/js/ocr-comparison.js');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const model={id:'fixture',name:'Fixture',access:'open'};
const base=()=>({models:[model],sources:{s:{url:'https://example.com/evidence'}},throughput:[],pricing:[],tokenPricing:[]});
const speed=(extra={})=>({model:model.id,source_id:'s',comparison_default:true,unit:'pages_per_second',pages_per_second:2,selection_priority:10,as_of:'2026-10-22',hardware_known:true,cost_eligible:true,hardware:'2 GPUs + CPU',...extra});
const price=(extra={})=>({model:model.id,source_id:'s',verification_status:'verified',comparison_default:true,basis:'vendor_list',usd_per_1000_pages:3,as_of:'2026-10-22',...extra});

test('OCR evidence selection uses declared priority, not fastest observation',()=>{
 const data=base();data.throughput=[speed({pages_per_second:999,comparison_default:false}),speed({pages_per_second:100,selection_priority:20}),speed({pages_per_second:2,selection_priority:10}),speed({pages_per_second:3,selection_priority:10,as_of:'2026-10-21'})];
 const snapshot=JSON.stringify(data);const d=OCR.deployment(data,model);assert.equal(d.speed.pages_per_second,2);assert.equal(d.records.length,4);assert.equal(JSON.stringify(data),snapshot);
});

test('OCR all sortable numeric/text columns keep missing values last in either direction',()=>{
 const make=(id,n)=>({id,name:n===null?null:String(n),rank:n,scores:{accuracy:{value:n}},deployment:{speed:n===null?null:{pages_per_second:n},cost:{value:n}}});
 const rows=[make('missing1',null),make('two',2),make('missing2',null),make('one',1),make('two-tie',2)];
 for(const key of ['model','rank','speed','price','accuracy'])for(const direction of ['asc','desc']){
  const sorted=OCR.sortRows(rows,key,direction);assert.deepEqual(sorted.slice(-2).map(r=>r.id),['missing1','missing2'],`${key}/${direction}`);
  assert.deepEqual(sorted.slice(0,3).map(r=>r.id),direction==='asc'?['one','two','two-tie']:['two','two-tie','one']);
 }
 assert.equal(rows[0].id,'missing1');
});

test('OCR token scenarios use per-million rates and cap billable inputs at200000',()=>{
 const data=base();data.tokenPricing=[{model:model.id,verification_status:'verified',source_id:'s',input_usd_per_million_tokens:2,output_usd_per_million_tokens:8,as_of:'2026-10-22'}];
 const d=OCR.deployment(data,model,{inputTokens:2000,outputTokens:500});assert.equal(d.cost.value,8);assert.equal(d.cost.kind,'token scenario');assert.equal(d.cost.estimated,true);assert.match(d.cost.note,/billable input/);assert.match(d.cost.note,/reasoning/);
 assert.deepEqual(OCR.assumptions({inputTokens:Infinity,outputTokens:-1,hourlyRate:NaN}),{inputTokens:1000,outputTokens:0,hourlyRate:1});
 assert.equal(OCR.deployment(data,model,{inputTokens:999999,outputTokens:999999}).cost.value,2000);
 data.tokenPricing[0].verification_status='unverified';assert.equal(OCR.deployment(data,model).cost.value,null);
 data.tokenPricing[0].verification_status='verified';data.tokenPricing[0].comparison_default=false;assert.equal(OCR.deployment(data,model).cost.value,null);
});

test('OCR local cost is per complete reported setup-hour and requires positive eligible throughput',()=>{
 const data=base();data.throughput=[speed()];const d=OCR.deployment(data,model,{hourlyRate:7.2});assert.equal(d.cost.value,1);assert.equal(d.cost.kind,'local compute');assert.match(d.cost.note,/complete reported setup/);assert.match(d.cost.note,/100% utilization/);assert.match(d.cost.note,/not a hardware market price/);
 for(const override of [{hardware_known:undefined},{cost_eligible:undefined},{hardware_known:false},{cost_eligible:false},{comparison_default:false},{pages_per_second:0},{pages_per_second:-1},{pages_per_second:NaN},{pages_per_second:Infinity},{unit:'tokens_per_second'}]){
  data.throughput=[speed(override)];assert.equal(OCR.deployment(data,model).cost.value,null,JSON.stringify(override));
 }
 data.throughput=[speed()];assert.equal(OCR.deployment(data,{...model,access:'closed'}).cost.value,null);
 assert.equal(OCR.deployment(data,model,{hourlyRate:0}).cost.value,0,'explicit zero assumption is not an API free claim');
});

test('OCR exact API, benchmark estimate, current service and unverified prices remain distinct',()=>{
 const data=base();data.pricing=[price({basis:'benchmark_estimate',usd_per_1000_pages:.1}),price()];
 let d=OCR.deployment(data,model);assert.equal(d.cost.value,3);assert.equal(d.cost.kind,'API');assert.equal(d.cost.estimated,false);
 data.pricing=[price({basis:'benchmark_estimate'})];d=OCR.deployment(data,model);assert.equal(d.cost.kind,'benchmark est.');assert.equal(d.cost.estimated,true);
 data.pricing=[price({version_scope:'current_service'})];d=OCR.deployment(data,model);assert.equal(d.cost.value,3);assert.equal(d.cost.kind,'current service');assert.equal(d.cost.estimated,false);assert.match(d.cost.label,/^Service \$/);assert.match(d.cost.note,/historical benchmark generation/);
 data.pricing=[price({version_scope:'current_service',comparison_default:false})];d=OCR.deployment(data,model);assert.equal(d.cost.value,null);assert.match(d.cost.label,/^Service \$/);
 data.pricing=[price({verification_status:'unverified'})];assert.equal(OCR.deployment(data,model).cost.value,null);
 data.pricing=[price({basis:'third_party_listing'})];assert.equal(OCR.deployment(data,model).cost.value,null);
 data.pricing=[price({comparison_default:false})];assert.equal(OCR.deployment(data,model).cost.value,null);
});

test('OCR real evidence includes16 speed defaults, explicit Gemini3.6 tariff and conservative contexts',()=>{
 const data=loadOCR();const rows=data.models.map(m=>({model:m,...OCR.deployment(data,m)}));assert.equal(rows.filter(r=>r.speed).length,16);
 for(const [id,value] of [['lightonocr-3-0.8b',3.32],['lightonocr-3-1b',3.52],['lightonocr-3-4b',2.03],['chandra-2-open',1.68],['lightonocr-2-1b',5.71]])assert.equal(rows.find(r=>r.model.id===id).speed.pages_per_second,value,id);
 const tariff=data.tokenPricing.find(p=>p.model==='gemini-3-6-flash');assert.equal(tariff.api_model,'gemini-3.6-flash');assert.equal(tariff.input_usd_per_million_tokens,.75);assert.equal(tariff.output_usd_per_million_tokens,3.75);assert.equal(tariff.verification_status,'verified');assert.match(tariff.note,/2026-12-31/);
 const gemini=rows.find(r=>r.model.id==='gemini-3-6-flash');assert.equal(gemini.cost.kind,'token scenario');assert.equal(gemini.cost.value,4.5);
 const indra=rows.find(r=>r.model.id==='indra-ocr-1-1');assert.equal(indra.speed,null,'median latency and OCR-only alternate are not auto throughput');assert.equal(indra.cost.value,null);
 const service=rows.find(r=>r.model.id==='datalab-convert-accurate');assert.equal(service.cost.kind,'current service');assert.equal(service.cost.value,10);assert.match(service.cost.label,/^Service \$/);
 const context=rows.find(r=>r.model.id==='chandra-2-1-api');assert.equal(context.cost.value,null);
});

test('OCR deployment assumptions never mutate raw accuracy or quality ranks',()=>{
 const data=loadOCR();const result=build(data,data.config.snapshot_date,{min:0});const before=JSON.stringify(result),records=JSON.stringify(data.rawRecords);
 const low=OCR.enrich(result,data,{hourlyRate:.1,inputTokens:100,outputTokens:50});const high=OCR.enrich(result,data,{hourlyRate:100,inputTokens:200000,outputTokens:200000});
 const quality=r=>r.rows.map(({deployment,...row})=>row);assert.deepEqual(quality(low),result.rows);assert.deepEqual(quality(high),result.rows);assert.equal(JSON.stringify(result),before);assert.equal(JSON.stringify(data.rawRecords),records);
 assert.ok(low.rows.some((r,i)=>r.deployment.cost.value!==high.rows[i].deployment.cost.value),'scenario actually changes some costs');
});

test('OCR speed details retain input, configuration and concurrency, with accessible column sorting',()=>{
 const data=loadOCR(),result=build(data,data.config.snapshot_date,{min:0});const sample=result.rows[0];
 const scoped={...data,throughput:[speed({model:sample.id,source_id:Object.keys(data.sources)[0],input_type:'PDF raster',configuration:'layout <strict>',concurrency:512,pipeline:'vLLM',dataset:'512 pages',hardware_short:'H100'})]};
 const html=OCR.renderRows({...result,rows:[sample]},scoped);assert.match(html,/input: PDF raster/);assert.match(html,/configuration: layout &lt;strict&gt;/);assert.match(html,/concurrency: 512/);
 const head=OCR.renderHead(result,{sortKey:'speed',sortDirection:'desc'});assert.match(head,/aria-sort="descending"/);assert.match(head,/<button type="button" class="column-sort" data-ocr-sort="speed"/);assert.match(head,/Quality only; speed and cost never affect this index/);
});

test('OCR throughput validation rejects source/identity/unit/eligibility mistakes',()=>{
 const {validateData}=require('../lib/validate.cjs');
 for(const change of [{model:'missing-model'},{source_id:'missing-source'},{pages_per_second:-1},{comparison_default:true,unit:'median_seconds_per_page'},{cost_eligible:true,hardware_known:false},{cost_eligible:true,unit:'median_seconds_per_page',comparison_default:false}]){
  const data=loadOCR();Object.assign(data.throughput[0],change);assert.throws(()=>validateData(data));
 }
 const data=loadOCR();data.throughput.push({...data.throughput[0]});assert.throws(()=>validateData(data),/duplicate/);
 assert.equal(loadOCR().throughput.find(r=>r.source_id==='ocr-speed-glm-v2').batch,'unspecified');
});
