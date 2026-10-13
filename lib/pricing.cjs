const finite = value => typeof value === 'number' && Number.isFinite(value);

function selectPagePrices(pricing) {
  const selected = {};
  for (const observation of pricing) {
    if (!finite(observation.usd_per_1000_pages) || observation.comparison_default === false) continue;
    const old = selected[observation.model];
    if (!old || observation.as_of > old.as_of ||
      (observation.as_of === old.as_of && observation.basis === 'vendor_list' && old.basis !== 'vendor_list')) {
      selected[observation.model] = observation;
    }
  }
  return selected;
}

function describePrices(models, pricing, tokens, selected) {
  return Object.fromEntries(models.map(model => {
    const page = selected[model.id];
    const service = pricing.find(p => p.model === model.id && p.version_scope === 'current_service' && p.verification_status === 'verified');
    const token = tokens.find(p => p.model === model.id);
    let info;
    if (page) {
      const qualified = page.basis !== 'vendor_list' || page.verification_status !== 'verified' || page.version_scope === 'current_service';
      info = {label: '$' + page.usd_per_1000_pages.toFixed(2) + (qualified ? '†' : ''), source_id: page.source_id,
        note: [page.provider, page.mode, page.basis, 'as of ' + page.as_of, page.note,
          page.verification_status === 'unverified_import' ? 'Imported estimate; not reverified' : ''].filter(Boolean).join(' · ')};
    } else if (service) {
      info = {label: 'Service $' + service.usd_per_1000_pages.toFixed(2) + '†', source_id: service.source_id,
        note: service.mode + ' · Current service rate; benchmarked generation/configuration is not guaranteed. ' + service.note};
    } else if (token) {
      info = {label: 'Token-priced', source_id: token.source_id, note: 'See Pricing for provider token rates; no verified per-page workload cost.'};
    } else if (model.access === 'open') {
      info = {label: 'Self-hosted', note: 'No verified page cost. Compute, hosting and any license charges depend on deployment; open weights do not imply zero processing cost.'};
    } else {
      info = {label: '—', note: model.access === 'unreleased' ? 'Weights unreleased; no verified processing cost.' : 'No verified comparable page price.'};
    }
    return [model.id, info];
  }));
}

module.exports = {selectPagePrices, describePrices};
