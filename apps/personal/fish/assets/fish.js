// Saved market research, using the shared AppUI shell, controls and tables.
(function () {
  'use strict';
  const fmt = new Intl.NumberFormat('ko-KR');
  const won = value => value == null ? '—' : '₩' + fmt.format(value);
  const weight = value => value == null ? 'Weight not stated' : fmt.format(value) + ' g';
  const filters = {query: '', market: '', category: '', max_price: '', min_weight: '', min_reviews: '', sort: 'reviews', coupons: false};
  const choices = new Map(), shortlist = new Map();
  let app, root, scope, table, stats, filtersBar, actions, resultLabel, errorLabel, note, snapshot;
  let currentRows = [], generation = 0, controller, compareButton, exportButton, csvButton;

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function safeLink(url, text) {
    const anchor = node('a', text);
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.hostname === 'tpirates.com') {
        anchor.href = parsed.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
    } catch (_) { /* Missing source: leave plain text. */ }
    return anchor;
  }

  function selected(row) {
    return row.eligible_sizes?.find(size => size.id === choices.get(row.id)) || row.selected;
  }

  function comparePrice(size) {
    return filters.coupons && size.coupon_price != null ? size.coupon_price : size.price;
  }

  function portionSummary(row) {
    return row.sizes.map(size => size.name + (size.grams ? ' ' + weight(size.grams) : '') +
      ' — ' + won(size.price) + (filters.coupons && size.coupon_price != null ? ' (coupon ' + won(size.coupon_price) + ')' : '') +
      (size.sold_out ? ' [sold out]' : '')).join('\n');
  }

  function productCell(row) {
    const content = node('div', null, 'fish-product');
    if (row.image_url && /^https:\/\/(cdn|resrc)\.tpirates\.com\//.test(row.image_url)) {
      const image = node('img');
      image.src = row.image_url; image.alt = ''; image.loading = 'lazy';
      content.append(image);
    }
    const text = node('div');
    text.append(safeLink(row.source_url, row.name), node('small', row.store + ' · ' + row.category));
    content.append(text);
    return content;
  }

  function updateSelection() {
    compareButton.textContent = 'Compare (' + shortlist.size + '/4)';
    compareButton.disabled = shortlist.size < 2;
  }

  function setShortlist(row, checked) {
    if (checked && !shortlist.has(row.id) && shortlist.size >= 4) {
      AppUIToast.info('Choose up to four products to compare.');
      table.setItems(currentRows);
      return;
    }
    if (checked) shortlist.set(row.id, {...row, selected: selected(row)});
    else shortlist.delete(row.id);
    updateSelection();
  }

  function sizeColumns() {
    return [
      {id: 'name', label: 'Portion', width: '150px'},
      {id: 'grams', label: 'Weight', width: '125px', render: size => weight(size.grams)},
      {id: 'regular_price', label: 'Regular', width: '105px', render: size => won(size.regular_price)},
      {id: 'price', label: 'Sale / before coupon', width: '155px', render: size => won(size.price)},
      {id: 'coupon_price', label: 'Coupon offer¹', width: '125px', render: size => won(size.coupon_price)},
      {id: 'value', label: 'KRW / 100 g', width: '120px', render: size => size.grams ? won(Math.round(comparePrice(size) * 100 / size.grams)) : '—'},
      {id: 'sold_out', label: 'Availability', width: '115px', render: size => size.sold_out ? 'Sold out' : 'Listed'},
    ];
  }

  function details(row, lifetime) {
    const body = node('section', null, 'fish-details');
    const intro = node('div', null, 'fish-detail-intro');
    intro.append(node('p', row.description || 'No product description supplied.', 'fish-description'));
    intro.append(node('p', row.address, 'fish-muted'));
    intro.append(node('p', 'Delivery options: ' + row.delivery.join(' · ') + '. Store rating and store reviews cover the whole store.', 'fish-muted'));
    body.append(intro);
    const picker = node('div'); body.append(picker);
    lifetime.add(AppUIToolbar.create({container: picker, signal: lifetime.signal, variant: 'inline', items: [
      {type: 'select', ariaLabel: 'Compare portion for ' + row.name, value: String(selected(row).id),
        options: row.eligible_sizes.map(size => ({value: String(size.id), label: size.name + ' · ' + weight(size.grams) + ' · ' + won(comparePrice(size))})),
        onChange(value) {
          choices.set(row.id, Number(value));
          if (shortlist.has(row.id)) shortlist.set(row.id, {...row, selected: selected(row)});
          table.setItems(currentRows);
        }},
      {type: 'text', label: 'Choose a matching portion for the comparison.'},
    ]}));
    body.append(node('p', 'All size options below, including those outside your filters. ¹ Coupon eligibility applies.', 'fish-muted'));
    const sizes = node('div', null, 'fish-sizes'); body.append(sizes);
    lifetime.add(AppUIDataTable.create({container: sizes, columns: sizeColumns(), items: row.sizes, signal: lifetime.signal, maxRows: 100}));
    const origin = node('details');
    origin.append(node('summary', 'Store origin disclosures'), node('p', row.origin || 'Not supplied.', 'fish-description'));
    body.append(origin);
    return body;
  }

  function compare() {
    if (shortlist.size < 2) return;
    const body = node('div', null, 'fish-comparison');
    body.append(node('p', 'Selected portions · ' + (filters.coupons ? 'conditional coupon offers included' : 'before coupons') + ' · delivery and extras excluded.'));
    const grid = node('div'); body.append(grid);
    const columns = [
      {id: 'name', label: 'Product / store', width: '260px', render: productCell},
      {id: 'portion', label: 'Portion', width: '150px', render: row => row.selected.name},
      {id: 'grams', label: 'Weight', width: '125px', render: row => weight(row.selected.grams)},
      {id: 'price', label: 'Price', width: '115px', render: row => won(comparePrice(row.selected))},
      {id: 'per100', label: 'KRW / 100 g', width: '125px', render: row => row.selected.grams ? won(Math.round(comparePrice(row.selected) * 100 / row.selected.grams)) : '—'},
      {id: 'product_reviews', label: 'Product reviews', width: '125px'},
      {id: 'store_rating', label: 'Store rating', width: '105px'},
      {id: 'store_reviews', label: 'Store reviews', width: '125px'},
    ];
    const comparison = AppUIDataTable.create({container: grid, columns, items: Array.from(shortlist.values()), maxRows: 4});
    body.append(node('p', 'Portion weight is the entire platter; mixed platters contain other fish. Review counts do not establish quality.', 'fish-muted'));
    AppUIDialog.show({title: 'Compare your shortlist', body, width: '1250px', signal: scope.signal,
      buttons: [{text: 'Close'}], onClose: () => comparison.destroy()});
  }

  function exportXlsx() {
    try { table.exportXlsx({filename: 'fish-comparison', sheetName: 'Fish Market'}); }
    catch (_) { AppUIToast.error('Could not export the spreadsheet. Reload the page and try again.'); }
  }

  function exportCsv() {
    try { table.exportCsv({filename: 'fish-comparison'}); }
    catch (_) { AppUIToast.error('Could not export CSV. Reload the page and try again.'); }
  }

  async function refresh() {
    const request = ++generation;
    controller?.abort(); controller = new AbortController();
    errorLabel.hidden = true;
    resultLabel.textContent = 'Loading matching portions…';
    exportButton.disabled = true;
    csvButton.disabled = true;
    const response = await AppUIApi.operation('personal/fish', 'products', {...filters, limit: 250}, {signal: controller.signal});
    if (request !== generation || !scope.current()) return;
    if (!response.ok) {
      currentRows = []; table.setItems([]);
      errorLabel.textContent = 'Could not load products: ' + (response.error || response._error || 'Unknown error') + '. Use Reload saved data to retry.';
      errorLabel.hidden = false;
      resultLabel.textContent = 'Products unavailable';
      app.setStatus('Fish Market: load failed');
      return;
    }
    currentRows = response.items;
    table.setItems(currentRows);
    exportButton.disabled = !currentRows.length;
    csvButton.disabled = !currentRows.length;
    resultLabel.textContent = response.total + ' matching products · ' + (filters.sort === 'value' ? 'best value matching portion shown' : 'lowest price matching portion shown') +
      (filters.coupons ? ' · conditional coupon offers included' : ' · before coupons');
    stats.setItems([
      {label: 'Products', value: snapshot.products}, {label: 'Stores', value: snapshot.stores},
      {label: 'Portion options', value: snapshot.sizes}, {label: 'Matching products', value: response.total},
    ]);
    app.setStatus('Saved research · ' + response.total + ' matches · ' + shortlist.size + ' shortlisted');
  }

  function change(key, value) { filters[key] = value; choices.clear(); void refresh(); }

  function filterItems() {
    const select = (id, label, options) => ({id: 'fish-' + id, type: 'select', ariaLabel: label, value: filters[id], options,
      onChange: value => change(id, value)});
    return [
      {id: 'fish-query', type: 'search', ariaLabel: 'Search products and stores', placeholder: 'Search product or store…', value: filters.query,
        debounceMs: 220, onInput: value => change('query', value)},
      select('market', 'Market', [{value: '', label: 'All markets (' + snapshot.products + ')'},
        ...snapshot.markets.map(market => ({value: market, label: market + ' (' + (snapshot.market_counts?.[market] ?? 0) + ')'}))]),
      select('category', 'Platter type', [{value: '', label: 'All platter types'}, ...snapshot.categories]),
      {id: 'fish-max-price', type: 'input', inputType: 'number', ariaLabel: 'Maximum portion price in KRW', placeholder: 'Max price ₩', value: filters.max_price,
        debounceMs: 220, onInput: value => change('max_price', value)},
      {id: 'fish-min-weight', type: 'input', inputType: 'number', ariaLabel: 'Minimum portion weight in grams', placeholder: 'Min weight g', value: filters.min_weight,
        debounceMs: 220, onInput: value => change('min_weight', value)},
      {id: 'fish-min-reviews', type: 'input', inputType: 'number', ariaLabel: 'Minimum product reviews', placeholder: 'Min product reviews', value: filters.min_reviews,
        debounceMs: 220, onInput: value => change('min_reviews', value)},
      select('sort', 'Sort products', [{value: 'reviews', label: 'Most product reviews'}, {value: 'price', label: 'Lowest portion price'},
        {value: 'value', label: 'Lowest price / 100 g'}, {value: 'rating', label: 'Highest store rating'}]),
      {id: 'fish-coupons', type: 'checkbox', label: 'Include coupon offers¹', checked: filters.coupons, onChange: value => change('coupons', value)},
      {label: 'Reset filters', action() {
        Object.assign(filters, {query: '', market: '', category: '', max_price: '', min_weight: '', min_reviews: '', sort: 'reviews', coupons: false});
        choices.clear(); renderFilters(); void refresh();
      }},
    ];
  }

  function renderFilters() {
    AppUIToolbar.create({container: filtersBar, signal: scope.signal, label: 'Filter fish products', items: filterItems()});
    filtersBar.querySelectorAll('input[type="number"]').forEach(input => {input.min = '0'; input.step = '1';});
  }

  function mount() {
    root.replaceChildren();
    root.classList.add('fish-page');
    const heading = node('div'); root.append(heading);
    scope.add(AppUIToolbar.create({container: heading, title: 'Fish Market', subtitle: '방어 · compare portions, prices & reviews', signal: scope.signal}));
    note = node('p', null, 'fish-muted');
    const date = snapshot.collected_at ? new Date(snapshot.collected_at).toLocaleString('en-GB', {timeZone: 'Asia/Seoul', hour12: false}) + ' KST' : 'No snapshot imported';
    note.append(node('span', 'Saved ' + date + ' · '));
    if (snapshot.source_url) note.append(safeLink(snapshot.source_url, 'TPirates yellowtail selection'));
    root.append(note);
    const summary = node('div', null, 'fish-stats'); root.append(summary);
    stats = AppUIStatCards.create({container: summary, compact: true, columns: 4, signal: scope.signal}); scope.add(stats);
    filtersBar = node('div', null, 'fish-filters'); root.append(filtersBar); renderFilters();
    const caveats = node('p', 'Pickup prices in KRW; delivery and extras excluded. ¹ Coupons require eligibility. Weights refer to the whole portion, not a whole fish. Mixed platters include other fish.', 'fish-caveat');
    root.append(caveats);
    const actionsHost = node('div'); root.append(actionsHost);
    actions = AppUIToolbar.create({container: actionsHost, signal: scope.signal, items: [
      {id: 'fish-compare', label: 'Compare (0/4)', disabled: true, primary: true, action: compare},
      {id: 'fish-clear', label: 'Clear shortlist', action() {shortlist.clear(); updateSelection(); table.setItems(currentRows);}},
      {id: 'fish-export', label: 'Export matching XLSX', disabled: true, action: exportXlsx},
      {id: 'fish-export-csv', label: 'Export matching CSV', disabled: true, action: exportCsv},
      {id: 'fish-reload', label: 'Reload saved data', action: () => void refresh()},
    ]}); scope.add(actions);
    compareButton = actionsHost.querySelector('#fish-compare'); exportButton = actionsHost.querySelector('#fish-export');
    csvButton = actionsHost.querySelector('#fish-export-csv');
    resultLabel = node('p', 'Loading products…', 'fish-results'); resultLabel.setAttribute('role', 'status');
    errorLabel = node('p', null, 'fish-error'); errorLabel.setAttribute('role', 'alert'); errorLabel.hidden = true;
    root.append(resultLabel, errorLabel);
    const host = node('div', null, 'fish-table'); root.append(host);
    table = AppUIDataTable.create({container: host, signal: scope.signal, maxRows: 250, getId: row => row.id,
      empty: snapshot.products ? 'No products match these filters. Try a lower minimum weight or fewer filters.' : 'No saved research yet. Import a snapshot to begin.',
      detailColumn: 'name', detailLabel: row => row.store + ' ' + row.name, renderDetails: details,
      columns: [
        {id: 'compare', label: 'Pick', width: '50px', checkbox: row => ({checked: shortlist.has(row.id), ariaLabel: 'Shortlist ' + row.name + ' from ' + row.store, onChange: (_, checked) => setShortlist(row, checked)})},
        {id: 'name', label: 'Product / store', width: '300px', sortable: true, render: productCell,
          exportValue: row => row.name + '\n' + row.store, exportLink: row => row.source_url},
        {id: 'market', label: 'Market', width: '175px', sortable: true},
        {id: 'portions', label: 'Portions / sale prices', width: '310px', className: 'fish-portion-summary', render: portionSummary, exportValue: portionSummary},
        {id: 'size', label: 'Selected portion', width: '150px', render: row => selected(row).name, exportValue: row => selected(row).name},
        {id: 'weight', label: 'Weight', width: '130px', sortable: true, getValue: row => selected(row).grams ?? Infinity, render: row => weight(selected(row).grams)},
        {id: 'price', label: 'Portion price¹', width: '115px', sortable: true, getValue: row => comparePrice(selected(row)), render: row => won(comparePrice(selected(row)))},
        {id: 'per100', label: 'KRW / 100 g', width: '120px', sortable: true, getValue: row => selected(row).grams ? comparePrice(selected(row)) * 100 / selected(row).grams : Infinity, render: row => selected(row).grams ? won(Math.round(comparePrice(selected(row)) * 100 / selected(row).grams)) : '—'},
        {id: 'product_reviews', label: 'Product reviews', width: '125px', sortable: true, render: row => fmt.format(row.product_reviews)},
        {id: 'store_rating', label: 'Store rating', width: '100px', sortable: true, render: row => row.store_rating == null ? '—' : row.store_rating.toFixed(1)},
        {id: 'store_reviews', label: 'Store reviews', width: '120px', sortable: true, render: row => fmt.format(row.store_reviews)},
      ]}); scope.add(table);
    root.append(node('p', 'Expand a product for all sizes, ingredients, origin disclosures and a portion selector. Select up to four items to compare; your shortlist lasts for this page session.', 'fish-muted'));
    const status = node('p', null, 'fish-muted');
    status.textContent = 'Workspace provider: vis://fish · product reviews and store reviews are separate; recent purchases are not reviews.';
    root.append(status);
    updateSelection(); void refresh();
  }

  async function start() {
    const result = await AppUIApi.operation('personal/fish', 'catalog', {}, {signal: scope.signal});
    if (!scope.current()) return;
    if (!result.ok) {
      root.replaceChildren(node('p', 'Could not load saved fish research: ' + (result.error || result._error || 'Unknown error'), 'fish-error'));
      const retry = node('div'); root.append(retry);
      scope.add(AppUIToolbar.create({container: retry, signal: scope.signal, items: [{label: 'Retry', action: () => void start()}]}));
      return;
    }
    snapshot = result; mount();
  }

  window.AppUIReady.then(() => {
    app = AppUI.createApp({id: 'personal-fish', title: 'Fish Market', statusbar: {},
      content: {render(el) {
        root = el;
        scope = AppUILifecycle.createViewScope({host: el, pagehide: true});
        scope.add(() => {generation++; controller?.abort();});
        root.append(node('p', 'Loading saved fish research…'));
        void start();
        return () => scope.destroy();
      }}});
  }).catch(error => {
    document.getElementById('app-content-body').textContent = 'Fish Market could not start: ' + error.message;
  });
})();
