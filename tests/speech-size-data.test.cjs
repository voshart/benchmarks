const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadSTT}=require('../lib/load-stt.cjs');
const Speech=require('../src/assets/js/speech.js');
const data=loadSTT();

test('backfilled artifact sizes match pinned file metadata, not parameter-to-byte estimates',()=>{
 const snapshot=JSON.parse(fs.readFileSync(require.resolve('../data/stt/evidence/size-metadata-2026-10-22.json'),'utf8'));
 for (const item of snapshot.models) {
   const record=data.sizes.find(row=>row.model===item.model&&row.source_id==='artifact-2026-10-22-'+item.model);
   assert.ok(record);
   assert.match(item.revision,/^[a-f0-9]{40}$/);
   if (record.download_mb!=null) {
     assert.ok(item.selected_files.length>0);
     assert.equal(record.download_bytes,item.selected_files.reduce((sum,file)=>sum+file.size,0));
     assert.equal(record.download_mb,record.download_bytes/1e6);
     if(item.index_weight_files)assert.deepEqual(item.selected_files.map(file=>file.rfilename).sort(),[...item.index_weight_files,...(item.additional_required_weight_files||[])].sort());
   }
   if (record.parameters_million!=null)assert.equal(record.parameters_million,item.safetensors.total/1e6);
 }
});

test('size backfill preserves original configurations and leaves unverified hosted quantities missing',()=>{
 assert.equal(Speech.selectSize(data,'phonon-2').download_mb,164);
 assert.equal(Speech.selectSize(data,'phonon-2').parameters_million,600);
 assert.equal(Speech.selectSize(data,'stt-handy-phonon-2-q8-0').download_bytes,739508608);
 assert.equal(Speech.selectSize(data,'canary-180m-flash').parameters_million,182);
 const omni=Speech.selectSize(data,'stt-facebook-omniasr-llm-7b-v2');
 assert.equal(omni.parameters_million,7801.041536);
 assert.equal(omni.download_bytes,31220488063);
 assert.notEqual(omni.field_records.download_mb.source_id,omni.field_records.parameters_million.source_id);
 for (const id of ['stt-assemblyai-universal-3-pro','stt-elevenlabs-scribe-v2','stt-openai-gpt-transcribe','stt-nvidia-parakeet-tdt-0-6b-v3-fast-gpu-asr'])assert.equal(Speech.selectSize(data,id),null);
});

test('artifact byte validation rejects unit mismatches',()=>{
 const {validateSTT}=require('../lib/validate-stt.cjs');
 const changed=structuredClone(data);
 changed.sizes.find(row=>row.download_bytes!=null).download_mb=1;
 assert.throws(()=>validateSTT(changed),/speech artifact MB must use decimal bytes/);
});

test('Niagara CPU exports and Omni v2 checkpoints retain their own measured bytes',()=>{
 const niagara=JSON.parse(fs.readFileSync(require.resolve('../data/stt/evidence/niagara-artifacts-2026-10-22.json'),'utf8'));
 for (const item of niagara) {
   const size=Speech.selectSize(data,item.model);
   assert.match(item.file.rfilename,/-cpu\.pt2$/);
   assert.equal(size.download_bytes,item.file.size);
   assert.equal(size.download_mb,item.file.size/1e6);
 }
 const omni=JSON.parse(fs.readFileSync(require.resolve('../data/stt/evidence/omni-v2-metadata-2026-10-22.json'),'utf8'));
 for(const item of omni.models){
   const size=Speech.selectSize(data,item.model);
   assert.match(item.checkpoint,/-v2\.pt$/);
   assert.equal(size.download_bytes,item.download_bytes);
   assert.equal(size.parameters_million,item.parameters/1e6);
 }
});
