const fs=require('node:fs'),path=require('node:path');const dir=path.join(__dirname,'..','data');
const get=x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8'));
const jsonl=x=>fs.readFileSync(path.join(dir,x),'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
function loadOCR(){const config=get('ocr/config.json'),models=get('models/registry.json'),sources=get('ocr/sources.json');const tests=fs.readdirSync(path.join(dir,'ocr/tests')).filter(x=>x.endsWith('.json')).map(x=>get('ocr/tests/'+x));const records=[];for(const t of tests)for(const r of jsonl('ocr/results/'+t.id+'.jsonl')){const value=r.metrics[t.primary_metric];if(typeof value==='number')records.push({...r,value,benchmark:t.id,evidence:r.evidence||sources[r.source_id]?.kind||'imported'});}
const resultsByKey={};for(const r of records)(resultsByKey[r.model+'|'+r.benchmark]??=[]).push(r);
const pricing=jsonl('ocr/pricing.jsonl'),pricingByModel={};for(const p of pricing){const old=pricingByModel[p.model];if(!old||p.as_of>old.as_of||(p.as_of===old.as_of&&p.basis==='vendor_list'))pricingByModel[p.model]=p;}
const primaryTests=tests.filter(t=>!['openocr-hard','chandra-internal','omnidoc-v16-en','mdp-public'].includes(t.id));return {config,models,tests,primaryTests,coverageTests:tests.filter(t=>primaryTests.includes(t)||t.id==='omnidoc-v16-en'),sources,records,resultsByKey,pricing,pricingByModel};}
module.exports={loadOCR};
