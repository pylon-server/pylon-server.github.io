/**
 * url-fields.js — AppUIUrlFields: generic URL-param → DOM field routing.
 *
 * The PARAM NAME IS THE ARGUMENT: each plain query param prefills the DOM
 * control whose name it is — resolved as a configurable ALIAS, then `#id`, then
 * `[name="…"]`, then a matching name. Raw selector parameters are rejected. The
 * value is written per element type (checkbox/radio → checked;
 * select/input/textarea → value) and an `input`+`change` event is dispatched so
 * the control's existing handlers run. Fields built LAZILY (dialogs, toolbars)
 * are caught by a bounded MutationObserver for a short window.
 *
 * This is the framework home for the "name an element `id=foo` and `?foo=` sets
 * it" convention, so any AppUI page gets it (not just one app).
 *
 *   AppUIUrlFields.apply({ aliases, reserved, root, search, onSet })  → remaining[]
 *   AppUIUrlFields.set(name, value, opts)                             → bool
 *   AppUIUrlFields.watch(opts)                                        → stop()
 *   AppUIUrlFields.init(opts)   // apply now + watch for late fields
 *
 * `aliases`: { argName: cssSelector } · `reserved`: { name: 1 } (skipped) ·
 * `onSet(name,value,el)`: optional hook (e.g. to stash a value an app needs
 * even when no element exists). Params starting with `appui.` are always skipped
 * (they belong to AppUIRouter).
 */
const AppUIUrlFields = (function () {
  'use strict';

  // Explicit schema for deep links. Input is untrusted; never carry secrets or
  // turn URL input into an operation. Existing apply/init callers retain their API.
  function safeKey(name) {
    return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name) &&
      !/token|password|passwd|secret|api[-_]?key|authorization|cookie|credential[-_]?value|private[-_]?key|(?:^|[-_])pass(?:$|[-_])/i.test(name);
  }
  function validated(schema, name, value) {
    if (!safeKey(name) || !Object.prototype.hasOwnProperty.call(schema, name)) return null;
    var rule = schema[name];
    if (!rule || typeof value !== 'string' || value.length > (rule.maxLength || 512) || /[\u0000-\u001f\u007f]/.test(value)) return null;
    if (rule.values && !rule.values.includes(value)) return null;
    if (rule.pattern && !rule.pattern.test(value)) return null;
    if (rule.url) {
      try {
        var u = new URL(value);
        if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) return null;
      } catch (e) { return null; }
    }
    return value;
  }
  function read(schema, search) {
    var params = _params(search), out = Object.create(null);
    Object.keys(schema || {}).forEach(function(name) {
      var all = params.getAll(name);
      if (all.length !== 1) return;
      var value = validated(schema, name, all[0]);
      if (value !== null) out[name] = value;
    });
    return out;
  }
  function link(path, values, schema) {
    if (typeof path !== 'string' || !/^\/apps\/[a-z0-9_-]+\/[a-z0-9_-]+\/(?:[a-zA-Z0-9_-]+\.htm)?$/.test(path)) throw new Error('Expected an AppUI application path');
    var params = new URLSearchParams();
    Object.keys(values || {}).forEach(function(name) {
      var value = validated(schema || {}, name, String(values[name]));
      if (value === null) throw new Error('Invalid or undeclared deep-link field: ' + name);
      params.set(name, value);
    });
    return path + (params.toString() ? '?' + params.toString() : '');
  }
  function prefill(root, schema, options) {
    options = options || {};
    var values = read(schema, options.search), applied = [];
    Object.keys(values).forEach(function(name) {
      var rule = schema[name], el;
      if (!rule.selector) return;
      try { el = root.querySelector(rule.selector); } catch(e) { return; }
      if (!el || !safeElement(el) || el.disabled || el.readOnly) return;
      if (options.emptyOnly && el.value) return;
      if (el.tagName === 'SELECT' && !Array.from(el.options).some(o => o.value === values[name])) return;
      if (el.type === 'checkbox') el.checked = values[name] === 'true' || values[name] === '1';
      else el.value = values[name];
      // Initial state only; explicit app code may update presentation, not submit.
      applied.push(name);
    });
    if (applied.length && options.focus) {
      var target = root.querySelector(options.focus);
      if (target && !target.disabled) target.focus();
    }
    return applied;
  }
  function safeElement(el) {
    var type = (el.type || '').toLowerCase(), tag = (el.tagName || '').toLowerCase();
    return ['select','textarea','input'].includes(tag) &&
      !['password','hidden','file','button','submit','reset','image'].includes(type) &&
      ![el.id,el.name,el.getAttribute && el.getAttribute('autocomplete')].some(function(v) {
        return v && /token|password|passwd|secret|api[-_]?key|authorization|cookie|private[-_]?key|(?:^|[-_])pass(?:$|[-_])/i.test(v);
      });
  }

  function _params(search) {
    try { return new URLSearchParams(search != null ? search : window.location.search); }
    catch (e) { return new URLSearchParams(''); }
  }

  function _resolve(name, aliases, root) {
    root = root || document;
    var el = null;
    if (aliases && aliases[name]) {
      try { el = root.querySelector(aliases[name]); } catch (e) {}
      if (el) return el;
    }
    try { el = document.getElementById(name); if (el && root !== document && !root.contains(el)) el = null; } catch (e) {}
    if (!el) {
      var sel;
      try { sel = (window.CSS && CSS.escape) ? CSS.escape(name) : name.replace(/"/g, '\\"'); }
      catch (e) { sel = name; }
      try { el = root.querySelector('[name="' + sel + '"]'); } catch (e) {}
    }
    if (!el && /^[#.\[]/.test(name)) { try { el = root.querySelector(name); } catch (e) {} }
    return el;
  }

  function set(name, value, opts) {
    opts = opts || {};
    if (!safeKey(name)) return false;
    var el = _resolve(name, opts.aliases, opts.root);
    if (el && (!safeElement(el) || el.disabled || el.readOnly)) return false;
    if (typeof opts.onSet === 'function') { try { opts.onSet(name, value, el); } catch (e) {} }
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    var type = (el.type || '').toLowerCase();
    try {
      if (type === 'checkbox' || type === 'radio') {
        el.checked = (value === '1' || value === 'true' || value === 'on' || value === el.value);
      } else if (tag === 'select' || tag === 'input' || tag === 'textarea') {
        el.value = value;
      } else {
        return false;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }

  // Apply every eligible param once. Returns the params NOT yet applied (their
  // field may mount later → feed to watch()).
  function apply(opts) {
    opts = opts || {};
    var reserved = opts.reserved || {};
    var remaining = [];
    _params(opts.search).forEach(function (value, name) {
      if (!safeKey(name) || name.indexOf('appui.') === 0 || reserved[name]) return;
      if (!set(name, value, opts)) remaining.push({ name: name, value: value });
    });
    return remaining;
  }

  // Watch the DOM for lazily-built fields and apply the remaining params as they
  // appear, for `timeoutMs` (default 15s). Returns a stop() fn.
  function watch(opts) {
    opts = opts || {};
    var remaining = opts.remaining || apply(opts);
    if (!remaining.length || !window.MutationObserver) return function () {};
    var deadline = Date.now() + (opts.timeoutMs || 15000);
    var obs = new MutationObserver(function () {
      remaining = remaining.filter(function (p) { return !set(p.name, p.value, opts); });
      if (!remaining.length || Date.now() > deadline) { try { obs.disconnect(); } catch (e) {} }
    });
    try { obs.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(function () { try { obs.disconnect(); } catch (e) {} }, opts.timeoutMs || 15000);
    return function () { try { obs.disconnect(); } catch (e) {} };
  }

  // Convenience: apply now + watch for late fields in one call.
  function init(opts) {
    opts = opts || {};
    var remaining = apply(opts);
    var o = {}; for (var k in opts) o[k] = opts[k];
    o.remaining = remaining;
    return watch(o);
  }

  const credentialSchema = Object.freeze({
    name: {selector:'#f-name',pattern:/^[a-zA-Z0-9_.-]{1,100}$/},
    product: {selector:'#f-product',pattern:/^[a-zA-Z0-9_.-]{1,80}$/},
    url: {selector:'#f-url',url:true,maxLength:1024},
    type: {selector:'#f-type',values:['bearer','private-token','basic','botpassword','cookie']},
    service: {values:['custom']},
    user: {selector:'#f-user',maxLength:128},
    expires_at: {selector:'#f-expires_at',pattern:/^\d{4}-\d{2}-\d{2}$/}
  });
  return { credentialSchema: credentialSchema, apply: apply, set: set, watch: watch, init: init, read: read, link: link, prefill: prefill, _resolve: _resolve };
})();

if (typeof window !== 'undefined') window.AppUIUrlFields = AppUIUrlFields;
if (typeof module !== 'undefined' && module.exports) module.exports = AppUIUrlFields;
