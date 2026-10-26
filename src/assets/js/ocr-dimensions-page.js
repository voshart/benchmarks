(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const root = $('ocrDimension');
  if (!root) return;
  const policy = JSON.parse($('dimensionPolicy').textContent);
  const dimension = root.dataset.dimension,
    mode = policy.views[dimension].mode;
  const UI = {
    cutoff: $('dimensionCutoff'),
    query: $('dimensionSearch'),
    coverage: $('dimensionCoverage'),
    access: $('dimensionAccess'),
    head: $('dimensionHead'),
    body: $('dimensionBody'),
    status: $('dimensionStatus')
  };
  let data = null,
    result = null,
    timer = null,
    sortKey = mode === 'rating' ? 'rank' : 'model',
    sortDirection = mode === 'rating' ? 'desc' : 'asc';
  const controls = document.querySelectorAll('[data-dimension-control]');

  function render() {
    if (!data) return;
    const cutoff = UI.cutoff.value || root.dataset.snapshot;
    const bounded = [UI.cutoff.min, cutoff, root.dataset.snapshot].sort()[1];
    result = OCRDimensions.build(data, policy, dimension, {
      cutoff: bounded,
      query: UI.query.value,
      min: UI.coverage.value,
      access: UI.access.value,
      sortKey,
      sortDirection
    });
    UI.cutoff.value = bounded;
    UI.head.innerHTML = OCRDimensionsView.renderHead(result);
    UI.body.innerHTML = OCRDimensionsView.renderRows(result);
    UI.status.textContent = OCRDimensionsView.status(result);
  }
  UI.head.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dimension-sort]');
    if (!button || !result) return;
    const key = button.dataset.dimensionSort;
    sortDirection =
      key === sortKey
        ? sortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : OCRDimensions.defaultDirection(key, result);
    sortKey = key;
    render();
    UI.head.querySelector(`[data-dimension-sort="${key}"]`)?.focus();
  });
  [UI.cutoff, UI.coverage, UI.access].forEach((element) =>
    element.addEventListener('change', render)
  );
  UI.query.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 100);
  });
  $('dimensionReset').addEventListener('click', () => {
    UI.cutoff.value = root.dataset.snapshot;
    UI.query.value = '';
    UI.coverage.value = '0';
    UI.access.value = 'all';
    sortKey = mode === 'rating' ? 'rank' : 'model';
    sortDirection = mode === 'rating' ? 'desc' : 'asc';
    render();
  });
  $('dimensionTheme').addEventListener('click', () => {
    const element = document.documentElement;
    element.dataset.theme = element.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('bench-theme', element.dataset.theme);
    } catch (e) {}
  });
  fetch('/ocr/data.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw Error('HTTP ' + response.status);
      return response.json();
    })
    .then((value) => {
      data = value;
      render();
      controls.forEach((element) => (element.disabled = false));
    })
    .catch((error) => {
      UI.status.textContent = 'Static snapshot available · interactive filters unavailable';
      console.warn('OCR component data load', error);
    });
})();
