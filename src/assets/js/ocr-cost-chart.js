/* Presentation only: consumes the table's enriched rows, never changes ratings or costs. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OCRCostChart = api;
})(globalThis, () => {
  'use strict';
  const finite = (n) => typeof n === 'number' && Number.isFinite(n);
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const money = (n) =>
    '$' +
    (n < 0.01
      ? Number(n.toPrecision(2))
      : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const safeURL = (url) => (/^https?:\/\//i.test(url || '') ? url : null);
  const localKinds = new Set(['H100 scenario', 'local compute', 'modeled compute']);
  const contextualKinds = new Set([
    'context',
    'current service',
    'unavailable',
    'no reference cost'
  ]);
  const colors = {
    OpenAI: '#555555',
    Anthropic: '#c66b51',
    Google: '#129858',
    Baidu: '#2463eb',
    LlamaIndex: '#9b51d6',
    NVIDIA: '#65a30d',
    Datalab: '#d97706',
    'LightOn AI': '#0891b2',
    'Z.ai': '#6366f1',
    DeepSeek: '#3b5bdb'
  };
  function color(organization) {
    if (colors[organization]) return colors[organization];
    let hash = 0;
    for (const c of organization) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360}, 59%, 46%)`;
  }
  const median = (values) => {
    const a = [...values].sort((x, y) => x - y),
      i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : a[i - 1] / 2 + a[i] / 2;
  };

  function points(result, data, options = {}) {
    const models = new Map((data.models || []).map((m) => [m.id, m]));
    const included = [],
      omitted = { unrated: 0, unpriced: 0, nonpositive: 0, basis: 0 };
    for (const row of result.rows || []) {
      if (!finite(row.rank) || row.rank < 0 || row.rank > 100) {
        omitted.unrated++;
        continue;
      }
      const cost = row.deployment?.cost;
      if (!cost || !finite(cost.value) || contextualKinds.has(cost.kind)) {
        omitted.unpriced++;
        continue;
      }
      if (cost.value <= 0) {
        omitted.nonpositive++;
        continue;
      }
      const basis = localKinds.has(cost.kind) ? 'local' : 'hosted';
      if (options.basis && options.basis !== 'all' && options.basis !== basis) {
        omitted.basis++;
        continue;
      }
      const model = models.get(row.id) || row,
        organization = model.organization || 'Unknown organization';
      const range =
        finite(cost.low) &&
        finite(cost.high) &&
        cost.low > 0 &&
        cost.low <= cost.value &&
        cost.high >= cost.value;
      included.push({
        id: row.id,
        name: row.name,
        organization,
        rating: row.rank,
        cost: cost.value,
        low: range ? cost.low : cost.value,
        high: range ? cost.high : cost.value,
        costLabel: cost.label || money(cost.value),
        costKind: cost.kind,
        costNote: cost.note || '',
        estimated: !!cost.estimated,
        basis,
        color: color(organization),
        source: safeURL(data.sources?.[cost.source_id]?.url),
        modelSource: safeURL(data.sources?.[model.source_id || row.modelSourceId]?.url),
        ratingNote: row.rankExplanation || 'Estimated OCR quality; not an accuracy percentage.'
      });
    }
    return { points: included, omitted, total: (result.rows || []).length };
  }

  // Exact ties share the frontier. A cheaper point with equal rating dominates a dearer one.
  function frontier(input) {
    const sorted = [...input]
      .filter((p) => finite(p.cost) && p.cost > 0 && finite(p.rating))
      .sort((a, b) => a.cost - b.cost || b.rating - a.rating || a.id.localeCompare(b.id));
    const out = [];
    let best = -Infinity,
      bestCost = null;
    for (const p of sorted) {
      if (p.rating > best) {
        out.push(p);
        best = p.rating;
        bestCost = p.cost;
      } else if (p.rating === best && p.cost === bestCost) out.push(p);
    }
    return out;
  }

  function geometry(input, ranges = true) {
    const values = input.flatMap((p) => (ranges ? [p.low, p.high] : [p.cost]));
    let lo = Math.log10(Math.min(...values)),
      hi = Math.log10(Math.max(...values));
    const pad = Math.max(0.12, (hi - lo) * 0.06);
    lo -= pad;
    hi += pad;
    if (hi - lo < 0.8) {
      const center = (hi + lo) / 2;
      lo = center - 0.4;
      hi = center + 0.4;
    }
    const x = (value) => 82 + ((Math.log10(value) - lo) / (hi - lo)) * 898,
      y = (value) => 466 - (value / 100) * 418;
    const ticks = [];
    for (let power = Math.floor(lo); power <= Math.ceil(hi); power++) {
      for (const factor of [1, 2, 5]) {
        const value = factor * 10 ** power;
        if (finite(value) && value > 0 && Math.log10(value) >= lo && Math.log10(value) <= hi)
          ticks.push(value);
      }
    }
    return {
      x,
      y,
      ticks: ticks.filter((_, i) => i % Math.max(1, Math.ceil(ticks.length / 9)) === 0)
    };
  }

  function labels(input, selected, plot) {
    const boxes = [],
      out = [];
    for (const p of selected) {
      const text = p.name.length > 30 ? p.name.slice(0, 28) + '…' : p.name,
        width = text.length * 6.6 + 8,
        px = plot.x(p.cost),
        py = plot.y(p.rating);
      const candidates = [
        [px + 12, py - 21],
        [px + 12, py + 6],
        [px - width - 12, py - 21],
        [px - width - 12, py + 6],
        [px - width / 2, py - 35],
        [px - width / 2, py + 20]
      ];
      for (const [x, y] of candidates) {
        const box = { x, y, right: x + width, bottom: y + 18 };
        if (x < 84 || box.right > 978 || y < 47 || box.bottom > 464) continue;
        if (
          boxes.some(
            (b) =>
              x < b.right + 4 && box.right + 4 > b.x && y < b.bottom + 3 && box.bottom + 3 > b.y
          ) ||
          input.some(
            (q) =>
              plot.x(q.cost) > x - 7 &&
              plot.x(q.cost) < box.right + 7 &&
              plot.y(q.rating) > y - 6 &&
              plot.y(q.rating) < box.bottom + 6
          )
        )
          continue;
        boxes.push(box);
        out.push(`<text class="ocr-chart-label" x="${x}" y="${y + 13}">${esc(text)}</text>`);
        break;
      }
    }
    return out.join('');
  }

  const pointDescription = (p) =>
    `${p.name} · ${p.organization} · rating ${p.rating.toFixed(1)} · ${p.costLabel}/1,000 pages · ${p.costKind}`;

  function render(result, data, options = {}) {
    const selection = points(result, data, options),
      all = selection.points,
      omitted = selection.omitted;
    const summary = `${all.length} plotted of ${selection.total} filtered models. Omitted: ${omitted.unrated} without a rating; ${omitted.unpriced} without a matched cost; ${omitted.nonpositive} with non-positive cost; ${omitted.basis} outside the chart cost filter.`;
    if (!all.length)
      return `<p class="ocr-chart-status" role="status">${esc(summary)}</p><p class="ocr-chart-empty">No models have both an overall rating and a positive, matched cost in this selection. Change the filters or cost assumptions above. Missing values are never plotted as zero.</p>`;
    const edge = frontier(all),
      edgeIds = new Set(edge.map((p) => p.id)),
      plot = geometry(all, options.ranges !== false),
      costMedian = median(all.map((p) => p.cost)),
      ratingMedian = median(all.map((p) => p.rating));
    const horizontal = [0, 20, 40, 60, 80, 100]
      .map(
        (v) =>
          `<line class="ocr-chart-grid" x1="82" x2="980" y1="${plot.y(v)}" y2="${plot.y(v)}"/><text class="ocr-chart-tick" x="68" y="${plot.y(v) + 4}" text-anchor="end">${v}</text>`
      )
      .join('');
    const vertical = plot.ticks
      .map(
        (v) =>
          `<line class="ocr-chart-grid" x1="${plot.x(v)}" x2="${plot.x(v)}" y1="48" y2="466"/><text class="ocr-chart-tick" x="${plot.x(v)}" y="490" text-anchor="middle">${esc(money(v))}</text>`
      )
      .join('');
    const ranges =
      options.ranges === false
        ? ''
        : all
            .filter((p) => p.low < p.high)
            .map(
              (p) =>
                `<path class="ocr-chart-range" stroke="${p.color}" d="M ${plot.x(p.low)} ${plot.y(p.rating)} H ${plot.x(p.high)} M ${plot.x(p.low)} ${plot.y(p.rating) - 3} v 6 M ${plot.x(p.high)} ${plot.y(p.rating) - 3} v 6"/>`
            )
            .join('');
    const marks = [...all]
      .sort((a, b) => Number(edgeIds.has(a.id)) - Number(edgeIds.has(b.id)))
      .map(
        (p) =>
          `<g class="ocr-chart-point${edgeIds.has(p.id) ? ' is-frontier' : ''}" tabindex="0" role="button" data-chart-model="${esc(p.id)}" aria-label="${esc(pointDescription(p))}"><title>${esc(pointDescription(p) + '. ' + p.costNote)}</title><circle class="ocr-chart-hit" cx="${plot.x(p.cost)}" cy="${plot.y(p.rating)}" r="11"/><circle class="ocr-chart-dot" cx="${plot.x(p.cost)}" cy="${plot.y(p.rating)}" r="${edgeIds.has(p.id) ? 6.5 : 5}" fill="${p.color}"/></g>`
      )
      .join('');
    const labelSet =
      options.labels === 'none'
        ? []
        : options.labels === 'all'
          ? [...edge, ...all.filter((p) => !edgeIds.has(p.id))]
          : edge;
    const organizations = [...new Set(all.map((p) => p.organization))].sort();
    const legend = organizations
      .map((org) => `<span><i style="background:${color(org)}" aria-hidden="true"></i>${esc(org)}</span>`)
      .join('');
    const table = [...all]
      .sort((a, b) => b.rating - a.rating || a.cost - b.cost)
      .map(
        (p) =>
          `<tr><th scope="row">${esc(p.name)}</th><td>${esc(p.organization)}</td><td>${p.rating.toFixed(1)}</td><td>${esc(p.costLabel)}</td><td>${esc(p.costKind)}</td><td>${edgeIds.has(p.id) ? 'Yes' : 'No'}</td><td>${esc(p.costNote)}${p.source ? ` <a href="${esc(p.source)}" target="_blank" rel="noreferrer">Cost source ↗</a>` : ''}</td></tr>`
      )
      .join('');
    return `<p class="ocr-chart-status" role="status">${esc(summary)}</p><div class="ocr-chart-legend"><span><i class="ocr-chart-quadrant-key" aria-hidden="true"></i>Lower cost / higher rating</span><span><i class="ocr-chart-frontier-key" aria-hidden="true"></i>Indicative Pareto frontier</span>${legend}</div><div class="ocr-chart-scroll" role="region" tabindex="0" aria-label="OCR rating versus cost chart; scroll horizontally on narrow screens"><svg class="ocr-chart-svg" viewBox="0 0 1040 550" role="group" aria-labelledby="ocrCostPlotTitle ocrCostPlotDesc"><title id="ocrCostPlotTitle">OCR rating versus cost per 1,000 pages</title><desc id="ocrCostPlotDesc">Higher ratings and lower costs are preferable. Cost is logarithmic. Green shading marks costs below ${esc(money(costMedian))} and ratings above ${ratingMedian.toFixed(1)}, the plotted cohort medians. Points on the dotted frontier are not dominated at their central cost estimates. Ranges are planning scenarios, not confidence intervals. A complete data table follows.</desc><rect class="ocr-chart-quadrant" x="82" y="48" width="${plot.x(costMedian) - 82}" height="${plot.y(ratingMedian) - 48}"/>${horizontal}${vertical}<text class="ocr-chart-zone-label" x="94" y="28">LOWER COST · HIGHER RATING ↖</text>${ranges}<polyline class="ocr-chart-frontier" points="${edge.map((p) => `${plot.x(p.cost)},${plot.y(p.rating)}`).join(' ')}"/>${marks}${labels(all, labelSet, plot)}<text class="ocr-chart-axis" x="531" y="532" text-anchor="middle">Cost per 1,000 pages (USD, log scale)</text><text class="ocr-chart-axis" transform="translate(22 257) rotate(-90)" text-anchor="middle">Estimated OCR rating (0–100)</text></svg></div><p class="ocr-chart-readout" aria-live="polite">Hover a point for its cost basis. Click, tap or keyboard-focus a point for details.</p><details class="ocr-chart-data"><summary>Chart data and cost sources (${all.length} models)</summary><div class="ocr-chart-scroll" tabindex="0" role="region" aria-label="Chart data"><table><caption>Same filtered models and cost assumptions as the OCR table</caption><thead><tr><th scope="col">Model</th><th scope="col">Organization</th><th scope="col">Rating</th><th scope="col">USD / 1,000 pages</th><th scope="col">Cost basis</th><th scope="col">Frontier</th><th scope="col">Qualification / source</th></tr></thead><tbody>${table}</tbody></table></div></details>`;
  }

  const states = new WeakMap();
  function update(element, result, data) {
    if (!element) return;
    let state = states.get(element);
    if (!state) {
      state = {};
      states.set(element, state);
      element.addEventListener('change', () => draw(element, state));
      const inspect = (event) => {
        const mark = event.target.closest?.('[data-chart-model]');
        if (!mark || !element.contains(mark)) return;
        if (event.type === 'keydown') {
          if (!['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
        }
        const p = state.points.find((p) => p.id === mark.dataset.chartModel),
          readout = element.querySelector('.ocr-chart-readout');
        if (!p || !readout) return;
        readout.innerHTML = `<strong>${esc(pointDescription(p))}</strong><br/>${esc(p.costNote)}${p.source ? ` <a href="${esc(p.source)}" target="_blank" rel="noreferrer">Cost source ↗</a>` : ''}${p.modelSource ? ` <a href="${esc(p.modelSource)}" target="_blank" rel="noreferrer">Model source ↗</a>` : ''}`;
      };
      for (const event of ['click', 'focusin', 'keydown']) element.addEventListener(event, inspect);
    }
    state.result = result;
    state.data = data;
    draw(element, state);
  }
  function draw(element, state) {
    const options = {
      basis: element.querySelector('[data-chart-basis]')?.value || 'all',
      labels: element.querySelector('[data-chart-labels]')?.value || 'frontier',
      ranges: element.querySelector('[data-chart-ranges]')?.checked !== false
    };
    const output = element.querySelector('[data-chart-output]');
    if (!output || !state.result) return;
    const tableOpen = !!output.querySelector('.ocr-chart-data')?.open;
    state.points = points(state.result, state.data, options).points;
    output.innerHTML = render(state.result, state.data, options);
    if (tableOpen && output.querySelector('.ocr-chart-data'))
      output.querySelector('.ocr-chart-data').open = true;
  }
  return { points, frontier, geometry, render, update, color };
});
