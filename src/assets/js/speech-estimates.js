/* Deployment scenarios, never observations of the accuracy-tested configuration.
 * No estimated value is written to source records or used in quality ranking.
 */
(function(root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkSpeechEstimates = api;
})(globalThis, () => {
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const hub = value => typeof value === 'string' ? value.toLowerCase() : '';
  const reference = Object.freeze({hardware:'m4-max', runtime:'transcribe.cpp metal / Q8_0', batch_size:1});
  const whisperSource = 'https://github.com/openai/whisper#available-models-and-languages';

  // Reviewed format conversions only; never strip suffixes or infer family identity.
  const reviewedLineages = {
    'qwen/qwen3-asr-0.6b-hf': {
      model:'qwen3-asr-0-6b-hf', upstream_hub_id:'Qwen/Qwen3-ASR-0.6B', verified_on:'2026-10-22',
      sources:['https://huggingface.co/Qwen/Qwen3-ASR-0.6B-hf','https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3_asr/convert_qwen3_asr_to_hf.py'],
      note:'Official Transformers-native conversion of the original Qwen3-ASR-0.6B release. Alternate original-checkpoint Q8 deployment, not measured HF speed. Exact evaluated revision/tensor identity is unverified; precision, engine and prompts differ.'
    },
    'qwen/qwen3-asr-1.7b-hf': {
      model:'qwen3-asr-1-7b-hf', upstream_hub_id:'Qwen/Qwen3-ASR-1.7B', verified_on:'2026-10-22',
      sources:['https://huggingface.co/Qwen/Qwen3-ASR-1.7B-hf','https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3_asr/convert_qwen3_asr_to_hf.py'],
      note:'Official Transformers-native conversion of the original Qwen3-ASR-1.7B release. Alternate original-checkpoint Q8 deployment, not measured HF speed. Exact evaluated revision/tensor identity is unverified; precision, engine and prompts differ.'
    },
    'funaudiollm/fun-asr-nano-2512-hf': {
      model:'stt-funaudiollm-fun-asr-nano-2512-hf', upstream_hub_id:'FunAudioLLM/Fun-ASR-Nano-2512', verified_on:'2026-10-22',
      sources:['https://huggingface.co/FunAudioLLM/Fun-ASR-Nano-2512-hf','https://github.com/huggingface/transformers/blob/main/src/transformers/models/fun_asr_nano/convert_fun_asr_nano_to_hf.py','https://github.com/handy-computer/transcribe.cpp/blob/9f102d1ab18d01c0e21f9b3465531360c888251d/docs/porting/families/funasr_nano.md'],
      note:'Official HF conversion of Fun-ASR-Nano-2512. Both this HF export and the measured Q8 port omit auxiliary CTC inference and generate transcription through the LLM. Alternate deployment only: exact evaluated revision/tensor identity is unverified; precision, engine and prompts differ. Not an estimate for CTC timestamps or diarization.'
    }
  };

  function documentedVram(model) {
    // Exact upstream models only. Not distillations, conversions, fine-tunes,
    // hosted APIs or alternative engines whose allocation may differ.
    if (model.configuration_kind === 'runtime_conversion') return null;
    const match = /^openai\/whisper-(tiny(?:\.en)?|base(?:\.en)?|small(?:\.en)?|medium(?:\.en)?|large-v3|large-v3-turbo)$/.exec(hub(model.hub_id));
    if (!match) return null;
    const name = match[1];
    const gb = name === 'large-v3-turbo' ? 6 : name === 'large-v3' ? 10 : ({tiny:1,base:1,small:2,medium:5})[name.split('.')[0]];
    return {gb, source_url:whisperSource, runtime:'OpenAI PyTorch', approximate:true,
      status:'author_reported', note:'Approximate upstream runtime requirement, not measured Q8/Metal memory.'};
  }

  function clipSpan(data, model) {
    const records = (data.throughput || []).filter(r => r.model === model.id &&
      r.test_id === 'handy-single-clip-speed' && r.hardware === reference.hardware &&
      r.runtime === reference.runtime && r.batch_size === 1 && r.status === 'observed' &&
      r.evidence !== 'assumed' && r.load_time_included === false && r.feature_extraction_included === true &&
      ['jfk','dots'].includes(r.sample) && positive(r.rtfx));
    // Ambiguous duplicate measurements or mismatched engine revisions are not
    // silently pooled. A future panel needs an explicit version-selection rule.
    if (records.length !== 2 || new Set(records.map(r => r.sample)).size !== 2 ||
        !records[0].engine_sha || records[0].engine_sha !== records[1].engine_sha) return null;
    return {low:Math.min(...records.map(r => r.rtfx)), high:Math.max(...records.map(r => r.rtfx)),
      unit:'rtfx', model:model.id, records:records.slice(), ...reference,
      engine_sha:records[0].engine_sha, kind:'two_clip_span', confidence_interval:false,
      load_time_included:false, note:'Observed span of two short clips; not a prediction interval, streaming latency or long-form benchmark.'};
  }

  function getDeployment(data, model, size, {hourlyRate=1} = {}) {
    if (typeof model === 'string') model = (data.models || []).find(m => m.id === model);
    if (!model || model.access !== 'open') return null;
    let speed = clipSpan(data, model);
    if (speed) speed = {...speed, status:'observed', proxy:false};
    else if (model.configuration_kind !== 'runtime_conversion' && hub(model.hub_id)) {
      const reviewed=reviewedLineages[hub(model.hub_id)];
      const lineage=reviewed?.model===model.id ? reviewed : null;
      const upstream=hub(lineage?.upstream_hub_id || model.hub_id);
      const candidates = (data.models || []).filter(m => m.access === 'open' &&
        m.configuration_kind === 'runtime_conversion' && hub(m.upstream_hub_id) === upstream);
      if (candidates.length === 1) {
        const span = clipSpan(data, candidates[0]);
        if (span) speed = {...span, status:'assumed', proxy:true,
          upstream_hub_id:candidates[0].upstream_hub_id,
          upstream_commit:candidates[0].upstream_commit || null,
          lineage:lineage ? {...lineage,sources:lineage.sources.slice()} : null,
          note:'Alternate Q8 deployment proxy, not the accuracy-tested configuration. Two short-clip span, not a confidence interval.'};
      }
    }
    const cost = speed && positive(hourlyRate) ? {status:'assumed',
      low:hourlyRate / speed.high, high:hourlyRate / speed.low,
      hourlyRate, unit:'usd_per_audio_hour', utilization:1, market_price:false,
      note:'Illustrative reference-machine hourly cost at 100% utilization; excludes loading, idle time and rental minimums. Not an API tariff.'} : null;
    const memory = positive(size?.parameters_million) ? {status:'assumed',
      fp16_weights_gb:size.parameters_million * .002, kind:'weights_only_floor',
      runtime_extra:true, precision:'FP16', unit:'decimal_GB',
      parameter_record:size.field_records?.parameters_million || size,
      documented_vram:documentedVram(model),
      note:'Hypothetical FP16 weights only: total parameters × 2 bytes. Runtime, activations and buffers are extra; not total VRAM or actual quantized memory.'} : null;
    return speed || memory ? {status:speed?.status || 'assumed', speed, cost, memory} : null;
  }
  return {getDeployment, reference};
});
