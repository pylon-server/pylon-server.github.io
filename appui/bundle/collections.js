/* Native text cards for GridView renderers; GridView owns interaction lifetime. */
window._AppUIGridViewCard = {
  create({ label = '', lines = [], selected = false, className = '' } = {}) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'appui-grid-text-card' + (className ? ' ' + className : '');
    card.setAttribute('aria-label', String(label ?? ''));
    card.style.cssText =
      'display:flex;flex-direction:column;align-items:stretch;text-align:left;min-width:0;padding:5px 6px;color:var(--text-primary);background:var(--bg-primary);border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:10px';
    if (selected) {
      card.classList.add('selected');
      card.setAttribute('aria-current', 'true');
      card.style.borderLeft = '2px solid var(--accent)';
    }
    function append(text, muted) {
      const line = document.createElement('span');
      line.textContent = String(text ?? '');
      line.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      if (muted) line.style.color = 'var(--text-muted)';
      card.appendChild(line);
    }
    append(label, false);
    for (const value of lines) {
      const line = value !== null && typeof value === 'object' ? value : { text: value };
      append(line.text, line.muted);
    }
    return card;
  }
};

;
// grid-view.js  --  AppUIGridView: Generic grid/icon view with toggle support
// Uses foundation storage and lifecycle services.

const AppUIGridView = (function() {
  'use strict';

  /**
   * Create a grid view instance.
   * @param {object} opts
   * @param {HTMLElement|string} opts.container - container element or selector
   * @param {number} [opts.itemSize] - grid item size in px (used for CSS grid min-width)
   * @param {number} [opts.columns] - optional positive fixed column count
   * @param {number|string} [opts.gap] - optional grid gap (pixels or CSS length, default 8px)
   * @param {number|string} [opts.padding] - optional grid padding (pixels or CSS length, default 8px)
   * @param {function} opts.renderItem - renderItem(item, scope) -> HTMLElement (card content)
   * The optional scope owns signal/current/add/listen until repaint or disposal.
   * @param {function} [opts.onSelect] - onSelect(item) called on click
   * @param {function} [opts.onDblClick] - onDblClick(item) called on double-click
   * @param {function} [opts.onContextMenu] - onContextMenu(item, ev) called on right-click
   * @param {string} [opts.persistKey] - localStorage key for view mode persistence
   * @returns {{setItems, toggle, isGrid, refresh, getViewMode, setViewMode}}
   */
  function create(opts) {
    const container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;
    if (!container) throw new Error('AppUIGridView: container not found');

    const itemSize = opts.itemSize || 120;
    const fixedColumns = Number.isInteger(opts.columns) && opts.columns > 0 ? opts.columns : null;
    const renderItem = opts.renderItem || function() { return document.createElement('div'); };
    const onSelect = opts.onSelect || function() {};
    const onDblClick = opts.onDblClick || function() {};
    const onContextMenu = opts.onContextMenu || function() {};
    const persistKey = opts.persistKey === false ? null : (opts.persistKey || 'ui:gridview:mode');

    let _viewMode = opts.viewMode || (persistKey ? AppUIStorage.get(persistKey, 'list') : 'list');
    let _items = [];
    let _gridEl = null;
    let destroyed = false;
    const lifetime = AppUILifecycle.createScope();
    const renders = AppUILifecycle.createKeyedScopes({pagehide: false});
    if (opts.signal) {
      lifetime.listen(opts.signal, 'abort', destroy, {once: true});
      if (opts.signal.aborted) destroy();
    }

    function ensureGridEl() {
      if (!_gridEl) {
        _gridEl = document.createElement('div');
        _gridEl.className = 'ui-grid-view-container';
        const columns = fixedColumns ? 'repeat(' + fixedColumns + ',minmax(0,1fr))' : 'repeat(auto-fill,minmax(min(100%,' + itemSize + 'px),1fr))';
        _gridEl.style.cssText = 'display:grid;grid-template-columns:' + columns + ';gap:8px;padding:8px';
        for (const name of ['gap','padding']) {
          if (opts[name] != null) _gridEl.style[name] = typeof opts[name] === 'number' ? opts[name]+'px' : opts[name];
        }
        container.appendChild(_gridEl);
      }
      return _gridEl;
    }

    /**
     * Set items and re-render if in grid mode.
     */
    function setItems(items) {
      if (destroyed) return;
      _items = items || [];
      if (_viewMode === 'grid') {
        renderGrid();
      }
    }

    /**
     * Render items in grid layout.
     */
    function renderGrid() {
      if (destroyed) return;
      const owner = renders.begin('grid');
      if (!owner.current()) return;
      const context = {
        signal: owner.signal,
        current: () => owner.current(),
        add: cleanup => owner.add(cleanup),
        listen(target, type, listener, options) {
          return owner.listen(target, type, function (...args) {
            if (context.current()) return listener.apply(this, args);
          }, options);
        },
      };
      const gridEl = ensureGridEl();
      gridEl.style.display = 'grid';
      gridEl.innerHTML = '';

      for (const item of _items) {
        if (!owner.current()) return;
        const card = renderItem(item, context);
        if (!owner.current()) return;
        if (!card) continue;
        card.className = (card.className || '') + ' ui-grid-card';

        if (opts.selectable !== false) owner.listen(card, 'click', function() {
          if (destroyed || owner.destroyed) return;
          // Clear previous selection
          gridEl.querySelectorAll('.ui-grid-card.selected').forEach(function(c) { c.classList.remove('selected'); });
          card.classList.add('selected');
          onSelect(item);
        });

        owner.listen(card, 'dblclick', function() {
          if (destroyed || owner.destroyed) return;
          onDblClick(item);
        });

        owner.listen(card, 'contextmenu', function(ev) {
          if (destroyed || owner.destroyed) return;
          onContextMenu(item, ev);
        });

        gridEl.appendChild(card);
      }
    }

    /**
     * Hide the grid container (caller should show their list view).
     */
    function hideGrid() {
      const owner = renders.begin('grid');
      if (!owner.current()) return;
      if (_gridEl) _gridEl.innerHTML = '';
      if (_gridEl) _gridEl.style.display = 'none';
    }

    /**
     * Toggle between list and grid view.
     */
    function toggle() {
      setViewMode(_viewMode === 'list' ? 'grid' : 'list');
    }

    /**
     * Check if currently in grid mode.
     */
    function isGrid() {
      return _viewMode === 'grid';
    }

    /**
     * Refresh the current view.
     */
    function refresh() {
      if (destroyed) return;
      if (_viewMode === 'grid') renderGrid();
      else hideGrid();
    }

    /**
     * Get current view mode.
     */
    function getViewMode() { return _viewMode; }

    /**
     * Set view mode: 'list' or 'grid'.
     */
    function setViewMode(mode) {
      if (destroyed) return;
      _viewMode = mode;
      if (persistKey) AppUIStorage.set(persistKey, mode);
      if (mode === 'grid') {
        renderGrid();
      } else {
        hideGrid();
      }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      const teardown=AppUILifecycle.createScope();
      teardown.add(()=>{_gridEl?.remove();_gridEl=null;_items=[];});
      teardown.add(lifetime);teardown.add(renders);
      teardown.destroy();
    }

    return {
      destroy: destroy,
      setItems: setItems,
      toggle: toggle,
      isGrid: isGrid,
      refresh: refresh,
      getViewMode: getViewMode,
      setViewMode: setViewMode
    };
  }

  return { create: create, createTextCard: options => window._AppUIGridViewCard.create(options) };
})();
window.AppUIGridView = AppUIGridView;

;
/* Read-only label/value summaries using the shared collection lifetime. */
const AppUIStatCards = (function() {
  function create(options = {}) {
    const grid = AppUIGridView.create({container: options.container, signal: options.signal,
      columns: options.columns, gap: options.gap, padding: options.padding,
      viewMode: 'grid', persistKey: false, selectable: false, itemSize: options.itemSize ?? 130,
      renderItem(stat) {
        const card = document.createElement('dl'); card.className = 'appui-stat-card' + (options.compact ? ' appui-stat-card-compact' : '');
        const label = document.createElement('dt'); label.className = 'appui-stat-label'; label.textContent = String(stat.label ?? '');
        const value = document.createElement('dd'); value.className = 'appui-stat-value'; value.textContent = String(stat.value ?? '--');
        if (stat.color) value.style.color = stat.color;
        card.appendChild(label); card.appendChild(value);
        if (stat.description != null) {
          const description = document.createElement('dd'); description.className = 'appui-stat-description';
          description.textContent = String(stat.description); card.appendChild(description);
        }
        return card;
      },
    });
    function setItems(items) {grid.setItems((items || []).map(stat => ({...stat})));}
    if (options.items) setItems(options.items);
    return {setItems, destroy: () => grid.destroy()};
  }
  return {create};
})();
window.AppUIStatCards = AppUIStatCards;
