/* Pure OCR speed/cost selection. Quality scores never enter this module. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OCRDeployment = api;
})(globalThis, () => {
  const defaults = { hourlyRate: 1, inputTokens: 1000, outputTokens: 1000 };
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const midpoint = (e) => Math.sqrt(e.low) * Math.sqrt(e.high);
  const validEstimate = (e) =>
    e?.status === 'assumed' &&
    e.confidence === 'low' &&
    finite(e.low) &&
    e.low > 0 &&
    finite(e.high) &&
    e.high >= e.low;
  const validReference = (r) =>
    r?.status === 'estimated' &&
    r.confidence === 'low' &&
    finite(r.low) &&
    r.low > 0 &&
    finite(r.high) &&
    r.high >= r.low;
  const money = (v) => '$' + (v < 0.01 ? v.toFixed(4) : v.toFixed(2));
  function assumptions(options = {}) {
    return Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [
        k,
        finite(options[k])
          ? Math.max(0, Math.min(k === 'hourlyRate' ? 1e7 : 200000, options[k]))
          : v
      ])
    );
  }
  function deployment(data, model, options = {}) {
    const a = assumptions(options),
      records = (data.throughput || []).filter((r) => r.model === model.id);
    const speed =
      records
        .filter(
          (r) =>
            r.comparison_default === true &&
            r.unit === 'pages_per_second' &&
            finite(r.pages_per_second) &&
            r.pages_per_second > 0
        )
        .sort(
          (x, y) =>
            (x.selection_priority ?? 100) - (y.selection_priority ?? 100) ||
            String(y.as_of).localeCompare(String(x.as_of)) ||
            x.source_id.localeCompare(y.source_id)
        )[0] || null;
    const estimate =
      (data.throughputEstimates || []).find((e) => e.model === model.id && validEstimate(e)) ||
      null;
    const page = (data.pricing || [])
      .filter(
        (p) =>
          p.model === model.id &&
          p.verification_status === 'verified' &&
          p.comparison_default !== false &&
          ['vendor_list', 'benchmark_estimate'].includes(p.basis) &&
          finite(p.usd_per_1000_pages)
      )
      .sort(
        (x, y) =>
          (x.basis === 'vendor_list' ? 0 : 1) - (y.basis === 'vendor_list' ? 0 : 1) ||
          String(y.as_of).localeCompare(String(x.as_of))
      )[0];
    const token = (data.tokenPricing || [])
      .filter(
        (p) =>
          p.model === model.id &&
          p.verification_status === 'verified' &&
          p.comparison_default !== false
      )
      .sort((x, y) => String(y.as_of).localeCompare(String(x.as_of)))[0];
    const service = (data.pricing || []).find(
      (p) =>
        p.model === model.id &&
        p.version_scope === 'current_service' &&
        p.verification_status === 'verified'
    );
    let cost;
    if (page) {
      const actual = page.basis === 'vendor_list',
        current = actual && page.version_scope === 'current_service';
      cost = {
        value: page.usd_per_1000_pages,
        label: (current ? 'Service ' : '') + money(page.usd_per_1000_pages) + (current ? '†' : ''),
        kind: current ? 'current service' : actual ? 'API' : 'benchmark est.',
        estimated: !actual,
        source_id: page.source_id,
        note: [
          current
            ? 'Current service tariff, not a verified tariff for the historical benchmark generation.'
            : null,
          page.provider,
          page.mode,
          page.basis,
          'as of ' + page.as_of,
          page.note
        ]
          .filter(Boolean)
          .join(' · ')
      };
    } else if (token) {
      const value =
        (a.inputTokens * token.input_usd_per_million_tokens +
          a.outputTokens * token.output_usd_per_million_tokens) /
        1000;
      cost = {
        value,
        label: '≈' + money(value),
        kind: 'token scenario',
        estimated: true,
        source_id: token.source_id,
        note: `Illustrative ${a.inputTokens} billable input + ${a.outputTokens} output tokens/page × 1,000 pages. Input includes image tokens; output includes billed reasoning. Not measured page usage. No caching, tool fees or additional charges included. ${token.provider} ${token.api_model} · ${token.mode} · as of ${token.as_of}. ${token.note || ''}`
      };
    } else if (service) {
      cost = {
        value: null,
        label: 'Service ' + money(service.usd_per_1000_pages) + '†',
        kind: 'current service',
        source_id: service.source_id,
        note:
          'Current service, not a verified tariff for this benchmarked generation. ' + service.note
      };
    } else if (model.price_context) {
      cost = { value: null, ...model.price_context, kind: 'context' };
    } else if (
      model.access === 'open' &&
      speed &&
      speed.hardware_known === true &&
      speed.cost_eligible === true
    ) {
      const value = (a.hourlyRate / (speed.pages_per_second * 3600)) * 1000;
      cost = {
        value,
        label: '≈' + money(value),
        kind: 'local compute',
        estimated: true,
        source_id: speed.source_id,
        note: `${money(a.hourlyRate)}/reported setup-hour ÷ (${speed.pages_per_second} pages/sec × 3,600) × 1,000 pages. Illustrative 100% utilization; not a hardware market price or API tariff. Applies to the complete reported setup, not a normalized machine. Excludes idle/loading, storage, licenses and rental minimums.`
      };
    } else if (model.access === 'open' && estimate) {
      const low = (a.hourlyRate * 1000) / (estimate.high * 3600),
        high = (a.hourlyRate * 1000) / (estimate.low * 3600);
      cost = {
        value: midpoint({ low, high }),
        low,
        high,
        label: '≈' + money(low) + '–' + money(high),
        kind: 'modeled compute',
        estimated: true,
        note: `Low-confidence planning range: ${money(a.hourlyRate)}/assumed complete setup-hour × 1,000 ÷ (modeled pages/sec × 3,600). Setup: ${estimate.hardware}. 100% utilization; no idle/loading, storage, licenses or rental minimums. Illustrative assumption, not market pricing or an API tariff. Cost range uses the modeled setup, not any differently configured observation. Sort uses geometric midpoint; overlapping ranges do not establish a winner.`
      };
    } else
      cost = {
        value: null,
        label: model.access === 'open' ? 'Self-hosted' : '—',
        kind: 'unavailable',
        note: 'No verified comparable page cost. Unknown is not zero; imported prices remain in the source/pricing details, not the sortable comparison.'
      };
    const referenceMode = !!data.ocrReference,
      reference = data.ocrReference?.models.find((r) => r.model === model.id) || null;
    const publishedCost = page || token || service ? cost : null;
    if (referenceMode && validReference(reference)) {
      const low = (a.hourlyRate * 1000) / (reference.high * 3600),
        high = (a.hourlyRate * 1000) / (reference.low * 3600);
      cost = {
        value: midpoint({ low, high }),
        low,
        high,
        label: '≈' + money(low) + '–' + money(high),
        kind: 'H100 scenario',
        estimated: true,
        note: `Low-confidence reference compute: ${money(a.hourlyRate)}/complete H10080GB setup-hour at100% utilization. Range inverts ${reference.low}–${reference.high} pages/sec; excludes idle/loading, storage, licenses and rental minimums. Not a hardware market quote or API tariff. CPU-only paths still charge the allocated whole reference setup.`
      };
    } else if (referenceMode && model.access === 'open' && reference?.status !== 'hosted') {
      cost = {
        value: null,
        label:
          reference?.status === 'too-large'
            ? '>80GB'
            : reference?.status === 'tight-fit'
              ? 'Fit uncertain'
              : '—',
        kind: 'no reference cost',
        note: reference?.fit || 'No supported reference setup estimate; unknown is not zero.'
      };
    }
    return {
      speed,
      estimate,
      records,
      cost,
      publishedCost,
      referenceMode,
      reference,
      assumptions: a
    };
  }
  return { defaults, assumptions, deployment, midpoint, validReference };
});
