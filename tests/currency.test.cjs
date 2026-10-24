const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {exchangeRates,conversion,normalizeTariff,normalizePriceContext}=require('../lib/currency.cjs');
const {loadOCR}=require('../lib/load.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
const {build}=require('../lib/ranking.cjs');

test('USD conversion uses the dated ECB cross-rate without changing the native tariff',()=>{
 assert.equal(exchangeRates.as_of,'2026-10-23');
 assert.equal(exchangeRates.rates.USD,1.1193);assert.equal(exchangeRates.rates.INR,106.2720);
 assert.equal(conversion('INR').rate,1.1193/106.2720);
 const source={currency:'EUR',amount:0.16,published_amount:0.16,published_unit:'currency_per_audio_hour',unit:'currency_per_audio_hour',as_of:'2026-10-19',verification_status:'verified',version_scope:'current_service',note:'Original service scope.'};
 const snapshot=structuredClone(source),price=normalizeTariff(source);
 assert.equal(price.amount,0.16*1.1193);assert.equal(price.currency,'USD');assert.equal(price.approximate,true);
 assert.equal(price.original_amount,0.16);assert.equal(price.original_currency,'EUR');assert.equal(price.published_currency,'EUR');
 assert.equal(price.published_amount,0.16);assert.equal(price.as_of,source.as_of);assert.equal(price.version_scope,source.version_scope);
 assert.equal(price.fx.as_of,'2026-10-23');assert.match(price.fx.source_url,/^https:\/\/www\.ecb\.europa\.eu\//);
 assert.deepEqual(source,snapshot);assert.deepEqual(normalizeTariff(price),price,'no double conversion');
 const usd={...source,currency:'USD'};assert.equal(normalizeTariff(usd),usd,'USD records remain unchanged');
 assert.throws(()=>normalizeTariff({...source,currency:'XYZ'}),/No verified USD exchange rate/);
 assert.throws(()=>normalizeTariff({...source,amount:-1}),/Invalid source-currency price/);
 assert.throws(()=>conversion('INR',{...exchangeRates,rates:{...exchangeRates.rates,INR:0}}),/No verified USD exchange rate/);
});

test('Sarvam displays USD while preserving contextual scope and original INR evidence',()=>{
 const data=loadOCR(),model=data.models.find(m=>m.id==='sarvam-vision-2-1');
 const native=JSON.parse(fs.readFileSync('data/models/registry.json','utf8')).find(m=>m.id===model.id).price_context;
 assert.equal(native.currency,'INR');assert.equal(native.amount_per_1000_pages,500);
 const context=model.price_context;
 assert.equal(context.currency,'USD');assert.equal(context.amount_per_1000_pages,500*1.1193/106.2720);
 assert.equal(context.original_amount_per_1000_pages,500);assert.equal(context.original_currency,'INR');
 assert.equal(context.label,'≈$5.27†');assert.match(context.note,/Original tariff: INR 500\/1,000 pages/);
 const cost=OCR.deployment(data,model).cost;assert.equal(cost.value,null);assert.equal(cost.kind,'context');
 assert.equal(data.pricingByModel[model.id],undefined,'conversion does not establish a frozen benchmark tariff');
 const result=build(data,undefined,{min:0}),row=result.rows.find(r=>r.id===model.id),html=OCR.renderRows({...result,rows:[row]},data);
 assert.match(html,/>≈\$5\.27†<\/a>/);assert.match(html,/Exchange rate ↗/);
 assert.ok(html.includes(context.fx.source_url));
});

test('subscription context converts every structured amount without becoming an API tariff',()=>{
 const source={status:'subscription_version_unverified',label:'Subscription',note:'Full quota required; benchmark version unverified.',prices:[
  {label:'Pro / month',amount:20,currency:'EUR',unit:'currency_per_month'},
  {label:'Full-quota batch / hour',amount:0.2,currency:'EUR',unit:'currency_per_audio_hour',basis:'full_quota_equivalent'},
  {label:'Pro overage / hour',amount:0.36,currency:'EUR',unit:'currency_per_audio_hour'}]};
 const context=normalizePriceContext(source);
 assert.deepEqual(context.prices.map(p=>p.amount),[20*1.1193,0.2*1.1193,0.36*1.1193]);
 assert.ok(context.prices.every(p=>p.currency==='USD'&&p.original_currency==='EUR'));
 assert.equal(context.status,source.status);assert.equal(context.label,source.label);
 assert.equal(context.prices[1].basis,'full_quota_equivalent');assert.equal(context.hourly_estimate,undefined);
 assert.match(context.note,/USD context: Pro \/ month: ≈\$22\.39/);
 assert.match(context.note,/Original tariffs: Pro \/ month: EUR 20/);
 assert.equal(context.fx.as_of,'2026-10-23');
});
