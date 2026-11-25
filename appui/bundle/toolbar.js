/* Toolbar item rendering and owned control bindings. */
window._AppUIToolbarItems = (() => {
  function append(container, item, onCommand, scope) {
    if (!item) return null;
    if (typeof item === 'function') {
      const mounted = item(container);
      scope.add(mounted);
      return mounted || null;
    }
    if (item.separator) {
      const separator = document.createElement('span');
      separator.className = 'appui-toolbar-separator';
      separator.setAttribute('role', 'separator');
      container.appendChild(separator);
      return separator;
    }
    if (item.render) {
      const mounted = item.render(container);
      scope.add(mounted);
      return mounted || null;
    }

    let control, root;
    if (item.type === 'text') {
      control = document.createElement('span');
      control.className = 'appui-toolbar-text';
      control.textContent = item.label ?? item.text ?? '';
      if (item.title != null) control.title = item.title;
    } else if (item.type === 'checkbox') {
      root = document.createElement('label'); root.className = 'appui-toolbar-checkbox';
      root.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
      control = document.createElement('input'); control.type = 'checkbox';
      control.checked = !!item.checked; control.disabled = !!item.disabled;
      const caption = document.createElement('span'); caption.textContent = item.label ?? item.text ?? '';
      root.append(control, caption);
      scope.listen(control, 'change', event => {if (!scope.destroyed && !control.disabled) item.onChange?.(event.target.checked, event);});
    } else if (item.type === 'input' || item.type === 'search') {
      control = document.createElement('input');
      control.type = item.type === 'search' ? 'search' : (item.inputType || 'text');
      control.placeholder = item.placeholder || '';
      control.value = item.value ?? '';
      const delay = Number(item.debounceMs);
      if (Number.isFinite(delay) && delay > 0) {
        let timer = null, version = 0;
        scope.add(() => {version++; if (timer !== null) clearTimeout(timer); timer = null;});
        scope.listen(control, 'input', event => {
          if (scope.destroyed) return;
          const request = ++version, value = event.target.value;
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => {
            if (scope.destroyed || version !== request) return;
            timer = null;
            item.onInput?.(value, event);
          }, delay);
        });
      } else {
        scope.listen(control, 'input', event => {if (!scope.destroyed) item.onInput?.(event.target.value, event);});
      }
      scope.listen(control, 'change', event => {if (!scope.destroyed) item.onChange?.(event.target.value, event);});
    } else if (item.type === 'select') {
      control = document.createElement('select');
      (item.options || []).forEach(option => {
        const el = document.createElement('option');
        const value = typeof option === 'object' ? option.value : option;
        el.value = value;
        el.textContent = typeof option === 'object' ? option.label : option;
        el.selected = value === item.value;
        control.appendChild(el);
      });
      scope.listen(control, 'change', event => {if (!scope.destroyed) item.onChange?.(event.target.value, event);});
    } else if (item.type === 'segmented') {
      // A small view switch: one button per option, exactly one selected.
      //   {type:'segmented', options:[{value,label,title?}|'value'], value, onChange(value, event)}
      // The returned element has setValue(value) for programmatic switches.
      control = document.createElement('span');
      control.className = 'appui-toolbar-segmented';
      control.setAttribute('role', 'radiogroup');
      control.style.cssText = 'display:inline-flex;gap:0';
      const buttons = [];
      const select = (value, event, notify) => {
        buttons.forEach(([button, v]) => {
          const on = v === value;
          button.classList.toggle('primary', on);
          button.setAttribute('aria-checked', on ? 'true' : 'false');
          button.tabIndex = on ? 0 : -1;
        });
        if (notify && !scope.destroyed) item.onChange?.(value, event);
      };
      (item.options || []).forEach((option, index, all) => {
        const value = typeof option === 'object' ? option.value : option;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'appui-toolbar-button';
        button.setAttribute('role', 'radio');
        button.textContent = typeof option === 'object' ? (option.label ?? String(value)) : String(option);
        if (typeof option === 'object' && option.title) button.title = option.title;
        // joined edges so the group reads as one control
        if (index > 0) button.style.borderTopLeftRadius = button.style.borderBottomLeftRadius = '0';
        if (index < all.length - 1) { button.style.borderTopRightRadius = button.style.borderBottomRightRadius = '0'; button.style.marginRight = '-1px'; }
        scope.listen(button, 'click', event => select(value, event, true));
        scope.listen(button, 'keydown', event => {
          const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          event.preventDefault();
          const next = buttons[(index + step + buttons.length) % buttons.length];
          next[0].focus(); select(next[1], event, true);
        });
        buttons.push([button, value]);
        control.appendChild(button);
      });
      select(item.value ?? (buttons[0] && buttons[0][1]), null, false);
      control.setValue = value => select(value, null, true);
    } else {
      control = document.createElement('button');
      control.type = 'button';
      control.className = `appui-toolbar-button${item.primary ? ' primary' : ''}`;
      control.textContent = item.label ?? item.text ?? item.id ?? 'Action';
      control.title = item.title || item.label || '';
      control.disabled = !!item.disabled;
      scope.listen(control, 'click', event => {
        if (scope.destroyed) return;
        if (item.command && typeof onCommand === 'function') {
          onCommand(item.command, item.params || {}, {type: 'toolbar', item, event});
        } else {
          item.action?.(event);
        }
      });
    }
    if (item.ariaLabel != null) control.setAttribute('aria-label', String(item.ariaLabel));
    if (item.id) control.id = item.id;
    const classes = item.className?.split(/\s+/).filter(Boolean) || [];
    if (classes.length) control.classList.add(...classes);
    container.appendChild(root || control);
    return control;
  }

  return {append};
})();

;
/* AppUI toolbar: a standard content.top title, controls, and actions region. */
const AppUIToolbar = (function() {
  const {append} = window._AppUIToolbarItems;
  const bindings = new WeakMap();
  function create(opts) {
    opts = opts || {};
    const container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : opts.container;
    if (!container) throw new Error('AppUIToolbar: container not found');
    if (opts.signal?.aborted) return {element: null, main: null, right: null, append: () => null, destroy() {}};
    bindings.get(container)?.destroy();
    const scope = AppUILifecycle.createScope();

    container.replaceChildren();
    const toolbar = document.createElement('div');
    toolbar.className = 'appui-toolbar' + (opts.variant === 'inline' ? ' appui-toolbar-inline' : '');
    if (opts.orientation === 'vertical') {
      toolbar.classList.add('appui-toolbar-vertical');
      toolbar.setAttribute('aria-orientation', 'vertical');
    }
    toolbar.setAttribute('role', 'toolbar');
    if (opts.label) toolbar.setAttribute('aria-label', opts.label);

    const main = document.createElement('div');
    main.className = 'appui-toolbar-main';
    const right = document.createElement('div');
    right.className = 'appui-toolbar-right';
    toolbar.append(main, right);
    container.appendChild(toolbar);

    if (opts.title || opts.subtitle) {
      const heading = document.createElement('div');
      heading.className = 'appui-toolbar-heading';
      if (opts.title) {
        const title = document.createElement('strong');
        title.className = 'appui-toolbar-title';
        title.textContent = opts.title;
        heading.appendChild(title);
      }
      if (opts.subtitle) {
        const subtitle = document.createElement('span');
        subtitle.className = 'appui-toolbar-subtitle';
        subtitle.textContent = opts.subtitle;
        heading.appendChild(subtitle);
      }
      main.appendChild(heading);
    }

    const controls = document.createElement('div');
    controls.className = 'appui-toolbar-controls';
    main.appendChild(controls);
    const onCmd = opts.onCommand;
    (opts.items || []).forEach(item => append(controls, item, onCmd, scope));
    (opts.right || []).forEach(item => append(right, item, onCmd, scope));

    let destroyed = false;
    const api = {
      element: toolbar,
      main,
      right,
      append: item => destroyed ? null : append(controls, item, onCmd, scope),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        try { scope.destroy(); }
        finally {
          toolbar.remove();
          if (bindings.get(container) === api) bindings.delete(container);
        }
      },
    };
    bindings.set(container, api);
    if (opts.signal) {
      scope.listen(opts.signal, 'abort', () => api.destroy(), {once: true});
      if (opts.signal.aborted) api.destroy();
    }
    return api;
  }


  return { create };
})();
window.AppUIToolbar = AppUIToolbar;
