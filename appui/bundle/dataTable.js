/* Client-side CSV and XLSX export. No render callbacks or external services. */
const AppUITableExport = (() => {
  const encoder = new TextEncoder();
  const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const scalar = value => value instanceof Date ? value.toISOString() : value == null ? '' :
    typeof value === 'object' ? JSON.stringify(value) : typeof value === 'number' && !Number.isFinite(value) ? '' : value;
  function link(value) {
    try {const url = new URL(value);return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null;}
    catch (_) {return null;}
  }
  function model(columns, items) {
    const cols = columns.filter(c => c.export !== false && (!c.actions && !c.checkbox || c.exportValue));
    const rows = items.map(row => cols.map(col => ({
      value: scalar(col.exportValue ? col.exportValue(row) : col.getValue ? col.getValue(row) : row[col.id]),
      hyperlink: col.exportLink ? link(col.exportLink(row)) : null,
    })));
    return {columns: cols, rows};
  }
  function csv(data) {
    const escape = value => {
      let text = String(value ?? '');
      if (typeof value !== 'number' && (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    return new Blob(['\uFEFF' + [data.columns.map(c => c.exportLabel || c.label || c.id),
      ...data.rows.map(row => row.map(cell => cell.value))].map(row => row.map(escape).join(',')).join('\r\n')],
      {type: 'text/csv;charset=utf-8'});
  }
  function columnName(index) {
    let name = '';
    for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
    return name;
  }
  // ZIP's stored method keeps this small and dependency-free; Excel reads it normally.
  function zip(files) {
    const parts = [], directory = [];
    let offset = 0, directorySize = 0;
    const bytes = (size, fields) => {
      const result = new Uint8Array(size), view = new DataView(result.buffer);
      fields.forEach(([at, value, width]) => width === 2 ? view.setUint16(at, value, true) : view.setUint32(at, value, true));
      return result;
    };
    for (const [path, text] of Object.entries(files)) {
      const name = encoder.encode(path), content = encoder.encode(text);
      let crc = 0xFFFFFFFF;
      for (const byte of content) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
      }
      crc = (crc ^ 0xFFFFFFFF) >>> 0;
      const header = bytes(30, [[0,0x04034b50],[4,20,2],[12,33,2],[14,crc],[18,content.length],[22,content.length],[26,name.length,2]]);
      parts.push(header, name, content);
      directory.push(bytes(46, [[0,0x02014b50],[4,20,2],[6,20,2],[14,33,2],[16,crc],[20,content.length],[24,content.length],[28,name.length,2],[42,offset]]), name);
      directorySize += 46 + name.length;
      offset += 30 + name.length + content.length;
    }
    const count = Object.keys(files).length;
    const end = bytes(22, [[0,0x06054b50],[8,count,2],[10,count,2],[12,directorySize],[16,offset]]);
    return new Blob([...parts, ...directory, end], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function xlsx(data, options) {
    if (!data.columns.length || data.columns.length > 16384 || data.rows.length > 1048575) throw new Error('XLSX requires 1–16384 columns and at most 1048575 data rows');
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const pkg = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const relationships = [], hyperlinks = [];
    const all = [data.columns.map(c => ({value: c.exportLabel || c.label || c.id})), ...data.rows];
    const sheetRows = all.map((row, r) => '<row r="' + (r + 1) + '">' + row.map((cell, c) => {
      const ref = columnName(c) + (r + 1), value = cell.value;
      const style = r === 0 ? 1 : cell.hyperlink ? 2 : 0;
      if (r && cell.hyperlink) {
        const id = 'rId' + (relationships.length + 1);
        relationships.push('<Relationship Id="' + id + '" Type="' + rel + '/hyperlink" Target="' + xml(cell.hyperlink) + '" TargetMode="External"/>');
        hyperlinks.push('<hyperlink ref="' + ref + '" r:id="' + id + '"/>');
      }
      const open = '<c r="' + ref + '" s="' + style + '"';
      if (typeof value === 'number') return open + '><v>' + value + '</v></c>';
      if (typeof value === 'boolean') return open + ' t="b"><v>' + (value ? 1 : 0) + '</v></c>';
      return open + ' t="inlineStr"><is><t xml:space="preserve">' + xml(String(value).slice(0,32767)) + '</t></is></c>';
    }).join('') + '</row>').join('');
    const last = columnName(data.columns.length - 1) + all.length;
    const widths = data.columns.map((c, i) => '<col min="' + (i+1) + '" max="' + (i+1) + '" width="' + Math.max(10, Math.min(70, Number(c.exportWidth) || parseFloat(c.width) / 7 || 22)) + '" customWidth="1"/>').join('');
    const name = String(options.sheetName || 'Table').replace(/[\\/*?:\[\]]/g, ' ').replace(/^'+|'+$/g, '').slice(0,31) || 'Table';
    const files = {
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels': '<Relationships xmlns="' + pkg + '"><Relationship Id="rId1" Type="' + rel + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<workbook xmlns="' + ns + '" xmlns:r="' + rel + '"><sheets><sheet name="' + xml(name) + '" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="' + pkg + '"><Relationship Id="rId1" Type="' + rel + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + rel + '/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': '<styleSheet xmlns="' + ns + '"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><color rgb="FF0563C1"/><u/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
      'xl/worksheets/sheet1.xml': '<worksheet xmlns="' + ns + '" xmlns:r="' + rel + '"><dimension ref="A1:' + last + '"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths + '</cols><sheetData>' + sheetRows + '</sheetData><autoFilter ref="A1:' + last + '"/>' + (hyperlinks.length ? '<hyperlinks>' + hyperlinks.join('') + '</hyperlinks>' : '') + '</worksheet>',
    };
    if (relationships.length) files['xl/worksheets/_rels/sheet1.xml.rels'] = '<Relationships xmlns="' + pkg + '">' + relationships.join('') + '</Relationships>';
    return zip(files);
  }
  function create({columns, items, format = 'xlsx', ...options}) {
    if (!['csv','xlsx'].includes(format)) throw new Error('Export format must be csv or xlsx');
    const data = model(columns, items);
    const blob = format === 'csv' ? csv(data) : xlsx(data, options);
    const filename = String(options.filename || 'table').replace(/\.(csv|xlsx)$/i, '').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_') + '.' + format;
    if (options.download !== false) {
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return {blob, filename, rows: data.rows.length};
  }
  return {create};
})();
window.AppUITableExport = AppUITableExport;

;
/* Private expandable record rendering for DataTable. */
const _AppUIDataTableDetails = (() => {
  let detailSerial = 0;
  function create({opts,columns,detailId,expandedDetails,columnValue}) {
    function detailRow(item, row, context) {
      const wrapper = document.createElement('div'), panel = document.createElement('div'), trigger = document.createElement('button');
      wrapper.className = 'appui-dt-record'; panel.className = 'appui-dt-details'; trigger.className = 'appui-dt-detail-toggle';
      trigger.type = 'button'; trigger.style.cssText = 'margin-right:6px;padding:2px 6px;cursor:pointer';
      const id = detailId(item), label = String(opts.detailLabel?.(item) ?? columnValue(item, columns[0]) ?? 'row');
      panel.id = 'appui-dt-details-' + ++detailSerial;
      trigger.setAttribute('aria-controls', panel.id); panel.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--border)';
      let detailsScope;
      function clear() {detailsScope?.destroy(); detailsScope = null; panel.replaceChildren();}
      context.add(clear);
      function apply() {
        const open = expandedDetails.has(id);
        panel.hidden = !open; trigger.textContent = open ? '\u25BC' : '\u25B6';
        trigger.setAttribute('aria-expanded', String(open)); trigger.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + label);
        clear();
        if (!open || !context.current()) return;
        const scope = AppUILifecycle.createViewScope({parent:context,pagehide:false,
          isCurrent:()=>detailsScope===scope}); detailsScope = scope;
        const details = {signal: scope.signal, current: scope.current,
          add: cleanup => scope.add(cleanup), listen(target, type, listener, options) {
            return scope.listen(target, type, function (...args) {if (details.current()) return listener.apply(this, args);}, options);
          }};
        const result = opts.renderDetails(item, details);
        if (!details.current()) return;
        if (result instanceof Node) panel.appendChild(result); else if (result != null) panel.textContent = String(result);
      }
      context.listen(trigger, 'click', event => {
        event.stopPropagation();
        if (expandedDetails.has(id)) expandedDetails.delete(id); else expandedDetails.add(id);
        apply();
        if (context.current()) opts.onDetailsToggle?.(item, expandedDetails.has(id));
      });
      const column = columns.findIndex(column => column.id === opts.detailColumn), cell = row.children[column >= 0 ? column : 0];
      if (cell) cell.prepend(trigger); else row.appendChild(trigger);
      wrapper.append(row, panel); apply(); return wrapper;
    }

    return detailRow;
  }
  return {create};
})();
window._AppUIDataTableDetails = _AppUIDataTableDetails;

;
/* Private DOM and listener ownership for DataTable headers. */
window._AppUIDataTableHeader = {
  create({header,body,columns,opts,sort,filters,onSort,onFilter,onMenu,onMove,isCurrent}) {
    const scope=AppUILifecycle.createScope(),current=()=>!scope.destroyed&&isCurrent();
    header.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'appui-dt-row appui-dt-row-header';
    columns.forEach(col => {
      if (!current()) return;
      const cell = document.createElement('div');
      cell.className = 'appui-dt-cell appui-dt-cell-header';
      cell.style.boxSizing='border-box';
      AppUITableControls.bindHeader({cell,column:col,scope,onMenu,onMove,reorderable:opts.reorderable!==false,isCurrent:current});
      if (col.width) {cell.style.width = col.width;cell.style.flex = '0 0 ' + col.width;}
      else cell.style.flex = '1';
      cell.style.minWidth = col.minWidth || '60px';

      // Label + sort indicator
      const label = document.createElement('span');
      label.className = 'appui-dt-label';
      label.textContent = col.label || col.id;
      if (col.description) {
        const hint = document.createElement('small');
        hint.textContent = col.description;
        hint.style.cssText = 'display:block;font-size:9px;color:var(--text-muted)';
        label.appendChild(hint);
      }
      cell.appendChild(label);

      if (col.sortable || sort.column === col.id) {
        const arrow = document.createElement('span');
        arrow.className = 'appui-dt-sort';
        if (sort.column === col.id) arrow.textContent = sort.asc ? ' ▲' : ' ▼';
        else arrow.textContent = ' ⇅';
        cell.appendChild(arrow);
        cell.style.cursor = 'pointer';
        scope.listen(cell,'click',()=>{if(current())onSort(col);});
      }

      if(filters[col.id]){
        cell.classList.add('appui-dt-column-filtered');
        const filter=filters[col.id];
        cell.title='Filter: '+AppUITableFilter.format(filter)+' (right-click to change)';
      }

      // Column resize handle
      if (opts.resizable !== false) {
        const handle = document.createElement('div');
        handle.className = 'appui-dt-resize-handle';
        handle.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:8px;cursor:col-resize;user-select:none;z-index:2';
        handle.draggable=false;handle.title='Drag to resize column';
        let startX, startWidth;
        const binding = window.AppUIPointerGesture.bind(handle, {
          onStart(event) {
            event.stopPropagation();cell.draggable=false;
            startX = event.clientX;startWidth = cell.offsetWidth;
          },
          onMove(event) {
            const newWidth = Math.max(40, startWidth + event.clientX - startX);
            col.width = newWidth + 'px';
            col.minWidth='40px';cell.style.minWidth='40px';cell.style.boxSizing='border-box';
            cell.style.width = newWidth + 'px';cell.style.flex = '0 0 '+newWidth+'px';
            const colIdx = columns.indexOf(col);
            body.querySelectorAll('.appui-dt-row').forEach(row => {
              const cells = row.querySelectorAll('.appui-dt-cell');
              if (cells[colIdx]) {cells[colIdx].style.minWidth='40px';cells[colIdx].style.boxSizing='border-box';cells[colIdx].style.width = newWidth + 'px';cells[colIdx].style.flex = '0 0 '+newWidth+'px';}
            });
          },
          onEnd(){cell.draggable=opts.reorderable!==false;},
        });
        scope.listen(handle,'click',event=>{if(current())event.stopPropagation();});
        scope.add(binding);
        cell.style.position = 'relative';
        cell.appendChild(handle);
      }

      row.appendChild(cell);
    });
    header.appendChild(row);

    return scope;
  }
};

;
/* Private standard controls for DataTable cells; row contexts own every binding. */
window._AppUIDataTableControls = (() => {
  const current = (context, isCurrent) => isCurrent() && context.current();

  function actions(cell, definition, item, context, isCurrent) {
    cell.classList.add('appui-dt-actions');
    const controls = typeof definition === 'function' ? definition(item) : definition;
    for (const action of controls || []) {
      if (!action || !current(context, isCurrent)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label ?? '';
      button.disabled = !!action.disabled;
      if (action.title != null) button.title = String(action.title);
      if (action.className) button.className = action.className;
      if (action.ariaLabel != null) button.setAttribute('aria-label', action.ariaLabel);
      if (action.ariaPressed != null) button.setAttribute('aria-pressed', String(action.ariaPressed));
      context.listen(button, 'click', (event) => {
        if (!current(context, isCurrent) || button.disabled) return;
        event.stopPropagation();
        action.action?.(item, event);
      });
      cell.appendChild(button);
    }
  }

  function checkbox(cell, definition, item, context, isCurrent) {
    const control = typeof definition === 'function' ? definition(item) : definition;
    if (!control || !current(context, isCurrent)) return;
    cell.classList.add('appui-dt-checkbox');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!control.checked;
    input.disabled = !!control.disabled;
    if (control.title != null) input.title = String(control.title);
    if (control.className) input.className = control.className;
    if (control.ariaLabel != null) input.setAttribute('aria-label', control.ariaLabel);
    context.listen(input, 'click', (event) => {
      if (current(context, isCurrent)) event.stopPropagation();
    });
    context.listen(input, 'change', (event) => {
      if (current(context, isCurrent) && !input.disabled) {
        control.onChange?.(item, !!input.checked, event);
      }
    });
    cell.appendChild(input);
  }

  return { actions, checkbox };
})();

;
/* Private cell and row rendering for DataTable. */
window._AppUIDataTableRows = {
  create({ opts, columns, detailRow, isCurrent }) {
    return function createRow(item, context) {
      const row = document.createElement('div');
      row.className = 'appui-dt-row';
      row.dataset.rowId=String(opts.getId?.(item) ?? item.id ?? '');
      if(opts.onRowHover){
        context.listen(row,'mouseenter',event=>opts.onRowHover(item,event));
        context.listen(row,'mouseleave',event=>opts.onRowHover(null,event));
      }
      columns.forEach((col) => {
        if (!isCurrent() || !context.current()) return;
        const cell = document.createElement('div');
        cell.className = 'appui-dt-cell';
        cell.style.boxSizing='border-box';
        if (col.width) {
          cell.style.width = col.width;
          cell.style.flex = '0 0 ' + col.width;
        } else cell.style.flex = '1';
        cell.style.minWidth = col.minWidth || '60px';
        if (col.render) {
          const val = col.render(item, context);
          if (val instanceof Node) cell.appendChild(val);
          else cell.textContent = val ?? '';
        } else if (col.checkbox) {
          window._AppUIDataTableControls.checkbox(cell, col.checkbox, item, context, isCurrent);
        } else if (col.actions) {
          window._AppUIDataTableControls.actions(cell, col.actions, item, context, isCurrent);
        } else if (opts.renderDetails) {
          const value = document.createElement('span');
          value.textContent = item[col.id] ?? '';
          cell.appendChild(value);
        } else {
          cell.textContent = item[col.id] ?? '';
        }
        if (col.className) {
          const classes = String(col.className).split(/\s+/).filter(Boolean);
          if (classes.length) cell.classList.add(...classes);
        }
        row.appendChild(cell);
      });
      if (opts.onRowClick)
        context.listen(row, 'click', (event) => opts.onRowClick(item, event, row));
      if (opts.renderDetails && (!opts.canExpand || opts.canExpand(item)))
        return detailRow(item, row, context);
      return row;
    };
  }
};

;
/* AppUI DataTable: sortable, filterable table for content areas.
 *
 * Usage:
 *   const table = AppUIDataTable.create({
 *     container: document.getElementById('content'),
 *     columns: [
 *       { id: 'time', label: 'Time', width: '80px', render: row => new Date(row.ts*1000).toLocaleTimeString() },
 *       { id: 'channel', label: 'Channel', sortable: true, filterable: true },
 *       { id: 'event', label: 'Event', sortable: true, filterable: true },
 *       { id: 'source', label: 'Source', sortable: true },
 *       { id: 'data', label: 'Data', render: row => JSON.stringify(row.data) },
 *     ],
 *     items: [],
 *     getId: row => row.ts,
 *     empty: 'No data',
 *     maxRows: 300,           // cap displayed rows
 *     stickyHeader: true,
 *   });
 *   table.setItems(newItems);          // replace all
 *   table.prepend(item);               // add to top (live stream)
 *   table.setFilter(columnId, value);  // filter by column value
 *   table.clearFilters();
 *   table.setSearch('text'); // case-insensitive find over loaded data
 *   table.setColumnVisible('source', false);
 *   table.moveColumn('source', 'time'); // move to target column position
 *   table.getColumns(); // order + hidden flags (copies)
 *   table.resetColumns();
 * Built-in controls (controls:false to hide) include find and a column chooser.
 * Header right-click / Shift+F10 offers sort, filter, hide and move actions.
 * Headers support drag/drop unless reorderable:false. At least one stays visible.
 * stateKey optionally persists column order/visibility in localStorage; no data
 * or search terms are persisted. New columns appear according to their defaults.
 * filterable:false opts a column out of filters; searchable:false opts out of find.
 *   table.exportXlsx({filename: 'results', sheetName: 'Results'});
 *   table.exportCsv({filename: 'results'});
 * Exports use displayed model order/filter/maxRows (including virtual rows).
 * Pass scope:'all' for all loaded items. Columns support export:false,
 * exportValue(row), exportLink(row), exportLabel and exportWidth. Renderers
 * are never invoked. Numeric cells stay numeric; XLSX links are clickable.
 * Columns may provide getValue(row) for sorting/filtering computed values.
 * Custom renderers do not change the underlying sort/filter value.
 * actions: descriptors[] or actions(row) renders owned native buttons instead
 * of the cell value. Descriptors support label, title, ariaLabel, className,
 * disabled and action(row, event). Button clicks do not trigger onRowClick.
 * checkbox: descriptor or checkbox(row) renders an owned native checkbox with
 * checked, disabled, title, ariaLabel, className and onChange(row, checked, event).
 * render(row, scope) receives signal/current/add/listen helpers owned by the
 * displayed body. Rebuilding rows or a virtual window releases that scope.
 * renderDetails(row, scope) optionally returns full-width expandable content.
 * Its scope is released on collapse and row replacement. Use getId for stable
 * expansion across setItems; detailLabel(row) names the native toggle button.
 */
const AppUIDataTable = (() => {
  function create(opts = {}) {
    const container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
    if (!container) throw new Error('AppUIDataTable: container required');
    if (opts.signal?.aborted) return {
      setItems() {}, prepend() {}, setFilter() {}, clearFilters() {},
      getFilters: () => ({}), setHighlighted() {}, render() {}, destroy() {},
      setSearch() {}, getSearch:()=>'',getColumns:()=>[],setColumnVisible:()=>false,moveColumn(){},resetColumns(){},showColumns(){},getDisplayItems:()=>[],
      exportCsv() {throw new Error('Table is destroyed');}, exportXlsx() {throw new Error('Table is destroyed');},
    };
    const columnState=AppUITableColumns.create({columns:opts.columns||[],stateKey:opts.stateKey,onChange(){_render();opts.onColumnsChange?.(getColumns());}});
    const allColumns=columnState.all,columns=columnState.visible;
    let query='';
    const getColumns=columnState.getColumns;
    function setColumnVisible(id,show){return !_destroyed&&columnState.setVisible(id,show);}
    function moveColumn(id,target){if(!_destroyed)columnState.move(id,target);}
    function resetColumns(){if(!_destroyed)columnState.reset();}
    function setSearch(value){if(_destroyed)return;query=String(value||'');bodyEl.scrollTop=0;_render(true);}
    const maxRows = opts.maxRows || 500;
    const getId = opts.getId || (row => row.id || row.ts || Math.random());
    const detailId = opts.getId || (row => row.id ?? row.ts ?? row);
    const expandedDetails = new Set(opts.expandedDetails || []);

    let _items = opts.items ? [...opts.items] : [];
    let _sortCol = opts.sort?.column || null, _sortAsc = opts.sort?.direction !== 'desc';
    let _filters = Object.create(null);  // columnId → filterValue
    let _destroyed = false;
    let highlightedId=null;
    function paintHighlight(){for(const row of bodyEl.querySelectorAll('.appui-dt-row'))row.classList.toggle('appui-dt-row-highlighted',highlightedId!==null&&row.dataset.rowId===highlightedId);}
    function setHighlighted(id,{scroll=false}={}){
      highlightedId=id==null?null:String(id);
      if(_destroyed)return;
      if(scroll&&highlightedId!==null){
        const display=_getDisplayItems(),index=display.findIndex(item=>String(opts.getId?.(item)??item.id??'')===highlightedId);
        if(index>=0){
          if(!opts.renderDetails&&opts.virtualScroll!==false&&display.length>200){
            if(index*32<bodyEl.scrollTop||index*32+32>bodyEl.scrollTop+bodyEl.clientHeight){bodyEl.scrollTop=Math.max(0,index*32-bodyEl.clientHeight/2);bodyEl.dispatchEvent(new Event('scroll'));}
          }else{const row=[...bodyEl.querySelectorAll('.appui-dt-row')].find(row=>row.dataset.rowId===highlightedId);if(row){const top=row.getBoundingClientRect().top-bodyEl.getBoundingClientRect().top;if(top<0||top+row.offsetHeight>bodyEl.clientHeight)bodyEl.scrollTop+=top-bodyEl.clientHeight/2;}}
        }
      }
      paintHighlight();
    }
    let _rowsScope = null;
    function clearRows() {const previous=_rowsScope;_rowsScope=null;previous?.destroy();}
    function renderContext() {
      clearRows();
      const scope = AppUILifecycle.createViewScope({pagehide: false,
        isCurrent: () => !_destroyed && _rowsScope === scope,
      });
      _rowsScope = scope;
      const context = {
        signal: scope.signal,
        current: () => scope.current(),
        add: cleanup => scope.add(cleanup),
        listen(target, type, listener, options) {
          return scope.listen(target, type, function (...args) {
            if (context.current()) return listener.apply(this, args);
          }, options);
        },
      };
      return context;
    }
    let headerScope;
    let _filterCleanup = null;
    const {columnValue}=window._AppUIDataTableModel;
    const detailRow=window._AppUIDataTableDetails.create({opts,columns,detailId,expandedDetails,columnValue});
    const _createRow=window._AppUIDataTableRows.create({opts,columns,detailRow,isCurrent:()=>!_destroyed});

    container.classList.add('appui-datatable');
    const view=window.AppUITableControls.create({container,opts,allColumns,getColumns:()=>columns.slice(),getFilters,setSearch,clearFilters,setVisible:setColumnVisible,moveColumn,resetColumns,showFilter:_showFilterPopup,isCurrent:()=>!_destroyed,clearSort(){_sortCol=null;_render();opts.onSort?.({column:null,direction:null});},
      sortColumn(id,ascending){_sortCol=id;_sortAsc=ascending;_render();opts.onSort?.({column:id,direction:ascending?'asc':'desc'});}});
    const headerEl = document.createElement('div');
    headerEl.className = 'appui-dt-header';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'appui-dt-body';
    container.append(headerEl, bodyEl);
    headerEl.style.overflow = 'hidden';
    const syncHorizontal = () => {headerEl.scrollLeft = bodyEl.scrollLeft;};
    bodyEl.addEventListener('scroll', syncHorizontal);

    function _renderHeader() {
      headerScope?.destroy();
      _filterCleanup?.();
      headerScope=window._AppUIDataTableHeader.create({header:headerEl,body:bodyEl,columns,opts,
        sort:{column:_sortCol,asc:_sortAsc},filters:_filters,isCurrent:()=>!_destroyed,onFilter:_showFilterPopup,onMenu:view.showMenu,onMove:moveColumn,
        onSort(col){
          if(_sortCol===col.id)_sortAsc=!_sortAsc;else{_sortCol=col.id;_sortAsc=true;}
          _render();opts.onSort?.({column:_sortCol,direction:_sortAsc?'asc':'desc'});
        }
      });
    }

    function _showFilterPopup(col) {
      if (_destroyed) return;
      _filterCleanup?.();
      const rawValues=_items.map(item=>columnValue(item,col));
      const values=[...new Set(rawValues.map(String).filter(Boolean))].sort();
      const popup=window.AppUITableFilter.create({container,column:col,values,value:_filters[col.id],
        rawValues,
        onApply:value=>setFilter(col.id,value),
        onClose:()=>{if(_filterCleanup===popup.destroy)_filterCleanup=null;},
      });
      _filterCleanup=popup.destroy;
    }

    function _getDisplayItems() {
      return window._AppUIDataTableModel.display(_items,{
        columns:allColumns,filters:_filters,sortColumn:_sortCol,sortAscending:_sortAsc,
        manualSort:opts.manualSort,maxRows,query,
      });
    }

    function _render(bodyOnly) {
      if (_destroyed) return;
      clearRows();
      if (!bodyOnly) _renderHeader();
      const display = _getDisplayItems();
      view.update({query,count:display.length,filtered:Object.keys(_filters).length>0});
      if (_destroyed) return;
      if (opts.renderDetails || opts.virtualScroll === false || display.length <= 200) {
        _virtualCleanup?.();_virtualCleanup = null;
        bodyEl.style.position = '';bodyEl.style.overflowY = '';
      }
      if (!display.length) {
        const empty = document.createElement('div'); empty.className = 'appui-dt-empty';
        empty.textContent = opts.empty || 'No data'; bodyEl.replaceChildren(empty);
        return;
      }

      // Virtual scrolling for large datasets (>200 rows)
      if (!opts.renderDetails && opts.virtualScroll !== false && display.length > 200) {
        _renderVirtual(display);
        return;
      }

      const scrollTop = bodyEl.scrollTop, scrollLeft = bodyEl.scrollLeft;
      bodyEl.innerHTML = '';
      const context = renderContext();
      display.forEach(item => {
        if (_destroyed || !context.current()) return;
        const row = _createRow(item, context);
        if (_destroyed || !context.current()) return;
        bodyEl.appendChild(row);
      });
      bodyEl.scrollTop = scrollTop;bodyEl.scrollLeft = scrollLeft;syncHorizontal();
      paintHighlight();
    }

    let _virtualCleanup = null;
    function _renderVirtual(display) {
      _virtualCleanup?.();_virtualCleanup=null;
      bodyEl.style.position='relative';bodyEl.style.overflowY='auto';
      let context;
      const virtual=window.AppUIVirtualScroll.create({container:bodyEl,content:bodyEl,layout:'list',
        rowHeight:32,buffer:5,threshold:201,throttle:false,
        onBeforeRender:()=>{context=renderContext();},
        renderRow:item=>{const row=_createRow(item,context);row.style.height='32px';return row;},
        onRender:()=>{syncHorizontal();paintHighlight();},
      });
      _virtualCleanup=()=>virtual.destroy();
      try {virtual.setItems(display);}
      catch(error){try{virtual.destroy();}catch{} _virtualCleanup=null;throw error;}
      if(_destroyed){_virtualCleanup?.();_virtualCleanup=null;}
    }

    function setItems(items) {
      _items = [...items];
      if (opts.renderDetails) {const ids = new Set(_items.map(detailId)); for (const id of expandedDetails) if (!ids.has(id)) expandedDetails.delete(id);}
      _render(true);
    }
    function prepend(item) { _items.unshift(item); if (_items.length > maxRows * 2) _items.length = maxRows * 2; _render(true); }
    function setFilter(colId, value) { if (value) _filters[colId] = value; else delete _filters[colId]; _render(); }
    function clearFilters() { _filters = Object.create(null); _render(); }
    function getFilters() { return {..._filters}; }
    function exportTable(format, options = {}) {
      if (_destroyed) throw new Error('Table is destroyed');
      return AppUITableExport.create({...options, format, columns,
        items: options.scope === 'all' ? [..._items] : _getDisplayItems()});
    }
    function destroy() {
      if (_destroyed) return;
      _destroyed = true;
      expandedDetails.clear();
      const teardown=AppUILifecycle.createScope();
      teardown.add(()=>container.replaceChildren());
      teardown.add(()=>view.destroy());
      teardown.add(()=>bodyEl.removeEventListener('scroll', syncHorizontal));
      teardown.add(()=>{const cleanup=_virtualCleanup;_virtualCleanup=null;cleanup?.();});
      teardown.add(()=>_filterCleanup?.());
      teardown.add(()=>headerScope?.destroy());
      teardown.add(clearRows);
      teardown.add(()=>opts.signal?.removeEventListener('abort', abort));
      teardown.destroy();
    }

    const abort = () => destroy();
    if (opts.signal?.aborted) destroy();
    else {
      opts.signal?.addEventListener('abort', abort, {once: true});
      _render();
    }
    // the rows as displayed (filtered + sorted, capped by maxRows): lets a page do keyboard navigation / "next row"
    function getDisplayItems() { return _destroyed ? [] : [..._getDisplayItems()]; }
    return { setItems, prepend, setFilter, clearFilters, getFilters, getDisplayItems, setHighlighted, setSearch,getSearch:()=>query,getColumns,setColumnVisible,moveColumn,resetColumns,showColumns:view.showColumns, render: _render, destroy,
      exportCsv: options => exportTable('csv', options), exportXlsx: options => exportTable('xlsx', options) };
  }
  return { create };
})();
window.AppUIDataTable = AppUIDataTable;
