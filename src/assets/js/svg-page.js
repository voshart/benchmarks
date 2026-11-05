(function () {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem('bench-theme', value);
    } catch (_) {}
  });
  fetch('/svg/data.json')
    .then((response) => {
      if (!response.ok) throw new Error('Data unavailable');
      return response.json();
    })
    .then((data) => {
      const mode = document.getElementById('svgMode'),
        search = document.getElementById('svgSearch'),
        complexity = document.getElementById('svgComplexity');
      let key = 'index',
        direction;
      const validMode = (id) => data.matrix.modes.some((m) => m.id === id);
      mode.value = validMode(location.hash.slice(1))
        ? location.hash.slice(1)
        : data.matrix.default_mode;
      function render() {
        const result = SVGMatrix.build(data, {
          mode: mode.value,
          query: search.value,
          complexity: complexity.checked,
          key,
          direction
        });
        document.getElementById('svgHead').innerHTML = SVGMatrix.renderHead(result, data);
        document.getElementById('svgRows').innerHTML = SVGMatrix.renderRows(result, data);
        document.getElementById('svgStatus').textContent =
          result.mode === 'gradient'
            ? 'No gradient-specific measurements yet'
            : `${result.rows.length} configurations · ${result.columns.length} dataset families · relative index`;
        return result;
      }
      mode.addEventListener('change', () => {
        key = 'index';
        direction = undefined;
        history.replaceState(null, '', '#' + mode.value);
        render();
      });
      search.addEventListener('input', render);
      complexity.addEventListener('change', () => {
        if (!complexity.checked && data.matrix.complexity_metrics.includes(key)) {
          key = 'index';
          direction = undefined;
        }
        render();
      });
      document.getElementById('svgReset').addEventListener('click', () => {
        mode.value = data.matrix.default_mode;
        search.value = '';
        complexity.checked = false;
        key = 'index';
        direction = undefined;
        history.replaceState(null, '', '#' + mode.value);
        render();
      });
      document.getElementById('svgMatrix').addEventListener('click', (event) => {
        const button = event.target.closest('[data-svg-sort]');
        if (!button) return;
        const previous = SVGMatrix.build(data, { mode: mode.value, key, direction });
        const next = button.dataset.svgSort;
        direction =
          next === previous.key ? (previous.direction === 'asc' ? 'desc' : 'asc') : undefined;
        key = next;
        render();
      });
      window.addEventListener('hashchange', () => {
        if (validMode(location.hash.slice(1))) {
          mode.value = location.hash.slice(1);
          key = 'index';
          direction = undefined;
          render();
        }
      });
      document.body.dataset.enhanced = 'true';
      render();
    })
    .catch(() => {
      delete document.body.dataset.enhanced;
      document.getElementById('svgStatus').textContent =
        'All results shown. Interactive filters are unavailable.';
    });
})();
