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
        sorts = {};
      const views = SVGComparison.choices(data);
      const validHash = location.hash.slice(1);
      if (views.some((r) => r.id === validHash)) current = validHash;
      select.value = current;
      function render() {
        const selected = SVGComparison.selectPanels(data, current, search.value, sorts);
        const results = new Map(selected.map((result) => [result.run.id, result]));
        document.querySelectorAll('[data-svg-run]').forEach((panel) => {
          const result = results.get(panel.dataset.svgRun);
          panel.hidden =
            !result || (selected.length > 1 && search.value.trim() !== '' && !result.rows.length);
          if (!panel.hidden) {
            panel.querySelectorAll('thead tr').forEach((head) => {
              head.innerHTML = SVGComparison.renderHead(result, data);
            });
            panel.querySelector('.svg-ranked-body').innerHTML = SVGComparison.renderRows(
              result,
              data
            );
            panel.querySelector('.svg-unranked-body').innerHTML = SVGComparison.renderRows(
              result,
              data,
              true
            );
            panel.querySelector('.svg-unranked').hidden = !result.unrankedRows.length;
            panel.querySelector('.svg-unranked summary').textContent =
              `${result.unrankedRows.length} without a complete score`;
          }
        });
        const result = selected[0];
        const matches = selected.reduce((sum, result) => sum + result.rows.length, 0);
        document.getElementById('svgStatus').textContent =
          selected.length > 1
            ? search.value.trim()
              ? `${matches} matching ${matches === 1 ? 'result' : 'results'}`
              : `${selected.length} comparisons · ranks apply within each`
            : `${result.rankedRows.length}${result.rankedRows.length === result.cohortCount ? '' : ' of ' + result.cohortCount} ranked${result.unrankedRows.length ? ' · ' + result.unrankedRows.length + ' incomplete' : ''}`;
      }
      select.addEventListener('change', () => {
        current = select.value;
        sorts = {};
        history.replaceState(null, '', '#' + current);
        render();
      });
      search.addEventListener('input', render);
      document.getElementById('svgReset').addEventListener('click', () => {
        search.value = '';
        sorts = {};
        render();
      });
      window.addEventListener('hashchange', () => {
        const id = location.hash.slice(1);
        if (views.some((run) => run.id === id)) {
          current = id;
          select.value = current;
          search.value = '';
          sorts = {};
          render();
        }
      });
      document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-svg-sort]');
        if (button) {
          const next = button.dataset.svgSort;
          const panel = button.dataset.svgSortPanel || current;
          const prior = SVGComparison.select(
            data,
            panel,
            search.value,
            sorts[panel]?.key,
            sorts[panel]?.direction
          );
          const direction =
            next === prior.key
              ? prior.direction === 'asc'
                ? 'desc'
                : 'asc'
              : next === 'name' || next === 'rank'
                ? 'asc'
                : data.metrics[next].direction;
          sorts[panel] = { key: next, direction };
          render();
        }
        const link = event.target.closest('[data-svg-link]');
        if (link) {
          event.preventDefault();
          link.closest('[popover]')?.hidePopover();
          current = link.dataset.svgLink;
          history.replaceState(null, '', '#' + current);
          select.value = current;
          search.value = '';
          sorts = {};
          render();
        }
      });
      document.body.dataset.enhanced = 'true';
      render();
    })
    .catch(() => {
      delete document.body.dataset.enhanced;
      document.querySelectorAll('[data-svg-run]').forEach((panel) => {
        panel.hidden = false;
      });
      document.getElementById('svgStatus').textContent = 'All comparison groups are shown below.';
    });
})();
