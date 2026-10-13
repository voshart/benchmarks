const {test}=require('node:test'),assert=require('node:assert/strict');const {loadOCR}=require('../lib/load.cjs');const {build,maturity,pctRanks}=require('../lib/ranking.cjs');const d=loadOCR();
test('TeleOCR survives four-family default',()=>assert.ok(build(d).rows.some(r=>r.name==='TeleOCR')));
test('historical cutoff excludes September 2026 entrants',()=>assert.ok(!build(d,'2026-06-01',{min:1}).rows.some(r=>r.name==='Xiaomi-OCR-0')));
test('thin benchmark is not rank-bearing',()=>assert.equal(maturity([{model:{organization:'X'}}],{min_models:6,min_organizations:3}).active,false));
test('ties share ranks',()=>{const rows=[{model:{id:'a'},obs:{value:90}},{model:{id:'b'},obs:{value:90}},{model:{id:'c'},obs:{value:80}}];const x=pctRanks(rows,{direction:'higher'});assert.equal(x.get('a'),x.get('b'));assert.equal(x.get('c'),0);});
test('PolyOCR private MDP is missing',()=>{const r=d.resultsByKey['polyocr-2-7b|mdp-public'][0];assert.equal(r.metrics.public,87);assert.equal(r.metrics.private,undefined);});

test('Chandra API floor is visibly assumed and does not overwrite the source',()=>{const r=require('../lib/ranking.cjs').choose(d,'chandra-2-api','mdp-private');assert.equal(r.value,82.4);assert.equal(r.evidence,'assumed');});
