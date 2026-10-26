/* Reviewed 2026-10-26 import. Idempotent; existing observations are never replaced. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, value) =>
  fs.writeFileSync(path.join(root, p), JSON.stringify(value, null, 2) + '\n');
const date = '2026-10-26';
const registry = read('data/models/registry.json');
const sources = read('data/ocr/sources.json');
const reference = read('data/ocr/reference-throughput.json');
const dimensions = read('data/ocr/dimensions.json');
const config = read('data/ocr/config.json');
const report = 'ocria-report-202610';
const announcement = 'ocria-announcement-20261022';
const router = 'opendocrouter-ocria-20261026';
const opb = 'datalab-open-omniparse-20261023';
const mappings = {};
function addSource(id, title, url, kind, note) {
  const source = { title, url, kind, note, verified_on: date };
  if (sources[id]) assert.deepEqual(sources[id], source, 'Conflicting source ' + id);
  else sources[id] = source;
}
addSource(
  report,
  'OCRia-1 technical report, October 2026',
  'https://www.llamaindex.ai/ocria/ocria-1-technical-report.pdf',
  'author_reported',
  'LlamaIndex author evaluation. Tables 3/4/16/17/18/19 and Appendix E. Four-category ParseBench is not the existing five-category overall. Table 16 reprints competitor baselines; Table 17 includes two reused baselines. Source-native precision and configurations remain distinct.'
);
addSource(
  announcement,
  'OCRia-1 announcement and higher-precision plots',
  'https://www.llamaindex.ai/blog/parse-ocria-1',
  'author_reported',
  'Same LlamaIndex operator, not independent corroboration of its PDF. Plots provide some higher-precision values; missing components are not borrowed. The announcement lists LightOnOCR-3 standardized olmOCR overall 81.2, while PDF Table 17 says 82.1; the PDF protocol import uses 82.1 and records the conflict.'
);
addSource(
  router,
  'OpenDocRouter OCRia recipe, tariffs and latency',
  'https://www.opendocrouter.ai/models',
  'vendor',
  'OpenDocRouter is a LlamaIndex product, not independent corroboration. OCRia recipe version 2026-10-22. Overall averages five ParseBench categories; grounding recipe is not established as equivalent to the bare model. $13.04/1000 pages is a token-workload estimate; 2.2 seconds is median request latency, not batched throughput.'
);
addSource(
  'ocria-router-ownership',
  'LlamaIndex introduces OpenDocRouter',
  'https://www.llamaindex.ai/blog/introducing-opendocrouter',
  'official',
  'Establishes common ownership and optional grounding engine, not independent model execution.'
);
addSource(
  opb,
  'Datalab open-weight OmniParseBench comparison, October 23',
  'https://app.datalab.to/blog/open-ocr-models-omniparsebench',
  'vendor_comparison',
  'Complete 17-row table, dataset revision 961c0f89; 16,288 tests on 2,937 pages. Preserve documented vendor pipelines, retries and deviations. Indra is reused repository evidence with ambiguous version presentation, not a new independent run. Hunyuan serving section specifies 1.5 despite the shortened headline label.'
);
addSource(
  'omniparse-cell-family-961c0f89',
  'OmniParseBench test families and pinned dataset',
  'https://huggingface.co/datasets/datalab-to/omni_parse_bench/tree/961c0f89',
  'official',
  'The tables family comprises 5,386 table_cell tests. This is not the table-tag composite, which can include other test families.'
);
addSource(
  'ocria-h100-hardware',
  'NVIDIA H100 reference specifications',
  'https://www.nvidia.com/en-us/data-center/h100/',
  'official',
  'H100 SXM: 80GB, 3.35 TB/s bandwidth. Hardware specifications constrain a planning scenario; they do not measure OCRia throughput.'
);
addSource(
  'ocria-b200-hardware',
  'NVIDIA DGX B200 specifications',
  'https://www.nvidia.com/en-us/data-center/dgx-b200/',
  'official',
  'Eight B200 GPUs, 64 TB/s aggregate HBM bandwidth: 8 TB/s per GPU. Native FP4 is not an H100 execution path. Do not use system-wide throughput as single-GPU throughput.'
);
function model(record) {
  const existing = registry.find((r) => r.id === record.id);
  if (existing) assert.deepEqual(existing, record, 'Conflicting new model ' + record.id);
  else registry.push(record);
  return record.id;
}
model({
  id: 'ocria-1',
  name: 'OCRia-1 (4B)',
  organization: 'LlamaIndex',
  access: 'closed',
  topics: ['ocr'],
  release_date: '2026-10-22',
  release_provenance: 'verified',
  release_source_id: router,
  source_id: report,
  ranking_identity: 'ocria-1',
  configuration:
    'Reported OCRia-1 checkpoint. Report protocols are separate from the OpenDocRouter five-category recipe.',
  evidence_note:
    'Hosted availability verified through the versioned OpenDocRouter listing and LlamaParse announcement. Public downloadable weights were not established. H100 speed is hypothetical, not hosted API throughput.',
  price_context: {
    label: 'Router ≈$13.04†',
    amount_per_1000_pages: 13.04,
    currency: 'USD',
    verified_on: date,
    source_id: router,
    note: 'Context only: OpenDocRouter recipe workload estimate, not a flat tariff or a matched cost for the report checkpoint. Actual routed recipe is listed separately.'
  }
});
model({
  id: 'ocria-1-opendocrouter-20261022',
  name: 'OCRia-1 · OpenDocRouter recipe',
  organization: 'LlamaIndex',
  access: 'closed',
  topics: ['ocr'],
  release_date: '2026-10-22',
  release_provenance: 'verified',
  release_source_id: router,
  source_id: router,
  ranking_identity: 'ocria-1',
  configuration:
    'llamaindex/ocria-1, OpenDocRouter recipe version 2026-10-22. Five-category evaluation; grounding augmentation/configuration not pinned.',
  evidence_note:
    'Separate routed configuration; no report checkpoint accuracy or native GPU speed inherited. Operator is LlamaIndex.'
});
function resolve(label, candidates, source = report, access = 'open') {
  const found = candidates.map((id) => registry.find((m) => m.id === id)).filter(Boolean);
  if (found.length) {
    mappings[label] = found[0].id;
    return found[0].id;
  }
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = registry.filter((m) => normalize(m.name) === normalize(label));
  if (exact.length === 1) {
    mappings[label] = exact[0].id;
    return exact[0].id;
  }
  throw Error(
    'Unresolved exact model ' +
      label +
      ': ' +
      registry
        .filter((m) => normalize(m.name).includes(normalize(label).slice(0, 7)))
        .map((m) => m.id + '=' + m.name)
        .join('; ')
  );
}
const peers = [
  resolve('Infinity-Parser2-Pro', ['infinity-parser2-pro']),
  resolve('LightOnOCR-3-4B', ['lightonocr-3-4b']),
  resolve('olmOCR-2', ['olmocr-2', 'olmocr2', 'olmocr-2-7b-1025', 'olmocr2-7b']),
  resolve('Chandra OCR 2', ['chandra-2-open']),
  resolve('dots.mocr', ['dots-mocr']),
  resolve('Surya OCR 2', ['surya-ocr-2']),
  resolve('LightOnOCR-2-1B', ['lightonocr-2-1b', 'lightonocr-2', 'lightonocr2']),
  resolve('Mistral OCR 4.1', ['mistral-ocr-4-1', 'mistral-ocr-4.1', 'mistral-ocr-41']),
  'ocria-1'
];
function append(file, records, key) {
  const filename = path.join(root, file);
  const original = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
  const existing = original.trim() ? original.trim().split('\n').map(JSON.parse) : [];
  const map = new Map(existing.map((r) => [key(r), r]));
  const added = [];
  for (const row of records) {
    const old = map.get(key(row));
    if (old) assert.deepEqual(old, row, 'Conflicting observation ' + key(row));
    else {
      added.push(row);
      map.set(key(row), row);
    }
  }
  if (added.length)
    fs.writeFileSync(
      filename,
      original +
        (original && !original.endsWith('\n') ? '\n' : '') +
        added.map((r) => JSON.stringify(r)).join('\n') +
        '\n'
    );
}
const protocols = [];
function panel(id, label, family, source, keys, values, options = {}) {
  const labels = Object.fromEntries(keys.map((key) => [key, key.replaceAll('_', ' ')]));
  const definition = {
    id,
    short: options.short || label,
    label,
    family,
    source,
    primary_metric: options.primary_metric || 'overall',
    unit: options.unit || 'percent',
    direction: 'higher',
    core: false,
    primary: false,
    aggregate_eligible: !!options.eligible,
    aggregate_priority: options.priority || 125,
    matrix_extra: !!options.eligible,
    metric_labels: labels,
    metric_units: Object.fromEntries(
      keys.map((key) => [key, options.units?.[key] || options.unit || 'percent'])
    ),
    metric_directions: Object.fromEntries(keys.map((key) => [key, 'higher'])),
    note: options.note,
    ...(options.scope ? { scope: options.scope } : {}),
    ...(options.eligible ? { aggregate_caveat: options.note } : {})
  };
  const file = 'data/ocr/tests/' + id + '.json';
  if (fs.existsSync(path.join(root, file))) assert.deepEqual(read(file), definition);
  else write(file, definition);
  const observations = values.map((row, i) => ({
    model: options.models?.[i] || peers[i],
    metrics: Object.fromEntries(
      keys.map((key, j) => [key, row[j]]).filter(([, value]) => value !== null)
    ),
    source_id: source,
    evidence:
      (options.models?.[i] || peers[i]) === 'ocria-1'
        ? 'author_reported'
        : options.evidence?.[i] || 'vendor_comparison',
    measurement_operator: options.operator || 'LlamaIndex',
    verified_on: date,
    configuration:
      options.configurations?.[i] ||
      options.configuration ||
      'Source report configuration; see exact protocol and source notes.',
    note: options.rowNotes?.[i] || options.note,
    ...(options.comparable?.[i] === false ? { comparable: false } : {}),
    ...(options.extra?.[i] || {})
  }));
  append('data/ocr/results/' + id + '.jsonl', observations, (r) => r.model + '|' + r.source_id);
  protocols.push({ id, source, keys, values, models: observations.map((r) => r.model) });
  return id;
}
const parseNote =
  'LlamaIndex-operated four-category ParseBench: excludes visual grounding. PDF Table 4 ratios converted exactly to percent, without adding precision. Not interchangeable with the existing five-category published overall. All nine comparison rows retained.';
const parse = panel(
  'parsebench-ocria-four-202610',
  'ParseBench · OCRia four-category report',
  'parsebench',
  report,
  ['overall', 'tables', 'charts', 'formatting', 'text'],
  [
    [74, 86, 61, 59, 90],
    [75, 83, 66, 64, 89],
    [43, 73, 14, 2, 84],
    [75, 89, 65, 61, 84],
    [56, 85, 0, 47, 90],
    [58, 80, 1, 68, 84],
    [61, 78, 15, 64, 88],
    [68, 74, 40, 66, 90],
    [87, 92, 85, 83, 90]
  ],
  { short: 'Parse 4-cat', eligible: true, note: parseNote }
);
// Keep higher-precision announcement values as separate observations, not merged components.
const blogRows = [
  [1, 75.3, 82.5, 66.1, 63.5],
  [2, 43.3, 73, 13.7, 2.2],
  [3, 74.8, 89.2, 65.1, 61.4],
  [4, 55.6, 85.2, 0.1, 47],
  [5, 58.4, null, 1.2, 67.9],
  [6, 61.1, null, 15.2, 63.5],
  [7, 67.5, null, 40.1, 66.4],
  [8, 87.4, 91.5, 85.1, 83.4]
];
append(
  'data/ocr/results/' + parse + '.jsonl',
  blogRows.map(([i, overall, tables, charts, formatting]) => ({
    model: peers[i],
    source_id: announcement,
    evidence: i === 8 ? 'author_reported' : 'vendor_comparison',
    measurement_operator: 'LlamaIndex',
    verified_on: date,
    metrics: Object.fromEntries(
      Object.entries({ overall, tables, charts, formatting }).filter(([, v]) => v !== null)
    ),
    note: 'Higher-precision announcement plot; same author, not independent evidence. PDF observation retained separately. No missing component is borrowed from another observation.'
  })),
  (r) => r.model + '|' + r.source_id
);
const olmKeys = [
  'arxiv',
  'old_scans_math',
  'tables',
  'old_scans',
  'headers_footers',
  'multi_column',
  'long_tiny_text',
  'base',
  'overall'
];
const published = panel(
  'olmocr-ocria-published-202610',
  'olmOCR · OCRia published-configuration panel',
  'olmocr',
  report,
  olmKeys,
  [
    [88.1, 91.3, 91.2, 58.2, 95.8, 83.7, 92.5, 99.9, 87.6],
    [91.1, 89.1, 90.2, 52.5, 89.2, 85.6, 93.2, 99.5, 86.3],
    [82.9, 82.1, 84.3, 48.3, 95.7, 84.3, 81.4, 99.7, 82.3],
    [86.9, 89.1, 92.1, 51.1, 91.4, 82.1, 93.7, 99.9, 85.8],
    [85.9, 85.5, 90.7, 48.2, 94, 85.3, 81.6, 99.7, 83.9],
    [88.3, 81.4, 86.6, 41.8, 92.5, 82.4, 93.7, 99.7, 83.3],
    [89.6, 85.6, 89, 42.2, 19.7, 84.8, 91.4, 99.6, 75.2],
    [82.6, 72.3, 85.9, 47.9, 91.4, 84.5, 91.2, 99.5, 81.9],
    [89.6, 89.1, 92.9, 48.9, 81.4, 81.6, 93.7, 99.9, 84.6]
  ],
  {
    short: 'olm published',
    note: 'PDF Table 16. OCRia row is an author run; competitors are reprinted published baselines, not new LlamaIndex executions. Mixed rendering/pipelines. Diagnostic only; never pooled with Table 17. LightOnOCR-2 overall includes headers/footers, unlike its published seven-category headline.',
    evidence: Array(8).fill('secondary').concat('author_reported')
  }
);
const standardized = panel(
  'olmocr-ocria-1288-202610',
  'olmOCR · OCRia 1,288px operator panel',
  'olmocr',
  report,
  olmKeys,
  [
    [82.9, 85.2, 87.7, 51, 92.1, 82.8, 84.4, 99.9, 83.2],
    [86.9, 78.8, 87.6, 48.7, 87.6, 84.3, 83.5, 99.7, 82.1],
    [82.9, 82.1, 84.3, 48.3, 95.7, 84.3, 81.4, 99.7, 82.3],
    [80.3, 84.3, 86.7, 45.8, 90.8, 80.7, 81.2, 99.9, 81.2],
    [77.9, 78.4, 86.3, 40.9, 90.2, 82.2, 85.3, 99.6, 80.1],
    [78.8, 76, 82.1, 38.2, 93.2, 79.9, 73.3, 99.7, 77.6],
    [88.1, 87.3, 85.7, 40.3, 22.4, 83.8, 80.3, 99.5, 73.4],
    [82.6, 72.3, 85.9, 47.9, 91.4, 84.5, 91.2, 99.5, 81.9],
    [85, 87.8, 92.9, 46.6, 81.8, 81.4, 92.3, 93.8, 83.5]
  ],
  {
    short: 'olm 1288',
    eligible: true,
    note: 'PDF Table 17. LlamaIndex runs use 1,288px long-edge rendering, vLLM at each model image budget, common post-processing and eight-category scoring. Mistral and olmOCR-2 rows are reused external baselines and remain context-only, excluded from comparisons. Blog gives LightOnOCR-3 81.2; PDF table gives 82.1, retained here.',
    comparable: [true, true, false, true, true, true, true, false, true],
    evidence: [
      'vendor_comparison',
      'vendor_comparison',
      'secondary',
      'vendor_comparison',
      'vendor_comparison',
      'vendor_comparison',
      'vendor_comparison',
      'secondary',
      'author_reported'
    ]
  }
);
const pulse = panel(
  'pulsebench-tab-ocria-202610',
  'PulseBench-Tab · OCRia cropped-table report',
  'pulsebench-tab',
  report,
  ['mean', 'coverage', 'median', 'perfect_percent'],
  [
    [0.82, 96.8, 0.93, 23],
    [0.82, 96.6, 0.93, 23.7],
    [0.8, 92.4, 0.9, 19.5],
    [0.8, 93, 0.92, 18.7],
    [0.82, 88.7, 0.92, 16.9],
    [0.71, 93.7, 0.82, 12.3],
    [0.81, 89.6, 0.9, 19.5],
    [0.75, 97.7, 0.82, 14.8],
    [0.84, 99.1, 0.95, 26.6]
  ],
  {
    short: 'Pulse crops',
    primary_metric: 'mean',
    unit: 'ratio',
    units: { coverage: 'percent', perfect_percent: 'percent' },
    note: 'PDF Table 18: 1,820 cropped tables / nine languages. Mean and median T-LAG exclude unparseable predictions. Coverage and perfect-table counts retained; this is not full-page detection plus extraction. Diagnostic only; no overall or table-rating family vote.',
    scope: '1,820 cropped tables; nine languages',
    extra: [419, 431, 354, 340, 308, 224, 354, 269, 485].map((n) => ({
      perfect_tables: n,
      table_count: 1820
    }))
  }
);
const frenchFamily = read('data/ocr/tests/fr-bench-lighton-202610.json').family;
const french = panel(
  'fr-bench-ocria-202610',
  'French PDF · OCRia operator panel',
  frenchFamily,
  report,
  [
    'forms',
    'graphics',
    'handwritten',
    'long_table',
    'long_table_2',
    'multi_column',
    'tiny_text',
    'overall'
  ],
  [
    [33.9, 26.9, 33.3, 51.5, 50, 76.4, 78.7, 54.9],
    [49.6, 68.3, 41.2, 80.6, 70.7, 83.6, 83.2, 71.4],
    [43.8, 37.7, 20.6, 67.9, 63.9, 84.8, 66.2, 56.9],
    [38.3, 72.8, 22.4, 80.6, 77.8, 70.9, 70, 65.5],
    [40.1, 26.1, 13.9, 56.7, 59.8, 80.6, 79.3, 56.8],
    [22.6, 26.6, 1.8, 74.6, 66.1, 73.3, 64.5, 50.9],
    [35.4, 32.9, 12.1, 73.9, 61.3, 78.8, 64.7, 53.5],
    [39.4, 55.8, 11.5, 69.4, 59.8, 73.3, 57.4, 54.1],
    [46, 78.5, 21.2, 83.2, 81.9, 77, 78.9, 72.1]
  ],
  {
    short: 'French OCRia',
    eligible: true,
    note: 'PDF Table 19: 2,318 tests on 721 difficult French pages. Separate LlamaIndex operator protocol; retains forms, graphics, handwriting and two long-table categories. Form pass rate is not schema-level KIE/F1.',
    scope: '721 French pages; 2,318 tests'
  }
);
const indra = model({
  id: 'indra-ocr-omniparse-20261023',
  name: 'Indra OCR · Oct 23 reported run',
  organization: 'Datalab',
  access: 'open',
  topics: ['ocr'],
  release_date: null,
  release_provenance: 'unknown',
  source_id: opb,
  configuration:
    'October 23 blog row 71.4. Serving section says v1.1 auto + math on CPU, while the post warns that the dataset card Indra version differs. Exact identity unresolved.',
  evidence_note:
    'Reused repository result, not a new Datalab rerun; kept context-only rather than silently mapped to the canonical Indra 1.1 entry.'
});
const openModels = [
  peers[3],
  peers[4],
  resolve('MinerU2.5-Pro', ['mineru2-5-pro']),
  peers[0],
  peers[5],
  peers[1],
  resolve('LightOnOCR-3-0.8B', ['lightonocr-3-0-8b', 'lightonocr-3-0.8b']),
  resolve('GLM-OCR', ['glm-ocr']),
  resolve('Nemotron 3.5 Parse', ['nemotron-3-5-parse', 'nemotron35-parse', 'nemotron-3.5-parse']),
  resolve('Unlimited-OCR', ['unlimited-ocr']),
  resolve('PaddleOCR-VL-1.6', ['paddleocr-vl-1-6']),
  resolve('Infinity-Parser2-Flash', ['infinity-parser2-flash']),
  resolve('DeepSeek-OCR-2', ['deepseek-ocr-2']),
  indra,
  resolve('HunyuanOCR-1.5', ['hunyuanocr-1-5', 'hunyuanocr1-5']),
  peers[2],
  resolve('Nanonets-OCR2-3B', ['nanonets-ocr2-3b', 'nanonets-ocr2-open'])
];
const opbConfigs = [
  'chandra-ocr ocr_layout; 300 DPI; greedy/top_p 0.1; 12,384 tokens; repetition and truncation retries.',
  'Vendor prompt_layout_all_en; 200 DPI; temperature 0.1; 32,768 tokens; JSON fallback.',
  'mineru-vl-utils two-stage layout/content extraction; 200 DPI; native prompts; client retries off.',
  'Infinity SDK document-to-JSON; 300 DPI; thinking off; TP=2 on two H100s; headers/footers preserved.',
  'surya-ocr 0.22.1; 192 DPI; vLLM 0.20.1 with MTP; up to six retries and native region fallback.',
  'LightOn grounding; 400 DPI capped at 5MP; temperature 0.1; 12,288 tokens.',
  'LightOn grounding; 400 DPI capped at 5MP; temperature 0.1; 12,288 tokens.',
  'GLM SDK + PP-DocLayoutV3 at 200 DPI; 12 single-request processes; normally omitted regions retained.',
  'nvidia/Nemotron-3.5-Parse@62cb1e4; client 3.5.0.post7; vLLM 0.26.0; single pass, MTP1, FlashAttention3, 64 pages in flight; temperature 0.2. Not greedy or triple-pass.',
  'Vendor vLLM recipe; 300 DPI; n-gram handling; 28,000 token allowance versus example 8,192.',
  'PaddleX VL1.6 + PP-DocLayoutV3 CPU layout at 144 DPI; all blocks retained.',
  'Infinity SDK document-to-JSON; 300 DPI; thinking off; 32,768 tokens; headers/footers retained.',
  'Repository vLLM0.8.5 + model code at 144 DPI; crop mode; grounding prompt; 8,192 tokens; wrapped HTTP serving.',
  'Reused repository evidence; CPU four vCPUs; auto + math. Blog/table version ambiguity retained.',
  'HunyuanOCR1.5 layout_parse; vLLM0.18.1; prior compatible config.json with identical current weights/tokenizer/processor; 2,048px input.',
  'olmOCR2 native 1,288px pipeline and retry schedule; final embedded-text fallback disabled; no layout.',
  'Nanonets-OCR2-3B generic document prompt, not optional financial prompt; 2,048px input; temperature0; 15,000 tokens; no layout.'
];
const openPanel = panel(
  'omniparse-open-20261023',
  'OmniParseBench · open models Oct 23',
  'omniparse',
  opb,
  ['overall', 'text', 'tables', 'layout'],
  [
    [90.1, 87.4, 87.4, 95.4],
    [87.9, 82.5, 88.6, 92.5],
    [87.1, 77.4, 92.1, 91.7],
    [87, 83.3, 84.1, 93.5],
    [83.1, 80.6, 74.3, 94.3],
    [82.9, 83.9, 70.8, 94],
    [81.6, 81.1, 72.1, 91.7],
    [81.5, 71, 84.2, 89.3],
    [80, 72.4, 77.3, 90.2],
    [79.3, 70.2, 76.5, 91.1],
    [78.7, 61.7, 83.7, 90.7],
    [78.4, 78.4, 66.5, 90.4],
    [75.2, 64.2, 70, 91.4],
    [71.4, 62.7, 59.6, 92],
    [64.6, 50.5, 61.9, 81.4],
    [null, 71.3, 56.6, null],
    [null, 68.2, 62.6, null]
  ],
  {
    short: 'OP open',
    models: openModels,
    eligible: true,
    operator: 'Datalab',
    configurations: opbConfigs,
    comparable: openModels.map((m) => m !== indra),
    evidence: openModels.map((m) =>
      m === indra
        ? 'secondary'
        : [peers[3], peers[5]].includes(m)
          ? 'author_reported'
          : 'vendor_comparison'
    ),
    scope: 'Dataset 961c0f89; 16,288 tests / 2,937 pages / 92 languages; 5,386 table_cell tests',
    note: 'October 23 complete 17-model cohort. Tables is the table_cell family, not the table-tag composite. Overall is the mean of text/tables/layout. Unsupported layout and headline remain absent. Vendor pipelines and exceptions are preserved per observation; one family budget, not an extra vote per component.',
    extra: openModels.map(() => ({
      dataset_version: '961c0f89',
      dataset_source_id: 'omniparse-cell-family-961c0f89',
      sample_count: 16288,
      sample_unit: 'pass/fail tests',
      table_test_count: 5386,
      page_count: 2937
    }))
  }
);
panel(
  'parsebench-ocria-router-20261026',
  'ParseBench · OCRia OpenDocRouter recipe',
  'parsebench',
  router,
  ['overall'],
  [[84.67]],
  {
    short: 'Router recipe',
    models: ['ocria-1-opendocrouter-20261022'],
    operator: 'LlamaIndex / OpenDocRouter',
    evidence: ['author_reported'],
    note: 'Five-category hosted recipe mean. Separate from report four-category scores. Grounding configuration is not pinned; one recorded recipe cannot establish a comparison cohort. Not independent evidence.',
    configuration: 'llamaindex/ocria-1 recipe version2026-10-22; observed2026-10-26.'
  }
);
function dim(
  name,
  id,
  benchmark,
  short,
  label,
  keys,
  unit = 'percent',
  rating = false,
  note = '',
  priority = 100
) {
  const entry = {
    id,
    benchmark,
    short,
    label,
    keys,
    unit,
    direction: 'higher',
    rating,
    note,
    priority
  };
  const old = dimensions.views[name].panels.find((p) => p.id === id);
  if (old) assert.deepEqual(old, entry);
  else dimensions.views[name].panels.push(entry);
}
dim(
  'tables',
  'ocria-parse-table',
  parse,
  'Parse 4-cat tables',
  'Table component',
  ['tables'],
  'percent',
  true,
  'Exact four-category author protocol. Existing five-category table panel keeps priority for shared pairs; no second ParseBench vote.',
  100
);
dim(
  'tables',
  'ocria-olm-table',
  standardized,
  'olm 1288 tables',
  'Table-category tests',
  ['tables'],
  'percent',
  true,
  'Exact LlamaIndex rendering/operator cohort; reused baselines remain context-only.',
  100
);
dim(
  'tables',
  'opb-cell',
  openPanel,
  'OmniParse cells',
  'Table-cell family',
  ['tables'],
  'percent',
  true,
  '5,386 table_cell checks of cells, headings and neighbours. Not the mixed table-tag slice.',
  100
);
dim(
  'tables',
  'pulse-crops',
  pulse,
  'Pulse crops mean',
  'Cropped-table T-LAG mean',
  ['mean'],
  'ratio',
  false,
  'Only parseable predictions scored. Read coverage beside this mean; not end-to-end table extraction.'
);
dim(
  'tables',
  'pulse-coverage',
  pulse,
  'Pulse coverage',
  'Parseable table coverage',
  ['coverage'],
  'percent',
  false,
  'Denominator: all 1,820 cropped tables. Not another ranking vote.'
);
dim(
  'layout',
  'opb-layout',
  openPanel,
  'OmniParse layout',
  'Layout-kind test family',
  ['layout'],
  'percent',
  false,
  'Typed block/content association, not reading-order edit distance. Unsupported boxes remain missing.'
);
if (!dimensions.views['charts-formatting'])
  dimensions.views['charts-formatting'] = {
    label: 'Charts / formatting',
    title: 'Charts and formatting · benchmark-specific diagnostics',
    mode: 'diagnostic',
    description:
      'Separate chart-data extraction and semantic-formatting results. No combined rating and no field-level KIE claim. Four-category author evaluations remain separate from five-category published panels.',
    panels: []
  };
dim(
  'charts-formatting',
  'published-charts',
  'parsebench-published-9af4102',
  'Published charts',
  'Chart component',
  ['chart']
);
dim(
  'charts-formatting',
  'published-format',
  'parsebench-published-9af4102',
  'Published formatting',
  'Semantic formatting',
  ['text_formatting']
);
dim('charts-formatting', 'ocria-charts', parse, 'OCRia panel charts', 'Chart data extraction', [
  'charts'
]);
dim('charts-formatting', 'ocria-format', parse, 'OCRia panel formatting', 'Semantic formatting', [
  'formatting'
]);
const native = [
  [1, 2.16, 4734, null],
  [8, 7.42, 1932, 9964],
  [16, 8.67, 1103, 12740],
  [32, 9.77, 566, 14833],
  [48, 9.98, 400, 15240],
  [64, 10.21, 302, 15557]
];
append(
  'data/ocr/throughput.jsonl',
  native.map(([concurrency, pps, tps, aggregate]) => ({
    id: 'ocria-b200-c' + concurrency + '-report-202610',
    model: 'ocria-1',
    source_id: report,
    as_of: date,
    unit: 'pages_per_second',
    pages_per_second: pps,
    status: 'observed',
    evidence: 'author_reported',
    comparison_default: false,
    hardware_known: true,
    cost_eligible: false,
    hardware: '1 NVIDIA B200; original measurement, not H100',
    pipeline:
      'Final custom serving stack: mixed NVFP4/FP8 target, BF16 vision encoder, DFlash2 draft, custom kernels; greedy production prompt.',
    dataset:
      'Production pages rendered at4.1MP, about3,900 image tokens; median request about1,300 output tokens. Not the H100 reference workload.',
    batch: concurrency + ' concurrent requests; AIPerf mean of three runs.',
    precision: 'Mixed NVFP4/FP8 target; BF16 vision; not portable unchanged to H100.',
    comparison_cohort: 'ocria-report-table20-b200',
    note: 'Source Appendix E.1/Table20. Decode tokens/s excludes time to first token; page throughput is end-to-end aggregate. Table21 has a separate c8 result7.83; this observation retains the concurrency-sweep result7.42. Original measurements stay in Details.',
    output_tokens_per_second_per_request: tps,
    ...(aggregate ? { aggregate_output_tokens_per_second: aggregate } : {})
  })),
  (r) => r.id
);
const transfer = {
  model: 'ocria-1',
  profile: 'h100-80gb-v1',
  status: 'estimated',
  evidence: 'assumed',
  hypothetical: true,
  as_of: date,
  source_ids: [report, 'ocria-h100-hardware', 'ocria-b200-hardware'],
  confidence: 'low',
  low: 0.3,
  high: 6,
  fit_class: 'hypothetical_hosted_runtime_port',
  fit: 'Hypothetical access to the4B checkpoint, draft and compatible H100 implementation. Target1xH10080GB without offload or sharding, memory-fitting batching up to16. BF16/FP16 fallback; upper range assumes useful drafting/kernel optimizations can be ported without native NVFP4. No downloadable weights, successful port or peak-VRAM measurement is established.',
  basis:
    'Engineering planning envelope, not measured H100 throughput or API speed. Use Table20 c16=8.67 pages/s, not c64=10.21, to match the reference concurrency ceiling. Bandwidth-only sensitivity anchor8.67*(3.35/8)=3.6306 pages/s. Apply explicitly subjective0.08–1.65 runtime/precision/workload factors and round to0.3–6. The low end allows loss of custom speculative/quantized speedups; the high end assumes a useful compatible draft/runtime and lighter reference pages. The source4.1MP/image-token budget and output lengths differ from the common up-to2048px,1000–3000 output-token scenario. The ratio is not a universal GPU conversion; the factor range is not a fitted confidence interval. BF16 stock-vLLM baseline321–333 end-to-end tokens/s is retained as a warning that the optimized stack can dominate hardware scaling. No native NVFP4 support on H100 is assumed.',
  transfer_assumptions: {
    source_observation_id: 'ocria-b200-c16-report-202610',
    source_pages_per_second: 8.67,
    source_concurrency: 16,
    target_max_concurrency: 16,
    source_bandwidth_tb_s: 8,
    target_bandwidth_tb_s: 3.35,
    subjective_runtime_workload_factors: [0.08, 1.65],
    output_range_pages_per_second: [0.3, 6],
    interval_kind: 'judgmental scenario, not statistical confidence'
  }
};
const oldReference = reference.models.find((r) => r.model === transfer.model);
if (oldReference) assert.deepEqual(oldReference, transfer);
else reference.models.push(transfer);
const routeModel = 'ocria-1-opendocrouter-20261022';
append(
  'data/ocr/pricing.jsonl',
  [
    {
      model: routeModel,
      source_id: router,
      provider: 'OpenDocRouter / LlamaIndex',
      mode: 'llamaindex/ocria-1 recipe2026-10-22; typical ParseBench workload',
      unit: 'usd_per_1000_pages',
      usd_per_1000_pages: 13.04,
      basis: 'benchmark_estimate',
      verification_status: 'verified',
      verified_on: date,
      as_of: date,
      note: 'Token-derived workload estimate, not a flat page tariff. Exact routed recipe is separate from report checkpoint. Same company as model author.'
    }
  ],
  (r) => [r.model, r.source_id, r.mode, r.unit, r.as_of].join('|')
);
append(
  'data/ocr/pricing-tokens.jsonl',
  [
    {
      model: routeModel,
      source_id: router,
      provider: 'OpenDocRouter',
      api_model: 'llamaindex/ocria-1',
      mode: 'Recipe2026-10-22 token tariff',
      unit: 'usd_per_million_tokens',
      input_usd_per_million_tokens: 0.97,
      cached_input_usd_per_million_tokens: 0.97,
      output_usd_per_million_tokens: 4.83,
      basis: 'vendor_list',
      verification_status: 'verified',
      verified_on: date,
      as_of: date,
      note: 'Maximum page charge$0.18. Token tariff is not observed page usage. OCRia recipe version2026-10-22; not the stale footer price date.'
    }
  ],
  (r) => [r.model, r.source_id, r.mode, r.unit, r.as_of].join('|')
);
append(
  'data/ocr/throughput.jsonl',
  [
    {
      id: 'ocria-router-median-20261026',
      model: routeModel,
      source_id: router,
      as_of: date,
      unit: 'median_seconds_per_page',
      display_value: '2.2 seconds/page median',
      status: 'observed',
      evidence: 'author_reported',
      comparison_default: false,
      hardware_known: false,
      cost_eligible: false,
      hardware: 'Hosted infrastructure undisclosed',
      pipeline: 'OpenDocRouter recipe2026-10-22',
      dataset: 'Successful live page requests; workload distribution not pinned',
      batch: 'Median page request latency; concurrency unspecified',
      precision: 'Undisclosed hosted recipe',
      comparison_cohort: 'opendocrouter-latency-20261026',
      note: 'Median latency is not reciprocal aggregate throughput and is not converted to H100 speed.'
    }
  ],
  (r) => r.id
);
config.snapshot_date = config.snapshot_date < date ? date : config.snapshot_date;
for (const id of [parse, standardized, french, openPanel])
  if (!config.views.new.tests.includes(id)) config.views.new.tests.push(id);
write('data/models/registry.json', registry);
write('data/ocr/sources.json', sources);
write('data/ocr/reference-throughput.json', reference);
write('data/ocr/dimensions.json', dimensions);
write('data/ocr/config.json', config);
write('data/ocr/research-ocria-20261026.json', {
  verified_on: date,
  source_ids: [report, announcement, router, opb],
  model_mapping: mappings,
  protocols,
  announcement_parse_rows: blogRows,
  source_speed_ladder: native,
  h100_transfer: transfer.transfer_assumptions,
  limitations: [
    'Source verification is not independent reproduction.',
    'Different renderings, four/five-category means and routed configurations remain separate.',
    'Datalab Hunyuan serving section identifies1.5; Indra version ambiguity is context-only.',
    'Table-tag composites stay excluded; genuine table_cell family is admitted.',
    'H100 numeric range is an assumed planning scenario, not an observation, accuracy evidence, API throughput or advertised availability.'
  ]
});
const template = 'src/ocr/index.njk';
let html = fs.readFileSync(path.join(root, template), 'utf8');
if (!html.includes('href="/ocr/charts-formatting/"')) {
  const marker = '<a href="/ocr/fields/">Fields / KIE evidence</a>.';
  assert.ok(html.includes(marker), 'Navigation anchor changed');
  html = html.replace(
    marker,
    '<a href="/ocr/fields/">Fields / KIE evidence</a> ·\n        <a href="/ocr/charts-formatting/">Charts / formatting</a>.'
  );
  fs.writeFileSync(path.join(root, template), html);
}
console.log(
  JSON.stringify(
    {
      model_mapping: mappings,
      protocols: protocols.map((p) => ({ id: p.id, rows: p.values.length })),
      h100_range: [transfer.low, transfer.high]
    },
    null,
    2
  )
);
