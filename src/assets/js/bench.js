(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const UI = {
    range: $('historyRange'),
    date: $('historyDate'),
    status: $('historyStatus'),
    coverage: $('coverage'),
    access: $('access'),
    search: $('modelSearch'),
    head: $('matrixHead'),
    body: $('matrixBody')
  };
  let data = null,
    view = 'all',
    changeTimer = null;
  const history = document.querySelector('.history-bar');
  const start = history.dataset.releaseStart,
    end = history.dataset.snapshotDate;
  const isoDay = (s) =>
    Math.round((Date.parse(s + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 864e5);
  const dayIso = (day) =>
    new Date(Date.parse(start + 'T00:00:00Z') + day * 864e5).toISOString().slice(0, 10);
  let sortKey = 'rank',
    sortDirection = 'desc';
  const assumptions = () => {
    const ids = {
      hourlyRate: 'ocrHourlyRate',
      inputTokens: 'ocrInputTokens',
      outputTokens: 'ocrOutputTokens'
    };
    const raw = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, Number($(id).value)]));
    const normalized = OCRComparison.assumptions(raw);
    for (const [k, id] of Object.entries(ids))
      if ($(id).value !== '' && raw[k] !== normalized[k]) $(id).value = normalized[k];
    return normalized;
  };
  let currentResult = null;
  function render() {
    if (!data) return;
    const date = dayIso(Number(UI.range.value));
    const result = BenchmarkRank.build(data, date, {
      min: UI.coverage.value,
      access: UI.access.value,
      query: UI.search.value,
      view
    });
    if (
      !['model', 'rank', 'speed', 'price'].includes(sortKey) &&
      !result.columns.some((t) => t.id === sortKey)
    ) {
      sortKey = 'rank';
      sortDirection = 'desc';
    }
    currentResult = result;
    UI.date.textContent = date;
    UI.status.textContent = `${result.rows.length} models · ${result.matureCount} comparison benchmark families`;
    const options = { ...assumptions(), sortKey, sortDirection };
    UI.head.innerHTML = OCRComparison.renderHead(result, options);
    UI.body.innerHTML = OCRComparison.renderRows(result, data, options);
  }
  UI.head.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ocr-sort]');
    if (!button || !currentResult) return;
    const key = button.dataset.ocrSort;
    sortDirection =
      sortKey === key
        ? sortDirection === 'asc'
          ? 'desc'
          : 'asc'
        : OCRComparison.defaultDirection(key, currentResult);
    sortKey = key;
    render();
    UI.head.querySelector?.(`[data-ocr-sort="${key}"]`)?.focus();
  });
  for (const id of ['ocrHourlyRate', 'ocrInputTokens', 'ocrOutputTokens'])
    $(id).addEventListener('input', render);
  $('ocrReset').addEventListener('click', () => {
    if (!data) return;
    UI.search.value = '';
    UI.coverage.value = String(data.config.default_families);
    UI.access.value = 'all';
    UI.range.value = UI.range.max;
    sortKey = 'rank';
    sortDirection = 'desc';
    $('ocrHourlyRate').value = 1;
    $('ocrInputTokens').value = 1000;
    $('ocrOutputTokens').value = 1000;
    setView('all');
  });
  function setView(v) {
    view = v;
    document
      .querySelectorAll('.views button')
      .forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $('matrixPanel').hidden = v === 'price';
    $('pricingPanel').hidden = v !== 'price';
    if (v !== 'price') render();
  }
  function snap() {
    if (!data) return;
    const dates = [
      0,
      Number(UI.range.max),
      ...data.models
        .map((m) => (m.release_date ? isoDay(m.release_date) : null))
        .filter((x) => x != null && x >= 0 && x <= Number(UI.range.max))
    ];
    const current = Number(UI.range.value);
    UI.range.value = dates.reduce(
      (a, b) => (Math.abs(current - a) <= Math.abs(current - b) ? a : b),
      dates[0]
    );
    render();
  }
  $('themeToggle').addEventListener('click', () => {
    const d = document.documentElement;
    d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('bench-theme', d.dataset.theme);
    } catch (e) {}
  });
  document
    .querySelectorAll('.views button')
    .forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  [UI.coverage, UI.access].forEach((el) => el.addEventListener('change', render));
  UI.search.addEventListener('input', () => {
    if (UI.search.value.trim()) UI.coverage.value = '0';
    clearTimeout(changeTimer);
    changeTimer = setTimeout(render, 100);
  });
  UI.range.max = isoDay(end);
  UI.range.value = UI.range.max;
  $('rangeStart').textContent = start;
  $('rangeEnd').textContent = end;
  UI.range.addEventListener('input', render);
  UI.range.addEventListener('change', snap);
  $('historyLatest').addEventListener('click', () => {
    UI.range.value = UI.range.max;
    render();
  });
  fetch('/ocr/data.json', { cache: 'no-cache' })
    .then((x) => {
      if (!x.ok) throw Error('HTTP ' + x.status);
      return x.json();
    })
    .then((x) => {
      data = x;
      render();
    })
    .catch((err) => {
      UI.status.textContent = 'Static snapshot available · interactive filters unavailable';
      console.warn('OCR data load', err);
    });
})();
