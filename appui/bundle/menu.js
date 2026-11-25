/* Shared arrow/Home/End and activation binding for menu popups. */
window._AppUIMenuNavigation = (() => {
  function bind({container,getItems,onClose,afterActivate,isCurrent=()=>true}) {
    let destroyed=false;
    const current=()=>!destroyed&&container.isConnected!==false&&isCurrent();
    function focusFirst() {if(current())getItems()[0]?.focus();}
    function handle(event) {
      if(!current()||event.isComposing||!['Escape','Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(event.key))return false;
      event.preventDefault?.();event.stopPropagation?.();
      if(event.key==='Escape'){onClose();return true;}
      const rows=getItems(),index=rows.indexOf(document.activeElement);
      if(!rows.length)return true;
      if(event.key==='Enter'||event.key===' ') {
        rows[index]?.click();
        if(current())afterActivate?.();
      } else if(event.key==='Home'||event.key==='End') {
        rows[event.key==='Home'?0:rows.length-1]?.focus();
      } else {
        const forward=event.key==='ArrowDown';
        const next=index<0?(forward?0:rows.length-1):(index+(forward?1:-1)+rows.length)%rows.length;
        rows[next]?.focus();
      }
      return true;
    }
    container.addEventListener('keydown',handle);
    return {handle,focusFirst,destroy(){if(destroyed)return;destroyed=true;container.removeEventListener('keydown',handle);}};
  }
  return {bind};
})();

;
/* Menu definition policies, independent of DOM rendering and action dispatch. */
window._AppUIMenuModel=(function(){
    // Helper: menu value can be an array (old format) or {description, items} (new format)
    function _getItems(menuValue) {
        if (Array.isArray(menuValue)) return menuValue;
        if (menuValue && menuValue.items) return menuValue.items;
        return [];
    }

    function _getMenuDescription(menuValue) {
        if (menuValue && typeof menuValue === 'object' && !Array.isArray(menuValue)) return menuValue.description || '';
        return '';
    }

    function _menuId(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
    function _findItem(items, id) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
            if (items[i].submenu) {
                const found = _findItem(items[i].submenu, id);
                if (found) return found;
            }
        }
        return null;
    }

    function getActions(definition) {
        /**
         * Get all available actions as a flat list.
         * Used to build LLM context about UI capabilities.
         */
        const actions = [];
        for (const [menuName, menuValue] of Object.entries(definition)) {
            for (const item of _getItems(menuValue)) {
                if (item.separator) continue;
                actions.push({
                    menu: menuName,
                    id: item.id,
                    label: item.label,
                    description: item.description || null,
                    action: item.action,
                    shortcut: item.shortcut || null,
                    params: item.params || null,
                });
            }
        }
        return actions;
    }

    return {items:_getItems,description:_getMenuDescription,id:_menuId,find:_findItem,actions:getActions};
})();

;
/* Config/pipeline menu discovery, independent of menu DOM rendering. */
window._AppUIMenuSource = (() => {
  function create() {
    const requests=AppUILifecycle.createKeyedScopes({pagehide:false,observeRemoval:false});
    async function load(options,onReady) {
      const owner=requests.begin('definition');
      if(!owner.current())return;
      const accept=definition=>{if(owner.current()&&definition.menu)onReady(definition);};
      const pipeline=async()=>{
        if(!owner.current())return;
        const response=await fetch('/api/pipeline.get',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:options.pipeline}),signal:owner.signal,
        });
        accept(await response.json());
      };
      try {
        const response=await fetch('/configs',{signal:owner.signal});
        const data=await response.json();
        if(!owner.current())return;
        const name=options.menu||options.pipeline;
        const entry=(data.configs||[]).find(config=>config.name===`pages/${name}/menu.json`);
        if(entry?.data?.menu)accept(entry.data);
        else if(!options.menu)await pipeline();
      } catch {
        // Pipeline discovery retains the original final API fallback.
        if(!options.menu&&owner.current()) {
          try {await pipeline();} catch {}
        }
      } finally {owner.destroy();}
    }
    return {load,destroy:()=>requests.destroy()};
  }
  return {create};
})();

;
/* Shared viewport geometry for popup and submenu views. */
window._AppUIPopupPlacement = (()=>{
  function fit({x,y,width,height,viewportWidth,viewportHeight,padding=8}) {
    return {left:Math.max(padding,Math.min(x,viewportWidth-width-padding)),
      top:Math.max(padding,Math.min(y,viewportHeight-height-padding))};
  }
  function submenu({anchor,width,height,viewportWidth,viewportHeight,gap=0,padding=8}) {
    const right=anchor.right+gap;
    const x=right+width>viewportWidth-padding?anchor.left-width-gap:right;
    return fit({x,y:anchor.top,width,height,viewportWidth,viewportHeight,padding});
  }
  return {fit,submenu};
})();

;
/* Private markup for Menu bars, buttons, dropdowns and submenus. */
window._AppUIMenuView = {
  bar(container) {
    container.style.cssText = container.style.cssText || 'display:flex;background:var(--bg-secondary);border-bottom:1px solid var(--border);padding:0 8px;font-size:12px;position:relative;z-index:1000;user-select:none;';
    container.setAttribute('role', 'menubar');
  },
  button({menuName, id}) {
    const menuBtn = document.createElement('button');
    menuBtn.className = 'ai-menu-top';
    menuBtn.type = 'button';
    menuBtn.setAttribute('role', 'menuitem');
    menuBtn.setAttribute('aria-haspopup', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-controls', `ai-menu-${id}`);
    menuBtn.style.cssText = 'padding:6px 12px;cursor:pointer;color:var(--text-primary);position:relative;border:0;background:transparent;font:inherit;';
    menuBtn.textContent = menuName;
    return menuBtn;
  },
  dropdown({id,menuName,items}) {
    const dd = document.createElement('div');
    dd.className = 'ai-menu-dropdown';
    dd.id = `ai-menu-${id}`;
    dd.setAttribute('role', 'menu');
    dd._menuName = menuName;
    dd._items = items;
    dd.style.cssText = 'position:absolute;top:100%;left:0;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;min-width:200px;padding:4px 0;box-shadow:var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15));z-index:1001;';

    return dd;
  },
  submenu(rect) {
    const sub = document.createElement('div');
    sub.className = 'ai-menu-dropdown ai-menu-submenu';
    sub.setAttribute('role', 'menu');
    sub.style.cssText = 'position:fixed;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;min-width:160px;padding:4px 0;box-shadow:var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15));z-index:1002;';
    sub.style.left = rect.right + 'px';
    sub.style.top = rect.top + 'px';
    return sub;
  },
  positionSubmenu(element,anchor) {
    const {left,top}=window._AppUIPopupPlacement.submenu({anchor,width:element.offsetWidth,height:element.offsetHeight,
      viewportWidth:window.innerWidth,viewportHeight:window.innerHeight});
    element.style.left=`${left}px`;element.style.top=`${top}px`;
  },
  refreshChecked(dd, items) {
      // Re-evaluate checked functions and update checkmark display
      const rows = dd.querySelectorAll('[data-menu-item-idx]');
      rows.forEach(row => {
          const idx = parseInt(row.dataset.menuItemIdx, 10);
          const item = items[idx];
          if (!item || item.separator) return;
          if (item.checked === undefined) return;
          const isChecked = typeof item.checked === 'function' ? item.checked() : item.checked;
          const label = row.querySelector('.ai-menu-item-label');
          if (label) label.textContent = (isChecked ? '✓ ' : '   ') + item.label;
      });
  },
  separator() {
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border);margin:4px 8px;';
    return sep;
  },
  row(item,{index,labelClass='',submenu=false}={}) {
    const row = document.createElement('div');
    row.tabIndex = -1;
    row.setAttribute('role', 'menuitem');
    if(index!==undefined)row.dataset.menuItemIdx=String(index);
    row.style.cssText = 'padding:6px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;color:var(--text-primary);';
    const label = document.createElement('span');
    if(labelClass)label.className=labelClass;
    if (item.checked !== undefined) {
      const isChecked = typeof item.checked === 'function' ? item.checked() : item.checked;
      label.textContent = (isChecked ? '✓ ' : '   ') + item.label;
    } else {
      label.textContent = item.label;
    }
    row.appendChild(label);
    if (submenu&&item.submenu) {
      const arrow = document.createElement('span');
      arrow.style.cssText = 'color:var(--text-muted);font-size:10px;margin-left:20px;';
      arrow.textContent = '▸';
      row.appendChild(arrow);
    } else if (item.shortcut) {
      const sc = document.createElement('span');
      sc.style.cssText = 'color:var(--text-muted);font-size:10px;margin-left:20px;';
      sc.textContent = item.shortcut;
      row.appendChild(sc);
    }
    return row;
  }
};

;
/* Menu dropdown/submenu lifetime, shared navigation and popup placement. */
window._AppUIMenuPopup = (() => {
  function create({generation: _generation, execute: _executeAction}) {
    const _menuId = window._AppUIMenuModel.id;
    let _activeDropdown = null, _openMenuName = null;
    function _showDropdown(anchor, menuName, items) {
        _hideDropdown();
        const dd = window._AppUIMenuView.dropdown({id:_menuId(menuName),menuName,items});
        const generation=_generation.current();
        const current=()=>_generation.isCurrent(generation)&&_activeDropdown?.el===dd;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.separator) {
                dd.appendChild(window._AppUIMenuView.separator());
                continue;
            }
            const row=window._AppUIMenuView.row(item,{index:i,labelClass:'ai-menu-item-label',submenu:true});
            row.onmouseenter = () => { if(!current())return;row.style.background = 'var(--bg-hover)'; _hideSubmenu(dd); if (item.submenu) _showSubmenu(row, menuName, item); };
            row.onmouseleave = () => { if (current() && !item.submenu) row.style.background = ''; };
            row.onclick = (e) => {
                if(!current())return;
                e.stopPropagation();
                if (item.submenu) { _showSubmenu(row, menuName, item); return; }
                _hideDropdown();
                _executeAction(menuName, item);
            };
            dd.appendChild(row);
        }

        // Re-evaluate all checked states now that the dropdown is freshly shown
        window._AppUIMenuView.refreshChecked(dd,items);

        _bindMenuKeys(dd, () => { _hideDropdown(); anchor.focus(); },current);

        anchor.style.background = 'var(--bg-hover)';
        anchor.setAttribute('aria-expanded', 'true');
        anchor.appendChild(dd);
        _activeDropdown = {el: dd, anchor};
        _openMenuName = menuName;
    }

    function _bindMenuKeys(menu,close,isCurrent) {
        menu._appuiMenuKeys=window._AppUIMenuNavigation.bind({container:menu,isCurrent,onClose:close,
            getItems:()=>[...menu.querySelectorAll('[role="menuitem"]')],
            afterActivate:()=>_activeSubmenu?.el.querySelector('[role="menuitem"]')?.focus(),
        });
    }

    function _hideDropdown() {
        _hideSubmenu();
        if (_activeDropdown) {
            _activeDropdown.el._appuiMenuKeys?.destroy();
            _activeDropdown.el.remove();
            _activeDropdown.anchor.style.background = '';
            _activeDropdown.anchor.setAttribute('aria-expanded', 'false');
            _activeDropdown = null;
        }
        _openMenuName = null;
    }

    let _activeSubmenu = null;
    function _hideSubmenu(parentDropdown) {
        if (_activeSubmenu) {
            _activeSubmenu.el._appuiMenuKeys?.destroy();
            _activeSubmenu.el.remove();
            if (_activeSubmenu.row) _activeSubmenu.row.style.background = '';
            _activeSubmenu = null;
        }
    }
    function _showSubmenu(row, menuName, item) {
        _hideSubmenu();
        const sub = window._AppUIMenuView.submenu(row.getBoundingClientRect());
        const generation=_generation.current(),dropdown=_activeDropdown;
        const current=()=>_generation.isCurrent(generation)&&_activeDropdown===dropdown&&_activeSubmenu?.el===sub;
        (item.submenu || []).forEach(subItem => {
            if (subItem.separator) {
                sub.appendChild(window._AppUIMenuView.separator());
                return;
            }
            const subRow=window._AppUIMenuView.row(subItem);
            subRow.onmouseenter = () => {if(current())subRow.style.background = 'var(--bg-hover)';};
            subRow.onmouseleave = () => {if(current())subRow.style.background = '';};
            subRow.onclick = (e) => {
                if(!current())return;
                e.stopPropagation();
                _hideDropdown();
                _executeAction(menuName, subItem);
            };
            sub.appendChild(subRow);
        });
        _bindMenuKeys(sub, () => { _hideSubmenu(); row.focus(); },current);
        document.body.appendChild(sub);
        window._AppUIMenuView.positionSubmenu(sub,row.getBoundingClientRect());
        row.style.background = 'var(--bg-hover)';
        _activeSubmenu = {el: sub, row: row};
    }

    return {show: _showDropdown, close: _hideDropdown,
      get isOpen() {return !!_activeDropdown;},
      get name() {return _openMenuName;},
      focus() {_activeDropdown?.el.querySelector('[role="menuitem"]')?.focus();},
    };
  }
  return {create};
})();

;
/**
 * AppUI menu bar  --  renders application menus from pipeline definitions.
 * 
 * Menus are defined in pipeline JSON and serve three purposes:
 * 1. User-facing UI (clickable menu bar with dropdowns)
 * 2. LLM capability declaration (AI knows what actions exist)
 * 3. Keyboard shortcuts (dispatched centrally by AppUI)
 * 
 * Usage:
 *   <script src="/appui/loader.js"></script>
 *   <script>window.AppUIReady = AppUIAssets.load('shell');</script>
 *   <script>
 *     AppUIReady.then(() => AppUI.components.Menu.init({
 *       container: '#menu-bar',          // where to render
 *       pipeline: 'doc_studio',          // pipeline ID (loads from /api/pipeline.get)
 *       // OR
 *       definition: { menu: {...} },     // inline definition
 *       onAction: (menuId, itemId, params) => { ... },  // action handler
 *     }));
 *     
 *     // LLM can trigger:
 *     AppUI.components.Menu.trigger('File', 'save');
 *     AppUI.components.Menu.trigger('AI', 'review');
 *     
 *     // Get available actions (for LLM context):
 *     AppUI.components.Menu.getActions();  // [{menu, id, label, action, shortcut}, ...]
 *   </script>
 */
var AppUIMenu = window.AppUIMenu || (function() {
    const {items:_getItems,description:_getMenuDescription,id:_menuId,find:_findItem}=window._AppUIMenuModel;
    let _config = {};
    let _menuDef = {};
    let _container = null;
    let _createdContainer = false;
    let _actionHandler = null;
    let _outsideClickListener = null;
    let _source = null;
    const _generation=AppUILifecycle.generation();
    const popup=window._AppUIMenuPopup.create({generation:_generation,execute:_executeAction});

    function init(opts) {
        destroy();
        _config = opts;
        _actionHandler = opts.onAction || (() => {});

        if (opts.definition && opts.definition.menu) {
            _config._fullDef = opts.definition;
            _menuDef = opts.definition.menu;
            _render();
        } else if (opts.menu || opts.pipeline) {
            _source = window._AppUIMenuSource.create();
            _source.load(opts,definition=>{
                _config._fullDef=definition;
                _menuDef=definition.menu;
                _render();
            });
        }
    }

    function _render() {
        const generation=_generation.next();
        const current=()=>_generation.isCurrent(generation);
        popup.close();
        if(_createdContainer)_container?.remove();
        _createdContainer=false;
        _container = typeof _config.container === 'string'
            ? document.querySelector(_config.container)
            : _config.container;
        if (!_container) {
            _container = document.createElement('div');
            _container.id = 'ai-menu-bar';
            _createdContainer=true;
            document.body.prepend(_container);
        }

        window._AppUIMenuView.bar(_container);
        _container.innerHTML = '';

        for (const [menuName, menuValue] of Object.entries(_menuDef)) {
            const items = _getItems(menuValue);
            const menuBtn = window._AppUIMenuView.button({menuName, id: _menuId(menuName)});
            menuBtn.onmouseenter = () => { if (current() && popup.isOpen) popup.show(menuBtn, menuName, items); };
            menuBtn.onclick = (e) => {
                if(!current())return;
                e.stopPropagation();
                if (popup.name === menuName) {
                    popup.close();
                } else {
                    popup.show(menuBtn, menuName, items);
                }
            };
            menuBtn.onkeydown = (e) => {
                if(!current()||e.isComposing)return;
                if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    popup.show(menuBtn, menuName, items);
                    popup.focus();
                } else if (e.key === 'Escape') {
                    popup.close();
                } else if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    const buttons = [..._container.querySelectorAll('.ai-menu-top')];
                    const next = (buttons.indexOf(menuBtn) + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
                    buttons[next].focus();
                }
            };
            _container.appendChild(menuBtn);
        }

        // Close on outside click
        _outsideClickListener = (e) => {
            if(!current())return;
            if (popup.isOpen && !_container.contains(e.target)) {
                popup.close();
            }
        };
        document.addEventListener('click', _outsideClickListener);
    }

    function _executeAction(menuName, item) {
        _actionHandler(menuName, item.id, item.params || {}, item);
    }

    function destroy() {
        _generation.next();
        _source?.destroy(); _source=null;
        popup.close();
        if (_outsideClickListener) document.removeEventListener('click', _outsideClickListener);
        _outsideClickListener = null;
        if(_createdContainer)_container?.remove();
        _createdContainer=false;
        _container = null;
        _menuDef = {};
        _config = {};
        _actionHandler = null;
    }



    // --- Public API for LLM interaction ---

    function trigger(menuName, itemId) {
        /**
         * Trigger a menu action programmatically.
         * Used by LLM to drive the UI.
         */
        const menuValue = _menuDef[menuName];
        if (!menuValue) return {error: `Menu not found: ${menuName}`};
        const items = _getItems(menuValue);
        const item = _findItem(items, itemId);
        if (!item) return {error: `Item not found: ${menuName}.${itemId}`};
        _executeAction(menuName, item);
        return {ok: true, triggered: `${menuName}.${itemId}`};
    }

    function getActions() { return window._AppUIMenuModel.actions(_menuDef); }

    function setEnabled(menuName, itemId, enabled) {
        /** Enable/disable a menu item (visual + functional). */
        // For future implementation with DOM state tracking
    }

    return {
        init,
        destroy,
        trigger,
        getActions,
        setEnabled,
    };
})();
window.AppUIMenu = AppUIMenu;
