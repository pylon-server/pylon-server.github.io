/* Private draggable title-bar ownership for shared dialogs. */
var _AppUIDialogDrag = window._AppUIDialogDrag || {
  bind({overlay, box, titleBar}) {
    let sx = 0, sy = 0, ox = 0, oy = 0, placed = false;
    return window.AppUIPointerGesture.bind(titleBar, {
      cursor: 'move',
      shouldStart: event => overlay.isConnected && !event.target?.closest?.('button'),
      onStart(event) {
        const rect = box.getBoundingClientRect();
        if (!placed) {
          // Pin the current rect before moving out of the centering flex layout.
          overlay.style.display = 'block';
          box.style.position = 'fixed';
          box.style.left = rect.left + 'px';
          box.style.top = rect.top + 'px';
          box.style.margin = '0';
          placed = true;
        }
        sx = event.clientX; sy = event.clientY; ox = rect.left; oy = rect.top;
      },
      onMove(event) {
        const width = box.offsetWidth;
        const left = Math.max(8 - width + 60, Math.min(ox + event.clientX - sx, window.innerWidth - 60));
        const top = Math.max(0, Math.min(oy + event.clientY - sy, window.innerHeight - 40));
        box.style.left = left + 'px';
        box.style.top = top + 'px';
      },
    });
  }
};

;
/* Private native prompt and schema-form adapter for shared dialogs. */
var _AppUIDialogForms = window._AppUIDialogForms || {
  create({show, close}) {
    function confirm(msg, onYes, onNo, options = {}) {
      const body=msg&&typeof msg.nodeType==='number'?msg:'<p style="margin:0">'+msg+'</p>';
      const yes={text:options.confirmText||'OK',action:onYes};
      if(options.primary !== undefined)yes.primary=options.primary;
      if(options.danger !== undefined)yes.danger=options.danger;
      const no={text:options.cancelText||'Cancel',action:onNo};
      return show({title:options.title||'Confirm',body,signal:options.signal,onClose:options.onClose,
        ...(options.width !== undefined ? {width:options.width} : {}),
        buttons:options.cancelFirst?[no,yes]:[yes,no],
      });
    }
    function confirmAsync(msg, options = {}) {
      return new Promise(resolve => {
        let answered=false;
        const finish=value=>{if(!answered){answered=true;resolve(value);}};
        const overlay=confirm(msg,()=>finish(true),()=>finish(false),{...options,onClose:()=>{
          finish(false);options.onClose?.();
        }});
        if(!overlay)finish(false);
      });
    }
    let _promptSerial = 0;
    function prompt(msg, defaultVal, onOk, options = {}) {
      const input = document.createElement('input');
      input.id = 'ui-prompt-' + (++_promptSerial);
      input.value = defaultVal ?? '';
      input.style.cssText = 'width:100%;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-size:13px;outline:none';
      const submit = () => onOk?.(input.value);
      const overlay = show({title: msg, body: input, signal:options.signal,onClose:options.onClose,
        buttons: [{text: 'OK', action: submit}, {text: 'Cancel'}]});
      if(!overlay)return null;
      input.addEventListener('keydown', event => {
        if (!overlay.isConnected || event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();if (submit() !== false) close(overlay);
      });
      return overlay;
    }

    /**
     * Generate a dialog with a form from field definitions.
     * @param {object} opts - {title, note?, fields: [{name, type, label, placeholder, options, default, showIf}], onSubmit: (values) => {}}
     *   note: a short muted line above the fields (scope / caveats of the form)
     */
    function form(opts) {
      const fields = opts.fields || [];
      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
      if (opts.note) {
        const note = document.createElement('div');
        note.className = 'ui-dialog-note';
        note.style.cssText = 'font-size:11px;color:var(--text-muted)';
        note.textContent = opts.note;
        body.appendChild(note);
      }
      const inputs = new Map(), labels = new Map();
      fields.forEach(field => {
        const label = document.createElement('label');
        label.style.cssText = 'font-size:11px;color:var(--text-muted);display:block';
        label.textContent = field.label || field.name;
        const input = document.createElement(field.type === 'select' ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
        input.id = 'dlg-f-' + field.name;
        input.setAttribute('aria-label', field.label || field.name);
        input.className = field.type === 'select' ? 'ui-select' : 'ui-input';
        input.style.cssText = 'width:100%;margin-top:2px;font-size:11px';
        if (field.type === 'select') {
          (field.options || []).forEach(option => {
            const item = document.createElement('option');
            item.value = typeof option === 'object' ? (option.v ?? option.value) : option;
            item.textContent = typeof option === 'object' ? (option.l ?? option.label) : option;
            input.appendChild(item);
          });
          if (field.default != null) input.value = field.default;
        } else if (field.type === 'checkbox') {
          input.type = 'checkbox'; input.checked = !!field.default;
          input.style.width = 'auto';
        } else {
          if (field.type === 'textarea') {input.rows = field.rows || 3; input.style.resize = 'vertical';}
          else input.type = field.type || 'text';
          input.placeholder = field.placeholder || '';
          input.value = field.default ?? '';
        }
        input.required = !!field.required;
        if (field.disabled) input.disabled = true;
        for (const property of ['min', 'max', 'step', 'pattern', 'maxLength']) {
          if (field[property] != null) input[property] = field[property];
        }
        label.appendChild(input);body.appendChild(label);
        inputs.set(field.name, input);labels.set(field.name, label);
      });
      const values = () => Object.fromEntries(fields.map(field => [field.name,
        field.type === 'checkbox' ? inputs.get(field.name).checked : inputs.get(field.name).value]));
      const submit = () => {
        if (opts.signal?.aborted) return false;
        for (const field of fields) {
          const input = inputs.get(field.name);
          if (input.disabled || labels.get(field.name).style.display === 'none') continue;
          if (input.checkValidity?.() === false) {input.reportValidity?.(); return false;}
        }
        return opts.onSubmit?.(values());
      };
      const overlay = show({
        title: opts.title || 'Form', body, width: opts.width || '400px',
        buttons: [{text: opts.submitLabel || 'Submit', action: submit}, {text: 'Cancel'}],
        onClose: opts.onClose, signal:opts.signal
      });
      if (!overlay) return null;
      fields.forEach(field => {
        if (!field.showIf) return;
        const update = () => {labels.get(field.name).style.display = field.showIf(values()) ? '' : 'none';};
        inputs.forEach(input => input.addEventListener('change', update));
        update();
      });
      if (opts.submitOnEnter) {
        inputs.forEach(input => input.addEventListener('keydown', event => {
          if (!overlay.isConnected || event.key !== 'Enter' || event.isComposing || input.tagName !== 'INPUT' || input.type === 'checkbox') return;
          event.preventDefault();if (submit() !== false) close(overlay);
        }));
      }
      return overlay;
    }

    return {confirm, confirmAsync, prompt, form};
  }
};

;
/* Generic background-job dialog. Closing the view does not stop completion sync. */
var _AppUIDialogJob = window._AppUIDialogJob || {
  create({show,close}) {
    // waitJob(id) (optional): a LONG-POLL fetch (work_runner.wait with a short
    // timeout_s) used instead of getJob - it returns at completion or after its
    // own budget, so the next round starts at once instead of after pollInterval.
    return function job({title='Job progress',submit,getJob,waitJob,cancelJob,onComplete,signal,pollInterval=1000}={}) {
      const body=document.createElement('div'),status=document.createElement('p'),meter=document.createElement('progress'),detail=document.createElement('p');
      status.setAttribute('role','status');status.textContent='Queuing…';meter.max=1;body.append(status,meter,detail);
      let id,timer,stopped=false,completed=false,busy=false;
      const stop=()=>{stopped=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);};
      signal?.addEventListener('abort',stop,{once:true});
      if(signal?.aborted)stop();
      const dialog=show({title,body,signal,buttons:[...(cancelJob?[{text:'Cancel job',action:()=>{if(id&&!completed)Promise.resolve().then(()=>cancelJob(id)).catch(error=>{detail.textContent=error.message;});return false;}}]:[]),{text:'Close',primary:true}]});
      async function poll(){
        if(stopped||busy||!id)return;busy=true;let delay=pollInterval;
        try{
          const record=await (waitJob||getJob)(id);if(stopped)return;
          if(waitJob)delay=50;
          const terminal=['done','failed','error','cancelled'].includes(record.status);
          const failed=record.status!=='done'||record.op_result?.ok===false;
          status.textContent=terminal?(failed?'Job '+(record.status==='done'?'failed':record.status):'Completed'):record.status;
          detail.textContent=record.error||record.op_result?._error||record.progress?.detail||'Waiting for worker';
          // Terminal jobs must never retain an indeterminate (animated) meter.
          if(terminal)meter.value=failed?Math.max(0,Math.min(1,Number(record.progress?.fraction)||0)):1;
          else if(record.progress?.fraction!=null)meter.value=record.progress.fraction;else meter.removeAttribute('value');
          if(terminal){
            if(!failed){detail.textContent='Updating results…';await onComplete?.(record);detail.textContent=record.op_result?.title?'Saved: '+record.op_result.title+' · '+(record.op_result.items?.length||0)+' places':'Results updated.';}
            completed=true;stop();
          }
        }catch(error){status.textContent='Progress / result refresh unavailable';detail.textContent=error.message+' · retrying';}
        finally{busy=false;if(!stopped)timer=setTimeout(poll,delay);}
      }
      const ready=Promise.resolve().then(async()=>{if(stopped)return null;id=await submit();if(!id)throw new Error('Worker returned no job identity');poll();return id;}).catch(error=>{status.textContent='Could not start job';detail.textContent=error.message;meter.value=0;stop();throw error;});
      ready.catch(()=>{});
      return {dialog,ready,destroy(){stop();if(dialog)close?.(dialog);}};
    };
  }
};

;
/* Private DOM construction for shared modal dialogs. */
window._AppUIDialogView = {
  create({opts,z,titleId,onClose,onAction}) {
    const title = opts.title || '';
    const body = opts.body || '';
    const buttons = opts.buttons || [{text: 'OK'}];
    const width = opts.width || '420px';
    const closable = opts.closable !== false;
    const overlay = document.createElement('div');
    overlay.className = 'ui-dialog-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:' + z + ';background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';

    const box = document.createElement('div');
    box.className = 'ui-dialog-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;width:' + width + ';max-width:90vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);color:var(--text-primary);overflow:hidden;';

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.style.cssText = 'display:flex;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;cursor:move;user-select:none;touch-action:none;';
    const titleEl = document.createElement('span');
    titleEl.id = titleId;
    box.setAttribute('aria-labelledby', titleEl.id);
    titleEl.style.cssText = 'font-weight:600;font-size:14px;flex:1;';
    titleEl.textContent = title;
    titleBar.appendChild(titleEl);
    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close dialog');
      closeBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;border-radius:4px;';
      closeBtn.textContent = '✕';
      closeBtn.onmouseenter = function() { this.style.color = 'var(--text-primary)'; this.style.background = 'var(--bg-hover)'; };
      closeBtn.onmouseleave = function() { this.style.color = 'var(--text-muted)'; this.style.background = 'none'; };
      closeBtn.onclick = function() { onClose(); };
      titleBar.appendChild(closeBtn);
    }
    box.appendChild(titleBar);

    // Content area
    const content = document.createElement('div');
    content.className = 'ui-dialog-content';
    content.style.cssText = 'padding:16px;flex:1;overflow-y:auto;font-size:13px;line-height:1.6;';
    if (body && typeof body.nodeType === 'number') content.appendChild(body);
    else content.innerHTML = body;
    box.appendChild(content);

    // Bottom button area
    if (buttons.length > 0) {
      const footer = document.createElement('div');
      footer.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid var(--border);flex-shrink:0;';
      // Which button gets the accent (primary) styling: honor an explicit
      // `primary:true` flag on any button when one is declared — so the POSITIVE
      // action (Apply/Save/OK) is highlighted regardless of position. Only fall
      // back to "first button is primary" when NO button declares the flag
      // (keeps legacy dialogs that relied on first-is-primary unchanged).
      const flaggedPrimary = buttons.findIndex(b => b && b.primary);
      const primaryIndex = flaggedPrimary >= 0 ? flaggedPrimary : 0;
      buttons.forEach((b, i) => {
        const btn = document.createElement('button');
        const isPrimary = i === primaryIndex;
        if (isPrimary) btn.className = 'ui-dialog-primary';
        btn.style.cssText = isPrimary
          ? 'background:var(--accent);color:var(--text-inverse);border:none;border-radius:4px;padding:6px 18px;cursor:pointer;font-size:13px;font-weight:500;'
          : 'background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:6px 18px;cursor:pointer;font-size:13px;';
        btn.textContent = b.text || 'OK';
        btn.disabled = !!b.disabled;
        btn.onclick = () => { if (!btn.disabled) onAction(b); };
        footer.appendChild(btn);
      });
      box.appendChild(footer);
    }

    overlay.appendChild(box);
    return {overlay,box,content,titleBar};
  }
};

;
/**
 * UI/Dialog  --  modal dialog, confirm, and prompt.
 *
 * Layout:
 *   +- Title -------------------- [✕] -+
 *   |                                    |
 *   |  Content                           |
 *   |                                    |
 *   +------------------------------------+
 *   |              [Cancel] [OK]         |
 *   +------------------------------------+
 *
 * Usage:
 *   AppUIDialog.show({title:'Confirm', body:'Are you sure?', buttons:[{text:'Yes',action:fn}]});
 *   AppUIDialog.confirm('Delete this?', () => doDelete());
 *   AppUIDialog.prompt('Enter name', 'default', (val) => rename(val));
 */
var AppUIDialog = window.AppUIDialog || (function() {
  // Stack of open dialogs (LIFO). Each entry: {overlay, keyHandler, focusTimer}.
  // Dialogs STACK — opening a new one renders it ABOVE the current instead of
  // replacing it, so a dialog can open another dialog (e.g. an image preview
  // over a detail dialog). ``close()`` closes only the TOPMOST; Escape /
  // overlay-click / a button close the dialog they belong to. Back-compat: the
  // public API (show/close/confirm/prompt/form) is unchanged; single-dialog
  // callers behave exactly as before.
  const _stack = [];
  let _dialogSerial = 0;
  const _BASE_Z = 99999;   // first dialog z-index; each stacked level adds +10

  function _top() { return _stack.length ? _stack[_stack.length - 1] : null; }

  const _background = new Map();
  let _backgroundObserver = null;
  function _isolate() {
    const top = _top();
    if (!top) {
      _backgroundObserver?.disconnect();
      _backgroundObserver = null;
      _background.forEach((value, element) => {
        if (value === null) element.removeAttribute('inert');
        else element.setAttribute('inert', value);
      });
      _background.clear();
      return;
    }
    Array.from(document.body.children).forEach(element => {
      if (!_background.has(element)) _background.set(element, element.getAttribute('inert'));
      if (element === top.overlay) element.removeAttribute('inert');
      else element.setAttribute('inert', '');
    });
    if (!_backgroundObserver) {
      _backgroundObserver = new MutationObserver(_isolate);
      _backgroundObserver.observe(document.body, {childList: true});
    }
  }
  function _focusable(box) {
    return Array.from(box.querySelectorAll('a[href],button,input,textarea,select,[tabindex],[contenteditable="true"]'))
      .filter(element => !element.matches(':disabled') && element.tabIndex >= 0 &&
        !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  }
  function _focus(entry) {
    if (!entry || !entry.overlay.isConnected) return;
    const items = _focusable(entry.box);
    (items.find(element => element.matches('input,textarea,select')) ||
      items.find(element => element.classList.contains('ui-dialog-primary')) || items[0] || entry.box).focus();
  }

  function show(opts) {
    if (opts.signal?.aborted) {opts.onClose?.();return null;}
    const closable = opts.closable !== false;
    const opener = document.activeElement;

    // Do NOT close existing dialogs — stack on top. z-index rises per level so
    // the new overlay (and its darkening backdrop) sits above the ones below.
    const z = _BASE_Z + _stack.length * 10;
    const {overlay,box,content,titleBar}=window._AppUIDialogView.create({opts,z,
      titleId:'ui-dialog-title-'+(++_dialogSerial),onClose:()=>_closeOverlay(overlay),
      onAction:button=>{
        if(!overlay.isConnected||!_stack.some(entry=>entry.overlay===overlay)||opts.signal?.aborted)return;
        if(button.action?.()===false)return;
        _closeOverlay(overlay);
      }
    });
    // Close on a genuine OUTSIDE click only. A click whose target is the overlay
    // can be the TAIL of a text-selection drag that STARTED inside the box and
    // ended on the overlay (mousedown in box → drag → mouseup on overlay fires a
    // `click` targeted at the overlay) — that must NOT close the dialog. So we
    // require the pointer to have gone DOWN on the overlay itself, not inside the
    // box. Track the mousedown origin and only close when both down and up/click
    // happened on the overlay backdrop.
    let _downOnOverlay = false;
    overlay.addEventListener('mousedown', (e) => { _downOnOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => {
      const ok = _downOnOverlay && e.target === overlay && closable;
      _downOnOverlay = false;
      if (ok) _closeOverlay(overlay);
    });
    document.body.appendChild(overlay);

    const drag = _AppUIDialogDrag.bind({overlay, box, titleBar});

    box.tabIndex = -1;
    const focusTimer = setTimeout(() => {
      if (_top()?.overlay === overlay) _focus(_top());
    }, 50);

    // Escape closes only the TOP dialog (this one, while it stays on top).
    const keyHandler = (e) => {
      if (_top()?.overlay !== overlay) return;
      if (e.key === 'Tab') {
        const items = _focusable(box);
        const index = items.indexOf(document.activeElement);
        if (!items.length || index < 0 || (!e.shiftKey && index === items.length - 1) || (e.shiftKey && index === 0)) {
          e.preventDefault();
          (items[e.shiftKey ? items.length - 1 : 0] || box).focus();
        }
      }
      if (e.key === 'Escape' && closable) {
        e.preventDefault();
        e.stopImmediatePropagation();
        _closeOverlay(overlay);
      }
    };
    document.addEventListener('keydown', keyHandler, true);
    const focusHandler = event => {
      if (_top()?.overlay === overlay && !box.contains(event.target)) _focus(_top());
    };
    document.addEventListener('focusin', focusHandler);

    // Stop keyboard shortcuts from leaking out of dialog inputs (except Escape)
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return; // let Escape bubble to close the dialog
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        e.stopPropagation();
      }
    });

    const abortHandler = () => _closeOverlay(overlay);
    _stack.push({overlay, box, opener, drag, keyHandler, focusHandler, focusTimer, onClose: opts.onClose, signal:opts.signal, abortHandler});
    _isolate();
    _focus(_top());
    opts.signal?.addEventListener('abort', abortHandler, {once:true});
    if (opts.signal?.aborted) abortHandler();
    return overlay;
  }

  // Tear down a specific overlay (from its own close button / backdrop / Escape),
  // regardless of stack position, and remove it from the stack.
  function _closeOverlay(overlay) {
    for (let i = _stack.length - 1; i >= 0; i--) {
      if (_stack[i].overlay === overlay) {
        const entry = _stack[i];
        const wasTop = entry === _top();
        entry.drag.destroy();
        if (entry.focusTimer != null) clearTimeout(entry.focusTimer);
        entry.signal?.removeEventListener('abort', entry.abortHandler);
        document.removeEventListener('keydown', entry.keyHandler, true);
        document.removeEventListener('focusin', entry.focusHandler);
        try { entry.overlay.remove(); } catch (_e) { /* ignore */ }
        _stack.splice(i, 1);
        _isolate();
        if (wasTop) {
          const top = _top();
          if (entry.opener?.isConnected && !entry.opener.closest('[inert]') && (!top || top.box.contains(entry.opener))) entry.opener.focus();
          else _focus(top);
        }
        if (entry.onClose) entry.onClose();
        return;
      }
    }
  }

  // With an overlay, close that instance; otherwise close the topmost dialog.
  function close(overlay) {
    if (overlay) { _closeOverlay(overlay); return; }
    const t = _top();
    if (t) _closeOverlay(t.overlay);
  }

  const {confirm, confirmAsync, prompt, form} = _AppUIDialogForms.create({show, close});
  const job = _AppUIDialogJob.create({show,close});

  return { show, close, confirm, confirmAsync, prompt, form, job };
})();
window.AppUIDialog = AppUIDialog;
