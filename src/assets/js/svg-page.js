(function () {
  const theme = document.getElementById('themeToggle');
  theme.addEventListener('click', () => {
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
      const select = document.getElementById('svgRun'),
        search = document.getElementById('svgSearch');
      let current = data.default_run,
        key,
        direction;
      const validHash = location.hash.slice(1);
      if (data.runs.some((r) => r.id === validHash)) current = validHash;
      select.value = current;
      function render() {
        const result = SVGComparison.select(data, current, search.value, key, direction);
        document.querySelectorAll('[data-svg-run]').forEach((panel) => {
          panel.hidden = panel.dataset.svgRun !== current;
          if (!panel.hidden) {
            panel.querySelector('thead tr').innerHTML = SVGComparison.renderHead(result, data);
            panel.querySelector('tbody').innerHTML = SVGComparison.renderRows(result, data);
          }
        });
        document.getElementById('svgStatus').textContent =
          `${result.rows.length} of ${result.run.rows.length} tracers · ${result.run.label}`;
      }
      select.addEventListener('change', () => {
        current = select.value;
        key = direction = undefined;
        history.replaceState(null, '', '#' + current);
        render();
      });
      search.addEventListener('input', render);
      document.getElementById('svgReset').addEventListener('click', () => {
        search.value = '';
        key = direction = undefined;
        render();
      });
      window.addEventListener('hashchange', () => {
        const id = location.hash.slice(1);
        if (data.runs.some((run) => run.id === id)) {
          current = id;
          select.value = current;
          search.value = '';
          key = direction = undefined;
          render();
        }
      });
      document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-svg-sort]');
        if (button) {
          const next = button.dataset.svgSort;
          const prior = SVGComparison.select(data, current, search.value, key, direction);
          direction =
            next === prior.key
              ? prior.direction === 'asc'
                ? 'desc'
                : 'asc'
              : next === 'name'
                ? 'asc'
                : data.metrics[next].direction;
          key = next;
          render();
        }
        const link = event.target.closest('[data-svg-link]');
        if (link) {
          event.preventDefault();
          current = link.dataset.svgLink;
          history.replaceState(null, '', '#' + current);
          select.value = current;
          search.value = '';
          key = direction = undefined;
          render();
        }
      });
      document.body.dataset.enhanced = 'true';
      render();
    })
    .catch(() => {
      document.getElementById('svgStatus').textContent = 'All comparison groups are shown below.';
    });
})();
