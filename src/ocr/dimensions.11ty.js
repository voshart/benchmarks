const { loadOCR } = require('../../lib/load.cjs');
const policy = require('../../data/ocr/dimensions.json');
const Dimensions = require('../assets/js/ocr-dimensions.js');
const View = require('../assets/js/ocr-dimensions-view.js');

module.exports = class {
  data() {
    return {
      dimensionPages: Object.keys(policy.views),
      pagination: { data: 'dimensionPages', size: 1, alias: 'dimensionId' },
      permalink: (data) => `/ocr/${data.dimensionId}/index.html`,
      eleventyExcludeFromCollections: true
    };
  }

  render({ dimensionId }) {
    const data = loadOCR();
    const result = Dimensions.build(data, policy, dimensionId);
    const esc = View.escape,
      asset = (url) => this.assetUrl(url);
    const navigation = Object.entries(policy.views)
      .map(
        ([id, view]) =>
          `<a href="/ocr/${id}/"${id === dimensionId ? ' aria-current="page"' : ''}>${esc(view.label)}</a>`
      )
      .join('');
    const scripts = [
      'pairwise-ranking',
      'ranking',
      'rank-ui',
      'ocr-dimensions',
      'ocr-dimensions-view',
      'ocr-dimensions-page'
    ]
      .map((name) => `<script defer src="${asset('/assets/js/' + name + '.js')}"></script>`)
      .join('\n');
    const coverage = [1, 2, 3, 4, 5]
      .map((n) => `<option value="${n}">${n}+ families</option>`)
      .join('');
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(result.view.title)} | Voshart Benchmarks</title>
  <meta name="description" content="${esc(result.view.description)}">
  <link rel="stylesheet" href="${asset('/assets/css/benchmark.css')}">
  <link rel="stylesheet" href="${asset('/assets/css/ocr-dimensions.css')}">
  <script>
    try {
      document.documentElement.dataset.theme = localStorage.getItem('bench-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {}
  </script>
</head>
<body class="ocr-page ocr-dimensions-page">
<main id="ocrDimension" data-dimension="${dimensionId}" data-snapshot="${esc(data.config.snapshot_date)}">
  <header class="hero">
    <div><small class="eyebrow">Voshart / OCR components</small>
    <h1>${esc(result.view.title)}</h1></div>
    <button type="button" class="quiet" id="dimensionTheme" aria-label="Toggle light and dark mode">Theme</button>
  </header>
  <nav class="dimension-nav" aria-label="OCR evaluation views">
    <a href="/ocr/">Overall OCR</a>${navigation}
  </nav>
  <p id="dimensionDescription">${esc(result.view.description)}</p>
  <div class="controls">
    <label>Model cutoff <input disabled data-dimension-control id="dimensionCutoff" type="date" value="${esc(data.config.snapshot_date)}" min="${esc(data.config.release_start)}" max="${esc(data.config.snapshot_date)}"></label>
    <input disabled data-dimension-control id="dimensionSearch" type="search" placeholder="Search models…" aria-label="Search models">
    <select disabled data-dimension-control id="dimensionCoverage" aria-label="${result.view.mode === 'rating' ? 'Comparison' : 'Reported'} family coverage">
      <option value="0">All reported models</option>${coverage}
    </select>
    <select disabled data-dimension-control id="dimensionAccess" aria-label="Model access">
      <option value="all">All access types</option><option value="open">Open weights</option>
      <option value="closed">Closed / hosted</option><option value="unreleased">Unreleased weights</option>
      <option value="unknown">Unknown access</option>
    </select>
    <button disabled data-dimension-control id="dimensionReset" type="button" class="quiet">Reset</button>
  </div>
  <p id="dimensionStatus" class="key" role="status" aria-live="polite">${esc(View.status(result))}</p>
  <noscript><p>Static snapshot shown. JavaScript enables filtering and sorting; all score details and navigation remain available.</p></noscript>
  <div class="table-scroll" role="region" aria-label="${esc(result.view.title)}" aria-describedby="dimensionDescription" tabindex="0">
    <table class="dimension-table">
      <thead><tr id="dimensionHead">${View.renderHead(result)}</tr></thead>
      <tbody id="dimensionBody">${View.renderRows(result)}</tbody>
    </table>
  </div>
  <p class="key">ⓘ Exact metric, source and alternative observations · * qualified reported evidence · ‡ context only · — no component or no eligible table rating. Values retain their published scales; details retain full precision. Missing values sort last. The cutoff selects model releases, not evidence publication dates.</p>
  <details class="method"><summary>Component methodology and limits</summary>
    <p>These views select explicitly mapped component metrics before choosing a source. They never substitute whole-document totals for missing components. Alternative sources, execution caveats and genuine measured zeros are preserved.</p>
    <p>The experimental table graph uses the existing regularized Bradley–Terry method on eligible table components only. Comparisons stay within an exact protocol. Each model identity has a capped family budget; repeated metrics do not create extra family votes. Only the main connected group can receive ratings, and a model needs at least two contributing families. Single-family and disconnected evidence remains visible without an aggregate rating.</p>
    <p>Table metrics measure different aspects of extraction. Dataset overlap, selective reporting, source execution differences and uncertain pipelines remain limitations. Tiny score differences are not statistically established wins. Source verification is not independent reproduction. Layout and field extraction have no combined score.</p>
    <p>The OmniParse table-tag composite is deliberately excluded: it still mixes text, table and layout checks. TEDS-S and clean/digital PureDoc components are diagnostics, not extra votes. Overall OCR, speech rankings, pricing and speed calculations are unchanged.</p>
    <p><a href="https://github.com/voshart/benchmarks/blob/main/data/ocr/dimensions.md">Full component methodology</a> · <a href="https://github.com/voshart/benchmarks/blob/main/data/ocr/dimensions.json">Explicit protocol mappings</a></p>
  </details>
  <footer><a href="/ocr/">Overall OCR</a> · <a href="/">All benchmarks</a> · Research snapshot ${esc(data.config.snapshot_date)}</footer>
</main>
<script id="dimensionPolicy" type="application/json">${JSON.stringify(policy).replace(/</g, '\\u003c')}</script>
${scripts}
</body>
</html>`;
  }
};
