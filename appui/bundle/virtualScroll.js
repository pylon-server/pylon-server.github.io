/* Private height indexing and viewport ranges for shared virtual lists. */
window._AppUIVirtualScrollModel = {
  create({rowHeight,getRowHeight}) {
    let items=[],offsets=null;
    function offsetAt(index) { return offsets ? offsets[index] : index * rowHeight; }
    function indexAtOffset(offset) {
      if (!items.length) return -1;
      if (!offsets) return Math.max(0, Math.min(items.length - 1, Math.floor(offset / rowHeight)));
      let low = 0, high = items.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (offsets[middle + 1] <= offset) low = middle + 1;
        else high = middle;
      }
      return Math.min(low, items.length - 1);
    }

    function setItems(next) {
      items=next;offsets=getRowHeight?[0]:null;
      if(offsets)items.forEach((item,index)=>{
        const measured=Number(getRowHeight(item,index));
        offsets.push(offsets[index]+(Number.isFinite(measured)&&measured>0?measured:rowHeight));
      });
    }
    function range(scrollTop,height,buffer) {
      const visibleCount=Math.ceil(height/rowHeight);
      const start=offsets?Math.max(0,indexAtOffset(scrollTop)-buffer):Math.min(
        Math.max(0,Math.floor(scrollTop/rowHeight)-buffer),Math.max(0,items.length-visibleCount-buffer));
      const end=offsets?Math.min(items.length,indexAtOffset(scrollTop+height)+buffer+1)
        :Math.min(items.length,start+visibleCount+buffer*2);
      return {start,end};
    }
    return {setItems,offsetAt,indexAtOffset,range,clear(){items=[];offsets=null;}};
  },
};

;
/**
 * AppUIVirtualScroll  --  renders only visible rows for large lists
 *
 * Usage:
 *   const vs = AppUIVirtualScroll.create({
 *     container: document.getElementById('fileTableWrap'),
 *     content: document.getElementById('fileRows'),
 *     rowHeight: 30,
 *     buffer: 20,
 *     renderRow: (item, idx) => {
 *       const tr = document.createElement('tr');
 *       tr.textContent = item.name;
 *       return tr;
 *     }
 *   });
 *   vs.setItems(largeArray);
 *   vs.refresh();
 *   vs.destroy();
 *
 * Options:
 *   - container: scrollable parent element (must have fixed/known height)
 *   - content: element where rows are rendered (e.g., tbody)
 *   - rowHeight: fixed row height in px (default: 30)
 *   - getRowHeight(item, index): optional known height for mixed-height rows
 *   - buffer: extra rows to render above/below viewport (default: 20)
 *   - threshold: minimum item count to enable virtual scrolling (default: 500)
 *   - renderRow(item, index): returns a DOM element or {element, destroy}
 *   - colSpan: number of columns for table spacer elements (default: 4)
 *   - layout: "list" for div spacers; defaults to table spacers
 *   - onRender(startIdx, endIdx): called after each virtual-window commit
 *   - onBeforeRender(startIdx, endIdx): called before preparing a replacement window
 *   - throttle: false to update synchronously on scroll (default: animation frame)
 */
const AppUIVirtualScroll = (function() {
  'use strict';

  function create(opts) {
    opts = opts || {};
    const container = opts.container;
    const content = opts.content;
    if (!container) throw new Error('AppUIVirtualScroll: container is required');
    if (!content) throw new Error('AppUIVirtualScroll: content is required');

    const rowHeight = opts.rowHeight || 30;
    const getRowHeight = typeof opts.getRowHeight === 'function' ? opts.getRowHeight : null;
    const buffer = opts.buffer || 20;
    const threshold = opts.threshold || 500;
    const colSpan = opts.colSpan || 4;
    const renderRow = opts.renderRow;
    if (!renderRow) throw new Error('AppUIVirtualScroll: renderRow is required');

    let destroyed = false;
    let items = [];
    let enabled = false;
    let startIdx = -1;
    let endIdx = -1;
    const scrollFrame = AppUILifecycle.createFrameTask(_onScroll);
    let _bound = false;
    let rowCleanups = [];
    const renders=AppUILifecycle.generation();
    const geometry=window._AppUIVirtualScrollModel.create({rowHeight,getRowHeight});
    const {offsetAt,indexAtOffset}=geometry;

    function _releaseRows(cleanups) {
      const teardown=AppUILifecycle.createScope();
      cleanups.splice(0).reverse().forEach(cleanup=>teardown.add(cleanup));
      teardown.destroy();
    }

    function _createRow(item, index, cleanups) {
      const mounted = renderRow(item, index);
      if (typeof mounted?.destroy === 'function') cleanups.push(() => mounted.destroy());
      return mounted?.element || mounted;
    }

    function _commitRows(fragment, cleanups, current) {
      if (!current()) {_releaseRows(cleanups);return;}
      try { _releaseRows(rowCleanups); }
      catch (error) { try { _releaseRows(cleanups); } catch {} throw error; }
      if (!current()) { _releaseRows(cleanups); return; }
      rowCleanups = cleanups;
      content.replaceChildren(fragment);
    }

    function setItems(newItems) {
      if (destroyed) return;
      items = newItems || [];
      geometry.setItems(items);
      startIdx = -1;
      endIdx = -1;

      if (items.length >= threshold) {
        _enable();
        _onScroll();
      } else {
        _disable();
        _renderAll();
      }
    }

    function _enable() {
      if (enabled) return;
      enabled = true;
      if (!_bound) {
        container.addEventListener('scroll', _onScrollThrottled, { passive: true });
        _bound = true;
      }
    }

    function _disable() {
      enabled = false;
      // Keep listener attached for potential re-enable, but it will no-op when not enabled
    }

    function _renderAll() {
      const version=renders.next(),current=()=>!destroyed&&renders.isCurrent(version);
      opts.onBeforeRender?.(0, items.length);
      if (!current()) return;
      const frag = document.createDocumentFragment();
      const cleanups = [];
      try { for(let i=0;i<items.length&&current();i++)frag.appendChild(_createRow(items[i], i, cleanups)); }
      catch (error) { try { _releaseRows(cleanups); } catch {} throw error; }
      _commitRows(frag, cleanups, current);
    }

    function _onScrollThrottled() {
      if (!destroyed && opts.throttle === false) {_onScroll();return;}
      if (!destroyed) scrollFrame.schedule();
    }

    function _onScroll() {
      if (!enabled) return;

      const scrollTop = container.scrollTop;
      const {start:newStart,end:newEnd}=geometry.range(scrollTop,container.clientHeight,buffer);

      if (newStart === startIdx && newEnd === endIdx) return;
      startIdx = newStart;
      endIdx = newEnd;

      _renderVisible(newStart, newEnd);
    }

    function _createSpacer(height) {
      const spacer = document.createElement(opts.layout === 'list' ? 'div' : 'tr');
      spacer.className = 'virtual-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      const cell = opts.layout === 'list' ? spacer : document.createElement('td');
      if (cell !== spacer) { cell.colSpan = colSpan; spacer.appendChild(cell); }
      cell.style.setProperty('--spacer-h', height + 'px');
      cell.style.height = height + 'px';
      return spacer;
    }

    function _renderVisible(start, end) {
      const version=renders.next(),current=()=>!destroyed&&renders.isCurrent(version);
      opts.onBeforeRender?.(start, end);
      if (!current()) return;
      const frag = document.createDocumentFragment();

      if (start > 0) frag.appendChild(_createSpacer(offsetAt(start)));

      const cleanups = [];
      try {
        for (let i = start; i < end && current(); i++) frag.appendChild(_createRow(items[i], i, cleanups));
      } catch (error) { try { _releaseRows(cleanups); } catch {} throw error; }

      const remaining = items.length - end;
      if (remaining > 0) frag.appendChild(_createSpacer(offsetAt(items.length) - offsetAt(end)));

      _commitRows(frag, cleanups, current);

      if (current() && opts.onRender) opts.onRender(start, end);
    }

    function refresh() {
      if (destroyed) return;
      if (enabled) {
        startIdx = -1;
        endIdx = -1;
        _onScroll();
      } else {
        _renderAll();
      }
    }

    function getVisibleRange() {
      return { start: startIdx, end: endIdx };
    }

    function isEnabled() {
      return enabled;
    }

    function getItems() {
      return items;
    }

    function scrollToIndex(idx, options = {}) {
      if (destroyed || !items.length) return;
      idx = Math.max(0, Math.min(items.length - 1, Math.floor(idx)));
      let targetScroll = offsetAt(idx);
      if (options.align === 'nearest') {
        const bottom = offsetAt(idx + 1);
        if (targetScroll >= container.scrollTop && bottom <= container.scrollTop + container.clientHeight) return;
        if (targetScroll >= container.scrollTop) targetScroll = Math.max(0, bottom - container.clientHeight);
      }
      container.scrollTop = targetScroll;
      if (enabled) _onScroll();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (_bound) {
        container.removeEventListener('scroll', _onScrollThrottled);
        _bound = false;
      }
      scrollFrame.destroy();
      enabled = false;
      items = [];
      geometry.clear();
      _releaseRows(rowCleanups);
    }

    return {
      setItems,
      refresh,
      getVisibleRange,
      isEnabled,
      getItems,
      scrollToIndex,
      getIndexAtOffset: indexAtOffset,
      destroy
    };
  }

  return { create };
})();
window.AppUIVirtualScroll = AppUIVirtualScroll;
