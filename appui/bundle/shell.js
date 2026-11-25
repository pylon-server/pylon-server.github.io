/* Content top/body/bottom region controller. */
const AppUIContentRegion = (function() {
  function create({element, top, body, bottom}) {
    let content = null;
    return {
      mount(config) {
        if (typeof AppContent === 'undefined') {
          element.replaceChildren();
          config?.render?.(element);
          return null;
        }
        content?.destroy?.();
        content = AppContent.create({
          container: element,
          regions: {top, body, bottom},
          top: config?.top,
          body: config?.body || config?.render,
          bottom: config?.bottom,
          onCommand: config?.onCommand,
        });
        return content;
      },
      destroy() { content?.destroy?.(); content = null; [top, body, bottom].forEach(region => region.replaceChildren()); },
      get content() { return content; },
    };
  }
  return {create};
})();
window.AppUIContentRegion = AppUIContentRegion;

;
/* Template-mounted menubar region. */
const AppUIMenubarRegion = (function() {
  function create(element) {
    let menu = null;
    let right = null;
    return {
      mount({visible = true} = {}) {
        element.replaceChildren();
        element.hidden = !visible;
        if (!visible) { menu = null; right = null; return {menu, right}; }
        menu = document.createElement('div'); menu.className = 'ai-app-menu-main';
        right = document.createElement('div'); right.className = 'ai-app-menu-right';
        element.append(menu, right);
        return {menu, right};
      },
      initMenu({component, definition, onAction} = {}) {
        if (!menu || !component?.init) return null;
        component.init({container: menu, definition, onAction});
        return component;
      },
      mountTheme({enabled = false, themeService} = {}) {
        if (!enabled || !right) return null;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai-app-theme-btn';
        button.title = 'Toggle theme';
        button.textContent = 'Theme';
        button.addEventListener('click', () => themeService.toggle());
        right.appendChild(button);
        return button;
      },
      mountNotifications({enabled = false, feature} = {}) {
        if (!enabled || !right || !feature?.mount) return null;
        return feature.mount(right);
      },
      destroy() { element.replaceChildren(); element.hidden = false; menu = null; right = null; },
      get menu() { return menu; },
      get right() { return right; },
    };
  }
  return {create};
})();
window.AppUIMenubarRegion = AppUIMenubarRegion;

;
/* Shared left/right template-mounted sidebar region with resize ownership. */
const AppUISidebarRegion = (function() {
  function create({element, main, position, layout, persist}) {
    let handle = null;
    let resizeCleanup = null;
    const widthKey = position === 'left' ? 'leftWidth' : 'rightWidth';
    const collapsedKey = position === 'left' ? 'leftCollapsed' : 'rightCollapsed';
    const min = position === 'left' ? 150 : 200;
    const max = position === 'left' ? 500 : 600;

    function removeHandle() { resizeCleanup?.(); resizeCleanup = null; handle?.remove(); handle = null; }
    function mount(config, render) {
      element.replaceChildren();
      removeHandle();
      if (!config) {
        element.hidden = true; element.classList.remove('ai-app-hidden');
        return;
      }
      element.hidden = false;
      element.style.width = (layout[widthKey] || config.width || (position === 'left' ? 250 : 350)) + 'px';
      element.classList.toggle('ai-app-hidden', !!layout[collapsedKey]);
      handle = document.createElement('div');
      handle.className = position === 'left' ? 'ai-app-resize-left' : 'ai-app-resize-right';
      handle.dataset.appuiOwned = 'true';
      main.insertBefore(handle, position === 'left' ? element.nextSibling : element);
      bindResize();
      render?.(element);
    }
    function bindResize() {
      resizeCleanup = AppUIShellLayout.makeDraggable(
        handle, element, 'width', min, max, position === 'right', widthKey, layout, persist,
      );
    }
    return {
      mount,
      toggle() { element.classList.toggle('ai-app-hidden'); layout[collapsedKey] = element.classList.contains('ai-app-hidden'); persist?.(); },
      destroy() { removeHandle(); element.replaceChildren(); element.hidden = false; element.classList.remove('ai-app-hidden'); element.style.removeProperty('width'); },
    };
  }
  return {create};
})();
window.AppUISidebarRegion = AppUISidebarRegion;

;
/* Template-mounted statusbar slots. */
const AppUIStatusbarRegion = (function() {
  function create(element) {
    let main = null;
    let right = null;
    let defaults = null;
    function clearDefaults() {const previous = defaults; defaults = null; previous?.destroy();}
    return {
      mount({visible = true} = {}) {
        clearDefaults();
        element.replaceChildren(); element.hidden = !visible;
        if (!visible) { main = null; right = null; return {main, right}; }
        main = document.createElement('div'); main.className = 'ai-app-status-main';
        right = document.createElement('div'); right.className = 'ai-app-status-right';
        element.append(main, right);
        return {main, right};
      },
      mountDefault({component, sections} = {}) {
        if (!main || !right || !component?.create) return null;
        clearDefaults();
        const owner = AppUILifecycle.createScope(); defaults = owner;
        const statusBar = component.create({container: main, sections: sections || [{id: 'main', initial: 'Ready'}]});
        owner.add(statusBar);
        const mainSection = main.querySelector('#main');
        if (mainSection) mainSection.style.flex = '1';
        const logButton = component.mountLogButton?.(right, statusBar) || null;
        owner.add(logButton);
        return {statusBar, logButton};
      },
      destroy() { clearDefaults(); element.replaceChildren(); element.hidden = false; main = null; right = null; },
      get main() { return main; },
      get right() { return right; },
    };
  }
  return {create};
})();
window.AppUIStatusbarRegion = AppUIStatusbarRegion;

;
/* Internal shell utilities. Kept separate so shell/app.js owns orchestration only. */
window.AppUIShellHelpers = {
  create({getContentTarget, getHashRoutes}) {
    function el(tag, className) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      return node;
    }
    async function fetchApi(path, body, options = {}) {
      return AppUIApi.request(path, body, options);
    }
    function renderBreadcrumb(container) {
      container ||= getContentTarget(); if (!container) return null;
      const parts = [...getHashRoutes()].filter(([, value]) => value).map(([key, value]) => ({key, value}));
      if (!parts.length) return null;
      const nav = el('nav', 'ai-app-breadcrumb'); nav.setAttribute('aria-label', 'Breadcrumb');
      parts.forEach((part, index) => { if (index) { const separator = el('span', 'ai-breadcrumb-sep'); separator.textContent = '›'; nav.appendChild(separator); } const item = el('span', 'ai-breadcrumb-item'); item.textContent = decodeURIComponent(part.value); item.title = `${part.key}=${part.value}`; nav.appendChild(item); });
      return nav;
    }
    return {el, fetchApi, renderBreadcrumb};
  },
};

;
/* Shell command registry and shortcut ownership, separate from layout orchestration. */
window.AppUIShellCommandRuntime=(function(){
  function create({getConfig,onPaletteChange,dispatchMenu}){
    let _commands=new Map(),_commandService=null,_shortcutService=null;
    const raw=()=>_commandService?_commandService.raw():[..._commands.values()];
    const init=()=>{_commandService=AppUICommands.create();};
    const destroyShortcuts=()=>{_shortcutService?.destroy();_shortcutService=null;};
    const clear=()=>{_commandService?.clear();_commandService=null;_commands.clear();};

    function _registerCommands(definitions) {
        if (_commandService) _commandService.clear();
        else _commands.clear();
        if (!definitions) return;
        const list = Array.isArray(definitions)
            ? definitions
            : Object.entries(definitions).map(([id, value]) => Object.assign({id}, typeof value === 'function' ? {run: value} : value));
        list.forEach(registerCommand);
    }

    function registerCommand(command) {
        if (!command || !command.id || typeof (command.run || command.action) !== 'function') {
            throw new Error('AppUI command requires id and run(action) function');
        }
        if (_commandService) _commandService.register(command);
        else _commands.set(command.id, Object.assign({}, command, {run: command.run || command.action}));
    }

    function runCommand(id, params, source) {
        if (_commandService) return _commandService.run(id, params || {}, source || {});
        const command = _commands.get(id);
        if (!command || !_isCommandAvailable(command)) return false;
        command.run(params || {}, source || {});
        return true;
    }

    function _isCommandAvailable(command) {
        return command.visible !== false && command.enabled !== false
            && (typeof command.visible !== 'function' || command.visible())
            && (typeof command.enabled !== 'function' || command.enabled());
    }

    function getCommands() {
        if (_commandService) return _commandService.all();
        return [..._commands.values()].filter(_isCommandAvailable).map(command => Object.assign({}, command));
    }

    function setCommandEnabled(id, enabled) {
        if (_commandService) {
            const updated = _commandService.setEnabled(id, enabled);
            if (updated) onPaletteChange();
            return updated;
        }
        const command = _commands.get(id);
        if (!command) return false;
        command.enabled = enabled;
        onPaletteChange();
        return true;
    }

    function _bindCommandShortcuts() {
        _shortcutService?.destroy();
        _shortcutService = null;
        _loadCustomShortcuts();
        const bindings = new Map();
        const commands=raw();
        for (const command of commands) {
            if (command.shortcut) bindings.set(window.AppUIShellCommands.normalizeShortcut(command.shortcut), () =>
                runCommand(command.id, {}, {type: 'shortcut'}));
        }
        AppUIMenu.getActions().forEach(item => {
            if (item.shortcut && !bindings.has(window.AppUIShellCommands.normalizeShortcut(item.shortcut))) {
                bindings.set(window.AppUIShellCommands.normalizeShortcut(item.shortcut), () =>
                    dispatchMenu(item.menu, item.id, item.params, item));
            }
        });
        _shortcutService = AppUIShortcuts.create({enabled: _areShortcutsEnabled});
        bindings.forEach((run, shortcut) => _shortcutService.bind(shortcut, run));
    }

    function _areShortcutsEnabled() {
        return window.AppUIShellCommands.areShortcutsEnabled(getConfig().id, getConfig());
    }

    function setShortcutsEnabled(enabled) {
        window.AppUIShellCommands.setShortcutsEnabled(getConfig().id, enabled);
    }

    function areShortcutsEnabled() {
        return _areShortcutsEnabled();
    }

    function _loadCustomShortcuts() {
        const stored = window.AppUIShellCommands.loadCustomShortcuts(getConfig().id);
        for (const [id, shortcut] of Object.entries(stored)) {
            if (_commandService) _commandService.update(id, {shortcut});
            else {
                const cmd = _commands.get(id);
                if (cmd) cmd.shortcut = shortcut;
            }
        }
    }

    function setShortcut(commandId, shortcut) {
        if (_commandService) {
            if (!_commandService.update(commandId, {shortcut})) return false;
        } else {
            const cmd = _commands.get(commandId);
            if (!cmd) return false;
            cmd.shortcut = shortcut;
        }
        window.AppUIShellCommands.saveCustomShortcut(getConfig().id, commandId, shortcut);
        return true;
    }

    function resetShortcuts() {
        window.AppUIShellCommands.resetCustomShortcuts(getConfig().id);
        // Re-register from original config
        _registerCommands(getConfig().commands || getConfig().actions);
    }

    function getShortcuts() {
        const commands=raw();
        return commands
            .filter(cmd => cmd.shortcut)
            .map(cmd => ({ id: cmd.id, label: cmd.label || cmd.id, shortcut: cmd.shortcut }));
    }

    return {init,clear,destroyShortcuts,raw,registerAll:_registerCommands,register:registerCommand,run:runCommand,
      all:getCommands,setEnabled:setCommandEnabled,bindShortcuts:_bindCommandShortcuts,
      setShortcutsEnabled,areShortcutsEnabled,setShortcut,resetShortcuts,getShortcuts};
  }
  return {create};
})();

;
/* Shell state helpers: cleanup registry, public-state accessors, dirty-state tracking, history stacks. */

/* Idempotent cleanup registry for shell-owned plugin resources. */
window.AppUIShellCleanup = {
  create() {
    let scope = AppUILifecycle.createScope();
    return {
      track: resource => scope.add(resource),
      runAll() {
        const previous = scope;
        scope = AppUILifecycle.createScope();
        previous.destroy();
      },
    };
  },
};

/* Read-only public shell state accessors. */
window.AppUIShellPublicState = {
  create({elements, regions, pipeline, statusBar, content}) {
    return {
      setTitle(title) { document.title = title; },
      getElement: slot => elements()[slot] || null,
      getRegion: name => regions()[name] || null,
      getPipeline: () => pipeline(),
      getStatusBar: () => statusBar(),
      getContent: () => content(),
    };
  },
};

/* Page dirty-state tracking is independent from layout and lifecycle. */
window.AppUIShellDirtyState = {
  create(getTitle) {
    let dirty = false;
    return {
      set(value = true) {
        dirty = value;
        document.querySelector('.ai-app-save-indicator')?.classList.toggle('ai-app-dirty', dirty);
        const title = getTitle() || document.title.replace(/^\u25cf /, '');
        document.title = dirty ? `\u25cf ${title}` : title;
      },
      get: () => dirty,
    };
  },
};

/* Undo/redo state is independent from shell layout and page lifecycle. */
window.AppUIShellHistory = {
  create(limit = 50) {
    let undoStacks = {}, redoStacks = {};
    return {
      pushUndo(scope, state) { (undoStacks[scope] ||= []).push(state); if (undoStacks[scope].length > limit) undoStacks[scope].shift(); redoStacks[scope] = []; },
      undo(scope) { const stack = undoStacks[scope]; if (!stack?.length) return null; redoStacks[scope] ||= []; return stack.pop(); },
      redo(scope) { const stack = redoStacks[scope]; if (!stack?.length) return null; return stack.pop(); },
      pushRedo(scope, state) { (redoStacks[scope] ||= []).push(state); },
      clear(scope) { if (scope) { delete undoStacks[scope]; delete redoStacks[scope]; } else { undoStacks = {}; redoStacks = {}; } },
    };
  },
};

;
/* Shell UI adapters: notification push, diagnostics/error reporting, confirm dialogs. */

/* Notification feature adapter. */
window.AppUIShellNotifications = {
  notify(message, level = 'info') {
    const notifications = window.AppUINotificationsFeature;
    if (!notifications?.push) return false;
    notifications.push(typeof message === 'object' ? Object.assign({level}, message) : {message: String(message || ''), level});
    return true;
  },
};

/* Error reporting and plugin discovery kept outside shell orchestration. */
window.AppUIShellDiagnostics = {
  reportUnhandled(event, setStatus) {
    const message = event.reason?.message || event.message || 'Unknown error';
    window.AppUIToast?.error?.(message.substring(0, 100));
    setStatus(`Error: ${message.substring(0, 60)}`);
  },
  discoverSidebarPlugins(position) {
    return (window.__appui_sidebar_plugins || []).filter(plugin => !plugin.position || plugin.position === position);
  },
};

/* Shell dialog adapters. */
window.AppUIShellDialogs = {
  confirm(message, options = {}) {
    return new Promise(resolve => {
      if (typeof AppUIDialog === 'undefined') return resolve(window.confirm(message));
      AppUIDialog.show({ title: options.title || 'Confirm', body: `<div style="font-size:13px">${message}</div>`, buttons: [
        {text: options.confirmText || 'OK', action: () => resolve(true)},
        {text: options.cancelText || 'Cancel', action: () => resolve(false)},
      ]});
    });
  },
};

;
/* TTL data cache shared by AppUI pages. */
window.AppUIShellDataCache = {
  create(request, limit = 50) {
    const cache = new Map();
    return {
      async get(toolPath, params, options = {}) {
        const key = `${toolPath}|${JSON.stringify(params || {})}`, ttl = options.ttl || 30000, cached = cache.get(key);
        if (cached && Date.now() - cached.ts < ttl) return cached.data;
        const data = await request(`/api/${toolPath.replace(/\./g, '/')}`, params);
        cache.set(key, {data, ts: Date.now()});
        if (cache.size > limit) { const [oldest] = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0] || []; if (oldest) cache.delete(oldest); }
        return data;
      },
      invalidate(toolPath) { [...cache.keys()].filter(key => key.startsWith(toolPath)).forEach(key => cache.delete(key)); },
    };
  },
};

;
/* Private overflow navigation for sidebar tab strips. */
const _AppUISidebarTabOverflow = {
  create(tabBar) {
    const scope = AppUILifecycle.createScope();
    const tabRow = document.createElement('div');
    tabRow.className = 'ai-app-sidebar-tabrow';
    function _mkNav(dir, glyph, label) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ai-app-sidebar-tabnav ai-app-sidebar-tabnav-' + (dir < 0 ? 'prev' : 'next');
      b.setAttribute('aria-label', label);
      b.title = label;
      b.textContent = glyph;
      b.tabIndex = -1;                 // not part of the tab keyboard order
      scope.listen(b, 'click', function (e) {
        if (scope.destroyed) return;
        e.preventDefault();
        // scroll by ~80% of the visible width in the requested direction
        const step = Math.max(40, Math.round(tabBar.clientWidth * 0.8));
        tabBar.scrollBy({ left: dir * step, behavior: 'smooth' });
      });
      return b;
    }
    const navPrev = _mkNav(-1, '\u25C2', 'Scroll tabs left');   // ◂
    const navNext = _mkNav(1, '\u25B8', 'Scroll tabs right');   // ▸
    tabRow.append(navPrev, tabBar, navNext);
    // Reflect overflow + scroll position onto the nav buttons. Hidden entirely
    // when everything fits; each arrow disabled at its end.
    function _updateNav() {
      if (scope.destroyed) return;
      const overflow = tabBar.scrollWidth - tabBar.clientWidth > 1;
      tabRow.classList.toggle('has-overflow', overflow);
      if (!overflow) { navPrev.disabled = navNext.disabled = true; return; }
      const x = tabBar.scrollLeft;
      navPrev.disabled = x <= 1;
      navNext.disabled = x >= (tabBar.scrollWidth - tabBar.clientWidth - 1);
    }
    scope.listen(tabBar, 'scroll', _updateNav, { passive: true });
    if (typeof ResizeObserver === 'function') {
      try { const observer = new ResizeObserver(_updateNav); observer.observe(tabBar); scope.add(() => observer.disconnect()); } catch (e) { /* best-effort */ }
    }
    scope.listen(window, 'resize', _updateNav);
    // Run once after the strip has laid out (and expose for post-add/remove).
    const navFrame = AppUILifecycle.createFrameTask(_updateNav, {fallbackDelay: 0});
    scope.add(() => navFrame.destroy());
    const _scheduleNav = () => {if (!scope.destroyed) navFrame.schedule();};
    _scheduleNav();
    return {element: tabRow, schedule: _scheduleNav, destroy: () => scope.destroy()};
  }
};

;
/* Private markup for sidebar tab strips and lazy panels. */
window._AppUISidebarTabView = {
  frame() {
    const tabBar = document.createElement('div');
    tabBar.className = 'ai-app-sidebar-tabs';
    tabBar.setAttribute('role', 'tablist');
    const panelHost = document.createElement('div');
    panelHost.className = 'ai-app-sidebar-panel';
    return {tabBar, panelHost};
  },
  panel(tab) {
    var tabPanel = document.createElement('div');
    tabPanel.className = 'ai-app-tab-panel';
    tabPanel.dataset.tabId = tab.id;
    tabPanel.style.cssText = 'flex:1;overflow:auto;display:flex;flex-direction:column;';
    tabPanel.innerHTML = '<div class="ai-app-tab-loading">Loading...</div>';
    return tabPanel;
  },
  button(tab, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-app-sidebar-tab';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = -1;
    button.dataset.tabId = tab.id;
    button.title = tab.title || tab.label || tab.id || 'Sidebar tab';
    button.textContent = (tab.icon || '') + (tab.label || tab.title || tab.id || 'Tab ' + (index + 1));
    button.draggable = true;
    if (tab.closable) button.dataset.closable = 'true';
    return button;
  },
};

;
/* Unified sidebar tab host for AppUI sidebars.
 *
 * Used by both the shell sidebar renderer and standalone pages.
 * Supports: lazy panel rendering, activate/deactivate lifecycle, keyboard
 * navigation, drag-to-reorder, localStorage persistence, ARIA roles,
 * and custom render interception (for ai-sidebar type).
 */
const AppUISidebarTabs = (() => {
  // A render that APPENDS to the panel (instead of replacing its content) left the "Loading..." placeholder
  // above its content forever. Drop it once the panel has real content - now, or when it first arrives.
  function _dropPlaceholder(panel) {
    const ph = panel.querySelector(':scope > .ai-app-tab-loading');
    if (!ph) return;
    if (panel.children.length > 1) { ph.remove(); return; }
    if (typeof MutationObserver !== 'function') return;
    const mo = new MutationObserver(function() {
      if (!ph.isConnected) { mo.disconnect(); return; }
      if (panel.children.length > 1) { ph.remove(); mo.disconnect(); }
    });
    mo.observe(panel, { childList: true });
  }
  function create({container, storageKey = '', tabs = [], onTabChange, onRender, onTabClose, initialActiveId} = {}) {
    if (!container) throw new Error('AppUISidebarTabs: container required');

    const definitions = [...tabs];
    const panels = Object.create(null);
    const cleanups = Object.create(null);
    const scope = AppUILifecycle.createScope();
    let destroyed = false;
    const buttonScopes=AppUILifecycle.createKeyedScopes({pagehide:false});
    scope.add(buttonScopes);
    let activeTab = null, tabBinding = null;
    const activation=AppUILifecycle.generation();
    scope.add(()=>tabBinding?.destroy());
    let activeId = initialActiveId === 0 ? 0 : (initialActiveId || _load() || '');

    function _load() {
      return storageKey ? AppUIStorage.get(storageKey + ':active', '') : '';
    }
    function _save() {
      if (storageKey) AppUIStorage.set(storageKey + ':active', activeId);
    }

    // Build DOM
    const {tabBar, panelHost} = window._AppUISidebarTabView.frame();
    const overflow = _AppUISidebarTabOverflow.create(tabBar);
    scope.add(overflow);
    const tabRow = overflow.element, _scheduleNav = overflow.schedule;
    container.append(tabRow, panelHost);
    if (definitions.length <= 1) tabRow.hidden = true;

    function activate(tab) {
      if (destroyed || !definitions.includes(tab)) return;
      const version=activation.next();
      tabBinding?.switch(String(tab.id),false);
      if (activeTab && activeTab.id !== tab.id) activeTab.deactivate?.(panels[activeTab.id]);
      if(destroyed||!activation.isCurrent(version)||!definitions.includes(tab))return;
      tabBar.querySelectorAll('.ai-app-sidebar-tab').forEach(function(button) {
        button.classList.toggle('active', String(button.dataset.tabId) === String(tab.id));
        button.setAttribute('aria-selected', String(String(button.dataset.tabId) === String(tab.id)));
        button.tabIndex = String(button.dataset.tabId) === String(tab.id) ? 0 : -1;
        if (String(button.dataset.tabId) === String(tab.id)) {
          // Keep the active tab visible when the strip overflows + is scrolled.
          try { button.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (e) {}
        }
      });
      Object.values(panels).forEach(function(p) { p.style.display = 'none'; });
      if (!panels[tab.id]) {
        var tabPanel = window._AppUISidebarTabView.panel(tab);
        panelHost.appendChild(tabPanel);
        const owner=AppUILifecycle.createScope();
        cleanups[tab.id]=()=>owner.destroy();
        panels[tab.id] = tabPanel;
        owner.add(onRender ? onRender(tab, tabPanel) : tab.render?.(tabPanel));
        _dropPlaceholder(tabPanel);
      }
      if(destroyed||!activation.isCurrent(version)||!definitions.includes(tab)||!panels[tab.id])return;
      panels[tab.id].style.display = '';
      activeTab = tab;
      activeId = tab.id;
      tab.activate?.(panels[tab.id]);
      if(destroyed||!activation.isCurrent(version)||!definitions.includes(tab))return;
      _save();
      if (onTabChange) onTabChange(tab.id, panels[tab.id]);
      if(destroyed||!activation.isCurrent(version)||!definitions.includes(tab))return;
      container.dispatchEvent(new CustomEvent('appui:sidebar-tab-change', {
        detail: {id: tab.id, panel: panels[tab.id]},
      }));
    }

    // Render tab buttons
    function appendButton(tab) {
      const owner=buttonScopes.begin(tab);
      var button = window._AppUISidebarTabView.button(tab, definitions.indexOf(tab));
      // CLOSE via RIGHT-CLICK context menu (no × button) for a closable tab —
      // the shared tab engine's close affordance (lifted from the workspace
      // shim per TODO.sidebar-chat #99 so every app page gets it). Built-in
      // (non-closable) tabs let the native menu through.
      owner.listen(button, 'contextmenu', function (event) {
        var items = [];
        if (tab.closable) {
          items.push({ label: 'Close', action: function () { publicApi.removeTab(tab.id); } });
          var others = definitions.filter(function (t) { return t.closable && t.id !== tab.id; });
          if (others.length) {
            items.push({ label: 'Close others', action: function () {
              others.slice().forEach(function (t) { publicApi.removeTab(t.id); }); } });
          }
        }
        if (!items.length) return;
        event.preventDefault(); event.stopPropagation();
        if (window.AppUIContextMenu && window.AppUIContextMenu.show) {
          window.AppUIContextMenu.show(event, items);
        } else if (window.AppUIAssets && window.AppUIAssets.load) {
          window.AppUIAssets.load('contextMenu').then(function () {
            window.AppUIContextMenu && window.AppUIContextMenu.show(event, items);
          }).catch(function () {});
        }
      });
      window._AppUITabsBinding.bindDrag({element:button,listen:owner.listen.bind(owner),
        isCurrent:()=>!destroyed&&!owner.destroyed&&definitions.includes(tab),draggingClass:'ai-tab-dragging',
        onStart:event=>event.dataTransfer.setData('text/plain',String(definitions.indexOf(tab))),
        onDrop:event=>{
          var fromIndex=Number.parseInt(event.dataTransfer.getData('text/plain'),10);
          var index=definitions.indexOf(tab);
          if(index<0||fromIndex===index||!definitions[fromIndex])return;
          var buttons=Array.from(tabBar.children);
          tabBar.insertBefore(buttons[fromIndex],fromIndex<index?buttons[index].nextSibling:buttons[index]);
          var moved=definitions.splice(fromIndex,1)[0];definitions.splice(index,0,moved);
          bindButtons();
        },
      });
      tabBar.appendChild(button);
    }
    function findButton(id) { return Array.from(tabBar.children).find(function(button) { return String(button.dataset.tabId) === String(id); }); }
    function bindButtons() {
      if(destroyed)return;
      tabBinding?.destroy();
      tabBinding=window.AppUITabNavigation.bind({container:tabBar,selector:'[data-tab-id]',
        getId:button=>String(button.dataset.tabId),
        onSwitch:({id})=>{const tab=definitions.find(def=>String(def.id)===id);if(tab)activate(tab);},
      });
      if(activeTab)tabBinding.switch(String(activeTab.id),false);
    }
    definitions.forEach(appendButton);
    bindButtons();

    // Activate initial tab
    var initial = (activeId !== '' && activeId != null && definitions.find(function(t) { return String(t.id) === String(activeId); }))
      || definitions.find(function(t) { return t.active; })
      || definitions[0];
    if (initial) activate(initial);

    var publicApi = {
      switchTo: function(id) {
        var tab = definitions.find(function(t) { return t.id === id; });
        if (tab) activate(tab);
      },
      addTab: function(def) {
        if (destroyed) return;
        if (definitions.some(function(t) { return t.id === def.id; })) return;
        definitions.push(def);
        tabRow.hidden = definitions.length <= 1;
        appendButton(def);
        bindButtons();
        _scheduleNav();
        if (!activeTab) activate(def);
      },
      removeTab: function(id) {
        if (destroyed) return;
        var idx = definitions.findIndex(function(t) { return t.id === id; });
        if (idx === -1) return;
        if (activeId === id) {
          const previous=activeTab;activeTab=null;activeId='';
          previous?.deactivate?.(panels[id]);
          if(destroyed)return;
          idx=definitions.findIndex(t=>t.id===id);if(idx<0)return;
        }
        const removed=definitions[idx],button=findButton(id),cleanup=cleanups[id],panel=panels[id];
        definitions.splice(idx,1);delete cleanups[id];delete panels[id];
        buttonScopes.destroy(removed);
        button?.remove();panel?.remove();cleanup?.();
        try { if (onTabClose) onTabClose(id); } catch (e) {}
        if(destroyed)return;
        tabRow.hidden = definitions.length <= 1;
        bindButtons();
        _scheduleNav();
        if (!activeTab && definitions.length) activate(definitions[0]);
      },
      getActiveId: function() { return activeId; },
      getTabs: function() { return definitions.map(function(t) { return {id: t.id, label: t.label}; }); },
      getPanel: function(id) { return panels[id] || null; },
      showPane: function(id) {
        if (destroyed) return;
        var btn = findButton(id);
        if (btn) btn.hidden = false;
        tabRow.hidden = Array.from(tabBar.children).filter(function(b) { return !b.hidden; }).length <= 1;
        _scheduleNav();
      },
      hidePane: function(id) {
        if (destroyed) return;
        var btn = findButton(id);
        if (btn) btn.hidden = true;
        if (panels[id]) panels[id].style.display = 'none';
        tabRow.hidden = Array.from(tabBar.children).filter(function(b) { return !b.hidden; }).length <= 1;
        _scheduleNav();
        if (activeId === id) {
          var visible = definitions.find(function(d) { var b = findButton(d.id); return b && !b.hidden; });
          if (visible) activate(visible);
        }
      },
      togglePane: function(id) {
        var btn = findButton(id);
        if (btn && btn.hidden) this.showPane(id);
        else this.hidePane(id);
      },
      isPaneVisible: function(id) {
        var btn = findButton(id);
        return btn ? !btn.hidden : false;
      },
      getPaneIds: function() { return definitions.map(function(d) { return d.id; }); },
      destroy: function() {
        if (destroyed) return;
        destroyed = true;
        const teardown=AppUILifecycle.createScope(),previous=activeTab,previousPanel=panels[activeId];
        teardown.add(()=>{
          for (const id in panels) delete panels[id];
          container.replaceChildren();definitions.length=0;activeTab=null;
        });
        Object.keys(cleanups).reverse().forEach(id=>{
          teardown.add(cleanups[id]);delete cleanups[id];
        });
        teardown.add(()=>{try {previous?.deactivate?.(previousPanel);} finally {activeId='';}});
        teardown.add(scope);
        teardown.destroy();
      },
    };
    return publicApi;
  }
  return {create: create};
})();
window.AppUISidebarTabs = AppUISidebarTabs;

;
/* Sidebar rendering with pluggable type registry.
 *
 * Supported tab/sidebar types:
 *   render: (el) => {}        — custom render callback (default)
 *   type: 'ai-sidebar'        — AI chat assistant panel
 *   type: 'file-explorer'     — file tree with roots, watch, select
 *   type: 'sections'          — collapsible sections with hash routing
 *   type: 'toolbar'           — toolbar component
 *
 * Pages can register custom types:
 *   AppUIShellSidebarRenderer.registerType('my-type', (spec, container) => { ... });
 */
window.AppUIShellSidebarRenderer = (() => {
  const _types = Object.create(null);

  function registerType(name, handler) {
    _types[name] = handler;
  }

  // Every optional sidebar panel follows the same load/mount/dispose path.
  function mountLazy({container,bundle,loaded,createPanel,onMount,loading,unavailable}) {
    const owner=window.AppUILifecycle.createScope();
    let destroyed=false;
    function mount() {
      if(destroyed)return;
      const panel=createPanel();
      owner.add(panel);
      if(destroyed)return;
      try {owner.add(onMount?.(panel));}
      catch(error){owner.destroy();throw error;}
    }
    if(loaded())mount();
    else {
      container.textContent=loading;
      window.AppUI.load(bundle).then(mount).catch(error=>{
        if(!destroyed)container.textContent=unavailable+error.message;
      });
    }
    return()=>{
      if(destroyed)return;destroyed=true;
      owner.destroy();
    };
  }

  registerType('ai-sidebar',(spec,container,ctx)=>mountLazy({
    container,bundle:'aiSidebar',loaded:()=>window.AppUIAISidebarFeature,
    createPanel:()=>ctx.initAISidebar(container,spec),
    loading:'Loading assistant...',unavailable:'Assistant unavailable: ',
  }));

  registerType('file-explorer',(spec,container)=>mountLazy({
    container,bundle:'fileExplorer',loaded:()=>window.AppUIFileExplorer,onMount:panel=>spec.onMount?.(panel),
    loading:'Loading files...',unavailable:'File browser unavailable: ',
    createPanel(){
      const Explorer=window.AppUIFileExplorer;
      if(!Explorer)throw new Error('FileExplorer not loaded');
      const config=spec.config||spec;
      container.replaceChildren();
      return Explorer.create({...config,container,roots:config.roots||[],
        watchPaths:config.watchPaths||config.watch||[],storageKey:config.storageKey||'file-explorer'});
    },
  }));

  registerType('chat',(spec,container)=>mountLazy({
    container,bundle:'aiSidebar',loaded:()=>window.AppUIChat,onMount:panel=>spec.onMount?.(panel),
    loading:'Loading chat...',unavailable:'Chat unavailable: ',
    createPanel(){
      const Chat=window.AppUIChat;
      if(!Chat)throw new Error('Chat not loaded');
      container.replaceChildren();
      return Chat.create({...spec.config,container});
    },
  }));

  // Built-in type: sections
  registerType('sections', (spec, container) => {
    const Sections = window.AppUISidebarSections;
    if (!Sections) { container.textContent = 'SidebarSections not loaded'; return; }
    const config = spec.config || spec;
    const sections = Sections.create({
      container,
      storageKey: config.storageKey || '',
      sections: config.sections || [],
      hashRouting: config.hashRouting !== false,
      onNavigate: config.onNavigate,
    });
    return () => sections.destroy();
  });

  // Built-in type: toolbar
  registerType('toolbar', (spec, container) => {
    const Toolbar = window.AppUIToolbar;
    if (!Toolbar) { container.textContent = 'Toolbar not loaded'; return; }
    const config = spec.config || spec;
    const toolbar = Toolbar.create({
      container,
      title: config.title,
      subtitle: config.subtitle,
      items: config.items || [],
      right: config.right || [],
      onCommand: config.onCommand,
    });
    return () => toolbar.destroy();
  });

  function renderPanel(spec, container, ctx) {
    if (spec.type && _types[spec.type]) {
      return _types[spec.type](spec, container, ctx);
    }
    return ctx.renderSlot(spec, container);
  }

  function render({sidebar, container, position, el, renderSlot, initAISidebar, discoverPlugins, layout, writeLayout, setTabs}) {
    const ctx = {renderSlot, initAISidebar};

    // No tabs — render single panel directly
    if (!Array.isArray(sidebar.tabs) || !sidebar.tabs.length) {
      return renderPanel(sidebar, container, ctx);
    }
    if (sidebar.tabs.length === 1 && !discoverPlugins(position).length) {
      return renderPanel(sidebar.tabs[0], container, ctx);
    }

    // Build tab list: page config + discovered plugins
    const tabs = sidebar.tabs.map((tab, index) => Object.assign({id: 'tab-' + index}, tab));
    discoverPlugins(position).forEach(plugin => {
      if (!tabs.some(tab => tab.id === plugin.id)) tabs.push(plugin);
    });

    // Create the unified tab host
    const tabHost = window.AppUISidebarTabs.create({
      container,
      storageKey: 'appui-sidebar-' + position,
      tabs,
      initialActiveId: layout[position + 'Tab'],
      onRender: (tab, panel) => renderPanel(tab, panel, ctx),
      onTabChange: (id) => {
        layout[position + 'Tab'] = id;
        writeLayout();
      },
    });

    // Expose to shell for programmatic tab activation
    setTabs({
      tabs,
      activate: tab => tabHost.switchTo(tab.id),
      active: () => tabHost.getActiveId(),
    });

    // Register as pane controller for View menu toggles
    if (window.AppUIShellCommands?.registerPaneController) {
      window.AppUIShellCommands.registerPaneController(position, tabHost);
    }
    return () => tabHost.destroy();
  }

  return {render, registerType};
})();

;
/* Status-bar composition is separate from page and shell lifecycle. */
window.AppUIShellStatusRenderer = {
  mountRight({config, elements, renderSlot, trackCleanup, right}) {
    const daemonConfig = this.serviceConfig(config);
    const daemonStatusFeature = window.AppUIDaemonStatus;
    if (daemonStatusFeature && daemonConfig) {
      const daemons = Array.isArray(daemonConfig) ? daemonConfig : [daemonConfig];
      const indicators = daemons.filter(Boolean).map(config => daemonStatusFeature.mount(elements.statusRight, config));
      trackCleanup(() => indicators.forEach(i => i?.destroy?.()));
    }
    renderSlot(right, elements.statusRight);
    // Dark/light theme toggle in statusbar
    if (elements.statusRight && window.AppUIShellThemeToggle) {
      trackCleanup(AppUIShellThemeToggle.mount(elements.statusRight));
    }
  },
  serviceConfig(statusBar) {
    if (!statusBar || typeof statusBar !== 'object') return null;
    if (statusBar.services) {
      return Object.assign({}, statusBar.serviceStatus || {}, {services: statusBar.services});
    }
    return statusBar.serviceStatus || statusBar.daemon || statusBar.daemons || null;
  },
  mount({config, elements, region, renderSlot, trackCleanup}) {
    if (config.status) {
      renderSlot(config.status, elements.statusMain);
      return null;
    }
    if (config.render) {
      renderSlot(container => config.render(container), elements.statusMain);
      return null;
    }
    const mounted = region.mountDefault({component: AppUIStatusBar, sections: config.sections});
    if (mounted.logButton) trackCleanup(() => mounted.logButton.destroy());
    return mounted.statusBar;
  },
};

;
/* Merge registered commands and menu actions for the shared command palette. */
window.AppUIShellPaletteRenderer={
  sync({palette,definitions,available,menuActions,runCommand,triggerMenu}) {
    const known=new Set(definitions.map(command=>command.id)),labels=new Map();
    for(const item of menuActions)if(!labels.has(item.id))labels.set(item.id,item);
    const commands=available.map(command=>{
      const item=labels.get(command.id);
      return {name:command.label || item?.label || command.id,category:command.category || item?.menu || 'Actions',shortcut:command.shortcut || item?.shortcut || '',action:()=>runCommand(command.id,{}, {type:'palette'})};
    });
    for(const item of menuActions){
      if(!item.id || known.has(item.id) || item.id.startsWith('_sub_'))continue;
      known.add(item.id);commands.push({name:item.label || item.id,category:item.menu || 'Actions',shortcut:item.shortcut || '',action:()=>triggerMenu(item.menu,item.id)});
    }
    palette.init({commands});palette.setCommands(commands);return commands;
  },
};

;
/* AI-sidebar feature mounting and its unavailable-feature fallback. */
window.AppUIShellAISidebarRenderer = {
  mount({container, sidebar, pipeline, appId}) {
    return AppUIAISidebarFeature.mount({container, sidebar, pipeline, appId});
  },
};

;
/* Pipeline loading is cancellable infrastructure, not shell rendering. */
window.AppUIShellPipelineLoader = {
  load(pipelineId, {isCurrent, onPipeline}) {
    if (!pipelineId) return null;
    const controller = new AbortController();
    fetch('/api/pipeline.get', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: pipelineId}), signal: controller.signal,
    }).then(response => response.json()).then(data => {
      if (!isCurrent()) return;
      // API errors can be JSON responses; only accept actual pipeline data.
      onPipeline(data?.menu ? data : null);
    }).catch(() => {});
    return controller;
  },
};

;
/* Shell mounting: template validation and content region mounting. */

/* The versioned AppUI DOM contract is validated before shell rendering. */
window.AppUIShellTemplateMounter = {
  mount() {
    return this.map(AppUITemplate.mount().regions);
  },
  reset() {
    document.querySelectorAll('[data-appui-owned="true"]').forEach(el => el.remove());
    for (const id of ['app-menubar', 'app-left', 'app-content-top', 'app-content-body',
        'app-content-bottom', 'app-right', 'app-statusbar']) {
        const region = document.getElementById(id);
        if (!region) continue;
        region.replaceChildren();
        region.hidden = false;
        region.classList.remove('ai-app-hidden');
        region.style.removeProperty('width');
    }
    document.body.classList.remove('ai-app-body', 'ai-app-compact', 'ai-app-compact-left-open', 'ai-app-compact-right-open');
  },
  map(regions) {
    return {
      menuBar: regions['app-menubar'], main: regions['app-main'], left: regions['app-left'],
      content: regions['app-content'], contentTop: regions['app-content-top'],
      contentBody: regions['app-content-body'], contentBottom: regions['app-content-bottom'],
      right: regions['app-right'], status: regions['app-statusbar'],
    };
  },
};

/* Content-region mounting is independent of the surrounding shell lifecycle. */
window.AppUIShellContentMounter = {
  mount({config, region, runCommand}) {
    if (!config) return null;
    const contentConfig = Object.assign({}, config, {
      onCommand: config.onCommand || ((command, params, context) => runCommand(command, params, context)),
    });
    return region.mount(contentConfig);
  },
};

/* Region construction and initial visibility; the shell retains lifecycle ownership. */
window.AppUIShellRegionMounter = {
  create({elements, layout, persist}) {
    const {main, menuBar, left, content, right, status, contentTop, contentBody, contentBottom} = elements;
    return {
      menubar: AppUIMenubarRegion.create(menuBar),
      left: AppUISidebarRegion.create({element: left, main, position: 'left', layout, persist}),
      content: AppUIContentRegion.create({element: content, top: contentTop, body: contentBody, bottom: contentBottom}),
      right: AppUISidebarRegion.create({element: right, main, position: 'right', layout, persist}),
      statusbar: AppUIStatusbarRegion.create(status),
    };
  },
  mount({regions, elements, config, buildResponsiveRail}) {
    const menuSlots = regions.menubar.mount({visible: config.menubar !== false});
    elements.menu = menuSlots.menu; elements.menuRight = menuSlots.right;
    regions.left.mount(config.sidebar !== false ? config.leftSidebar : null);
    regions.right.mount(config.sidebar !== false ? config.rightSidebar : null);
    buildResponsiveRail(elements.main);
    const statusSlots = regions.statusbar.mount({visible: config.statusbar !== false && !!config.statusBar});
    elements.statusMain = statusSlots.main; elements.statusRight = statusSlots.right;
  },
};

;
/* Breadcrumb navigation bar for AppUI shell.
 * API: AppUI.breadcrumb.set(['Platform', 'Page', 'Section'])
 */
window.AppUIShellBreadcrumb = (function() {
  let _el = null, _segs = [];
  let _router = null, _routerConfig = null;
  let _initialized = false;
  let _readyHandler = null;
  const initFrame = AppUILifecycle.createFrameTask(init);

  function el() {
    if (_el && _el.isConnected) return _el;
    const top = document.getElementById('app-content-top');
    if (!top) return null;
    _el = top.querySelector('.breadcrumb-bar');
    if (!_el) { _el = document.createElement('nav'); _el.className = 'breadcrumb-bar'; _el.setAttribute('aria-label', 'Breadcrumb'); top.insertBefore(_el, top.firstChild); }
    return _el;
  }

  function render() {
    const c = el(); if (!c) return;
    const ol = document.createElement('ol'); ol.className = 'breadcrumb-list';
    for (let i = 0; i < _segs.length; i++) {
      const li = document.createElement('li'); li.className = 'breadcrumb-item';
      if (i === _segs.length - 1) { li.innerHTML = `<span class="breadcrumb-current" aria-current="page">${esc(_segs[i])}</span>`; }
      else { li.innerHTML = `<a class="breadcrumb-link" href="#">${esc(_segs[i])}</a><span class="breadcrumb-sep" aria-hidden="true">›</span>`; li.querySelector('a').onclick = e => { e.preventDefault(); nav(i); }; }
      ol.appendChild(li);
    }
    c.innerHTML = ''; c.appendChild(ol);
  }

  function nav(i) {
    if (i === 0) { window.location.href = '/pages/framework/manager/'; return; }
    _segs = _segs.slice(0, i + 1); render();
    if (i === 1 && location.hash) history.pushState(null, '', location.pathname);
  }

  function esc(s) { const d = document.createElement('span'); d.textContent = s; return d.innerHTML; }

  /** Build breadcrumb segments from router hash params using the mapping config. */
  function buildRouterSegments() {
    const t = document.body.getAttribute('data-page-title') || document.title || 'Page';
    const base = ['Platform', t];
    if (!_router || !_routerConfig || !_routerConfig.mapping) return base;
    const mapped = [];
    for (let i = 0; i < _routerConfig.mapping.length; i++) {
      const m = _routerConfig.mapping[i];
      const val = _router.getHash(m.param);
      if (val === null || val === '') continue;
      let display;
      if (typeof m.label === 'function') { display = m.label(val); }
      else if (typeof m.format === 'function') { display = m.format(val); }
      else if (typeof m.label === 'string') { display = m.label; }
      else { display = val; }
      if (display) mapped.push(String(display));
    }
    return base.concat(mapped);
  }

  /** Handle hash/route change — uses router mapping if connected, raw hash otherwise. */
  function onHashChange() {
    if (_router && _routerConfig) {
      _segs = buildRouterSegments(); render();
    } else {
      const h = location.hash.replace(/^#\/?/, '');
      if (h) { const t2 = document.body.getAttribute('data-page-title') || document.title || 'Page'; _segs = ['Platform', t2, decodeURIComponent(h).replace(/[/_-]/g, ' ')]; render(); }
    }
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    const t = document.body.getAttribute('data-page-title') || document.title || 'Page';
    _segs = ['Platform', t]; render();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
  }

  function destroy() {
    if (_readyHandler) document.removeEventListener('DOMContentLoaded', _readyHandler);
    initFrame.cancel();
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('popstate', onHashChange);
    _el?.remove();
    _el = null; _router = null; _routerConfig = null;
    _readyHandler = null; _initialized = false;
  }

  const scheduleInit = () => initFrame.schedule();
  if (document.readyState === 'loading') {
    _readyHandler = () => { _readyHandler = null; scheduleInit(); };
    document.addEventListener('DOMContentLoaded', _readyHandler, {once: true});
  } else scheduleInit();

  return {
    set(segs) { if (Array.isArray(segs) && segs.length) { _segs = segs.map(String); render(); } },
    push(s) { _segs.push(String(s)); render(); },
    pop() { if (_segs.length > 1) { _segs.pop(); render(); } },
    get() { return [..._segs]; },
    init,
    destroy,

    /**
     * Connect an AppUIRouter instance so breadcrumbs auto-update from hash params.
     * @param {object} router - AppUIRouter.create() instance with getHash() method
     * @param {object} config - { mapping: [{param, label?, format?}] }
     *   - param: hash param key to read from the router
     *   - label: string for static display, or function(value) => display text
     *   - format: function(value) => display text (used when label is not a function)
     */
    connectRouter(router, config) {
      if (!router || typeof router.getHash !== 'function') return;
      _router = router; _routerConfig = config || {};
      // Immediately rebuild from current hash state
      _segs = buildRouterSegments(); render();
    },

    /** Disconnect router integration; reverts to raw-hash breadcrumb behaviour. */
    disconnectRouter() { _router = null; _routerConfig = null; },
  };
})();

;
/* Shell layout: sidebar tab switching, status sections, layout persistence, sidebar resize controls. */

/* Public sidebar-tab activation adapter. */
window.AppUIShellSidebarTabs = {
  create(getTabs) {
    return {
      activate(position, id) {
        const sidebar = getTabs()[position], tab = sidebar?.tabs.find(item => item.id === id);
        if (!tab) return false;
        sidebar.activate(tab); return true;
      },
    };
  },
};

/* Status rendering adapter. */
window.AppUIShellStatus = {
  create(getStatusBar) {
    return {
      set(text, position) {
        const statusBar = getStatusBar();
        if (statusBar) return statusBar.set(position || 'main', text);
        const element = document.getElementById(position === 'right' ? 'appStatusRight' : 'appStatusLeft');
        if (element) element.textContent = text;
      },
    };
  },
};

/* Layout persistence bridge for the shell. */
window.AppUIShellLayoutStorage = {
  create({getAppId, getState, getLayout}) {
    const key = () => `pylon/appui/layout/${getAppId() || 'page'}`;
    return {
      read() { const state = getState(); return state ? state.all() : (AppUIStorage.getJSON(key(), {}) || {}); },
      write() { const state = getState(); return state ? state.replace(getLayout()) : AppUIStorage.setJSON(key(), getLayout()); },
    };
  },
};

/* Sidebar visibility controls; shell supplies region and layout state. */
window.AppUIShellSidebarControls = {
  create({elements, regions, layout, saveLayout}) {
    function toggle(side) {
      const element = elements()[side]; if (!element) return;
      if (document.body.classList.contains('ai-app-compact')) {
        const className = `ai-app-compact-${side}-open`, opening = !document.body.classList.contains(className);
        document.body.classList.toggle(className, opening);
        document.body.classList.remove(`ai-app-compact-${side === 'left' ? 'right' : 'left'}-open`);
        if (opening) element.classList.remove('ai-app-hidden');
        return;
      }
      const region = regions()[side]; if (region) return region.toggle();
      element.classList.toggle('ai-app-hidden'); layout()[`${side}Collapsed`] = element.classList.contains('ai-app-hidden'); saveLayout();
    }
    return {toggleLeft: () => toggle('left'), toggleRight: () => toggle('right')};
  },
};

;
/* Declarative toolbar renderer; command dispatch is supplied by the shell. */
window.AppUIShellToolbar = {
  create({el, runCommand}) {
    return {
      render(container, items = [], onAction) {
        if (!container) return null;
        const bar = el('div', 'ai-app-toolbar');
        for (const item of items) {
          if (item.separator) { bar.appendChild(el('div', 'ai-app-toolbar-sep')); continue; }
          const button = el('button', `ai-app-toolbar-btn${item.primary ? ' ai-app-toolbar-primary' : ''}`);
          button.type = 'button'; button.title = item.tooltip || item.label || item.id; button.textContent = `${item.icon ? `${item.icon} ` : ''}${item.label || ''}`;
          button.disabled = !!item.disabled; if (item.id) button.dataset.action = item.id;
          button.addEventListener('click', () => { if (item.action) item.action(); else if (onAction) onAction(item.id); else if (item.command) runCommand(item.command); });
          bar.appendChild(button);
        }
        container.appendChild(bar); return bar;
      },
    };
  },
};

;
/* Query/hash route behavior, with the shared router used when available. */
window.AppUIShellRoutes = {
  create({getAppId, getRouter, onRoute}) {
    const prefix = () => `appui.${getAppId() || 'page'}.`, hashes = () => new URLSearchParams(location.hash.replace(/^#/, ''));
    const get = key => getRouter()?.get(key) ?? new URLSearchParams(location.search).get(prefix() + key);
    const set = (key, value, silent) => { const router = getRouter(); if (router) { router.set(key, value, {replace: true, silent: true}); if (!silent) onRoute(key, value); return; } const url = new URL(location.href), name = prefix() + key; if (value == null || value === '') url.searchParams.delete(name); else url.searchParams.set(name, value); history.replaceState(history.state, '', url); if (!silent) onRoute(key, value); };
    const getHash = key => getRouter()?.getHash(key) ?? hashes().get(key);
    const setHashes = (routes, options) => { const router = getRouter(); if (router) { router.setHash(routes, Object.assign({replace: false, silent: false, reset: false}, options)); return true; } const settings = Object.assign({replace: false, silent: false, reset: false}, options), params = settings.reset ? new URLSearchParams() : hashes(); Object.entries(routes || {}).forEach(([key, value]) => value == null || value === '' ? params.delete(key) : params.set(key, String(value))); const url = new URL(location.href); url.hash = params.toString() || ''; if (url.href === location.href) return false; history[settings.replace ? 'replaceState' : 'pushState'](history.state, '', url); if (!settings.silent) onRoute(null, null); return true; };
    const bind = () => { if (getRouter()) return null; const listener = () => onRoute(null, null); addEventListener('popstate', listener); addEventListener('hashchange', listener); return listener; };
    return {get, set, hashes, getHash, setHash: (key, value, options) => setHashes({[key]: value}, options), setHashes, bind};
  },
};

;
/* Responsive shell behavior: compact mode and sidebar control rail. */
const AppUIResponsiveShell = (function() {
  function create({main, left, right, hasLeft, hasRight, layout, onToggleLeft, onToggleRight}) {
    let mediaQuery = null;
    let listener = null;
    let rail = null;

    if (hasLeft || hasRight) {
      rail = document.createElement('div');
      rail.className = 'ai-app-sidebar-rail';
      rail.dataset.appuiOwned = 'true';
      rail.setAttribute('aria-label', 'Sidebar controls');
      if (hasLeft) rail.appendChild(button('Left', 'Toggle left sidebar', onToggleLeft));
      if (hasRight) rail.appendChild(button('Right', 'Toggle right sidebar', onToggleRight));
      main?.appendChild(rail);
    }

    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(max-width: 850px)');
      listener = () => {
        document.body.classList.toggle('ai-app-compact', mediaQuery.matches);
        if (!mediaQuery.matches) {
          document.body.classList.remove('ai-app-compact-left-open', 'ai-app-compact-right-open');
          left?.classList.toggle('ai-app-hidden', !!layout.leftCollapsed);
          right?.classList.toggle('ai-app-hidden', !!layout.rightCollapsed);
        }
      };
      mediaQuery.addEventListener('change', listener);
      listener();
    }

    return {
      rail,
      destroy() {
        if (mediaQuery && listener) mediaQuery.removeEventListener('change', listener);
        rail?.remove();
        mediaQuery = null;
        listener = null;
        rail = null;
      },
    };
  }

  function button(label, title, onClick) {
    const element = document.createElement('button');
    element.type = 'button';
    element.title = title;
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
  }

  return {create};
})();
window.AppUIResponsiveShell = AppUIResponsiveShell;

;
/**
 * AppUI Shell Layout  --  shared shell styles and sidebar drag handles.
 * Extracted from shell/app.js for modularity.
 *
 * Exposes: window.AppUIShellLayout
 */
(function() {
  'use strict';

  function _el(tag, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function beginResize(handle) {
    if (document.querySelector('.appui-resize-shield')) return () => {};
    const shield = _el('div', 'appui-resize-shield');
    shield.setAttribute('aria-hidden', 'true');
    document.body.appendChild(shield);
    document.body.classList.add('appui-sidebar-resizing');
    handle?.classList.add('active');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      shield.remove();
      document.body.classList.remove('appui-sidebar-resizing');
      handle?.classList.remove('active');
      window.removeEventListener('blur', finish);
      window.dispatchEvent(new CustomEvent('appui:sidebar-resized'));
    };
    window.addEventListener('blur', finish);
    return finish;
  }

  function makeDraggable(handle, target, prop, min, max, reverse, layoutKey, layout, writeLayout) {
    let startX, startVal;
    let cancelActive = null;
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      const finishResize = beginResize(handle);
      startX = e.clientX;
      // Prefer the PERSISTED layout value over getComputedStyle(target)[prop]:
      // reading a computed style forces a synchronous reflow, which on a page
      // showing a very large document (e.g. a 30MB combined spec) can cost
      // 200ms+ at drag-start ("[Violation] mousedown handler took …"). The
      // persisted layout[layoutKey] is the same width without the layout flush;
      // fall back to the computed style only when it isn't available.
      const _persisted = layoutKey && layout && Number.isFinite(parseInt(layout[layoutKey], 10))
        ? parseInt(layout[layoutKey], 10) : NaN;
      startVal = Number.isFinite(_persisted) ? _persisted : parseInt(getComputedStyle(target)[prop]);
      let active = true;
      const onMove = (e) => {
        const delta = reverse ? startX - e.clientX : e.clientX - startX;
        const val = Math.max(min, Math.min(max, startVal + delta));
        target.style[prop] = val + 'px';
      };
      const onUp = () => {
        if (!active) return;
        active = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        window.removeEventListener('blur', onUp);
        if (layoutKey) {
          layout[layoutKey] = parseInt(target.style[prop], 10);
          writeLayout?.();
        }
        finishResize();
        cancelActive = null;
      };
      cancelActive = onUp;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      window.addEventListener('blur', onUp);
    };
    handle.addEventListener('mousedown', onMouseDown);
    return () => {
      cancelActive?.();
      handle.removeEventListener('mousedown', onMouseDown);
    };
  }

  function injectStyles() {
    if (document.getElementById('appui-styles')) return;
    const link = document.createElement('link');
    link.id = 'appui-styles';
    link.rel = 'stylesheet';
    const assets = window.AppUIAssets;
    if (!assets?.base || !assets?.css) return;
    link.href = assets.base + assets.css;
    document.head.appendChild(link);
  }

  window.AppUIShellLayout = {
    beginResize,
    makeDraggable,
    injectStyles,
  };
})();

;
/**
 * AppUI Shell Commands  --  command registration, keyboard shortcuts, view menu.
 * Extracted from shell/app.js for modularity.
 *
 * Exposes: window.AppUIShellCommands
 */
(function() {
  'use strict';

  function normalizeShortcut(shortcut) {
    return AppUIShortcuts.normalize(shortcut);
  }

  /**
   * Build view menu items for the layout.
   * @param {object} config - app config
   * @returns {Array} view menu item definitions
   */
  function buildViewMenuItems(config) {
    const viewItems = [];
    if (config.leftSidebar) viewItems.push({ id: 'view.toggle_left', label: 'Toggle Left Sidebar', shortcut: 'Ctrl+Shift+L' });
    if (config.rightSidebar) viewItems.push({ id: 'view.toggle_right', label: 'Toggle Right Sidebar', shortcut: 'Ctrl+Shift+R' });
    if (config.leftSidebar) viewItems.push({ id: 'view.float_left', label: 'Float Left Sidebar' });
    if (config.rightSidebar) viewItems.push({ id: 'view.float_right', label: 'Float Right Sidebar' });
    if (config.statusBar || config.statusbar) viewItems.push({ id: 'view.toggle_statusbar', label: 'Toggle Status Bar' });
    viewItems.push({ id: 'view.sidebar_gallery', label: 'Sidebar Gallery…' });
    viewItems.push({ id: 'view.api_inspector', label: 'API Inspector', shortcut: 'Ctrl+Shift+I' });
    viewItems.push({ id: 'view.appui_diagnostics', label: 'AppUI Diagnostics' });
    const panes = collectPaneIds(config);
    ['left', 'right', 'content'].forEach(region => {
      const regionPanes = panes.filter(pane => pane.region === region);
      if (!regionPanes.length) return;
      const labels = {left: 'Left Sidebar', right: 'Right Sidebar', content: 'Content'};
      viewItems.push({ separator: true });
      viewItems.push({id: '_sub_' + region, label: labels[region], submenu: regionPanes.map(pane => ({
        id: `view.pane.${region}.${pane.id}`, label: pane.label || pane.id,
        checked: () => isPaneVisible(region, pane.id),
      }))});
    });
    return viewItems;
  }

  function collectPaneIds(config) {
    const panes = [];
    // Content body tabs/accordion
    const body = config.content?.body || config.content;
    if (body?.type === 'tabs' && body.tabs) {
      body.tabs.forEach(t => panes.push({ id: t.id, label: t.label || t.id, region: 'content' }));
    }
    if (body?.type === 'accordion' && body.sections) {
      body.sections.forEach(s => panes.push({ id: s.id, label: s.label || s.id, region: 'content' }));
    }
    // Left sidebar tabs
    if (config.leftSidebar?.tabs) {
      config.leftSidebar.tabs.forEach(t => panes.push({ id: t.id, label: t.label || t.id, region: 'left' }));
    }
    // Right sidebar tabs
    if (config.rightSidebar?.tabs) {
      config.rightSidebar.tabs.forEach(t => panes.push({ id: t.id, label: t.label || t.id, region: 'right' }));
    }
    return panes;
  }

  // Pane visibility state — set by the shell after content/sidebars render
  let _paneControllers = {};
  function registerPaneController(region, controller) { _paneControllers[region] = controller; }
  function isPaneVisible(region, id) {
    const c = _paneControllers[region];
    return c?.isPaneVisible ? c.isPaneVisible(id) : true;
  }
  function togglePane(region, id) {
    const c = _paneControllers[region];
    if (c?.togglePane) c.togglePane(id);
  }

  /**
   * Create built-in view command handlers.
   * @param {object} opts - {toggleLeftSidebar, toggleRightSidebar}
   * @returns {Array} command definitions
   */
  function buildViewCommands(opts) {
    const cmds = [
      { id: 'view.toggle_left', run: () => opts.toggleLeftSidebar() },
      { id: 'view.toggle_right', run: () => opts.toggleRightSidebar() },
      { id: 'view.float_left', run: () => { const f = window.AppUISidebarDockFeature; f?.toggleLeft?.(); } },
      { id: 'view.float_right', run: () => { const f = window.AppUISidebarDockFeature; f?.toggleRight?.(); } },
      { id: 'view.toggle_statusbar', run: () => { const sb = document.getElementById('app-statusbar'); if (sb) sb.hidden = !sb.hidden; } },
      { id: 'view.sidebar_gallery', run: () => openSidebarGallery(opts) },
      { id: 'view.api_inspector', run: () => {
        const toggle = () => window.AppUIApiInspector?.toggle();
        if (window.AppUIApiInspector) toggle();
        else window.AppUIAssets?.load?.('apiInspector').then(toggle);
      } },
      { id: 'view.appui_diagnostics', run: () => window.AppUI?.diagnostics?.open?.() },
    ];
    // Add pane toggle commands
    const panes = collectPaneIds(opts.config || {});
    panes.forEach(p => {
      cmds.push({ id: `view.pane.${p.region}.${p.id}`, run: () => togglePane(p.region, p.id) });
    });
    return cmds;
  }

  /**
   * Check if shortcuts are enabled for the given app.
   * @param {string} appId
   * @param {object} config
   * @returns {boolean}
   */
  function areShortcutsEnabled(appId, config) {
    const stored = AppUIStorage.get(`pylon/appui/shortcuts-enabled/${appId || 'global'}`);
    return stored === null ? config.shortcuts !== false : stored === 'true';
  }

  function setShortcutsEnabled(appId, enabled) {
    AppUIStorage.set(`pylon/appui/shortcuts-enabled/${appId || 'global'}`, !!enabled);
  }

  /**
   * Load custom shortcuts from localStorage.
   * @param {string} appId
   * @returns {object} mapping of commandId -> shortcut
   */
  function loadCustomShortcuts(appId) {
    return AppUIStorage.getJSON(`pylon/appui/keybindings/${appId || 'global'}`, {}) || {};
  }

  /**
   * Save a custom shortcut.
   * @param {string} appId
   * @param {string} commandId
   * @param {string} shortcut
   */
  function saveCustomShortcut(appId, commandId, shortcut) {
    const key = `pylon/appui/keybindings/${appId || 'global'}`;
    const stored = Object.assign(Object.create(null),AppUIStorage.getJSON(key,{})||{});
    if (shortcut) stored[commandId] = shortcut;
    else delete stored[commandId];
    AppUIStorage.setJSON(key, stored);
  }

  /**
   * Reset all custom shortcuts for an app.
   * @param {string} appId
   */
  function resetCustomShortcuts(appId) {
    AppUIStorage.remove(`pylon/appui/keybindings/${appId || 'global'}`);
  }

  // --- Sidebar Gallery (View menu) ---------------------------------------
  // A manifest-driven gallery of every app that advertises a `sidebar` block
  // (GET /v1/sidebars). Pick one → it's embedded into this page's RIGHT sidebar
  // region. The gallery helpers live in AppUIPanelApp (panel-app.js, shipped in
  // the 'feedback' bundle); lazy-load it on demand so the shell stays lean.
  async function _ensurePanelApp() {
    if (window.AppUIPanelApp) return window.AppUIPanelApp;
    try { await window.AppUIAssets?.load?.('feedback'); } catch (_e) {}
    return window.AppUIPanelApp || null;
  }

  async function openSidebarGallery(opts) {
    const PA = await _ensurePanelApp();
    if (!PA || !PA.openGallery) { window.AppUIToast?.error?.('Sidebar gallery unavailable'); return; }
    const hostApp = (opts.config && opts.config.id) || null;
    return PA.openGallery({
      toggleRightSidebar: opts.toggleRightSidebar,
      hostApp,
      // ADD the picked sidebar as a CLOSABLE TAB in the right sidebar (parity
      // with the workspace shim): go through the registered pane controller's
      // addTab so it gets the shared closable + right-click-close behavior,
      // rather than a one-off sub-panel. Falls back to the panel-app default
      // embed if no right pane controller is registered.
      addSidebar: function (spec, cfg) {
        let ctrl = _paneControllers.right;
        const rEl0 = document.getElementById('app-right');
        // a page without a configured right sidebar (no pane controller yet):
        // create the tab host there ON DEMAND, so ANY page can add a sidebar
        if ((!ctrl || !ctrl.addTab) && rEl0 && window.AppUISidebarTabs && window.AppUISidebarTabs.create) {
          rEl0.classList.remove('ai-app-hidden');
          if (rEl0.getBoundingClientRect().width < 120) rEl0.style.width = ((spec && spec.width) || 380) + 'px';
          // the page's own (declared) sidebar already in the region becomes the
          // FIRST tab — its nodes are MOVED (a live chat keeps its state) — so
          // the gallery pick sits beside it instead of under it
          const kept = Array.from(rEl0.childNodes).filter(n => n.nodeType === 1 || (n.textContent || '').trim());
          const first = [];
          if (kept.length) {
            const name = rEl0.getAttribute('data-declared-sidebar')
              || (rEl0.querySelector('[data-declared-sidebar]') || {getAttribute: () => ''}).getAttribute('data-declared-sidebar')
              || 'Sidebar';
            kept.forEach(n => n.remove());
            first.push({id: 'page-sidebar', label: name, closable: false, render: function (host) {
              host.style.cssText += ';display:flex;flex-direction:column;min-height:0;height:100%';
              kept.forEach(n => host.appendChild(n));
            }});
          }
          ctrl = window.AppUISidebarTabs.create({container: rEl0, storageKey: 'appui-sidebar-right-added', tabs: first,
                                                 initialActiveId: first.length ? 'page-sidebar' : ''});
          registerPaneController('right', ctrl);
        }
        if (!ctrl || !ctrl.addTab) return false;
        const id = 'gal-' + (spec.app_id ? spec.app_id.replace(/\//g, '-') + '-' : '') + spec.type;
        ctrl.addTab({
          id: id,
          label: (spec.icon ? spec.icon + ' ' : '') + (spec.label || spec.type),
          closable: true,
          render: function (host) {
            if (typeof spec.embed === 'function') { try { spec.embed(host); } catch (_e) {} return; }
            // a chat: its profile / the page agent + the page's own hooks
            Promise.resolve(PA.mountChat ? PA.mountChat(spec, host, Object.assign({hostApp}, cfg || {})) : false)
              .then(done => { if (!done) PA.embedSidebar(spec, host, { hostApp }); })
              .catch((e) => {
                try { (window.AppUILogger?.console('appui/sidebar-gallery') || console).warn('chat mount failed', spec && (spec.profile || spec.type), e); } catch (_e) {}
                PA.embedSidebar(spec, host, { hostApp });
              });
          },
        });
        try { if (ctrl.switchTo) ctrl.switchTo(id); } catch (_e) {}
        try { if (typeof opts.toggleRightSidebar === 'function') {
          const rEl = document.getElementById('app-right');
          if (rEl && rEl.classList.contains('ai-app-hidden')) opts.toggleRightSidebar();
        } } catch (_e) {}
        return true;
      },
    });
  }

  window.AppUIShellCommands = {
    normalizeShortcut,
    buildViewMenuItems,
    buildViewCommands,
    areShortcutsEnabled,
    setShortcutsEnabled,
    loadCustomShortcuts,
    saveCustomShortcut,
    resetCustomShortcuts,
    registerPaneController,
    togglePane,
    isPaneVisible,
  };
})();

;
/**
 * AppUI shell  --  application layout framework for studio pages.
 *
 * Layout:
 *   +--------------- Menu Bar (ai-menu.js) ------------------+
 *   +--------+------------------------------+----------------+
 *   | Left   |                              | Right Sidebar  |
 *   |Sidebar |      Content Area            | (ai-sidebar)   |
 *   |(nav/   |                              |                |
 *   | panels)|  (editor/preview/etc.)       |  AI chat +     |
 *   |        |                              |  tool context   |
 *   +--------+------------------------------+----------------+
 *   |                    Status Bar                           |
 *   +--------------------------------------------------------+
 *
 * Left sidebar: page-specific navigation (chapters, file tree, macros, etc.)
 * Right sidebar: AI assistant (ai-sidebar.js)  --  always the same component
 * Content: the main working area  --  editor, preview, split pane, etc.
 * ai-float: optional floating overlay (independent of layout)
 *
 * Usage:
 *   <script src="/appui/manifest.js"></script>
 *   <script>AppUIAssets.loadCss();</script>
 *   <script>window.AppUIReady = AppUIAssets.load('foundation', 'shell', 'aiSidebar');</script>
 *   <script>
 *     AppUI.init({
 *       id: 'mum_studio',
 *       title: 'MUM Studio',
 *       pipeline: 'mum_studio',         // loads menu + tool_groups from pipeline
 *       leftSidebar: {                   // page-specific navigation
 *         width: 250,
 *         render: (el) => { el.innerHTML = '<h3>Macros</h3>...'; }
 *       },
 *       rightSidebar: {                  // AI chat (always ai-sidebar)
 *         type: 'ai-sidebar', width: 350,
 *         config: { title: 'MUM AI', context: () => getEditorContent() }
 *       },
 *       statusBar: {},                    // default: AppUIStatusBar with history log
 *       // statusBar: { render: (el) => { ... } },  // custom render overrides default
 *       content: { render: (el) => { ... } },
 *       onAction: (menu, id, params) => { ... },
 *       onReady: () => { ... },
 *     });
 *
 *     // Layout control:
 *     AppUI.setStatus('Processing…');     // updates status bar + logs to history
 *     AppUI.toggleLeftSidebar();
 *     AppUI.toggleRightSidebar();
 *     AppUI.setTitle('MUM Studio  --  diagram.puml');
 *   </script>
 */
// Allow pages to register sidebar tab plugins before init
if (!window.__appui_sidebar_plugins) window.__appui_sidebar_plugins = [];

// Page lifecycle: onDestroy callbacks invoked on beforeunload/navigation
(function() {
    const _destroyCallbacks = [];
    if (!window.AppUI) window.AppUI = {};
    window.AppUI.onDestroy = function(fn) { _destroyCallbacks.push(fn); };
    window.addEventListener('beforeunload', function() {
        _destroyCallbacks.forEach(fn => { try { fn(); } catch(e) {} });
    });
})();

const AppUIShell = (function() {
    const VERSION = '2.4.0';
    let _config = {};
    let _sourceConfig = {};
    let _els = {};
    let _lifetime = null;
    let _pipeline = null;
    let _statusBar = null;
    let _content = null;
    let _regions = {};
    let _sidebarTabs = {};
    let _layout = {};
    let _layoutState = null;
    let _responsiveShell = null;
    let _routeListener = null;
    let _routerService = null;
    const _commandRuntime=window.AppUIShellCommandRuntime.create({getConfig:()=>_config,onPaletteChange:_syncPalette,dispatchMenu:_dispatchMenuAction});
    const _cleanupRegistry = window.AppUIShellCleanup.create();
    let _initGeneration = 0;
    const _state = AppUIReactiveState.create();
    let _pipelineController = null;
    const _layoutStorage = window.AppUIShellLayoutStorage.create({getAppId: () => _config.id, getState: () => _layoutState, getLayout: () => _layout});
    const _routes = window.AppUIShellRoutes.create({getAppId: () => _config.id, getRouter: () => _routerService, onRoute: (...args) => _config.onRoute?.(...args)});
    const _shellHelpers = window.AppUIShellHelpers.create({
        getContentTarget: () => _els.contentTop || _els.content,
        getHashRoutes: () => _hashRoutes(),
    });

    function _copyConfig(opts = {}) {
        const menu = Object.fromEntries(Object.entries(opts.menu || {}).map(([name, items]) => [
            name,
            Array.isArray(items) ? [...items] : items,
        ]));
        return Object.assign({}, opts, {menu});
    }

    function init(opts) {
        destroy();
        const generation = ++_initGeneration;
        _sourceConfig = _copyConfig(opts);
        _config = _copyConfig(_sourceConfig);
        // `statusbar: true` is the concise form for the default status bar;
        // `statusbar: false`, `menubar: false`, and `sidebar: false` disable
        // shell regions without requiring a different page framework.
        if (_config.statusbar === true && _config.statusBar === undefined) {
            _config.statusBar = {};
        }
        if (typeof _config.statusbar === 'object' && _config.statusBar === undefined) {
            _config.statusBar = _config.statusbar;
        }
        _layoutState = AppUILayoutState.create(_config.id);
        _commandRuntime.init();
        _routerService = AppUIRouter.create(_config.id, () => _config.onRoute?.(null, null));
        _layout = _readLayout();
        _registerCommands(_config.commands || _config.actions);
        _injectViewMenu();
        _buildShell();
        _bindRoute();
        const lifetime = AppUILifecycle.createViewScope({
            host: _els.main, isCurrent: () => generation === _initGeneration,
        });
        _lifetime = lifetime;
        _trackCleanup(() => lifetime.destroy());
        lifetime.add(() => { if (generation === _initGeneration) destroy(); });
        // Every active page supplies its own shell configuration. Render it
        // immediately; pipeline data is an optional menu enhancement and must
        // not delay first paint or page-owned onReady work.
        _finishInit(generation);
        _loadPipeline(_config.pipeline, generation);
    }

    function _buildShell() {
        AppUITheme.restore();
        _injectStyles();
        _buildShellWithRegions();
    }

    function _buildShellWithRegions() {
        _mountTemplate();
        document.body.classList.add('ai-app-body');
        _regions = window.AppUIShellRegionMounter.create({elements: _els, layout: _layout, persist: _writeLayout});
        window.AppUIShellRegionMounter.mount({regions: _regions, elements: _els, config: _config,
            buildResponsiveRail: _buildResponsiveRail});
        window.addEventListener('unhandledrejection', _onUnhandledError);
        window.addEventListener('error', _onUnhandledError);
    }

    function _mountTemplate() {
        _els = window.AppUIShellTemplateMounter.mount();
    }

    function _loadPipeline(pipelineId, generation) {
        _pipelineController = window.AppUIShellPipelineLoader.load(pipelineId, {
            isCurrent: () => generation === _initGeneration,
            onPipeline: pipeline => {
                _pipeline = pipeline;
                if (_pipeline) _refreshPipelineMenu(generation);
            },
        });
    }

    function _refreshPipelineMenu(generation) {
        if (generation !== _initGeneration) return;
        _regions.menubar.initMenu({component: AppUIMenu, definition: _pipeline, onAction: _dispatchMenuAction});
        _syncPalette();
    }

    function _finishInit(generation) {
        if (generation !== _initGeneration) return;
        // Init menu
        _regions.menubar.initMenu({
            component: AppUIMenu,
            definition: _pipeline || _config,
            onAction: _dispatchMenuAction,
        });
        _bindCommandShortcuts();
        _renderSlot(_getRegionOption('menubar', 'right', 'menuRight'), _els.menuRight);
        _installThemeControl();
        _installNotifications();
        _syncPalette();

        // Render left sidebar
        if (_config.leftSidebar && _els.left) {
            const cleanup = _renderSidebar(_config.leftSidebar, _els.left, 'left');
            if (typeof cleanup === 'function' || typeof cleanup?.destroy === 'function') _trackCleanup(cleanup);
        }

        // Render right sidebar (AI sidebar or custom)
        if (_config.rightSidebar && _els.right) {
            const cleanup = _renderSidebar(_config.rightSidebar, _els.right, 'right');
            if (typeof cleanup === 'function' || typeof cleanup?.destroy === 'function') _trackCleanup(cleanup);
        }

        // Render content
        _content = window.AppUIShellContentMounter.mount({
            config: _config.content, region: _regions.content, runCommand,
        });

        // The optional dock feature shares the shell's layout and lifetime.
        if (window.AppUISidebarDockFeature && (_config.leftSidebar || _config.rightSidebar)) {
            const dock = window.AppUISidebarDockFeature.mount({
                elements: _els, layout: _layout, persist: _writeLayout, config: _config,
            });
            _trackCleanup(() => dock.destroy());
        }

        // Notify ready
        if (_config.onReady) _config.onReady();

        // Render status bar
        if (_config.statusBar && _els.status) {
            _statusBar = window.AppUIShellStatusRenderer.mount({
                config: _config.statusBar, elements: _els, region: _regions.statusbar,
                renderSlot: _renderSlot, trackCleanup: _trackCleanup,
            });
            window.AppUIShellStatusRenderer.mountRight({
                config: _config.statusBar, elements: _els,
                renderSlot: _renderSlot, trackCleanup: _trackCleanup,
                right: _getRegionOption('statusBar', 'right'),
            });
        }
    }

    function _initAISidebar(container, sidebar) {
        return window.AppUIShellAISidebarRenderer.mount({
            container, sidebar, pipeline: _pipeline, appId: _config.id, onClose: toggleRightSidebar,
        });
    }

    function _getRegionOption(region, key, legacyKey) {
        const config = _config[region];
        if (config && typeof config === 'object') return config[key];
        return legacyKey ? _config[legacyKey] : null;
    }


    function _renderSlot(spec, container) {
        if (!spec || !container) return;
        let cleanup;
        if (typeof spec === 'function') cleanup = spec(container);
        else if (spec.mount) cleanup = spec.mount(container);
        else if (spec.render) cleanup = spec.render(container);
        else if (typeof spec === 'string') container.insertAdjacentHTML('beforeend', spec);
        else if (spec instanceof Node) container.appendChild(spec);
        if (typeof cleanup === 'function' || typeof cleanup?.destroy === 'function') cleanup = _trackCleanup(cleanup);
        return cleanup;
    }

    function _renderSidebar(sidebar, container, position) {
        return window.AppUIShellSidebarRenderer.render({
            sidebar, container, position, el: _el, renderSlot: _renderSlot,
            initAISidebar: _initAISidebar, discoverPlugins: discoverSidebarPlugins,
            layout: _layout, writeLayout: _writeLayout,
            setTabs: tabs => { _sidebarTabs[position] = tabs; },
        });
    }

    const _trackCleanup = cleanup => _cleanupRegistry.track(cleanup);

    const _readLayout = () => _layoutStorage.read();
    const _writeLayout = () => _layoutStorage.write();

    function _buildResponsiveRail(main) {
        _responsiveShell?.destroy();
        _responsiveShell = AppUIResponsiveShell.create({
            main,
            left: _els.left,
            right: _els.right,
            hasLeft: !!_config.leftSidebar,
            hasRight: !!_config.rightSidebar,
            layout: _layout,
            onToggleLeft: toggleLeftSidebar,
            onToggleRight: toggleRightSidebar,
        });
        _els.sidebarRail = _responsiveShell.rail;
    }

    function _installThemeControl() {
        const menuConfig = _config.menubar && typeof _config.menubar === 'object' ? _config.menubar : {};
        if (!(menuConfig.theme || _config.theme) || !_els.menuRight) return;
        _regions.menubar.mountTheme({enabled: true, themeService: AppUITheme});
    }

    function _installNotifications() {
        const menuConfig = _config.menubar && typeof _config.menubar === 'object' ? _config.menubar : {};
        const notificationsFeature = window.AppUINotificationsFeature;
        if ((menuConfig.notifications || _config.notifications) && notificationsFeature) {
            const notifications = _regions.menubar?.mountNotifications
                ? _regions.menubar.mountNotifications({enabled: true, feature: notificationsFeature})
                : notificationsFeature.mount(_els.menuRight);
            if (notifications?.destroy) _trackCleanup(() => notifications.destroy());
        }
    }

    function _syncPalette() {
        const paletteComponent = window.AppUIPalette;
        if (_config.palette === false || !paletteComponent) return;
        window.AppUIShellPaletteRenderer.sync({
            palette:paletteComponent,
            definitions:_commandRuntime.raw(),
            available:getCommands(),menuActions:AppUIMenu.getActions(),
            runCommand,triggerMenu:(menu,id)=>AppUIMenu.trigger(menu,id),
        });
    }

    // Hash routes are intentionally page-local and human-readable. Unlike query
    // routes, they are not namespaced because the fragment belongs only to this
    // document. Example: #folder=Mailbox%2FInbox&email=Quarterly+Review
    const getRoute = key => _routes.get(key);
    const setRoute = (...args) => _routes.set(...args);
    const _hashRoutes = () => _routes.hashes();
    const getHashRoute = key => _routes.getHash(key);
    const setHashRoute = (...args) => _routes.setHash(...args);
    const setHashRoutes = (...args) => _routes.setHashes(...args);
    const _bindRoute = () => { _routeListener = _routes.bind(); };

    function _injectViewMenu() {
        if (!_config.menu) _config.menu = {};
        const viewItems = window.AppUIShellCommands.buildViewMenuItems(_config);
        _config.menu.View = [...viewItems, ...(_config.menu.View || [])];
        window.AppUIShellCommands.buildViewCommands({
            config: _config, toggleLeftSidebar, toggleRightSidebar,
        }).forEach(command => {
            try { registerCommand(command); } catch (_) {}
        });
    }

    function _dispatchMenuAction(menu, id, params, item) {
        if (runCommand(id, params, {type: 'menu', menu, item})) return;
        if (_config.onAction) _config.onAction(menu, id, params, item);
    }

    const _registerCommands=definitions=>_commandRuntime.registerAll(definitions);
    const registerCommand=command=>_commandRuntime.register(command);
    function runCommand(id,params,source){return _commandRuntime.run(id,params,source);}
    const getCommands=()=>_commandRuntime.all();
    const setCommandEnabled=(id,enabled)=>_commandRuntime.setEnabled(id,enabled);
    const _bindCommandShortcuts=()=>_commandRuntime.bindShortcuts();
    const setShortcutsEnabled=enabled=>_commandRuntime.setShortcutsEnabled(enabled);
    const areShortcutsEnabled=()=>_commandRuntime.areShortcutsEnabled();
    const setShortcut=(id,shortcut)=>_commandRuntime.setShortcut(id,shortcut);
    const resetShortcuts=()=>_commandRuntime.resetShortcuts();
    const getShortcuts=()=>_commandRuntime.getShortcuts();

    const _history = window.AppUIShellHistory.create();

    const _dirtyState = window.AppUIShellDirtyState.create(() => _config.title);

    const _toolbar = window.AppUIShellToolbar.create({el: _el, runCommand});

    const _onUnhandledError = event => window.AppUIShellDiagnostics.reportUnhandled(event, setStatus);
    const discoverSidebarPlugins = position => window.AppUIShellDiagnostics.discoverSidebarPlugins(position);

    const _dataCache = window.AppUIShellDataCache.create((...args) => _shellHelpers.fetchApi(...args));

    // --- Public API ---

    const _status = window.AppUIShellStatus.create(() => _statusBar);
    const setStatus = (...args) => _status.set(...args);

    const _sidebarControls = window.AppUIShellSidebarControls.create({elements: () => _els, regions: () => _regions, layout: () => _layout, saveLayout: _writeLayout});
    const toggleLeftSidebar = () => _sidebarControls.toggleLeft();
    const toggleRightSidebar = () => _sidebarControls.toggleRight();

    const notify = (...args) => window.AppUIShellNotifications.notify(...args);

    const _publicState = window.AppUIShellPublicState.create({elements: () => _els, regions: () => _regions, pipeline: () => _pipeline, statusBar: () => _statusBar, content: () => _content});

    const _sidebarTabControls = window.AppUIShellSidebarTabs.create(() => _sidebarTabs);

    function refresh() {
        const config = _sourceConfig;
        init(config);
    }

    function destroy() {
        ++_initGeneration;
        _pipelineController?.abort();
        _pipelineController = null;
        _cleanupRegistry.runAll();
        _lifetime = null;
        Object.values(_regions).forEach(region => region.destroy?.());
        _regions = {};
        const paletteComponent = window.AppUIPalette;
        AppUIMenu.destroy();
        paletteComponent?.destroy?.();
        _commandRuntime.destroyShortcuts();
        _responsiveShell?.destroy();
        if (_routeListener) {
            window.removeEventListener('popstate', _routeListener);
            window.removeEventListener('hashchange', _routeListener);
        }
        _routerService?.destroy();
        window.removeEventListener('unhandledrejection', _onUnhandledError);
        window.removeEventListener('error', _onUnhandledError);
        _routeListener = null;
        _routerService = null;
        _responsiveShell = null;
        _statusBar = null;
        _content = null;
        _sidebarTabs = {};
        _layoutState = null;
        _commandRuntime.clear();
        _els = {};
        window.AppUIShellTemplateMounter.reset();
    }

    // --- Helpers ---

    function _el(tag, cls) {
        return _shellHelpers.el(tag, cls);
    }

    function _injectStyles() {
        return window.AppUIShellLayout.injectStyles();
    }

    return {
        VERSION,
        init,
        destroy,
        refresh,
        getLifetime: () => _lifetime,
        own: cleanup => _trackCleanup(cleanup),
        setStatus,
        notify,
        toggleLeftSidebar,
        toggleRightSidebar,
        setTitle: title => _publicState.setTitle(title),
        getElement: slot => _publicState.getElement(slot),
        getRegion: name => _publicState.getRegion(name),
        getPipeline: () => _publicState.getPipeline(),
        getStatusBar: () => _publicState.getStatusBar(),
        getContent: () => _publicState.getContent(),
        getRoute,
        setRoute,
        getHashRoute,
        setHashRoute,
        setHashRoutes,
        activateSidebarTab: (...args) => _sidebarTabControls.activate(...args),
        registerCommand,
        runCommand,
        setCommandEnabled,
        pushUndo: (...args) => _history.pushUndo(...args),
        undo: (...args) => _history.undo(...args),
        redo: (...args) => _history.redo(...args),
        pushRedo: (...args) => _history.pushRedo(...args),
        clearUndoHistory: scope => _history.clear(scope),
        setShortcut,
        resetShortcuts,
        getShortcuts,
        setShortcutsEnabled,
        areShortcutsEnabled,
        fetch: (...args) => _shellHelpers.fetchApi(...args),
        renderBreadcrumb: container => _shellHelpers.renderBreadcrumb(container),
        confirm: (...args) => window.AppUIShellDialogs.confirm(...args),
        markDirty: value => _dirtyState.set(value),
        isDirty: () => _dirtyState.get(),
        renderToolbar: (...args) => _toolbar.render(...args),
        data: (...args) => _dataCache.get(...args),
        invalidateData: toolPath => _dataCache.invalidate(toolPath),
        state: _state,
    };
})();
window.AppUIShell = AppUIShell;

;
/* Public AppUI entry point. It is provided by the foundation and shell bundles. */
const AppUI = (function() {
  const VERSION = '2.81.0';
  let activeFacade = null;
  function load(...bundleNames) {
    const assets = window.AppUIAssets;
    if (!assets?.load) return Promise.reject(new Error('AppUI manifest is missing. Load pylon/appui/manifest.js before the core bundle.'));
    return bundleNames.reduce((ready, name) => ready.then(() => assets.load(name)), Promise.resolve());
  }
  function requireGlobal(name) {
    const value = window[name];
    if (!value) throw new Error(`AppUI requires ${name}; load its bundle before using this API.`);
    return value;
  }
  // Recognized top-level createApp config keys. A typo (e.g. `left`/`right`/
  // `statusbar` casing, or `rightsidebar`) silently renders nothing, which is a
  // frequent and hard-to-spot page-authoring bug — so warn at mount time.
  const KNOWN_CONFIG_KEYS = new Set([
    'id', 'title', 'content',
    'sidebar', 'leftSidebar', 'rightSidebar',
    'statusBar', 'statusbar',            // statusbar is a tolerated alias
    'menu', 'menubar', 'palette',
    'commands', 'actions', 'onAction',
    'pipeline', 'theme', 'notifications',
    'onReady', 'onRoute', 'events', 'shortcuts',
  ]);
  function _warnUnknownConfigKeys(config) {
    if (!config || typeof config !== 'object') return;
    const unknown = Object.keys(config).filter(k => !KNOWN_CONFIG_KEYS.has(k));
    if (!unknown.length) return;
    // Suggest the closest known key for common casing typos.
    const suggest = {left: 'leftSidebar', right: 'rightSidebar', rightsidebar: 'rightSidebar',
      leftsidebar: 'leftSidebar', status: 'statusBar', statusBar: 'statusBar',
      statusbar: 'statusBar', header: 'menubar', footer: 'statusBar'};
    unknown.forEach(k => {
      const hint = suggest[k.toLowerCase()] ? ` — did you mean "${suggest[k.toLowerCase()]}"?` : '';
      console.warn(`[AppUI.createApp] unknown config key "${k}"${hint} (this region will not render). Known keys: ${[...KNOWN_CONFIG_KEYS].join(', ')}`);
    });
  }
  // AppUIEmbed — a page shown INLINE by another app (?embed=1, e.g. an app's
  // own viewer hosted in the Workspace preview pane) tells its host what it is
  // showing right now, so the host can ground its chat in the live view:
  //   AppUIEmbed.post({src, table, sql, where, view, rows, columns, …})
  // posts {type:"appui:view-state", state} to the parent (same origin only).
  // A no-op when the page isn't embedded.
  if (!window.AppUIEmbed) {
    window.AppUIEmbed = {
      embedded() {
        try { return window.parent !== window && new URLSearchParams(location.search).get('embed') === '1'; }
        catch (_e) { return false; }
      },
      post(state) {
        if (!this.embedded()) return;
        try { window.parent.postMessage({type: 'appui:view-state', state: state || {}}, location.origin); } catch (_e) {}
      },
      // the HOST drives the view (e.g. its chat fills the SQL box):
      // parent posts {type:"appui:view-command", command:{…}} → fn(command).
      // Same origin + from the parent only. The page decides what it supports
      // (it lists that in its state as `accepts`).
      onCommand(fn) {
        if (!this.embedded() || typeof fn !== 'function') return () => {};
        const listener = (e) => {
          const d = e && e.data;
          if (!d || d.type !== 'appui:view-command' || e.origin !== location.origin || e.source !== window.parent) return;
          try { fn(d.command || {}); } catch (_e) {}
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
      }
    };
  }
  function createApp(config = {}) {
    _warnUnknownConfigKeys(config);
    // EMBED MODE: a page loaded with ?embed=1 (another app showing it inline —
    // e.g. the Workspace preview pane hosting an app's own viewer) drops its
    // window chrome: the menubar and the status bar (shell/styles.css). The
    // page's own content and sidebars render as usual.
    try {
      if (new URLSearchParams(location.search).get('embed') === '1') document.documentElement.classList.add('appui-embed');
    } catch (_e) { /* no location (tests) */ }
    const app = requireGlobal('AppUIShell');
    app.init(config);
    let lifetime = app.getLifetime?.();
    const current = () => !lifetime || lifetime.current();
    const owned=(callback,fallback)=>(...args)=>current()?callback(...args):fallback;
    // If config declares event channels AND AppUIEventBus is available, create SSE-connected bus.
    // Otherwise fall back to page-local AppUIEvents.
    let events = null;
    const eventConfig = config.events;
    if (eventConfig && eventConfig.channels && typeof AppUIEventBus !== 'undefined') {
      events = window.AppUIEvents.createConnected(eventConfig,AppUIEventBus);
    } else {
      events = window.AppUIEvents?.create?.() || null;
    }
    let released = false;
    const releaseEvents = () => { if (released) return; released = true; events?.destroy(); };
    let refreshing = false;
    const ownEvents = () => app.own?.(() => { if (!refreshing) releaseEvents(); });
    ownEvents();
    const refresh = () => {
      if (!current()) return;
      refreshing = true;
      try {
        const result = app.refresh();
        lifetime = app.getLifetime?.();
        ownEvents();
        return result;
      } catch (error) { releaseEvents(); throw error; }
      finally { refreshing = false; }
    };
    const facade = {
      destroy: () => {
        releaseEvents();
        if (current()) app.destroy();
      },
      refresh,
      setStatus: owned((...args)=>app.setStatus(...args)),
      setTitle: owned(title=>app.setTitle(title)),
      notify: owned((...args)=>app.notify(...args)),
      toggleLeftSidebar: owned(()=>app.toggleLeftSidebar()),
      toggleRightSidebar: owned(()=>app.toggleRightSidebar()),
      renderAll: refresh,
      events,
      regions: {
        get: owned(name=>app.getElement(name),null),
        controller: owned(name=>app.getRegion(name),null),
        content: {
          mount: owned(config=>app.getRegion('content')?.mount(config)),
          get: owned(()=>app.getContent(),null),
        },
      },
      commands: {
        run: owned((...args)=>app.runCommand(...args),false),
        register: owned(command=>app.registerCommand(command)),
        setEnabled: owned((...args)=>app.setCommandEnabled(...args),false),
      },
      shortcuts: {
        get: () => current()?app.getShortcuts():[],
        set: owned((...args)=>app.setShortcut(...args),false),
        reset: owned(()=>app.resetShortcuts()),
        enabled: owned(()=>app.areShortcutsEnabled(),false),
        setEnabled: owned(value=>app.setShortcutsEnabled(value)),
      },
      router: {
        get: owned(key=>app.getRoute(key),null),
        set: owned((...args)=>app.setRoute(...args)),
        getHash: owned(key=>app.getHashRoute(key),null),
        setHash: owned((key,value,options)=>app.setHashRoute(key,value,options)),
        setHashRoutes: owned((...args)=>app.setHashRoutes(...args)),
      },
      sidebars: {
        activate: owned((position,id)=>app.activateSidebarTab(position,id),false),
        toggleLeft: owned(()=>app.toggleLeftSidebar()),
        toggleRight: owned(()=>app.toggleRightSidebar()),
      },
    };
    activeFacade = facade;
    return facade;
  }
  function shell() { return requireGlobal('AppUIShell'); }
  return {
    VERSION,
    version: VERSION,
    templateVersion: window.AppUITemplate?.VERSION || null,
    createApp,
    init(config) { createApp(config); return this; },
    destroy() { return activeFacade ? activeFacade.destroy() : shell().destroy(); },
    refresh() { return activeFacade ? activeFacade.refresh() : shell().refresh(); },
    setStatus(...args) { return shell().setStatus(...args); },
    setTitle(title) { return shell().setTitle(title); },
    notify(...args) { return shell().notify(...args); },
    toggleLeftSidebar() { return shell().toggleLeftSidebar(); },
    toggleRightSidebar() { return shell().toggleRightSidebar(); },
    registerCommand(command) { return shell().registerCommand(command); },
    get state() { return shell().state; },
    template: window.AppUITemplate,
    services: {get dataBind() { return window.AppUIDataBind || null; }, get EventBus() { return window.AppUIEventBus || null; }, api: window.AppUIApi, commands: window.AppUICommands, events: window.AppUIEvents, lifecycle: window.AppUILifecycle, layoutState: window.AppUILayoutState, router: window.AppUIRouter, shortcuts: window.AppUIShortcuts, theme: window.AppUITheme, get ToolSocket() { return window.AppUIToolSocket || null; }, get streamEvents() { return window.AppUIStreamEvents || null; }, get urlFields() { return window.AppUIUrlFields || null; }},
    utils: {get documentStyles() { return window.AppUIDocumentStyles || null; }, get scripts() { return window.AppUIScriptLoader || null; }, get asyncCache() { return window.AppUIAsyncCache || null; }, get files() { return window.AppUIFileUtils || null; }, core: window.AppUICore, storage: window.AppUIStorage, text: window.AppUITextUtils, polling: window.AppUIPollRefresh, get pointer() { return window.AppUIPointerGesture || null; }, get diff() { return window.AppUITextDiff || null; }},
    diagnostics: {
      snapshot() { return window.AppUIAssets?.diagnostics?.() || {}; },
      clearCacheAndReload() { return window.AppUIAssets?.clearCacheAndReload?.(); },
      open() {
        const snapshot = window.AppUIAssets?.diagnostics?.() || {};
        const body = '<pre style="white-space:pre-wrap;max-height:55vh;overflow:auto">' +
          AppUITextUtils.esc(JSON.stringify(snapshot, null, 2)) + '</pre>';
        return AppUIDialog.show({
          title: 'AppUI diagnostics', body, width: '720px',
          buttons: [
            {text: 'Close'},
            {text: 'Clear cache and reload', action: () => window.AppUIAssets?.clearCacheAndReload?.()},
          ],
        });
      },
    },
    // Shared debug capture + one-call issue reporting for any app. See
    // src/services/debug.js. AppUI.debug.log(...) leaves a breadcrumb;
    // AppUI.debug.reportIssue() opens a prefilled report with the full
    // auto-captured context (log + errors + diagnostics) and files it to
    // the issue_report tracker.
    get debug() { return window.AppUIDebug || null; },
    load,
    components: {
      get LogView() { return window.AppUILogView || null; },
      get GraphNode() { return window.AppUIGraphNode || null; },
      get GraphDrag() { return window.AppUIGraphDrag || null; },
      get Disclosure() { return window.AppUIDisclosure || null; },
      get Feedback() { return window.AppUIFeedback || null; },
      get SidebarSections() { return window.AppUISidebarSections || null; },
      get Breadcrumbs() { return window.AppUIBreadcrumbs || null; },
      get ContextMenu() { return window.AppUIContextMenu || null; },
      get Menu() { return window.AppUIMenu || null; },
      get Palette() { return window.AppUIPalette || null; },
      get StatusBar() { return window.AppUIStatusBar || null; },
      get Toolbar() { return window.AppUIToolbar || null; },
      get Pagination() { return window.AppUIPagination || null; },
      get Header() { return window.AppUIHeader || null; },
      get RecentRuns() { return window.AppUIRecentRuns || null; },
      get Splitter() { return window.AppUISplit || null; },
      get DataView() { return window.AppUIDataView || null; },
      get Dialog() { return window.AppUIDialog || null; },
      get TabbedDialog() { return window.AppUITabbedDialog || null; },
      get FileDialog() { return window.AppUIFileDialog || null; },
      get Toast() { return window.AppUIToast || null; },
      get Chat() { return window.AppUIChat || null; },
      get ChatView() { return window.AppUIChatView || null; },
      get Suggestions() { return window.AppUISuggestions || null; },
      get DnD() { return window.AppUIDnD || null; },
      get Resizer() { return window.AppUIResizer || null; },
      get Selection() { return window.AppUISelection || null; },
      get VirtualScroll() { return window.AppUIVirtualScroll || null; },
      get Tree() { return window.AppUITree || null; },
      get ChapterTree() { return window.ChapterTree || null; },
      get Tabs() { return window.AppUITabs || null; },
      get NavigationLink() { return window.AppUINavigationLink || null; },
      get TabNavigation() { return window.AppUITabNavigation || null; },
      get SidebarTabs() { return window.AppUISidebarTabs || null; },
      get FloatingPanel() { return window.AppUIFloatingPanel || null; },
      get JsonEditor() { return window.AppUIJsonEditor || null; },
      get JsonForm() { return window.AppUIJsonForm || null; },
      get MultiSplit() { return window.AppUIMultiSplit || null; },
      get DataTable() { return window.AppUIDataTable || null; },
      get Watcher() { return window.AppUIWatcher || null; },
      get GridView() { return window.AppUIGridView || null; },
      get StatCards() { return window.AppUIStatCards || null; },
      get Workspace() { return window.AppUIWorkspace || null; },
      get LiveEditPane() { return window.AppUILiveEditPane || null; },
    },
    features: {
      get PylonProcessors() { return window.AppUIPylonProcessors || null; },
      get ContentTabs() { return window.AppUIContentTabs || null; },
      get aiSidebar() { return window.AppUIAISidebarFeature || null; },
      get DaemonStatus() { return window.AppUIDaemonStatus || null; },
      get ServiceStatus() { return window.AppUIDaemonStatus || null; },
      get FileExplorer() { return window.AppUIFileExplorer || null; },
      get FileBackend() { return window.AppUIFileBackend || null; },
      get Notifications() { return window.AppUINotificationsFeature || null; },
      get SidebarDock() { return window.AppUISidebarDockFeature || null; },
    },
    get breadcrumb() { return window.AppUIShellBreadcrumb || null; },
  };
})();
window.AppUI = AppUI;

;
/* Workflow prompt presentation; transport and prompt state stay in the controller. */
window._AppUIWorkflowPromptView = {
  create({ parent, idOf, onRespond, onDispose }) {
    const banner = document.createElement('div');
    banner.id = 'wf-prompt-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;display:none';
    document.body.appendChild(banner);
    const owner = AppUILifecycle.createViewScope({ host: banner, parent, pagehide: false });
    const views = AppUILifecycle.createKeyedScopes({ parent: owner });
    owner.add(views);
    const drafts = new Map();
    owner.add(() => drafts.clear());
    const style = document.createElement('style');
    style.textContent = `
      #wf-prompt-banner { font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif); }
      .wf-prompt-item { display:flex; align-items:center; gap:12px; padding:10px 16px; background:var(--bg-elevated, #1e1e2e); border-bottom:2px solid var(--accent, #4a9eff); color:var(--text-primary, #e0e0e0); font-size:13px; animation: wf-prompt-slide 0.3s ease; }
      .wf-prompt-item .wf-prompt-icon { font-size:18px; flex-shrink:0; }
      .wf-prompt-item .wf-prompt-msg { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wf-prompt-item .wf-prompt-wf { font-size:10px; color:var(--text-muted, #888); margin-left:4px; }
      .wf-prompt-item .wf-prompt-actions { display:flex; gap:6px; flex-shrink:0; }
      .wf-prompt-item .wf-prompt-btn { padding:5px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600; transition:opacity 0.2s; }
      .wf-prompt-item .wf-prompt-btn:hover { opacity:0.85; }
      .wf-prompt-item .wf-prompt-btn:disabled { opacity:0.4; cursor:default; }
      .wf-prompt-btn-approve { background:var(--color-success, #4caf50); color:var(--text-inverse, #fff); }
      .wf-prompt-btn-reject { background:var(--bg-hover, #666); color:var(--text-inverse, #fff); }
      .wf-prompt-btn-input { background:var(--bg-primary, #0d0d1a); color:var(--text-primary, #e0e0e0); border:1px solid var(--border, #333) !important; min-width:120px; font-weight:400 !important; }
      .wf-prompt-choices { display:flex; gap:4px; flex-wrap:wrap; }
      .wf-prompt-choices button { padding:4px 10px; font-size:11px; border:1px solid var(--border, #333); border-radius:3px; background:var(--bg-primary, #0d0d1a); color:var(--text-primary, #e0e0e0); cursor:pointer; }
      .wf-prompt-choices button:hover { border-color:var(--accent, #4a9eff); color:var(--accent, #4a9eff); }
      @keyframes wf-prompt-slide { from { transform:translateY(-100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
    `;
    document.head.appendChild(style);
    owner.add(() => {
      banner.remove();
      style.remove();
      onDispose?.();
    });

    function text(className, value) {
      const node = document.createElement('span');
      node.className = className;
      node.textContent = value;
      return node;
    }
    function createPrompt(prompt, row, states) {
      const id = idOf(prompt),
        mode = prompt.type || prompt.mode || 'confirm';
      const state = states.get(id),
        disabled = !!state;
      const card = document.createElement('div'),
        message = text('wf-prompt-msg', prompt.message || 'Workflow requires input');
      card.className = 'wf-prompt-item';
      card.dataset.promptId = id;
      if (prompt.workflow) message.appendChild(text('wf-prompt-wf', '(' + prompt.workflow + ')'));
      const controls = document.createElement('div');
      controls.className = 'wf-prompt-actions';
      card.append(text('wf-prompt-icon', '\u2753'), message, controls);
      if (state?.status === 'responded') {
        card.style.opacity = '0.5';
        message.textContent = state.action === 'reject' ? '\u2717 Rejected' : '\u2713 Responded';
      }
      const toolbar = AppUI.components.Toolbar.create({
        container: controls,
        signal: row.signal,
        label: 'Workflow prompt response'
      });
      toolbar.element.style.cssText += ';padding:0;border:0;background:transparent';
      row.add(toolbar);
      function button(label, action, value, className = '') {
        const control = toolbar.append({
          label,
          disabled,
          className: ['wf-prompt-btn', className].filter(Boolean).join(' '),
          action: () => {
            if (row.current())
              onRespond(prompt, action, typeof value === 'function' ? value() : value, row);
          }
        });
        control.dataset.run = id;
        control.dataset.action = action;
        if (value !== undefined && typeof value !== 'function')
          control.dataset.value = String(value);
        return control;
      }
      if (['confirm', 'approve', 'approval'].includes(mode)) {
        button('\u2713 Yes', 'approve', undefined, 'wf-prompt-btn-approve');
        button('\u2717 No', 'reject', undefined, 'wf-prompt-btn-reject');
      } else if (mode === 'input') {
        const input = toolbar.append({
          type: 'input',
          value: drafts.has(id) ? drafts.get(id) : (state?.value ?? prompt.default ?? ''),
          onInput: (value) => drafts.set(id, value),
          placeholder: 'Type response...',
          className: 'wf-prompt-btn wf-prompt-btn-input'
        });
        input.dataset.run = id;
        input.setAttribute('aria-label', 'Workflow response');
        button('Send', 'respond', () => input.value, 'wf-prompt-btn-approve');
        button('Cancel', 'reject', undefined, 'wf-prompt-btn-reject');
        row.listen(input, 'keydown', (event) => {
          if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            onRespond(prompt, 'respond', input.value, row);
          }
        });
      } else if (mode === 'choice') {
        for (const value of Array.isArray(prompt.options) ? prompt.options : [])
          button(String(value), 'respond', String(value));
        button('Cancel', 'reject', undefined, 'wf-prompt-btn-reject');
      }
      return card;
    }
    function render(prompts, states) {
      if (!owner.current()) return;
      const present = new Set(prompts.map(idOf));
      for (const id of drafts.keys()) if (!present.has(id)) drafts.delete(id);
      const rows = views.begin('rows');
      banner.replaceChildren();
      banner.style.display = prompts.length ? 'block' : 'none';
      if (!prompts.length) return;
      const grid = AppUI.components.GridView.create({
        container: banner,
        signal: rows.signal,
        columns: 1,
        gap: 0,
        padding: 0,
        viewMode: 'grid',
        persistKey: false,
        selectable: false,
        renderItem: (prompt, row) => createPrompt(prompt, row, states)
      });
      rows.add(grid);
      grid.setItems(prompts);
    }
    return { render, current: () => owner.current(), destroy: () => owner.destroy() };
  }
};

;
/* Global workflow prompts with restartable, owned reads, responses and presentation. */
(function () {
  'use strict';
  const API_BASE = '/api/workflows';
  const POLL_INTERVAL = 5000;
  let active = null;
  const idOf = (prompt) => String(prompt?.run_id ?? prompt?.id ?? '');
  const current = (context) => active === context && context.owner.current();

  async function render(context) {
    if (!current(context)) return;
    if (context.view) {
      context.view.render(context.prompts, context.states);
      return;
    }
    if (!context.prompts.length) return;
    if (!context.viewPromise) {
      context.viewPromise = AppUI.load('toolbar', 'collections')
        .then(() => {
          if (!current(context) || !context.prompts.length) return;
          const view = window._AppUIWorkflowPromptView.create({
            parent: context.owner,
            idOf,
            onRespond: (prompt, action, value, row) => respond(context, prompt, action, value, row),
            onDispose: () => {
              if (current(context)) context.owner.destroy();
            }
          });
          context.view = view;
          context.owner.add(view);
          view.render(context.prompts, context.states);
        })
        .catch((error) => {
          if (current(context)) console.warn('Workflow prompt controls unavailable:', error);
        })
        .finally(() => {
          context.viewPromise = null;
        });
    }
    return context.viewPromise;
  }
  function replacePrompts(context, prompts) {
    context.prompts = prompts;
    const present = new Set(prompts.map(idOf));
    for (const id of context.states.keys()) {
      if (!present.has(id)) {
        context.states.delete(id);
        context.responses.destroy(id);
      }
    }
  }
  async function poll(context) {
    if (!current(context)) return;
    const owner = context.reads.begin('pending');
    try {
      const response = await fetch(API_BASE + '/prompt/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: owner.signal
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!owner.current()) return;
      const prompts = Array.isArray(data.prompts) ? data.prompts : [];
      if (JSON.stringify(prompts.map(idOf)) !== JSON.stringify(context.prompts.map(idOf))) {
        replacePrompts(context, prompts);
        await render(context);
      } else if (!context.view && prompts.length) {
        // Retry optional controls after a transient asset-loading failure.
        await render(context);
      }
    } catch (error) {
      if (owner.current() && context.prompts.length) {
        replacePrompts(context, []);
        await render(context);
      }
    }
  }
  async function respond(context, prompt, action, value, row) {
    if (!current(context) || !row.current()) return;
    const id = idOf(prompt);
    if (context.states.has(id) || !context.prompts.some((item) => idOf(item) === id)) return;
    const owner = context.responses.begin(id, {
      isCurrent: () => current(context) && context.prompts.some((item) => idOf(item) === id)
    });
    context.reads.destroy('pending');
    context.states.set(id, { status: 'pending', action, value });
    render(context);
    try {
      // A submitted response may resume a workflow: complete it independently of UI reads.
      const response = await fetch(API_BASE + '/prompt/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, value: value || '' })
      });
      const data = await response.json();
      if (!owner.current()) return;
      if (!response.ok || !data.ok) throw new Error(data._error || 'Response not accepted');
      context.states.set(id, { status: 'responded', action, value });
      await render(context);
      if (!(await AppUILifecycle.wait(owner, 1000)) || !owner.current()) return;
      replacePrompts(
        context,
        context.prompts.filter((item) => idOf(item) !== id)
      );
      context.states.delete(id);
      context.responses.destroy(id);
      await render(context);
    } catch (error) {
      if (owner.current()) {
        context.states.delete(id);
        context.responses.destroy(id);
        await render(context);
      }
    }
  }
  function connect(context) {
    if (
      !current(context) ||
      context.bus ||
      window.APPUI_BASE ||
      typeof window.AppUIEventBus !== 'function'
    )
      return;
    const bus = new window.AppUIEventBus(['workflows']);
    context.bus = bus;
    context.owner.add(() => {
      bus.close();
      if (context.bus === bus) context.bus = null;
    });
    bus.on('workflows', 'prompt', (prompt) => {
      if (
        !current(context) ||
        !prompt ||
        context.prompts.some((item) => idOf(item) === idOf(prompt))
      )
        return;
      context.prompts = [...context.prompts, prompt];
      render(context);
    });
  }
  async function connectLater(context) {
    if (await AppUILifecycle.wait(context.owner, 100)) connect(context);
  }
  function ensure() {
    if (active?.owner.current()) return active;
    const owner = AppUILifecycle.createViewScope();
    const context = {
      owner,
      prompts: [],
      states: new Map(),
      view: null,
      viewPromise: null,
      bus: null,
      poller: null,
      reads: AppUILifecycle.createKeyedScopes({ parent: owner }),
      responses: AppUILifecycle.createKeyedScopes({ parent: owner })
    };
    active = context;
    owner.add(context.reads);
    owner.add(context.responses);
    owner.add(() => {
      context.states.clear();
      if (active === context) active = null;
    });
    if (typeof window.AppUIEventBus === 'function') connect(context);
    else if (document.readyState === 'loading')
      owner.listen(document, 'DOMContentLoaded', () => connectLater(context), { once: true });
    else connectLater(context);
    return context;
  }
  function start() {
    const context = ensure();
    if (context.poller) return;
    const poller = AppUIPollRefresh.create(() => poll(context), POLL_INTERVAL, {
      refreshOnVisible: true
    });
    context.poller = poller;
    context.owner.add(poller);
    poller.start();
    poller.refresh();
  }
  function stop() {
    const context = active;
    active = null;
    context?.owner.destroy();
  }
  window.AppUIWorkflowPromptBanner = { start, stop, destroy: stop, poll: () => poll(ensure()) };
  ensure();
})();

;
/* Theme toggle button in the statusbar right section. */
window.AppUIShellThemeToggle = {
  mount(container) {
    const owner = AppUILifecycle.createScope();
    const btn = document.createElement('button');
    btn.className = 'ai-app-theme-toggle';
    btn.type = 'button';
    btn.title = 'Toggle dark/light theme';
    btn.setAttribute('aria-label', 'Toggle theme');
    const sync = theme => {
      btn.textContent = theme === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19';
      document.body.classList.toggle('light-theme', theme === 'light');
    };
    sync(AppUITheme.get());
    owner.listen(btn, 'click', () => {if (!owner.destroyed) sync(AppUITheme.toggle());});
    container.appendChild(btn);
    owner.add(() => btn.remove());
    return {element: btn, destroy: () => owner.destroy()};
  },
};
