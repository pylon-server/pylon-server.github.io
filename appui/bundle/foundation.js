/* Shared keyboard, selection and drag binding for tab buttons. */
window._AppUITabsBinding = (() => {
  function nextIndex(key, index, count) {
    if (!count) return -1;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    if (key === 'ArrowLeft') return (index - 1 + count) % count;
    if (key === 'ArrowRight') return (index + 1) % count;
    return index;
  }
  function bindDrag({
    element,
    listen,
    isCurrent = () => true,
    draggingClass,
    overClass,
    onStart,
    onEnd,
    onDrop
  }) {
    const on = (type, handler) =>
      listen(element, type, (event) => {
        if (isCurrent()) handler(event);
      });
    on('dragstart', (event) => {
      onStart(event);
      element.classList.add(draggingClass);
    });
    on('dragend', () => {
      element.classList.remove(draggingClass);
      onEnd?.();
    });
    on('dragover', (event) => {
      event.preventDefault();
      if (overClass) element.classList.add(overClass);
    });
    if (overClass) on('dragleave', () => element.classList.remove(overClass));
    on('drop', (event) => {
      event.preventDefault();
      if (overClass) element.classList.remove(overClass);
      onDrop(event);
    });
  }
  function dragReorder({ listen, reorder }) {
    let dragged = null;
    return {
      reset() {
        dragged = null;
      },
      bind(element, tab) {
        element.draggable = true;
        bindDrag({
          element,
          listen,
          draggingClass: 'dragging',
          overClass: 'drag-over',
          onStart: (event) => {
            dragged = tab;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tab.id);
          },
          onEnd: () => {
            dragged = null;
          },
          onDrop: () => {
            if (dragged && dragged.id !== tab.id) reorder(dragged.id, tab.id);
          }
        });
      }
    };
  }
  function bind({
    container,
    panels = [],
    onSwitch,
    selector = '[data-tab]',
    getId = (button) => button.dataset.tab
  } = {}) {
    if (!container) throw new Error('AppUITabs: container is required');
    const buttons = Array.from(container.querySelectorAll(selector));
    const panelList = Array.from(panels);
    let activeId = null;
    const owner = AppUILifecycle.createScope();
    container.setAttribute('role', 'tablist');
    const available = (button) =>
      !button.hidden && !button.disabled && button.getAttribute?.('aria-disabled') !== 'true';
    function switchTo(id, notify = true) {
      if (owner.destroyed) return;
      const button = buttons.find((item) => getId(item) === id);
      if (!button || !available(button)) return;
      activeId = id;
      buttons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panelList.forEach((panel) => {
        const selected = getId(panel) === id;
        panel.classList.toggle('active', selected);
        panel.setAttribute('role', 'tabpanel');
        panel.hidden = !selected;
      });
      if (notify)
        onSwitch?.({ id, button, panel: panelList.find((panel) => getId(panel) === id) || null });
    }
    buttons.forEach((button) => {
      const editable = (event) =>
        event?.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event?.target?.tagName);
      const click = (event) => {
        if (!editable(event)) switchTo(getId(button));
      };
      const keydown = (event) => {
        if (owner.destroyed || event.isComposing || event.defaultPrevented || editable(event))
          return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const visible = buttons.filter(available);
        if (!visible.length || !available(button)) return;
        const index = visible.indexOf(button);
        const next = nextIndex(event.key, index, visible.length);
        visible[next].focus();
        switchTo(getId(visible[next]));
      };
      owner.listen(button, 'click', click);
      owner.listen(button, 'keydown', keydown);
    });
    const initial =
      buttons.find((button) => available(button) && button.classList.contains('active')) ||
      buttons.find(available);
    if (initial) switchTo(getId(initial), false);
    return { switch: switchTo, active: () => activeId, destroy: () => owner.destroy() };
  }

  return { bind, nextIndex, dragReorder, bindDrag };
})();
// Existing markup can use tab navigation without loading generated tab widgets.
window.AppUITabNavigation = { bind: window._AppUITabsBinding.bind };

;
/**
 * AppUIDebug — shared, zero-config debug capture + issue reporting for EVERY
 * AppUI page. Before this, apps hand-rolled their own console buffers (e.g.
 * page_automation's window.__palog) and each re-implemented the issue_report
 * submit. This gives one surface:
 *
 *   AppUI.debug.log(...args)        // app-level breadcrumb (ring buffer)
 *   AppUI.debug.getLog()           // the captured breadcrumbs (array of strings)
 *   AppUI.debug.snapshot()         // {page_id, url, log, errors, diagnostics, ...}
 *   AppUI.debug.reportIssue(opts)  // prefilled issue dialog -> issue_report.submit
 *
 * It auto-captures:
 *   - app breadcrumbs logged via AppUI.debug.log (and the legacy window.__palog
 *     if a page still uses it)
 *   - uncaught errors + unhandled promise rejections (installed once)
 *   - the AppUI asset/loader diagnostics snapshot
 *   - page id (from <body data-page-id>) and the current URL
 *
 * Reporting posts to the platform issue tracker (apps/documents/issue_report)
 * via its `submit` op, with all the context attached — so a user clicks "Report
 * issue", types a sentence, and triage gets the full debug bundle.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.AppUIDebug) return;

  var MAX = 300;
  var _log = [];        // ring buffer of breadcrumb strings
  var _errors = [];     // uncaught errors / rejections
  var _hooked = false;

  function _fmt(args) {
    try {
      return Array.prototype.map.call(args, function (a) {
        if (a instanceof Error) return a.message + (a.stack ? ' | ' + a.stack.split('\n')[1] : '');
        return (typeof a === 'object') ? JSON.stringify(a) : String(a);
      }).join(' ');
    } catch (e) { return String(args); }
  }

  function log() {
    var line = Date.now() + ' ' + _fmt(arguments);
    _log.push(line);
    if (_log.length > MAX) _log.shift();
    if (window.APPUI_DEBUG) { try { console.log.apply(console, ['[appui]'].concat([].slice.call(arguments))); } catch (e) {} }
    return line;
  }

  function _installHooks() {
    if (_hooked) return;
    _hooked = true;
    try {
      window.addEventListener('error', function (e) {
        _errors.push({ kind: 'error', msg: String(e.message || e.error || e), at: Date.now(),
          src: (e.filename || '') + ':' + (e.lineno || '') });
        if (_errors.length > 50) _errors.shift();
      });
      window.addEventListener('unhandledrejection', function (e) {
        var r = e && e.reason;
        _errors.push({ kind: 'rejection', msg: (r && r.message) ? r.message : String(r), at: Date.now() });
        if (_errors.length > 50) _errors.shift();
      });
    } catch (e) {}
  }

  function pageId() {
    try { return document.body && document.body.getAttribute('data-page-id') || 'app'; }
    catch (e) { return 'app'; }
  }

  function getLog() {
    // merge our buffer with a legacy page buffer (window.__palog) if present.
    var legacy = (window.__palog && Array.isArray(window.__palog)) ? window.__palog : [];
    return _log.concat(legacy.map(function (l) { return 'legacy: ' + l; }));
  }

  function snapshot(extra) {
    var diag = {};
    try { diag = (window.AppUIAssets && window.AppUIAssets.diagnostics) ? window.AppUIAssets.diagnostics() : {}; } catch (e) {}
    return {
      page_id: pageId(),
      page_url: (typeof location !== 'undefined') ? location.href : '',
      user_agent: (typeof navigator !== 'undefined') ? navigator.userAgent : '',
      ts: Date.now(),
      log: getLog(),
      errors: _errors.slice(),
      diagnostics: diag,
      extra: extra || null,
    };
  }

  // Resolve the issue_report submit transport. Prefer a page-provided submit;
  // else POST to the platform op edge directly.
  function _defaultSubmit(body) {
    return fetch('/v1/apps/documents/issue_report/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
  }

  /**
   * reportIssue(opts?) — open a tiny prefilled dialog; on submit, file an issue
   * with the full debug snapshot attached. opts:
   *   title     prefill title (default: "<page_id>: issue")
   *   kind      'bug' | 'feature' | 'other' (default 'bug')
   *   submit    function(body)->Promise (default: issue_report.submit op)
   *   extra     any extra context object to attach
   *   onDone    function(result)
   */
  function reportIssue(opts) {
    opts = opts || {};
    var submit = opts.submit || _defaultSubmit;
    var snap = snapshot(opts.extra);
    var Dialog = window.AppUIDialog;
    var esc = (window.AppUITextUtils && window.AppUITextUtils.esc) ||
      function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
    var defTitle = opts.title || (snap.page_id + ': issue');

    function doSubmit(title, detail, kind) {
      var body = {
        kind: kind || opts.kind || 'bug',
        title: title || defTitle,
        detail: detail || '',
        source: 'appui.debug',
        context: snap,     // the full auto-captured debug bundle
      };
      log('reportIssue submit', body.kind, body.title);
      return submit(body).then(function (res) {
        if (opts.onDone) { try { opts.onDone(res); } catch (e) {} }
        return res;
      });
    }

    if (!Dialog || !Dialog.show) {
      // headless fallback: submit immediately with the snapshot (no UI).
      return doSubmit(defTitle, 'Auto-reported (no dialog available).', opts.kind);
    }
    var bodyHtml =
      '<div style="display:flex;flex-direction:column;gap:.5rem;min-width:420px">' +
      '<label style="font-size:.85em;opacity:.8">What went wrong? (one sentence)</label>' +
      '<input id="pa-rpt-title" value="' + esc(defTitle) + '" style="padding:.4rem;font:inherit">' +
      '<textarea id="pa-rpt-detail" rows="4" placeholder="Steps / what you expected…" style="padding:.4rem;font:inherit"></textarea>' +
      '<label style="font-size:.78em;opacity:.65">Attached automatically: page, URL, ' +
      snap.log.length + ' debug lines, ' + snap.errors.length + ' error(s), diagnostics.</label>' +
      '</div>';
    return Dialog.show({
      title: 'Report an issue', body: bodyHtml, width: '520px',
      buttons: [
        { text: 'Cancel' },
        { text: 'Send report', primary: true, action: function () {
          var t = (document.getElementById('pa-rpt-title') || {}).value || defTitle;
          var d = (document.getElementById('pa-rpt-detail') || {}).value || '';
          doSubmit(t, d, opts.kind).then(function (res) {
            try { window.AppUI && window.AppUI.toast &&
              window.AppUI.toast(res && res.ok ? ('Issue filed: ' + (res.id || '')) : ('Report failed: ' + ((res && res._error) || '?')),
                res && res.ok ? 'ok' : 'bad'); } catch (e) {}
          });
        } },
      ],
    });
  }

  _installHooks();

  window.AppUIDebug = {
    log: log,
    getLog: getLog,
    snapshot: snapshot,
    reportIssue: reportIssue,
    clear: function () { _log.length = 0; _errors.length = 0; },
  };
})();

;
/* AppUIWorkspaceNav — ONE deep-link helper, both ways (WORKSPACE_CONTEXT_TODO
 * #60). Every app page that shows a document/file/symbol opens it in the
 * workspace with AppUIWorkspaceNav.open(wsUri | {uri|vfs|path, line, newTab}),
 * and the ws-uri (framework.workspace.ws_uri, #2) is the portable key a citation
 * carries. Replaces the hand-built "/apps/knowledge/workspace/?vfs=…" strings
 * scattered in wsrag.js / 77_rag.js.
 *
 * It resolves a ws:// uri to a concrete vfs:// url via the server op
 * knowledge/workspace.resolve_uri (which wraps framework.workspace.ws_to_vfs),
 * strips the vfs:// scheme to the clean ?vfs= value, appends &line=, and either
 * navigates the CURRENT page (when it IS the workspace app) or opens the
 * workspace app in a new tab. A plain vfs url / abs path is opened directly (no
 * resolve round-trip). Pure DOM + fetch; no framework coupling.
 */
(function () {
  "use strict";

  var WS_APP_PATH = "/apps/knowledge/workspace/";

  function _stripVfs(u) { return String(u == null ? "" : u).replace(/^vfs:\/\//i, ""); }

  function _lineQ(line) {
    var n = parseInt(line || 0, 10);
    return (isFinite(n) && n > 0) ? ("&line=" + n) : "";
  }

  function _onWorkspacePage() {
    try { return location.pathname.indexOf(WS_APP_PATH) === 0; } catch (e) { return false; }
  }

  // Resolve a ws:// uri → a concrete vfs:// url via the server op. Returns a
  // Promise<string|null>. A non-ws value passes through unchanged.
  function resolve(uri) {
    var s = String(uri == null ? "" : uri).trim();
    if (!s) return Promise.resolve(null);
    if (!/^ws:\/\//i.test(s)) return Promise.resolve(s);   // already a vfs/abs value
    return fetch("/v1/apps/knowledge/workspace/workspace.resolve_uri", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri: s })
    }).then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.ok && j.vfs_url) ? j.vfs_url : null; })
      .catch(function () { return null; });
  }

  // Navigate (same page) or open (new tab) the workspace app at a scheme-stripped
  // vfs value + optional &line.
  function _go(strippedVfs, line, newTab) {
    if (!strippedVfs) return false;
    var q = "?vfs=" + encodeURIComponent(strippedVfs) + _lineQ(line);
    if (!newTab && _onWorkspacePage()) {
      // same-page: update the deep link + let the page's own restore open it.
      // Prefer a hook the workspace page registers; else a soft reload with the
      // new ?vfs= (the page reads it on load).
      try {
        if (window.AppUIWorkspaceNav && typeof window.AppUIWorkspaceNav._localOpen === "function") {
          return window.AppUIWorkspaceNav._localOpen(strippedVfs, line);
        }
      } catch (e) { /* fall through to navigation */ }
      try { location.search = q; return true; } catch (e) { /* fall through */ }
    }
    try { window.open(WS_APP_PATH + q, "_blank", "noopener"); return true; }
    catch (e) { return false; }
  }

  /**
   * open(target[, opts]) — open a workspace item.
   *   target : a ws:// uri, a vfs:// url, or an abs path (string); OR an object
   *            {uri|vfs|path, line, newTab}.
   *   opts   : {line, newTab} (when target is a string).
   * Returns a Promise<boolean> (did we navigate/open).
   */
  function open(target, opts) {
    opts = opts || {};
    var uri, vfs, path, line = opts.line, newTab = opts.newTab;
    if (target && typeof target === "object") {
      uri = target.uri; vfs = target.vfs; path = target.path;
      line = (target.line != null) ? target.line : line;
      newTab = (target.newTab != null) ? target.newTab : newTab;
    } else {
      var s = String(target == null ? "" : target).trim();
      if (/^ws:\/\//i.test(s)) uri = s;
      else vfs = s;
    }
    // a direct vfs/abs value opens immediately; a ws-uri resolves first.
    if (vfs || path) {
      return Promise.resolve(_go(_stripVfs(vfs || path), line, newTab));
    }
    if (!uri) return Promise.resolve(false);
    return resolve(uri).then(function (resolved) {
      if (!resolved) return false;
      return _go(_stripVfs(resolved), line, newTab);
    });
  }

  // Build a ws-uri from a workspace name + rel (client-side mirror of
  // framework.workspace.ws_uri; name/link url-encoded, rel keeps slashes).
  function wsUri(workspace, rel, link) {
    rel = String(rel || "").replace(/\\/g, "/").replace(/^\/+/, "");
    var base = "ws://" + encodeURIComponent(workspace || "");
    if (link) base += "/@" + encodeURIComponent(link);
    return base + (rel ? "/" + rel : "");
  }

  var api = { open: open, resolve: resolve, wsUri: wsUri, stripVfs: _stripVfs };
  if (typeof window !== "undefined") {
    // merge onto any existing object (so a page can register _localOpen first)
    window.AppUIWorkspaceNav = Object.assign(window.AppUIWorkspaceNav || {}, api);
  }
})();

;
/**
 * UI/TabbedDialog  --  a modal dialog whose body is a set of TABS.
 *
 * Composes the existing AppUIDialog (modal + buttons + stacking) with the
 * existing AppUITabNavigation.bind (keyboard + ARIA + panel show/hide), so a
 * page can open a tabbed dialog without re-wiring the strip/panes/active-state
 * by hand (the pattern several pages had duplicated inline).
 *
 * Layout the helper builds for you inside the dialog body:
 *   +- Title ------------------------- [✕] -+
 *   | [ Tab A ][ Tab B ][ Tab C ]            |   <- .ui-tab buttons (role=tab)
 *   |  <active pane content>                 |   <- .ui-tab-panel (role=tabpanel)
 *   +---------------------------------------+
 *   |                           [Close]     |
 *   +---------------------------------------+
 *
 * Usage:
 *   const dlg = AppUITabbedDialog.open({
 *     title: 'Credentials',
 *     width: '560px',
 *     active: 'shared',                 // initial tab id (default: first)
 *     tabs: [
 *       { id:'shared', label:'🔑 Shared account', render(pane){ pane.append(...) } },
 *       { id:'site',   label:'🌐 Per-site',        render(pane){ ... } },
 *       { id:'netrc',  label:'📄 Remote ~/.netrc',  render(pane){ ... } },
 *     ],
 *     buttons: [{ text:'Close' }],      // optional; defaults to a single Close
 *   });
 *   dlg.activate('site');   // switch programmatically
 *   dlg.close();            // close the dialog
 *
 * Each tab's `render(pane, api)` runs LAZILY the first time its tab is shown
 * (so a heavy tab pays nothing until opened); `api` is {activate, close}.
 * `render` may return a cleanup function, called when the dialog closes.
 *
 * Returns: { overlay, activate(id), active(), close(), tabsApi } or null (when
 * a supplied AbortSignal was already aborted, mirroring AppUIDialog.show).
 */
var AppUITabbedDialog = window.AppUITabbedDialog || (function() {
  'use strict';

  function _escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function open(opts) {
    opts = opts || {};
    const Dialog = window.AppUIDialog;
    const bindTabs = window.AppUITabNavigation && window.AppUITabNavigation.bind;
    if (!Dialog || !Dialog.show) throw new Error('AppUITabbedDialog: AppUIDialog is required');

    const tabs = (opts.tabs || []).filter(t => t && t.id);
    if (!tabs.length) throw new Error('AppUITabbedDialog: at least one tab is required');
    const initial = tabs.some(t => t.id === opts.active) ? opts.active : tabs[0].id;

    // Build the dialog BODY ourselves (AppUIDialog appends a DOM node as-is):
    //   a .ui-tab strip of role=tab buttons + one .ui-tab-panel per tab.
    const body = document.createElement('div');
    body.className = 'ui-tabbed-dialog';

    const strip = document.createElement('div');
    strip.className = 'ui-tab-strip';
    strip.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;margin:-4px -4px 10px;';
    tabs.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ui-tab';
      b.dataset.tab = t.id;
      // label may be an HTML string (icons) — it's author-supplied, not user data.
      b.innerHTML = (t.labelHtml != null) ? t.labelHtml : _escape(t.label || t.id);
      strip.appendChild(b);
    });
    body.appendChild(strip);

    const panes = tabs.map(t => {
      const p = document.createElement('div');
      p.className = 'ui-tab-panel';
      p.dataset.tab = t.id;
      body.appendChild(p);
      return p;
    });

    // Lazy per-tab render (idempotent) + collect any cleanup fns.
    const rendered = Object.create(null);
    const cleanups = [];
    let api = null;   // assigned after show(); passed to render callbacks
    function _fill(id) {
      if (rendered[id]) return;
      rendered[id] = true;
      const tab = tabs.find(t => t.id === id);
      const pane = panes[tabs.indexOf(tab)];
      if (tab && pane && typeof tab.render === 'function') {
        try {
          const ret = tab.render(pane, api);
          if (typeof ret === 'function') cleanups.push(ret);
        } catch (e) { /* a broken tab must not break the dialog */ }
      }
    }

    let tabsApi = null;
    function _runCleanups() {
      cleanups.splice(0).forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
      if (tabsApi && tabsApi.destroy) { try { tabsApi.destroy(); } catch (e) { /* ignore */ } }
    }

    const overlay = Dialog.show({
      title: opts.title || '',
      body,
      width: opts.width || '520px',
      closable: opts.closable,
      signal: opts.signal,
      buttons: opts.buttons || [{ text: 'Close' }],
      onClose: () => { _runCleanups(); if (opts.onClose) opts.onClose(); },
    });
    if (!overlay) return null;   // signal already aborted — nothing opened

    function activate(id) {
      _fill(id);
      if (tabsApi && tabsApi.switch) tabsApi.switch(id);
      else _manualPaint(id);
    }
    // Fallback paint when the tab binder isn't present (defensive — foundation
    // always ships it, but keep the dialog usable regardless).
    function _manualPaint(id) {
      strip.querySelectorAll('.ui-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === id));
      panes.forEach(p => {
        const on = p.dataset.tab === id;
        p.classList.toggle('active', on);
        p.hidden = !on;
      });
    }

    api = { activate, close: () => Dialog.close(overlay) };

    if (bindTabs) {
      try {
        tabsApi = bindTabs({
          container: strip,
          panels: panes,
          onSwitch: ({ id }) => _fill(id),
        });
      } catch (e) { tabsApi = null; }
    }
    // Ensure the chosen initial tab is rendered + shown (bind auto-activates the
    // first/.active button, but we also want LAZY render of exactly `initial`).
    activate(initial);

    return {
      overlay,
      activate,
      active: () => (tabsApi && tabsApi.active) ? tabsApi.active() : initial,
      close: () => Dialog.close(overlay),
      tabsApi,
    };
  }

  return { open };
})();
window.AppUITabbedDialog = AppUITabbedDialog;

;
/**
 * UI Toast  --  non-blocking notification messages.
 *
 * Usage:
 *   AppUIToast.success('Saved!');
 *   AppUIToast.error('Failed to connect');
 *   AppUIToast.info('Processing...');
 *   AppUIToast.warn('Low disk space');
 *
 * When `window.AppUINotifications` is available (from the AppUI notifications
 * bundle), AppUIToast methods delegate to it so there is only one visual toast
 * system on screen. AppUINotifications.show() calls back into AppUIToast._showRaw()
 * which always renders directly, avoiding infinite loops.
 */
var AppUIToast = window.AppUIToast || (function() {
  let _container = null;

  function _ensureContainer() {
    if (_container) return;
    _container = document.createElement('div');
    _container.className = 'ui-toast-container';
    document.body.appendChild(_container);
  }

  function _show(message, type, duration) {
    _ensureContainer();
    const el = document.createElement('div');
    el.className = `ui-toast ui-toast-${type}`;
    const icons = {success:'✓', error:'✗', info:'ℹ', warn:'⚠'};
    el.innerHTML = `<span class="ui-toast-icon">${icons[type] || ''}</span><span class="ui-toast-text">${message}</span><button class="ui-toast-close" title="Dismiss" aria-label="Dismiss">×</button>`;
    el.querySelector('.ui-toast-text').style.cssText = 'user-select:text;cursor:text;flex:1;min-width:0';
    _container.appendChild(el);
    // Animate in
    requestAnimationFrame(() => el.classList.add('show'));
    // Auto dismiss
    let timer = setTimeout(() => _dismiss(el), duration || 3000);
    let pinned = false;
    // Click on toast body pins it (stops auto-dismiss)
    el.addEventListener('click', (e) => {
      if (e.target.closest('.ui-toast-close')) { clearTimeout(timer); _dismiss(el); return; }
      if (!pinned) { clearTimeout(timer); pinned = true; el.classList.add('pinned'); }
    });
    // Hovering pauses auto-dismiss
    el.addEventListener('mouseenter', () => { clearTimeout(timer); });
    el.addEventListener('mouseleave', () => { if (!pinned) timer = setTimeout(() => _dismiss(el), 2000); });
  }

  function _dismiss(el) {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }

  /** Delegate to AppUINotifications if loaded, otherwise render directly. */
  function _dispatch(msg, type, ms) {
    if (window.AppUINotifications?.show) {
      window.AppUINotifications.show(msg, type, ms);
    } else {
      _show(msg, type, ms);
    }
  }

  return {
    success: (msg, ms) => _dispatch(msg, 'success', ms),
    error: (msg, ms) => _dispatch(msg, 'error', ms || 5000),
    info: (msg, ms) => _dispatch(msg, 'info', ms),
    warn: (msg, ms) => _dispatch(msg, 'warn', ms || 4000),
    /** Direct render used internally by AppUINotifications.show(). */
    _showRaw: (msg, type, ms) => _show(msg, type, ms),
  };
})();
window.AppUIToast = AppUIToast;

;
/* Bind an expandable section without replacing page or component markup. */
var AppUIDisclosure = window.AppUIDisclosure || (() => {
  let serial = 0;
  function bind({trigger, panel, expanded = !panel?.hidden, onToggle} = {}) {
    if (!trigger || !panel) throw new Error('Disclosure requires a trigger and panel');
    const scope = AppUILifecycle.createScope();
    let open = !!expanded;
    const native = trigger.tagName === 'BUTTON' || (trigger.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(trigger.type));
    if (!panel.id) panel.id = 'ui-disclosure-' + ++serial;
    trigger.setAttribute('aria-controls', panel.id);
    if (!native) {trigger.setAttribute('role', 'button'); trigger.tabIndex = 0;}
    else if (trigger.tagName === 'BUTTON' && !trigger.getAttribute('type')) trigger.type = 'button';

    function apply() {panel.hidden = !open; trigger.setAttribute('aria-expanded', String(open));}
    function setExpanded(value, notify = true) {
      if (scope.destroyed) return;
      const next = !!value, changed = next !== open;
      open = next; apply();
      if (changed && notify) onToggle?.(open);
    }
    function interactiveChild(event) {
      const control = event.target?.closest?.('button,a,input,select,textarea,[contenteditable="true"]');
      return control && control !== trigger && trigger.contains(control);
    }
    const toggle = () => setExpanded(!open);
    scope.listen(trigger, 'click', event => {
      if (!interactiveChild(event) && !trigger.disabled && trigger.getAttribute('aria-disabled') !== 'true') toggle();
    });
    if (!native) scope.listen(trigger, 'keydown', event => {
      if (event.isComposing || !['Enter', ' '].includes(event.key) || interactiveChild(event)) return;
      event.preventDefault();
      if (!event.repeat && !trigger.disabled && trigger.getAttribute('aria-disabled') !== 'true') toggle();
    });
    apply();
    return {setExpanded, toggle, expand: () => setExpanded(true), collapse: () => setExpanded(false),
      isExpanded: () => open, destroy: () => scope.destroy()};
  }
  return {bind};
})();
window.AppUIDisclosure = AppUIDisclosure;

;
/* Clipboard feedback for an existing button. Transport stays in AppUICore. */
var AppUICopyButton = window.AppUICopyButton || (() => {
  const states = new WeakMap();
  function reset(button) {
    const state = states.get(button);
    if (!state) return;
    clearTimeout(state.timer);
    button.textContent = state.label;
    states.delete(button); // Invalidate a clipboard write that is still pending.
  }

  // Resolves true only when the clipboard write succeeds. Repeated clicks keep
  // the original label; a late result from an older click cannot overwrite it.
  async function copy(button, text, {successText = 'Copied', errorText = 'Copy failed',
    duration = 1200, fallbackOnError = false} = {}) {
    const previous = states.get(button);
    clearTimeout(previous?.timer);
    const state = {label: previous ? previous.label : button.textContent, timer: null};
    states.set(button, state);
    let ok = false;
    try {
      await AppUICore.copyText(typeof text === 'function' ? text() : text, {fallbackOnError});
      ok = true;
    } catch (_error) { /* Report rejection on the button; never claim success. */ }
    if (states.get(button) !== state) return ok;
    button.textContent = ok ? successText : errorText;
    state.timer = setTimeout(() => {
      if (states.get(button) === state) reset(button);
    }, duration);
    return ok;
  }

  function bind(button, text, options) {
    const onClick = event => {
      event.preventDefault();
      if (!button.disabled && button.getAttribute('aria-disabled') !== 'true') copy(button, text, options);
    };
    button.addEventListener('click', onClick);
    let destroyed = false;
    return {destroy() {
      if (destroyed) return;
      destroyed = true;
      button.removeEventListener('click', onClick);
      reset(button);
    }};
  }
  return {copy, bind, reset};
})();
window.AppUICopyButton = AppUICopyButton;

;
/* Filter existing table/list rows without rebuilding their markup or handlers. */
var AppUIRowFilter = window.AppUIRowFilter || (() => {
  function bind({input, container, selector = '[data-filter-row]',
    text = row => row.textContent} = {}) {
    if (!input || !container) throw new Error('RowFilter requires an input and container');
    const displays = new Map();
    let destroyed = false;
    function apply() {
      if (destroyed) return;
      const query = input.value.trim().toLowerCase();
      // Query again so asynchronously appended rows participate on the next input.
      container.querySelectorAll(selector).forEach(row => {
        if (!displays.has(row)) displays.set(row, row.style.display);
        const matches = !query || String(text(row) ?? '').toLowerCase().includes(query);
        row.style.display = matches ? displays.get(row) : 'none';
      });
    }
    input.addEventListener('input', apply);
    apply();
    return {apply, destroy() {
      if (destroyed) return;
      destroyed = true;
      input.removeEventListener('input', apply);
      displays.forEach((display, row) => { row.style.display = display; });
      displays.clear();
    }};
  }
  return {bind};
})();
window.AppUIRowFilter = AppUIRowFilter;

;
/* Content accordion markup and lifetime; Disclosure owns expansion behavior. */
window._AppUIContentAccordion = (() => {
  function create(area, spec) {
    const owner = AppUILifecycle.createScope(), sections = Object.create(null);
    for (const section of spec.sections || []) {
      if (owner.destroyed) break;
      const wrapper = document.createElement('div');
      wrapper.className = 'appui-accordion-section';
      wrapper.dataset.paneId = section.id || '';
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'appui-accordion-header';
      header.innerHTML = '<span class="appui-accordion-arrow">' + (section.open !== false ? '\u25be' : '\u25b8') + '</span> ' + (section.label || section.id || '');
      const panel = document.createElement('div');
      panel.className = 'appui-accordion-panel';
      wrapper.append(header, panel); area.appendChild(wrapper);
      owner.add(() => wrapper.remove());
      sections[section.id] = {wrapper, header, panel};
      let rendered = false;
      function render() {
        if (owner.destroyed || rendered) return;
        rendered = true;
        owner.add(section.render?.(panel));
      }
      const disclosure = AppUIDisclosure.bind({trigger: header, panel, expanded: section.open !== false,
        onToggle(open) {
          header.querySelector('.appui-accordion-arrow').textContent = open ? '\u25be' : '\u25b8';
          if (open) render();
        },
      });
      owner.add(disclosure);
      if (section.open !== false) render();
    }
    function update(id, value) {
      if (owner.destroyed || !sections[id]) return;
      sections[id].wrapper.hidden = value(sections[id].wrapper.hidden);
    }
    return {
      destroy: () => owner.destroy(),
      showPane: id => update(id, () => false),
      hidePane: id => update(id, () => true),
      togglePane: id => update(id, hidden => !hidden),
      isPaneVisible: id => !owner.destroyed && !!sections[id] && !sections[id].wrapper.hidden,
      getPaneIds: () => Object.keys(sections),
    };
  }
  return {create};
})();

;
/* Declarative content specs delegate to optional AppUI components at render time. */
window._AppUIContentRenderer = (() => {
  function render(spec, area, onCommand) {
    if (!spec) {
      if (area.classList.contains('appui-content-top') || area.classList.contains('appui-content-bottom')) {
        area.hidden = true;
      }
      return;
    }
    const toolbar = window.AppUIToolbar;
    const header = window.AppUIHeader;
    const splitter = window.AppUISplit;
    const multiSplit = window.AppUIMultiSplit;
    const dataView = window.AppUIDataView;
    if (isColumnsSpec(spec) && splitter) {
      const columns = spec.columns || spec;
      // Array of panes → N-column multi-split
      if (Array.isArray(columns) && multiSplit) {
        return multiSplit.create({
          container: area,
          panes: columns,
          direction: spec.direction || 'horizontal',
          minSize: spec.minSize,
          sizes: spec.sizes,
          storageKey: spec.storageKey,
          swappable: spec.swappable,
          className: ['appui-content-columns', spec.className].filter(Boolean).join(' '),
        });
      }
      return splitter.create(Object.assign({}, columns, {
        container: area,
        className: ['appui-content-columns', columns.className].filter(Boolean).join(' '),
        primary: columns.primary || columns.left,
        secondary: columns.secondary || columns.right,
        primaryLabel: columns.primaryLabel || columns.leftLabel,
        secondaryLabel: columns.secondaryLabel || columns.rightLabel,
      }));
    } else if (spec.type === 'toolbar' && toolbar) {
      return toolbar.create(Object.assign({}, spec, {
        container: area,
        onCommand: spec.onCommand || onCommand,
      }));
    } else if (spec.type === 'header' && header) {
      return header.create(Object.assign({}, spec, {
        container: area,
        onCommand: spec.onCommand || onCommand,
      }));
    } else if (spec.type === 'split' && splitter) {
      return splitter.create(Object.assign({}, spec, {container: area}));
    } else if (spec.type === 'data-view' && dataView) {
      return dataView.create(Object.assign({}, spec, {container: area}));
    } else if (spec.type === 'tabs' && spec.tabs) {
      // Tabbed content: { type: 'tabs', tabs: [{id, label, render}, ...] }
      var Tabs = window.AppUISidebarTabs;
      if (Tabs) return Tabs.create({container: area, storageKey: spec.storageKey || '', tabs: spec.tabs, onTabChange: spec.onTabChange});
      // Fallback: render all panels stacked
      (spec.tabs || []).forEach(function(tab) { if (tab.render) tab.render(area); });
    } else if (spec.type === 'data-table') {
      var DataTable = window.AppUIDataTable;
      if (DataTable) return DataTable.create(Object.assign({}, spec, {container: area}));
    } else if (spec.type === 'accordion' && spec.sections) {
      // Collapsible sections: { type: 'accordion', sections: [{id, label, render, open}] }
      return window._AppUIContentAccordion.create(area, spec);
    } else if (typeof spec === 'function') return spec(area);
    else if (spec.render) return spec.render(area);
    else if (typeof spec === 'string') area.innerHTML = spec;
    else if (spec instanceof Node) area.appendChild(spec);
  }

  function isColumnsSpec(spec) {
    return !!spec && (spec.type === 'columns' || (!spec.type && !!spec.columns));
  }

  return {render, isColumnsSpec};
})();

;
/* AppUI content regions: optional top, body, and bottom areas for the AppUI shell. */
var AppContent = window.AppContent || (function() {
  const {render, isColumnsSpec} = window._AppUIContentRenderer;
  function create(opts) {
    const container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;
    if (!container) throw new Error('AppContent: container not found');

    const regions = opts.regions || {};
    const created = Object.create(null), mounted = Object.create(null);
    const owners = AppUILifecycle.createKeyedScopes({pagehide: false});
    const replaceRegion = (name, mount) => {
      const area = Object.hasOwn(regions, name) ? regions[name] : created[name];
      if (!area || owners.destroyed) return;
      mounted[name] = null;
      const owner = owners.begin(name);
      if (!owner.current()) return;
      area.hidden = false;
      area.replaceChildren();
      const instance = mount(area);
      owner.add(instance);
      if (owner.current()) mounted[name] = instance || null;
    };
    const renderRegion = (name, spec) => replaceRegion(name, area => {
      if (name === 'body') area.style.overflow = isColumnsSpec(spec) ? 'hidden' : 'auto';
      return render(spec, area, opts.onCommand);
    });
    const renderState = (name, kind, message) => replaceRegion(name, area => state(area, kind, message));
    if (regions.top || regions.body || regions.bottom) {
      for (const name of ['top', 'body', 'bottom']) {
        const area = regions[name];
        if (!area) throw new Error(`AppContent: template region not found: ${name}`);
        area.classList.add(`appui-content-${name}`);
        area.style.minHeight = '0';
        if (name === 'body') {
          area.style.flex = '1';
          area.style.overflow = 'auto';
        }
        renderRegion(name, opts[name]);
      }
      return controller(regions, owners, mounted, renderRegion, renderState);
    }

    container.replaceChildren();
    for (const name of ['top', 'body', 'bottom']) {
      const area = document.createElement('section');
      area.className = `appui-content-${name}`;
      if (name === 'body') area.style.flex = '1';
      area.style.minHeight = '0';
      if (name === 'body') area.style.overflow = 'auto';
      container.appendChild(area);
      created[name] = area;
      renderRegion(name, opts[name]);
    }
    return controller(created, owners, mounted, renderRegion, renderState);
  }

  function controller(regions, owners, mounted, renderRegion, renderState) {
    return {
      get(name) {
        if (Object.hasOwn(regions, name)) return regions[name];
        const [region, slot] = String(name || '').split('.');
        const split = mounted[region];
        if (!split || !slot) return null;
        return split[slot === 'left' ? 'primary' : slot === 'right' ? 'secondary' : slot] || null;
      },
      render: renderRegion,
      loading: (name, message) => renderState(name, 'loading', message || 'Loading…'),
      empty: (name, message) => renderState(name, 'empty', message || 'Nothing to show.'),
      error: (name, message) => renderState(name, 'error', message || 'Something went wrong.'),
      destroy: () => {
        try { owners.destroy(); }
        finally { Object.keys(mounted).forEach(name => { mounted[name] = null; }); }
      },
    };
  }

  function state(area, kind, message) {
    if (!area) return;
    area.hidden = false;
    area.replaceChildren();
    const el = document.createElement('div');
    el.className = `appui-content-state appui-content-${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.textContent = message;
    area.appendChild(el);
  }



  return { create };
})();

;
// preview-table.js — AppUIPreviewTable: the shared sortable/virtualized DATA
// TABLE used by every file previewer that renders rows (CSV/TSV, SQLite,
// PylonDB, Parquet, xlsx, RAN config, …). Promoted from the workspace page's
// per-closure `_tableHtml`/`_mountTable`/`_wireTable` (src/16_preview3.js) into a
// reusable AppUI component (IMPROVEMENTS_NEXT #4 — aggregate shared behavior into
// a reusable component with real consumers; #1 — so a LAZY previewer bundle can
// reuse it with no duplication). Pure DOM/string helpers, no app state.
//
//   AppUIPreviewTable.tableHtml(header, rows, caption, opts?) -> html string
//       header: string[]; rows: any[][]; caption?: string
//       opts.pin (default true): single table pins to the viewport (both
//         scrollbars at the pane edges); pin:false for stacked multi-table.
//   AppUIPreviewTable.mountTable(ctx, html)   — make ctx.box a flex column +
//       set innerHTML (so a pinned table scrolls internally).
//   AppUIPreviewTable.wireTable(box, header, rows) — attach the virtualized
//       "show all" + sortable-header behaviour (re-renders ONLY the <tbody>).
//   AppUIPreviewTable.rowHtml(row, i)         — one <tr> (zebra by index).
//   AppUIPreviewTable.escCell(s)              — the fast HOT-path cell escaper.
(function () {
  'use strict';

  var TABLE_ROW_CAP = 2000;   // initial windowed render; rest behind "show all"

  // Fast HTML escaper for the HOT table-cell path: a single regex replace
  // instead of a DOM-based escaper (which allocates a throwaway <div> per field).
  // Only the 5 text-context entities — fine for <td>/<th> text.
  function escCell(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;';
    });
  }

  // Build one <tr> string for a row (zebra bg by absolute index).
  function rowHtml(r, i) {
    var bg = (i % 2) ? 'color-mix(in srgb, var(--text-primary,#e3e5e8) 6%, var(--bg-primary,#1e1f22))' : 'var(--bg-primary,#1e1f22)';
    var tds = '';
    for (var c = 0; c < r.length; c++) {
      tds += '<td style="padding:4px 10px;border-bottom:1px solid var(--border,#3f4147);color:var(--text-primary,#e3e5e8);' +
        'white-space:nowrap;vertical-align:top">' + escCell(r[c]) + '</td>';
    }
    return '<tr style="background:' + bg + '">' + tds + '</tr>';
  }

  // A generic sortable table from rows (array of arrays) + header (array).
  // VIRTUALIZED: only the first TABLE_ROW_CAP rows are rendered up front; a
  // "show all" control appends the rest (incremental — no full pane rebuild).
  // SORTABLE: clicking a header re-renders ONLY the <tbody> (not the pane).
  function tableHtml(header, rows, caption, opts) {
    var pin = !(opts && opts.pin === false);   // single table pins to viewport; stacked tables don't
    var th = (header || []).map(function (h, ci) {
      return '<th data-col="' + ci + '" style="position:sticky;top:0;cursor:pointer;background:var(--bg-elevated,#2b2d31);text-align:left;padding:6px 10px;' +
        'border-bottom:1px solid var(--border,#3f4147);color:var(--text-primary,#e3e5e8);font-weight:600;white-space:nowrap" title="click to sort">' + escCell(h) + '</th>';
    }).join('');
    rows = rows || [];
    var shown = Math.min(rows.length, TABLE_ROW_CAP);
    var body = '';
    for (var i = 0; i < shown; i++) body += rowHtml(rows[i], i);
    var more = rows.length - shown;
    var moreBtn = more > 0
      ? '<div class="ws-table-more" style="padding:8px 10px;text-align:center;background:var(--bg-primary,#1e1f22)">' +
        '<button type="button" class="ws-table-showall" style="font:12px ui-monospace,monospace;padding:4px 12px;cursor:pointer;' +
        'background:var(--bg-elevated,#2b2d31);color:var(--text-primary,#e3e5e8);border:1px solid var(--border,#3f4147);border-radius:4px">' +
        'Show all ' + rows.length + ' rows (' + more + ' more)</button></div>'
      : '';
    // PIN mode (single table): a flex-column capped at the pane height so the
    // scroll region fills it and BOTH scrollbars pin to the pane edges (a wide
    // table's h-bar stays at the viewport bottom). SHORT table → shrinks, no bar.
    // NON-PIN (stacked multi-table): natural height; the OUTER container scrolls.
    if (pin) {
      return '<div class="ws-table-wrap" style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column;background:var(--bg-primary,#1e1f22)">' +
        (caption ? ('<div style="flex:0 0 auto;padding:6px 10px;font-size:11px;color:var(--text-muted,#949ba4)">' + escCell(caption) + '</div>') : '') +
        '<div class="ws-table-scroll" style="flex:1 1 auto;min-height:0;overflow:auto">' +
        '<table style="border-collapse:collapse;width:100%;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace">' +
        '<thead><tr>' + th + '</tr></thead><tbody class="ws-table-body">' + body + '</tbody></table></div>' + moreBtn + '</div>';
    }
    return '<div class="ws-table-wrap" style="background:var(--bg-primary,#1e1f22)">' +
      (caption ? ('<div style="padding:6px 10px;font-size:11px;color:var(--text-muted,#949ba4)">' + escCell(caption) + '</div>') : '') +
      '<div class="ws-table-scroll" style="overflow-x:auto">' +
      '<table style="border-collapse:collapse;width:100%;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace">' +
      '<thead><tr>' + th + '</tr></thead><tbody class="ws-table-body">' + body + '</tbody></table></div>' + moreBtn + '</div>';
  }

  // Mount a PINNED single table so its horizontal scrollbar stays at the pane
  // (viewport) bottom, not the content bottom. The preview box becomes a flex
  // column with overflow:hidden; the pinned wrap (flex:1;min-height:0) fills it
  // and scrolls INTERNALLY, so both scrollbars sit at the box edges and only
  // show when the table actually overflows.
  function mountTable(ctx, html) {
    try {
      var b = ctx.box;
      if (b && b.style) { b.style.display = 'flex'; b.style.flexDirection = 'column'; b.style.overflow = 'hidden'; }
    } catch (e) {}
    ctx.box.innerHTML = html;
  }

  // Wire the virtualized/sortable behaviours onto a just-rendered table. Keeps
  // the full `rows` in a closure so show-all + sort re-render the <tbody> ONLY
  // (incremental — never rebuilds the whole preview pane).
  function wireTable(box, header, rows) {
    try {
      var tbody = box.querySelector('.ws-table-body');
      if (!tbody) return;
      var sortCol = -1, sortDir = 1, capped = true;
      function paint() {
        var data = rows;
        if (sortCol >= 0) {
          data = rows.slice().sort(function (a, b) {
            var x = a[sortCol], y = b[sortCol];
            var nx = parseFloat(x), ny = parseFloat(y);
            var bothNum = !isNaN(nx) && !isNaN(ny) && String(x).trim() !== '' && String(y).trim() !== '';
            if (bothNum) return (nx - ny) * sortDir;
            return String(x == null ? '' : x).localeCompare(String(y == null ? '' : y)) * sortDir;
          });
        }
        var lim = capped ? Math.min(data.length, TABLE_ROW_CAP) : data.length;
        var s = '';
        for (var i = 0; i < lim; i++) s += rowHtml(data[i], i);
        tbody.innerHTML = s;
        var mb = box.querySelector('.ws-table-more');
        if (mb) mb.style.display = (capped && data.length > TABLE_ROW_CAP) ? '' : 'none';
      }
      box.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('ws-table-showall')) { capped = false; paint(); return; }
        var thEl = t; while (thEl && thEl.tagName !== 'TH' && thEl !== box) thEl = thEl.parentNode;
        if (thEl && thEl.tagName === 'TH' && thEl.hasAttribute('data-col')) {
          var c = parseInt(thEl.getAttribute('data-col'), 10);
          if (c === sortCol) sortDir = -sortDir; else { sortCol = c; sortDir = 1; }
          paint();
        }
      });
    } catch (e) { /* non-fatal: static table still shows */ }
  }

  if (typeof window !== 'undefined') {
    window.AppUIPreviewTable = {
      ROW_CAP: TABLE_ROW_CAP,
      escCell: escCell,
      rowHtml: rowHtml,
      tableHtml: tableHtml,
      mountTable: mountTable,
      wireTable: wireTable,
    };
  }
})();

;
/* Versioned AppUI template contract. */
var AppUITemplate = window.AppUITemplate || (function() {
  const VERSION = '1.1.0';
  const REQUIRED_REGIONS = [
    'app-menubar', 'app-main', 'app-left', 'app-content',
    'app-content-top', 'app-content-body', 'app-content-bottom',
    'app-right', 'app-statusbar',
  ];

  function supports(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || '');
    return !!match && Number(match[1]) === 1;
  }

  function mount(documentRef = document) {
    const version = documentRef.querySelector('meta[name="app-template"]')?.content;
    if (!supports(version)) {
      throw new Error(`AppUI supports app-template >=${VERSION} <2.0.0; found ${version || 'none'}.`);
    }
    const regions = {};
    REQUIRED_REGIONS.forEach(id => {
      const matches = documentRef.querySelectorAll(`#${id}`);
      if (matches.length !== 1) {
        throw new Error(`AppUI template ${VERSION} requires exactly one #${id}; found ${matches.length}.`);
      }
      regions[id] = matches[0];
    });
    return {version, regions};
  }

  return {VERSION, REQUIRED_REGIONS, supports, mount};
})();
window.AppUITemplate = AppUITemplate;

;
/* Per-app layout persistence with safe storage failure handling. */
var AppUILayoutState = window.AppUILayoutState || (function() {
  function create(appId) {
    const key = `pylon/appui/layout/${appId || 'page'}`;
    let value = read(key);
    return {
      get: name => value[name],
      all: () => Object.assign({}, value),
      set(name, next) { value[name] = next; write(key, value); },
      replace(next) { value = Object.assign({}, next); write(key, value); },
      clear() { value = {}; AppUIStorage.remove(key); },
    };
  }

  function read(key) { return AppUIStorage.getJSON(key, {}) || {}; }
  function write(key, value) { AppUIStorage.setJSON(key, value); }
  return {create};
})();
window.AppUILayoutState = AppUILayoutState;

;
/* Private DOM bindings for query-route controls. */
window._AppUIRouterBindings = {
  create({get, set}) {
    const scope=AppUILifecycle.createScope(),bindings=new Map();
    scope.add(()=>{bindings.forEach(binding=>binding.destroy());bindings.clear();});
    // Internal: bind a single element
    function _bindElement(el, key) {
      if(scope.destroyed)return;
      bindings.get(el)?.destroy();
      const owner=AppUILifecycle.createScope();bindings.set(el,owner);
      const tag = el.tagName.toLowerCase();
      // Restore from URL on bind
      const urlVal = get(key);
      if (urlVal !== null) _setElementValue(el, urlVal);

      // Listen for changes
      if (tag === 'select' || tag === 'input' || tag === 'textarea') {
        owner.listen(el,'change', () => {
          if(owner.destroyed)return;
          set(key, el.value, {replace: true, silent: false});
        });
        if (tag === 'input') {
          owner.listen(el,'input', () => {
            if(owner.destroyed)return;
            set(key, el.value, {replace: true, silent: true});
          });
        }
      } else {
        // Clickable element with data-url-value
        owner.listen(el,'click', () => {
          if(owner.destroyed)return;
          const val = el.dataset.urlValue || el.dataset.id || el.textContent.trim();
          set(key, val, {replace: false, silent: false});
          // Add active class
          const siblings = el.parentElement?.querySelectorAll(`[data-url-param="${key}"]`);
          siblings?.forEach(s => s.classList.remove('url-active'));
          el.classList.add('url-active');
        });
      }
    }

    // Internal: set element value/state from URL param
    function _setElementValue(el, val) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'select' || tag === 'input' || tag === 'textarea') {
        el.value = val;
      } else {
        // For clickable elements, add active class if value matches
        const elVal = el.dataset.urlValue || el.dataset.id || el.textContent.trim();
        if (elVal === val) el.classList.add('url-active');
        else el.classList.remove('url-active');
      }
    }

    function bind(elOrContainer, paramName) {
      if (paramName) _bindElement(elOrContainer, paramName);
      else elOrContainer.querySelectorAll('[data-url-param]').forEach(el => _bindElement(el, el.dataset.urlParam));
    }
    function restore(container) {
      (container || document).querySelectorAll('[data-url-param]').forEach(el => {
        const val=get(el.dataset.urlParam);
        if(val !== null) _setElementValue(el,val);
      });
    }
    return {bind, restore, destroy:()=>scope.destroy()};
  },
};

;
/* Namespaced query and hash route helpers. */
var AppUIRouter = (function() {
  // Optional SHORT ALIASES: map a verbose router param (appui.<id>.<key>) to a
  // short query param (e.g. ?wpath=). When registered via AppUIRouter.alias(),
  // get() reads EITHER form and set() writes the SHORT one — so the address bar
  // stays short with no verbose↔short flicker. Parity with the AppForge shim.
  const _aliases = {};
  const _aliasKey = (appId, key) => `${appId || 'page'}.${key}`;
  function create(appId, onRoute) {
    const scope=AppUILifecycle.createScope();
    const bindings=window._AppUIRouterBindings.create({get:key=>api.get(key),set:(...args)=>api.set(...args)});
    scope.add(bindings);
    const prefix = `appui.${appId || 'page'}.`;
    const hashRoutes = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const notify = () => onRoute?.();
    const hashListener = () => notify();
    const popstateListener = () => { api.restore(); notify(); };
    scope.listen(window,'popstate',popstateListener);
    scope.listen(window,'hashchange',hashListener);

    const api = {
      get(key) {
        const q = new URLSearchParams(window.location.search);
        const v = q.get(prefix + key);
        if (v != null) return v;
        const sh = _aliases[_aliasKey(appId, key)];
        return sh ? q.get(sh) : null;
      },
      set(key, value, {replace = false, silent = false} = {}) {
        const url = new URL(window.location.href);
        const sh = _aliases[_aliasKey(appId, key)];
        const name = sh || (prefix + key);   // write the SHORT alias when registered
        url.searchParams.delete(prefix + key);
        if (sh) url.searchParams.delete(sh);
        if (value === undefined || value === null || value === '') { /* cleared */ }
        else url.searchParams.set(name, String(value));
        history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
        if (!silent) notify();
      },
      getHash(key) { return hashRoutes().get(key); },
      setHash(values, {replace = false, reset = false, silent = false} = {}) {
        const params = reset ? new URLSearchParams() : hashRoutes();
        Object.entries(values || {}).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') params.delete(key);
          else params.set(key, String(value));
        });
        const url = new URL(window.location.href); url.hash = params.toString();
        history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
        if (!silent) notify();
      },

      /**
       * Declaratively bind elements to URL params.
       * 
       * Usage:
       *   router.bind(container)  — scans for [data-url-param] elements
       *   router.bind(element, 'paramName')  — bind a single element
       * 
       * Supported elements:
       *   <select data-url-param="db">  — syncs selected value ↔ URL
       *   <input data-url-param="search">  — syncs input value ↔ URL
       *   <div data-url-param="table" data-url-value="nodes">  — click sets URL
       * 
       * On page load: reads URL → sets element state.
       * On interaction: updates URL from element.
       * On popstate: restores element state from URL.
       */
      bind(elOrContainer, paramName) { bindings.bind(elOrContainer,paramName); },

      /** Restore all bound elements from current URL. Call after DOM updates. */
      restore(container) { bindings.restore(container); },

      destroy() { scope.destroy(); },
    };

    return api;
  }
  function alias(appId, key, shortName) { _aliases[_aliasKey(appId, key)] = shortName; }
  return {create, alias};
})();
window.AppUIRouter = AppUIRouter;

;
/* Command registry shared by menus, toolbars, palettes, and shortcuts. */
var AppUICommands = window.AppUICommands || (function() {
  function create(definitions) {
    const commands = new Map();
    const register = definition => {
      if (!definition?.id || typeof (definition.run || definition.action) !== 'function') {
        throw new Error('AppUI command requires id and run(action) function');
      }
      commands.set(definition.id, Object.assign({}, definition, {run: definition.run || definition.action}));
    };
    const registerAll = source => {
      const list = Array.isArray(source) ? source : Object.entries(source || {}).map(([id, value]) =>
        Object.assign({id}, typeof value === 'function' ? {run: value} : value));
      list.forEach(register);
    };
    const available = command => command.visible !== false && command.enabled !== false
      && (typeof command.visible !== 'function' || command.visible())
      && (typeof command.enabled !== 'function' || command.enabled());
    registerAll(definitions || []);
    return {
      register,
      registerAll,
      run(id, params = {}, source = {}) { const command = commands.get(id); if (!command || !available(command)) return false; command.run(params, source); return true; },
      get(id) { const command = commands.get(id); return command ? Object.assign({}, command) : null; },
      update(id, patch) { const command = commands.get(id); if (!command) return false; Object.assign(command, patch || {}); return true; },
      all() { return [...commands.values()].filter(available).map(command => Object.assign({}, command)); },
      raw() { return [...commands.values()].map(command => Object.assign({}, command)); },
      setEnabled(id, value) { const command = commands.get(id); if (!command) return false; command.enabled = value; return true; },
      clear() { commands.clear(); },
    };
  }
  return {create};
})();
window.AppUICommands = AppUICommands;

;
/* One keyboard dispatcher with editable-target protection. */
var AppUIShortcuts = window.AppUIShortcuts || (function() {
  function normalize(shortcut) { return String(shortcut || '').toLowerCase().replace(/\s/g, ''); }
  function eventShortcut(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.key && !['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) parts.push(event.key.toLowerCase());
    return parts.join('+');
  }
  function editable(target) { return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)); }
  function create({enabled = () => true} = {}) {
    const bindings = new Map();
    const listener = event => {
      if (!enabled() || editable(event.target)) return;
      const run = bindings.get(eventShortcut(event));
      if (!run) return;
      event.preventDefault(); event.stopImmediatePropagation(); run(event);
    };
    document.addEventListener('keydown', listener);
    return {
      bind(shortcut, run) { if (shortcut && typeof run === 'function') bindings.set(normalize(shortcut), run); },
      unbind(shortcut) { bindings.delete(normalize(shortcut)); },
      clear() { bindings.clear(); },
      destroy() { bindings.clear(); document.removeEventListener('keydown', listener); },
    };
  }
  return {create, normalize, eventShortcut, editable};
})();
window.AppUIShortcuts = AppUIShortcuts;
