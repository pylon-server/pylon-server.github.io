// pylon/appui/statusbar  --  AppUIStatusBar: Generic statusbar with sections and activity log
// Depends on: AppUIDialog (showLog)

var AppUIStatusBar = window.AppUIStatusBar || (function() {
  'use strict';

  const LOG_MAX = 100;

  /**
   * Create a statusbar instance.
   * @param {object} opts
   * @param {HTMLElement|string} opts.container - container element or selector
   * @param {Array} opts.sections - [{id, title, initial}]
   * @returns {{set, getLog, showLog}}
   */
  function create(opts) {
    const container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;
    if (!container) throw new Error('AppUIStatusBar: container not found');

    const sections = opts.sections || [];
    const _log = [];
    const _spans = Object.create(null);
    const owner = AppUILifecycle.createScope();
    const controller = new AbortController();
    owner.add(() => controller.abort());
    let destroyed = false;

    // Render sections
    sections.forEach(sec => {
      const span = document.createElement('span');
      span.id = sec.id || '';
      span.className = 'ui-statusbar-section';
      if (sec.title) span.title = sec.title;
      span.textContent = sec.initial || '';
      container.appendChild(span);
      owner.add(() => span.remove());
      _spans[sec.id] = span;
    });

    /**
     * Update a section value and log the change.
     */
    function set(id, value) {
      if (destroyed) return;
      const span = _spans[id];
      if (span) span.textContent = value;
      _log.push({ time: new Date().toLocaleTimeString(), section: id, value: value });
      if (_log.length > LOG_MAX) _log.shift();
    }

    /**
     * Get the activity log.
     * @returns {Array<{time, section, value}>}
     */
    function getLog() {
      return _log.slice();
    }

    /**
     * Show the activity log in an AppUIDialog.
     */
    function showLog() {
      if (destroyed) return;
      const escHtml = s => AppUITextUtils.esc(String(s));

      let body;
      if (_log.length) {
        body = '<div style="max-height:400px;overflow-y:auto;font-family:var(--font-mono,monospace);font-size:11px;line-height:1.8">';
        body += _log.map(e =>
          '<div><span style="color:var(--text-muted);margin-right:8px">' + e.time + '</span>' +
          '<span style="color:var(--text-muted);margin-right:8px">[' + escHtml(e.section) + ']</span>' +
          escHtml(e.value) + '</div>'
        ).join('');
        body += '</div>';
      } else {
        body = '<p style="color:var(--text-muted)">No status messages yet.</p>';
      }

      if (typeof AppUIDialog !== 'undefined') {
        AppUIDialog.show({ title: 'Status Log', body: body, width: '550px', signal: controller.signal });
      }
    }

    return { set, getLog, showLog, destroy() {
      if (destroyed) return;
      destroyed = true;
      owner.destroy();
    } };
  }

  /** Mount the status-history button in an AppUI status-bar right slot. */
  function mountLogButton(container, statusBar) {
    if (!container || !statusBar) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-app-status-log-btn';
    button.title = 'Status history';
    button.setAttribute('aria-label', 'Open status history');
    button.textContent = '📋';
    const owner = AppUILifecycle.createScope();
    owner.listen(button, 'click', () => {if (!owner.destroyed) statusBar.showLog();});
    owner.add(() => button.remove());
    container.appendChild(button);
    return { destroy() { owner.destroy(); } };
  }

  return { create, mountLogButton };
})();
window.AppUIStatusBar = AppUIStatusBar;
