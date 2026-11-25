/* Keyboard focus and activation for AppUI tree rows. */
var AppUITreeKeyboard = (() => {
  function bind({container, listen}) {
    // Keyboard navigation
    container.tabIndex = 0;
    container.setAttribute('role', 'tree');
    container.style.outline = 'none';
    let _focusIdx = -1;

    function _getVisibleRows() {
      return [...container.querySelectorAll('.tree-row')].filter(row => !row.closest('[hidden]'));
    }

    function _setFocus(idx) {
      const rows = _getVisibleRows();
      if (idx < 0 || idx >= rows.length) return;
      rows.forEach(r => r.classList.remove('focused'));
      _focusIdx = idx;
      rows[idx].classList.add('focused');
      rows[idx].scrollIntoView({block: 'nearest'});
    }

    const keyHandler = listen(container, 'keydown', (e) => {
      const rows = _getVisibleRows();
      if (!rows.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _setFocus(Math.min(_focusIdx + 1, rows.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _setFocus(Math.max(_focusIdx - 1, 0));
      } else if (e.key === 'Enter' && _focusIdx >= 0 && _focusIdx < rows.length) {
        e.preventDefault();
        rows[_focusIdx].click();
      } else if (e.key === 'ArrowRight' && _focusIdx >= 0 && _focusIdx < rows.length) {
        e.preventDefault();
        const twist = rows[_focusIdx].querySelector('.twisty');
        if (twist && rows[_focusIdx].classList.contains('tree-folder') && rows[_focusIdx].getAttribute('aria-expanded') === 'false') twist.click();
      } else if (e.key === 'ArrowLeft' && _focusIdx >= 0 && _focusIdx < rows.length) {
        e.preventDefault();
        const twist = rows[_focusIdx].querySelector('.twisty');
        if (twist && rows[_focusIdx].getAttribute('aria-expanded') === 'true') twist.click();
      }
    });

    // Focus style
    if (!document.getElementById('_tree-kb-css')) {
      const s = document.createElement('style');
      s.id = '_tree-kb-css';
      s.textContent = '.tree-row.focused{outline:1px solid var(--accent);outline-offset:-1px;border-radius:3px}';
      document.head.appendChild(s);
    }

    return {destroy() { container.removeEventListener('keydown', keyHandler); }};
  }
  return {bind};
})();
window.AppUITreeKeyboard = AppUITreeKeyboard;

;
/* Tree node DOM and event wiring, with host-owned selection/expansion state. */
var AppUITreeRendering = (() => {
  function create({ rowDecorations, checkedPaths, getActivePath, setActivePath, _isExpanded, _isCollapsed, basePadding, indent, alignLeafIndent, listen, _dbg, _toggleNode, container, opts, isDraggable, _clearDragOver, _setExpanded, appendChildren }) {
    function _buildNode(node, depth, isRoot) {
      const wrap = document.createElement('div');
      wrap.className = 'tree-node-wrap';

      const row = document.createElement('div');
      const canExpand = node.hasChildren !== false;
      row.className = 'tree-row' + (node.path === getActivePath() ? ' active' : '')
        + (canExpand ? ' tree-folder' : ' tree-file');
      row.dataset.path = node.path || '';
      row.title = node.title || node.path || node.name || '';
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-expanded', canExpand ? String(_isExpanded(node.path)) : 'false');
      row.style.paddingLeft = (basePadding + depth * indent) + 'px';

      // Twisty
      const twist = document.createElement('span');
      twist.className = 'twisty';
      if (canExpand) {
        twist.textContent = _isExpanded(node.path) ? '▾' : '▸';
      } else {
        twist.textContent = ' ';
        if (alignLeafIndent) twist.style.visibility = 'hidden';
        else twist.style.display = 'none';
      }

      // Icon (optional). Supports an overlapped badge glyph via node.iconBadge
      // (e.g. a 🔗 link badge composited onto a 📁 folder) rather than two emoji
      // sitting side-by-side. The badge sits over the base icon's bottom-right.
      const iconEl = document.createElement('span');
      iconEl.className = 'tree-icon';
      if (node.iconBadge) {
        iconEl.classList.add('tree-icon-badged');
        const base = document.createElement('span');
        base.className = 'tree-icon-base';
        base.textContent = node.icon || '';
        const bdg = document.createElement('span');
        bdg.className = 'tree-icon-badge' + (node.iconBadgeClass ? ' ' + node.iconBadgeClass : '');
        bdg.textContent = node.iconBadge;
        iconEl.append(base, bdg);
      } else {
        iconEl.textContent = node.icon || '';
      }

      // Name
      const nameEl = document.createElement('span');
      nameEl.className = 'tree-name';
      nameEl.textContent = node.name || '';
      // Per-node text style hook: a derived/twin node (converted .htm/.md/_files
      // under an original) renders in ITALIC via a node class. node.className is
      // a space-separated extra-class string applied to the row; node.italic is
      // a convenience flag. No-op for ordinary nodes.
      if (node.className) {
        String(node.className).split(/\s+/).forEach((c) => { if (c) row.classList.add(c); });
      }
      if (node.italic) nameEl.style.fontStyle = 'italic';

      row.append(twist, iconEl, nameEl);
      if (opts.checkable && (typeof opts.checkable !== 'function' || opts.checkable(node))) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'tree-checkbox';
        input.setAttribute('aria-label', 'Select ' + (node.name || node.path));
        input.checked = checkedPaths.has(node.path);
        row.insertBefore(input, iconEl);
        listen(input, 'click', event => event.stopPropagation());
        listen(input, 'keydown', event => event.stopPropagation());
        listen(input, 'change', () => {
          if (input.checked) checkedPaths.add(node.path); else checkedPaths.delete(node.path);
          container.querySelectorAll('.tree-checkbox').forEach(other => {
            other.checked = checkedPaths.has(other.closest('.tree-row').dataset.path);
          });
          if (opts.onCheck) opts.onCheck(node, input.checked, [...checkedPaths]);
        });
      }
      if (node.badge) {
        const badge = document.createElement('span');
        badge.className = 'tree-badge' + (node.badgeClass ? ' ' + node.badgeClass : '');
        badge.textContent = node.badge;
        badge.title = node.badgeTitle || node.badge;     // full text when ellipsized
        row.appendChild(badge);
      }
      wrap.appendChild(row);
      // Additive host hook: let a caller decorate the row with inline controls
      // or extra badges the declarative fields can't express (e.g. the catalog
      // chain tree's "write" pill, the dependency tree's colored type dot). It
      // runs after the standard row is built and must not replace it. No-op for
      // callers that don't pass it, so existing trees are unchanged.
      if (typeof opts.decorateRow === 'function') {
        const decorate = () => {
          try { opts.decorateRow(node, row, { nameEl, iconEl, twist }); } catch (_e) { /* a bad decorator must not break the tree */ }
        };
        rowDecorations?.set(row, decorate);
        decorate();
      }
      // Children container
      const children = document.createElement('div');
      children.className = 'tree-children';
      wrap.appendChild(children);

      // Twisty click -> expand/collapse
      if (canExpand) {
        listen(twist, 'click', (e) => {
          _dbg("[tree] CLICK twisty", (node && node.path), "isTrusted=" + e.isTrusted);
          e.stopPropagation();
          _toggleNode(node, children, twist, depth, false, row);
        });
      }

      // Row click -> select (or expand if parent node)
      listen(row, 'click', (ev) => {
        _dbg("[tree] CLICK row", (node && node.path), "isTrusted=" + (ev && ev.isTrusted));
        if (canExpand) {
          _toggleNode(node, children, twist, depth, false, row);
        }
        // Activate THIS specific row only. Matching by path (setActive) would
        // highlight EVERY row sharing the same relative path — e.g. a
        // ``README.md`` that exists under BOTH the guest and common roots would
        // light up in both. Clicking marks the exact clicked node.
        container.querySelectorAll('.tree-row.active').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        setActivePath(node.path || '');
        if (opts.onSelect) opts.onSelect(node);
      });

      // Context menu
      if (opts.contextMenu) {
        listen(row, 'contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const items = opts.contextMenu(node);
          if (items && items.length && typeof AppUIContextMenu !== 'undefined') {
            AppUIContextMenu.show(e, items);
          }
        });
      } else if (opts.onContextMenu) {
        listen(row, 'contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          opts.onContextMenu(node, e);
        });
      }

      // Draggable
      if (isDraggable) {
        row.draggable = true;
        listen(row, 'dragstart', (e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', node.path || '');
          e.dataTransfer.effectAllowed = 'all';   // allow move + copy + link cursors
          if (opts.onDragStart) opts.onDragStart(node, e);
          row.classList.add('dragging');
        });
        listen(row, 'dragend', () => {
          row.classList.remove('dragging');
          _clearDragOver();
        });
      }

      // Drop target
      if (opts.onDrop) {
        listen(row, 'dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Cursor feedback mirrors the drop semantics: Alt = link, Ctrl/⌘ =
          // copy, else move (see the explorer's onDrop modifier mapping).
          e.dataTransfer.dropEffect = e.altKey ? 'link' : ((e.ctrlKey || e.metaKey) ? 'copy' : 'move');
          row.classList.add('drag-over');
        });
        listen(row, 'dragleave', () => {
          row.classList.remove('drag-over');
        });
        listen(row, 'drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('drag-over');
          opts.onDrop(node, e);
        });
      }

      // Auto-expand: if node has inline children, render them immediately (no async)
      // Otherwise fall back to onExpand callback
      // #1 (evaluated): the chunked `appendChildren` below bounds the SIBLING-
      // width freeze (a folder with thousands of entries). A node seeded with
      // INLINE children at many PRE-EXPANDED levels still recurses synchronously
      // within a chunk (each _buildNode re-enters appendChildren for its own
      // inline children). In practice that doesn't jank because deep trees are
      // seeded ONE LEVEL at a time and fetch deeper levels LAZILY via onExpand
      // (the `hasChildren !== false` branch) rather than shipping the whole
      // subtree inline. True windowed virtualization (routing the tree through
      // AppUIVirtualScroll) is a nested-container → flat-list rewrite — deferred
      // until a real deep-pre-expanded tree is measured to jank.
      if (node.children && node.children.length > 0 && !(typeof _isCollapsed === 'function' && _isCollapsed(node.path))) {
        _setExpanded(node.path, true);
        twist.textContent = '▾';
        row?.setAttribute('aria-expanded', 'true');
        // Chunked append (via the host helper) so a node seeded with thousands
        // of inline children doesn't build them all synchronously → freeze.
        // Fallback to a plain loop if the helper wasn't provided (older host).
        if (typeof appendChildren === 'function') {
          appendChildren(children, node.children, depth + 1);
        } else {
          node.children.forEach(child => {
            children.appendChild(_buildNode(child, depth + 1, false));
          });
        }
      } else if (_isExpanded(node.path) && node.hasChildren !== false) {
        _toggleNode(node, children, twist, depth, true, row);
      } else if (node.children && node.children.length > 0) {
        // inline children the user collapsed: drawn closed (expanding rebuilds them)
        twist.textContent = '▸';
        row?.setAttribute('aria-expanded', 'false');
      }

      return wrap;
    }

    return _buildNode;
  }
  return {create};
})();
window.AppUITreeRendering = AppUITreeRendering;

;
/* Incremental rendered-tree insertion/removal. */
var AppUITreeMutations = (() => {
  function create({ container, basePadding, indent, _buildNode, isDestroyed }) {
    function insertNode(parentPath, nodeData) {
      if (isDestroyed()) return;
      // Find parent's children container
      const normalized = (parentPath || '').replace(/\\/g, '/');
      const rows = container.querySelectorAll('.tree-row');
      let parentWrap = null;
      let parentDepth = 0;
      for (const row of rows) {
        const rpath = (row.dataset.path || '').replace(/\\/g, '/');
        if (rpath === normalized || row.dataset.path === parentPath) {
          parentWrap = row.closest('.tree-node-wrap');
          const pl = parseInt(row.style.paddingLeft) || 0;
          parentDepth = Math.round((pl - basePadding) / indent);
          break;
        }
      }
      if (!parentWrap) return false;
      let childContainer = parentWrap.querySelector('.tree-children');
      if (!childContainer) {
        childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        parentWrap.appendChild(childContainer);
      }
      // Build the node
      const node = {
        name: nodeData.name,
        path: parentPath + '/' + nodeData.name,
        hasChildren: nodeData.type === 'dir',
        icon: nodeData.icon || (nodeData.type === 'dir' ? '📂' : ''),
      };
      // Skip if a child with this name already exists (e.g. re-upload / overwrite)
      // — leave the existing row rather than duplicating it.
      const _existingNames = childContainer.querySelectorAll(':scope > .tree-node-wrap > .tree-row > .tree-name');
      for (const _el of _existingNames) {
        if ((_el.textContent || '') === nodeData.name) return true;
      }
      const newEl = _buildNode(node, parentDepth + 1, false);
      // Insert sorted (folders first, then alphabetical)
      const existing = childContainer.querySelectorAll(':scope > .tree-node-wrap > .tree-row');
      let inserted = false;
      for (const row of existing) {
        const isFolder = row.classList.contains('tree-folder');
        const rowName = row.querySelector('.tree-name')?.textContent || '';
        if (node.hasChildren && !isFolder) { childContainer.insertBefore(newEl, row.closest('.tree-node-wrap')); inserted = true; break; }
        if (node.hasChildren === isFolder && nodeData.name.localeCompare(rowName) < 0) { childContainer.insertBefore(newEl, row.closest('.tree-node-wrap')); inserted = true; break; }
      }
      if (!inserted) childContainer.appendChild(newEl);
      return true;
    }

    function removeNode(path) {
      if (isDestroyed()) return;
      const normalized = (path || '').replace(/\\/g, '/');
      const rows = container.querySelectorAll('.tree-row');
      for (const row of rows) {
        const rpath = (row.dataset.path || '').replace(/\\/g, '/');
        if (rpath === normalized || row.dataset.path === path) {
          const wrap = row.closest('.tree-node-wrap');
          if (wrap) { wrap.remove(); return true; }
        }
      }
      return false;
    }

    return {insertNode, removeNode};
  }
  return {create};
})();
window.AppUITreeMutations = AppUITreeMutations;

;
/**
 * AppUITree  --  lazy-expanding tree component
 *
 * Usage:
 *   const tree = AppUITree.create({
 *     container: document.getElementById('tree'),
 *     onSelect: (node) => { console.log('selected', node.path); },
 *     onExpand: (node, callback) => {
 *       fetch('/api/children?path=' + node.path).then(r => r.json()).then(children => {
 *         callback(children); // [{name, path, icon, hasChildren, data}]
 *       });
 *     },
 *     onDrop: (node, data) => { console.log('dropped on', node.path, data); },
 *     draggable: true,
 *     storageKey: 'myTree:expanded'
 *   });
 *   tree.setRoots([{name: 'Root', path: '/', hasChildren: true}]);
 *   tree.setActive('/some/path');
 *   tree.expandTo('/some/deep/path');
 *
 * Node: {name, path, icon, hasChildren, data}
 *   - name: display text
 *   - path: unique identifier / path string
 *   - icon: optional emoji or HTML
 *   - hasChildren: boolean, whether twisty should appear
 *   - data: any page-specific state
 *
 * Options:
 *   - container: DOM element for the tree
 *   - onSelect(node): called when a node is clicked
 *   - checkable: true or predicate(node), enables independent checkboxes
 *   - checkedPaths: initial checked node paths (no implicit descendant cascade)
 *   - onCheck(node, checked, paths): called when a checkbox changes
 *   - onExpand(node, callback): called when a node is expanded; callback receives children array
 *   - onDrop(node, transferData): called when something is dropped on a node
 *   - draggable: boolean (default false)  --  make tree nodes draggable
 *   - onDragStart(node, event): called when drag starts on a node
 *   - storageKey: localStorage key for expanded state (default: 'uitree:expanded')
 *   - indent: pixels per depth level (default: 12)
 *   - basePadding: base left padding (default: 8)
 *   - alignLeafIndent: reserve the disclosure-column width for leaves so
 *     file and folder names line up (default: true)
 *   - autoScrollActive: scroll the highlighted/active item into view (default true)
 *   - matchFn(node, lowercasedQuery): optional custom filter predicate (default
 *     matches node.name only); return true to keep the node. Used with
 *     searchable / setFilter so a tree can match on more than the name.
 *   - decorateRow(node, rowEl, {nameEl, iconEl, twist}): optional hook to append
 *     inline controls/badges a declarative field can't express (e.g. a "write"
 *     pill or a colored type dot). Runs after the standard row is built.
 *     tree.refreshDecorations() reapplies it in place; keep decorators idempotent.
 */
const AppUITree = (function() {
  'use strict';

  // Diagnostic logging for tree expand/collapse/toggle — OFF by default so it
  // never spams the console in normal use. Opt in with
  //   localStorage.setItem('appui.treeDebug','1')   (persists)   or
  //   window.__APPUI_TREE_DEBUG = true               (this session)
  // then reload. (These logs traced a deep-link re-expand bug; kept behind the
  // flag so they're recoverable without shipping console noise.)
  let _TREE_DEBUG = null;
  function _treeDebug() {
    if (_TREE_DEBUG === null) {
      try {
        _TREE_DEBUG = !!(window.__APPUI_TREE_DEBUG) ||
          (typeof localStorage !== 'undefined' && localStorage.getItem('appui.treeDebug') === '1');
      } catch (e) { _TREE_DEBUG = false; }
    }
    return _TREE_DEBUG;
  }
  function _dbg() {
    if (!_treeDebug()) return;
    try { console.log.apply(console, arguments); } catch (e) { /* ignore */ }
  }

  function create(opts) {
    opts = opts || {};
    const container = opts.container;
    if (!container) throw new Error('AppUITree: container is required');

    const storageKey = opts.storageKey || null;
    const indent = Number.isFinite(opts.indent) ? opts.indent : 12;
    const basePadding = Number.isFinite(opts.basePadding) ? opts.basePadding : 8;
    const alignLeafIndent = opts.alignLeafIndent !== false;
    const isDraggable = !!opts.draggable;
    const autoScrollActive = opts.autoScrollActive !== false;
    const checkedPaths = new Set(opts.checkedPaths || []);
    const rowDecorations = new WeakMap();
    function setCheckedPaths(paths) {
      checkedPaths.clear();
      for (const path of paths || []) checkedPaths.add(path);
      container.querySelectorAll('.tree-checkbox').forEach(input => {
        input.checked = checkedPaths.has(input.closest('.tree-row').dataset.path);
      });
    }

    let expandedState = {};
    if (storageKey) {
      expandedState = AppUIStorage.getJSON(storageKey, {}) || {};
    }

    let destroyed = false;
    let activationTimer = null;
    const scrollFrames = new Set();
    // Pending chunked-append rAF ids, cancelled on destroy / collapse so a huge
    // folder's in-flight build stops cleanly.
    const buildFrames = new Set();
    // FREEZE FIX: build a node's children in CHUNKS across animation frames when
    // there are many siblings. A folder with thousands of entries otherwise
    // appends thousands of row subtrees in ONE synchronous pass → the tab
    // freezes (same class of bug as the sysdoc outline). Small sets build
    // synchronously (instant); large sets paint the first chunk immediately and
    // stream the rest, keeping the UI responsive. `depthFor(child)` yields the
    // child's depth (roots use 0; children use parent depth + 1).
    const _CHUNK = 120;
    function _appendChildren(childContainer, childNodes, depthFor) {
      const nodes = childNodes || [];
      if (nodes.length <= _CHUNK) {
        const frag = document.createDocumentFragment();
        for (const c of nodes) frag.appendChild(_buildNode(c, depthFor(c), false));
        childContainer.appendChild(frag);
        return;
      }
      let i = 0;
      // Tag this container's in-flight build so a collapse/re-expand supersedes it.
      const token = (childContainer.__buildTok = (childContainer.__buildTok || 0) + 1);
      const step = () => {
        if (destroyed || childContainer.__buildTok !== token) return;
        const frag = document.createDocumentFragment();
        const end = Math.min(nodes.length, i + _CHUNK);
        for (; i < end; i++) frag.appendChild(_buildNode(nodes[i], depthFor(nodes[i]), false));
        childContainer.appendChild(frag);
        if (i < nodes.length) {
          const f = requestAnimationFrame(step);
          buildFrames.add(f);
        }
      };
      const f = requestAnimationFrame(step);
      buildFrames.add(f);
    }
    function listen(target, event, callback) {
      const guarded = e => {if (!destroyed) callback(e);};
      target.addEventListener(event, guarded);
      return guarded;
    }
    let activePath = null;
    let roots = [];
    let _filteredRoots = null; // null = no filter active
    let filterText = '';

    // Search support
    let _searchEl = null;
    if (opts.searchable) {
      _searchEl = document.createElement('input');
      _searchEl.type = 'text';
      _searchEl.className = 'tree-search';
      _searchEl.placeholder = opts.searchPlaceholder || 'Search...';
      _searchEl.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-elevated);color:var(--text-primary);font-size:12px;margin-bottom:6px;box-sizing:border-box;';
      container.before(_searchEl);
      listen(_searchEl, 'input', () => setFilter(_searchEl.value));
    }

    function setFilter(query) {
      if (destroyed) return;
      filterText = String(query || '').trim().toLowerCase();
      if (_searchEl) _searchEl.value = String(query || '');
      _filteredRoots = filterText ? _filterNodes(roots, filterText) : null;
      _render();
    }

    function _filterNodes(nodes, query) {
      const result = [];
      // A caller may match on more than the name (e.g. the catalog tree matches
      // a tool's description too) via opts.matchFn(node, query) → boolean. The
      // query passed in is already lowercased. Default stays name-only.
      const matchFn = (typeof opts.matchFn === 'function') ? opts.matchFn : null;
      for (const node of nodes) {
        const nameMatch = matchFn ? !!matchFn(node, query) : (node.name || '').toLowerCase().includes(query);
        // Children can live inline (node.children — what the renderer expands)
        // OR under node.data.children; recurse whichever is present so the
        // filter's auto-expand matches how the tree actually renders.
        const kids = (node.children && node.children.length) ? node.children
          : (node.data?.children || []);
        const children = kids.length ? _filterNodes(kids, query) : [];
        if (nameMatch || children.length > 0) {
          const clone = Object.assign({}, node);
          if (children.length > 0) {
            // Write the filtered children back to WHERE this node carries them,
            // so the renderer (node.children) and any data.children consumer agree.
            if (node.children && node.children.length) clone.children = children;
            else clone.data = Object.assign({}, clone.data, { children });
            clone.hasChildren = true;
            // Auto-expand matching groups
            _setExpanded(clone.path, true);
          }
          result.push(clone);
        }
      }
      return result;
    }

    function _saveState() {
      if (storageKey) AppUIStorage.setJSON(storageKey, expandedState);
    }

    function _isExpanded(path) {
      return !!expandedState[path];
    }

    function _setExpanded(path, expanded) {
      if (destroyed) return;
      if (expanded) expandedState[path] = true;
      // a COLLAPSE is remembered explicitly (false), so a node that carries INLINE children - drawn
      // expanded by default - stays collapsed across a re-render / reload (absent = never toggled)
      else expandedState[path] = false;
      _saveState();
    }

    // true when the user collapsed this node (vs. never toggled it)
    function _isCollapsed(path) { return expandedState[path] === false; }

    function setRoots(nodes) {
      if (destroyed) return;
      roots = nodes || [];
      _filteredRoots = filterText ? _filterNodes(roots, filterText) : null;
      _render();
    }

    function _render() {
      if (destroyed) return;
      container.replaceChildren();
      const displayRoots = _filteredRoots !== null ? _filteredRoots : roots;
      _appendChildren(container, displayRoots, () => 0);
    }

    const _buildNode = AppUITreeRendering.create({ rowDecorations, checkedPaths, getActivePath: () => activePath, setActivePath: value => { activePath = value; }, _isExpanded, _isCollapsed, basePadding, indent, alignLeafIndent, listen, _dbg, _toggleNode, container, opts, isDraggable, _clearDragOver, _setExpanded, appendChildren: (c, nodes, depth) => _appendChildren(c, nodes, () => depth) });

    function _toggleNode(node, container, twist, depth, forceOpen, row) {
      const expanded = _isExpanded(node.path);
      _dbg("[tree] toggle", (node && node.path), expanded ? (forceOpen ? "(re-expand)" : "→collapse") : "→expand", "forceOpen=" + !!forceOpen);
      if (expanded && !forceOpen) {
        // Collapse
        _setExpanded(node.path, false);
        container.replaceChildren();
        twist.textContent = '▸';
        row?.setAttribute('aria-expanded', 'false');
        return;
      }

      // Expand
      _setExpanded(node.path, true);
      twist.textContent = '▾';
      row?.setAttribute('aria-expanded', 'true');

      // INLINE children and no onExpand (e.g. the charts library): build them again. A collapse
      // emptied the container and nothing else would refill it - the node showed open but empty.
      // (A tree WITH onExpand keeps asking it: its inline children may only be a first seed.)
      if (!opts.onExpand && node.children && node.children.length) {
        container.replaceChildren();
        _appendChildren(container, node.children, () => depth + 1);
        return;
      }

      if (!opts.onExpand) return;

      // Show a spinner on the twist while children load (async backends like the
      // GitLab link tree or a remote scope can take a moment). Restore the arrow
      // when done() fires. Guard with a token so a fast collapse/re-expand can't
      // let a stale callback flip the arrow back.
      const _spinTok = (twist.__spinTok = (twist.__spinTok || 0) + 1);
      twist.textContent = '';
      twist.classList.add('is-loading');
      let _spun = true;
      const _stopSpin = () => {
        if (!_spun || twist.__spinTok !== _spinTok) return;
        _spun = false;
        twist.classList.remove('is-loading');
        twist.textContent = _isExpanded(node.path) ? '▾' : '▸';
      };

      opts.onExpand(node, (childNodes) => {
        if (destroyed) return;
        _stopSpin();
        container.replaceChildren();
        _appendChildren(container, childNodes, () => depth + 1);
      });
    }

    function _clearDragOver() {
      container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    function setActive(path) {
      if (destroyed) return;
      activePath = path;
      const normalized = path ? path.replace(/\\/g, '/') : '';
      container.querySelectorAll('.tree-row.active').forEach(r => r.classList.remove('active'));
      container.querySelectorAll('.tree-row').forEach(r => {
        const rpath = (r.dataset.path || '').replace(/\\/g, '/');
        if (rpath === normalized || r.dataset.path === path) {
          r.classList.add('active');
          if (autoScrollActive) {
            // Defer until after the current render/expand layout has settled;
            // otherwise a newly revealed child can still be outside the
            // sidebar's scroll viewport.
            let frame;
            frame = requestAnimationFrame(() => {
              scrollFrames.delete(frame);
              if (!destroyed && r.isConnected) r.scrollIntoView({block: 'nearest', inline: 'nearest'});
            });
            scrollFrames.add(frame);
          }
        }
      });
    }

    function highlight(path) {
      setActive(path);
    }

    function expandTo(path, options) {
      if (destroyed) return;
      // Diagnostic: surface every programmatic expand request (helps trace why a
      // deep-link group does/doesn't open). Gated behind the tree-debug flag.
      _dbg("[tree] expandTo", path, options || {});
      // Mark all ancestors as expanded, then re-render
      const includeSelf = !!(options && options.includeSelf);
      const normalized = path.replace(/\\/g, '/');
      const parts = normalized.split('/');
      // FAST PATH — avoid the full _render() tree rebuild (which re-toggles every
      // root + every open folder, the visible "tree refreshes when it expands"
      // churn) when nothing actually needs to change: if every ancestor (and the
      // target, when includeSelf) is ALREADY expanded, just ensure the row is
      // active and return. _render() only needs to run when an expand-state bit
      // actually flips.
      let _needsRender = false;
      {
        let acc = '';
        for (let i = 0; i < parts.length - (includeSelf ? 0 : 1); i++) {
          acc += (i > 0 ? '/' : '') + parts[i];
          if (acc && !_isExpanded(acc) && !_isExpanded(acc.replace(/\//g, '\\'))) { _needsRender = true; break; }
        }
      }
      if (!_needsRender) {
        // Already in the desired expand-state → no rebuild. Just (re)activate the
        // target row if it's present (cheap, class-only; no re-render).
        try {
          let found = container.querySelector('.tree-row[data-path="' + CSS.escape(path) + '"]')
                   || container.querySelector('.tree-row[data-path="' + CSS.escape(normalized) + '"]');
          if (found) { setActive(found.dataset.path); }
        } catch (e) {}
        return;
      }
      let accumulated = '';
      for (let i = 0; i < parts.length - (includeSelf ? 0 : 1); i++) {
        accumulated += (i > 0 ? '/' : '') + parts[i];
        if (accumulated) {
          // Try both forward-slash and backslash versions
          _setExpanded(accumulated, true);
          _setExpanded(accumulated.replace(/\//g, '\\'), true);
        }
      }
      // Also expand with original separators
      const origParts = path.split(/[\/\\]/);
      let origAcc = '';
      for (let i = 0; i < origParts.length - (includeSelf ? 0 : 1); i++) {
        origAcc += (i > 0 ? '\\' : '') + origParts[i];
        if (origAcc) _setExpanded(origAcc, true);
      }
      _render();
      // Retry setActive until node appears (async children loading)
      let retries = 0;
      if (activationTimer) clearTimeout(activationTimer);
      function tryActivate() {
        if (destroyed) return;
        // Try matching with both separators
        let found = container.querySelector('.tree-row[data-path="' + CSS.escape(path) + '"]');
        if (!found) found = container.querySelector('.tree-row[data-path="' + CSS.escape(normalized) + '"]');
        if (!found) found = container.querySelector('.tree-row[data-path="' + CSS.escape(path.replace(/\//g, '\\')) + '"]');
        if (found) {
          setActive(found.dataset.path);
        } else if (retries < 20) {
          retries++;
          activationTimer = setTimeout(tryActivate, 200);
        }
      }
      tryActivate();
    }

    function refresh() {
      if (destroyed) return;
      _render();
      if (activePath) setActive(activePath);
    }

    // Reveal a deep path by EXPANDING each ancestor and INJECTING its children,
    // then highlight + scroll the leaf — the generic deep-link / tree-navigation
    // primitive shared by every lazy AppUITree (NRM, MOM, …).
    //
    // `path`   — the full node path of the target leaf (same separator the tree
    //            uses for node.path), INCLUDING the rootPath prefix. e.g.
    //            "28.541/ManagedElement/GNBDUFunction/RRMPolicyRatio".
    // `opts.rootPath` — the node path whose children are the FIRST descend level
    //            (e.g. the spec node "28.541"); the leading part of `path`. The
    //            remaining segments after it are the ones we descend. Default ''.
    // `opts.getChildren(ancestorPath, index)` — REQUIRED for a lazy tree: returns
    //            (or resolves to) the child node array to inject UNDER
    //            `ancestorPath` (the node just opened); `index` is 0 for the
    //            rootPath level, 1 for its child, … Return falsy to stop.
    //            Omit for an already-rendered tree (falls back to expandTo).
    // `opts.select` — setActive the leaf when done (default true).
    // Returns Promise<bool> (revealed the leaf?).
    async function revealPath(path, opts2) {
      if (destroyed) return false;
      opts2 = opts2 || {};
      const getChildren = opts2.getChildren;
      const sep = path.indexOf('\\') >= 0 && path.indexOf('/') < 0 ? '\\' : '/';
      const rootPath = opts2.rootPath != null ? String(opts2.rootPath) : '';
      let rest = path;
      if (rootPath && path.indexOf(rootPath + sep) === 0) rest = path.slice(rootPath.length + 1);
      else if (rootPath && path === rootPath) rest = '';
      const segs = rest.split(/[\/\\]/).filter(Boolean);
      if (!segs.length) return false;
      if (typeof getChildren !== 'function') { expandTo(path, { includeSelf: false }); return true; }
      // ancestorPath starts at rootPath; inject its children (segment 0's level),
      // then descend: ancestorPath grows by one segment each step.
      let ancestorPath = rootPath;
      for (let i = 0; i < segs.length; i++) {
        let kids = null;
        try { kids = await Promise.resolve(getChildren(ancestorPath, i)); } catch (e) { kids = null; }
        if (!kids || !kids.length) { return i > 0; }
        try { setChildren(ancestorPath, kids); } catch (e) { /* best-effort */ }
        ancestorPath = ancestorPath ? ancestorPath + sep + segs[i] : segs[i];
        if (i === segs.length - 1) break;   // leaf reached; its own children not needed
      }
      if (opts2.select !== false) setActive(path);
      return true;
    }

    function setChildren(path, children) {
      if (destroyed) return;
      _setExpanded(path, true);
      const normalized = path.replace(/\\/g, '/');
      const rows = container.querySelectorAll('.tree-row');
      for (const row of rows) {
        const rpath = (row.dataset.path || '').replace(/\\/g, '/');
        if (rpath === normalized || row.dataset.path === path) {
          const wrap = row.closest('.tree-node-wrap');
          if (!wrap) break;
          const childContainer = wrap.querySelector('.tree-children');
          if (!childContainer) break;
          const twist = row.querySelector('.twisty');
          if (twist) twist.textContent = '▾';
          row.setAttribute('aria-expanded', 'true');
          const pl = parseInt(row.style.paddingLeft) || 0;
          const depth = Math.round((pl - basePadding) / indent);
          childContainer.replaceChildren();
          _appendChildren(childContainer, children, () => depth + 1);
          break;
        }
      }
    }

    function getExpanded() {
      return { ...expandedState };
    }

    function setExpanded(states) {
      if (destroyed) return;
      expandedState = states || {};
      _saveState();
    }

    function collapseAll() {
      if (destroyed) return;
      expandedState = {};
      _saveState();
      _render();
    }

    function expandAll() {
      if (destroyed) return;
      // Expand all currently rendered nodes (can't expand unloaded children)
      container.querySelectorAll('.tree-node-wrap').forEach(wrap => {
        const row = wrap.querySelector('.tree-row');
        if (row && row.dataset.path) expandedState[row.dataset.path] = true;
      });
      _saveState();
      _render();
    }

    const {insertNode, removeNode} = AppUITreeMutations.create({ container, basePadding, indent, _buildNode, isDestroyed: () => destroyed });

    function expandToLevel(level) {
      if (destroyed) return;
      // Collapse everything, then expand nodes at depth < level
      expandedState = {};
      function _walkNodes(nodes, depth) {
        if (depth >= level) return;
        (nodes || []).forEach(node => {
          if (node.hasChildren !== false) {
            expandedState[node.path] = true;
          }
        });
      }
      _walkNodes(roots, 0);
      // For deeper levels, we need the loaded children  --  re-render triggers expansion
      _saveState();
      _render();
    }

    const keyboard = AppUITreeKeyboard.bind({container, listen});

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (activationTimer) clearTimeout(activationTimer);
      activationTimer = null;
      scrollFrames.forEach(frame => cancelAnimationFrame(frame));
      scrollFrames.clear();
      buildFrames.forEach(frame => cancelAnimationFrame(frame));
      buildFrames.clear();
      keyboard.destroy();
      _searchEl?.remove();
      _searchEl = null;
      roots = []; _filteredRoots = null; filterText = ''; activePath = null; expandedState = {};
      container.replaceChildren();
    }

    return {
      destroy,
      isDestroyed: function () { return destroyed; },
      setRoots,
      setCheckedPaths,
      getCheckedPaths: () => [...checkedPaths],
      refreshDecorations() {
        if (destroyed) return;
        container.querySelectorAll('.tree-row').forEach(row => rowDecorations.get(row)?.());
      },
      setFilter,
      setActive,
      highlight,
      setChildren,
      expandTo,
      revealPath,
      refresh,
      getExpanded,
      setExpanded,
      collapseAll,
      expandAll,
      expandToLevel,
      insertNode,
      removeNode
    };
  }

  return { create };
})();
window.AppUITree = AppUITree;

/**
 * Connect an AppUIEventBus to this tree for live file updates.
 * Handles: dir_created, deleted, renamed events on the 'files' channel.
 *
 * Usage: AppUITree.connectEventBus(tree, bus, rootPath)
 */
AppUITree.connectEventBus = function(tree, bus, rootPath) {
    // Handle directory creation
    bus.on('files', 'dir_created', (data) => {
        const path = data.path || '';
        if (!path.startsWith(rootPath)) return;
        const sep = path.includes('/') ? '/' : '\\';
        const parent = path.substring(0, path.lastIndexOf(sep));
        const name = path.substring(path.lastIndexOf(sep) + 1);
        tree.insertNode(parent, { name, type: 'dir' });
    });

    // Handle deletion
    bus.on('files', 'deleted', (data) => {
        const path = data.path || '';
        if (!path.startsWith(rootPath)) return;
        tree.removeNode(path);
    });

    // Handle rename
    bus.on('files', 'renamed', (data) => {
        const oldPath = data.old_path || '';
        const newPath = data.path || '';
        if (!oldPath.startsWith(rootPath) && !newPath.startsWith(rootPath)) return;
        // Remove old, insert new
        tree.removeNode(oldPath);
        const sep = newPath.includes('/') ? '/' : '\\';
        const parent = newPath.substring(0, newPath.lastIndexOf(sep));
        const name = newPath.substring(newPath.lastIndexOf(sep) + 1);
        const type = data.is_dir ? 'dir' : 'file';
        tree.insertNode(parent, { name, type });
    });
};
