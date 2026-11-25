/* Renderer-independent column order/visibility and optional view persistence. */
window.AppUITableColumns={
  create({columns:initial=[],stateKey,onChange=()=>{}}={}){
    const all=[],visible=[];let defaults=[],key;
    function save(){if(key)try{localStorage.setItem(key,JSON.stringify({order:all.map(c=>c.id),visible:visible.map(c=>c.id)}));}catch{}}
    function changed(){save();onChange();}
    function update(next,{reset=false,stateKey:nextKey=stateKey}={}){
      const newKey=nextKey?'appui.datatable.'+nextKey:null;
      reset=reset||key!==newKey;key=newKey;
      const previous=new Map(all.map(c=>[c.id,c])),selected=new Set(visible.map(c=>c.id));
      defaults=next.map(c=>({...c}));
      const ordered=reset?[]:all.map(c=>c.id);
      const incoming=new Map(next.map(c=>[c.id,{...c,...(!reset&&previous.get(c.id)?.width?{width:previous.get(c.id).width,minWidth:previous.get(c.id).minWidth}:{})}]));
      all.splice(0,all.length,...ordered.filter(id=>incoming.has(id)).map(id=>incoming.get(id)));
      for(const c of incoming.values())if(!all.some(old=>old.id===c.id))all.push(c);
      visible.splice(0,visible.length,...all.filter(c=>reset?!c.hidden:previous.has(c.id)?selected.has(c.id):!c.hidden));
      if(reset&&key)try{
        const state=JSON.parse(localStorage.getItem(key)||'null');
        if(Array.isArray(state?.order)&&Array.isArray(state?.visible)){
          const ids=[...new Set([...state.order,...all.map(c=>c.id)])];all.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
          visible.splice(0,visible.length,...all.filter(c=>state.visible.includes(c.id)||!state.order.includes(c.id)&&!c.hidden));
        }
      }catch{}
      if(!visible.length&&all.length)visible.push(all[0]);
    }
    update(initial,{reset:true});
    function setVisible(id,show){const col=all.find(c=>c.id===id);if(!col||!show&&visible.length===1&&visible.includes(col))return false;
      const ids=new Set(visible.map(c=>c.id));if(show)ids.add(id);else ids.delete(id);
      visible.splice(0,visible.length,...all.filter(c=>ids.has(c.id)));changed();return true;}
    function move(id,target){const from=all.findIndex(c=>c.id===id),to=all.findIndex(c=>c.id===target);if(from<0||to<0||from===to)return;
      const ids=new Set(visible.map(c=>c.id)),[col]=all.splice(from,1);all.splice(to,0,col);visible.splice(0,visible.length,...all.filter(c=>ids.has(c.id)));changed();}
    function reset(){const ids=defaults.map(c=>c.id);all.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));visible.splice(0,visible.length,...all.filter(c=>!defaults.find(d=>d.id===c.id)?.hidden));if(!visible.length&&all.length)visible.push(all[0]);changed();}
    return {all,visible,update,setVisible,move,reset,save,getColumns:()=>all.map(c=>({...c,hidden:!visible.includes(c)}))};
  }
};

;
/* DataTable values, client filtering and sorting, independent of DOM rendering. */
window._AppUIDataTableModel = (() => {
  function columnValue(item, column) {
    return (column?.getValue ? column.getValue(item) : item[column?.id]) ?? '';
  }
  function numeric(value){
    if(value==null||typeof value==='boolean'||String(value).trim()==='')return null;
    const number=typeof value==='number'?value:Number(String(value).replace(/,/g,''));
    return Number.isFinite(number)?number:null;
  }

  function display(items,{columns,filters,sortColumn,sortAscending,manualSort,maxRows,query=''}) {
    let display = [...items];
    const needle=String(query).trim().toLocaleLowerCase();
    if(needle)display=display.filter(item=>columns.some(col=>col.searchable!==false&&!col.actions&&!col.checkbox&&String(columnValue(item,col)).toLocaleLowerCase().includes(needle)));
    // Apply filters
    for (const [colId, val] of Object.entries(filters)) {
      if(val&&typeof val==='object'&&val.type==='range'){
        const col=columns.find(c=>c.id===colId),min=numeric(val.min),max=numeric(val.max);
        display=display.filter(item=>{const n=numeric(columnValue(item,col));return n!==null&&(min===null||n>=min)&&(max===null||n<=max);});
        continue;
      }
      const lower = String(val?.type==='contains'?val.value:val).toLowerCase();
      display = display.filter(item => {
        const col = columns.find(c => c.id === colId);
        const cellVal = String(columnValue(item, col));
        return cellVal.toLowerCase().includes(lower);
      });
    }
    // Apply sort
    if (sortColumn && !manualSort) {
      const col = columns.find(c => c.id === sortColumn);
      display.sort((a, b) => {
        const av = columnValue(a, col), bv = columnValue(b, col);
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv : String(av).localeCompare(String(bv), undefined, {numeric: true});
        return sortAscending ? cmp : -cmp;
      });
    }
    return display.slice(0, maxRows);
  }

  return {columnValue,display,numeric};
})();

;
/* Scoped DataTable filter popup with shared action controls. */
window._AppUIDataTableFilter = (() => {
  function create({container,column,values,rawValues=[],value,onApply,onClose}) {
    const owner=AppUILifecycle.createScope();
    let closed=false;
    const popup=document.createElement('div');popup.className='appui-dt-filter-popup';
    popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Filter '+(column.label||column.id));
    const content=document.createElement('div');content.style.padding='4px';
    const input=document.createElement('input');input.className='appui-dt-filter-input';
    input.placeholder='Filter '+(column.label||column.id)+'...';input.value=typeof value==='string'?value:value?.type==='contains'?value.value:'';
    input.setAttribute('aria-label','Filter '+(column.label||column.id));
    const suggestions=document.createElement('div');suggestions.className='appui-dt-filter-values';
    for(const value of values.slice(0,20)) {
      const button=document.createElement('button');button.type='button';button.className='appui-dt-filter-val';
      button.dataset.val=value;button.textContent=value.length>20?value.slice(0,20)+'\u2026':value;
      owner.listen(button,'click',()=>{if(!closed)input.value=value;});suggestions.appendChild(button);
    }
    const {numeric}=window._AppUIDataTableModel;
    const numbers=rawValues.map(numeric).filter(n=>n!==null);
    const rangeValue=value?.type==='range';
    const canRange=rangeValue||column.filterType==='number'||numbers.length>0&&rawValues.filter(v=>v!=null&&v!==''&&!(typeof v==='number'&&!Number.isFinite(v))).every(v=>numeric(v)!==null);
    const range=document.createElement('div');range.className='appui-dt-range-filter';
    const mode=document.createElement('select');mode.setAttribute('aria-label','Filter mode');
    for(const [id,text]of [['text','Text contains'],['range','Numeric range']]){const option=document.createElement('option');option.value=id;option.textContent=text;mode.append(option);}
    mode.value=rangeValue||canRange&&!value?'range':'text';
    const low=numbers.length?numbers.reduce((min,n)=>Math.min(min,n),Infinity):0,high=numbers.length?numbers.reduce((max,n)=>Math.max(max,n),-Infinity):1;
    const step=column.filterStep||(numbers.every(Number.isInteger)?1:Number(((high-low||1)/1000).toPrecision(3)));
    const fields=[],sliders=[];
    for(const [key,label,bound]of [['min','Minimum',low],['max','Maximum',high]]){
      const wrapper=document.createElement('label');wrapper.textContent=label;
      const field=document.createElement('input');field.type='number';field.step='any';field.placeholder='No limit';field.setAttribute('aria-label',label);field.value=rangeValue&&value[key]!=null?value[key]:'';
      const slider=document.createElement('input');slider.type='range';slider.min=low;slider.max=high===low?low+1:high;slider.step=step;slider.disabled=!numbers.length||high===low;slider.setAttribute('aria-label',label+' slider');slider.value=field.value||bound;
      wrapper.append(field,slider);range.append(wrapper);fields.push(field);sliders.push(slider);
      owner.listen(field,'input',()=>{slider.value=field.value===''?bound:field.value;});
      owner.listen(slider,'input',()=>{field.value=slider.value;const other=fields[key==='min'?1:0];if(other&&other.value!==''&&(key==='min'?Number(other.value)<Number(field.value):Number(other.value)>Number(field.value))){other.value=field.value;sliders[key==='min'?1:0].value=field.value;}});
    }
    const error=document.createElement('p');error.setAttribute('role','alert');error.hidden=true;
    const updateMode=()=>{input.hidden=suggestions.hidden=mode.value==='range';range.hidden=mode.value!=='range';};
    owner.listen(mode,'change',updateMode);updateMode();
    const actions=document.createElement('div');if(canRange)content.append(mode);else mode.value='text';updateMode();
    content.append(input,suggestions,range,error,actions);popup.appendChild(content);container.appendChild(popup);
    function close() {
      if(closed)return;closed=true;owner.destroy();popup.remove();onClose?.();
    }
    function apply(value) {if(closed)return;close();onApply(value);}
    function submit(){
      if(mode.value!=='range'){apply(input.value);return;}
      const [minimum,maximum]=fields,min=numeric(minimum.value),max=numeric(maximum.value);
      if(fields.some(field=>field.validity.badInput||field.value!==''&&numeric(field.value)===null)||min!==null&&max!==null&&min>max){error.textContent='Enter valid numbers with minimum no greater than maximum.';error.hidden=false;return;}
      apply(min===null&&max===null?'':{type:'range',min,max});
    }
    const toolbar=AppUIToolbar.create({container:actions,label:'Filter actions',items:[
      {className:'appui-dt-filter-apply',label:'Apply',primary:true,action:submit},
      {className:'appui-dt-filter-clear',label:'Clear',action:()=>apply('')},
    ]});owner.add(toolbar);
    owner.listen(content,'keydown',event=>{
      if(closed||event.isComposing)return;
      if(event.key==='Enter'){event.preventDefault();submit();}
      else if(event.key==='Escape'){event.preventDefault();close();}
    });
    let timer=setTimeout(()=>{
      timer=null;
      if(!closed&&popup.isConnected)owner.listen(document,'click',event=>{if(!popup.contains(event.target))close();});
    },0);
    owner.add(()=>{if(timer!==null)clearTimeout(timer);});
    (mode.value==='range'?fields[0]:input).focus();
    return {destroy:close};
  }
  function format(value){return value?.type==='range'?(value.min??'unbounded')+' to '+(value.max??'unbounded'):value?.type==='contains'?'contains '+value.value:String(value??'');}
  return {create,format};
})();

window.AppUITableFilter=window._AppUIDataTableFilter;

;
/* Renderer-independent table find, column chooser and header context menu. */
window.AppUITableControls={
  bindHeader({cell,column,scope,onMenu,onMove,reorderable=true,isCurrent=()=>true}){
    cell.dataset.columnId=column.id;cell.tabIndex=0;cell.draggable=reorderable;
    scope.listen(cell,'contextmenu',event=>{event.preventDefault();if(isCurrent())onMenu?.(column,event);});
    scope.listen(cell,'keydown',event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();const rect=cell.getBoundingClientRect();if(isCurrent())onMenu?.(column,{x:rect.left,y:rect.bottom});}});
    if(!reorderable)return;
    scope.listen(cell,'dragstart',event=>{if(event.target.closest('.appui-dt-resize-handle,.aubt-rs,button')){event.preventDefault();return;}event.dataTransfer.setData('application/x-appui-column',column.id);event.dataTransfer.effectAllowed='move';});
    scope.listen(cell,'dragover',event=>{if([...event.dataTransfer.types].includes('application/x-appui-column')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
    scope.listen(cell,'drop',event=>{const source=event.dataTransfer.getData('application/x-appui-column');if(source&&isCurrent()){event.preventDefault();onMove?.(source,column.id);}});
  },
  create({container,opts,allColumns,getColumns,getFilters,setSearch,clearFilters,setVisible,moveColumn,resetColumns,showFilter,sortColumn,clearSort,isCurrent}){
    const scope=AppUILifecycle.createViewScope({pagehide:false,isCurrent});
    const host=document.createElement('div');host.className='appui-dt-tools';container.append(host);
    const search=document.createElement('input');search.type='search';search.placeholder='Find in table';search.setAttribute('aria-label','Find in table');
    const count=document.createElement('span');count.setAttribute('role','status');
    scope.listen(search,'input',()=>setSearch(search.value));
    scope.listen(search,'keydown',event=>{if(event.key==='Escape'){search.value='';setSearch('');event.preventDefault();event.stopPropagation();}});
    const columnsButton=document.createElement('button');columnsButton.type='button';columnsButton.textContent='Columns';
    const clear=document.createElement('button');clear.type='button';clear.textContent='Clear filters';scope.listen(clear,'click',clearFilters);
    host.append(search,columnsButton,clear,count);if(opts.find===false)search.hidden=true;
    let chooser,chooserScope;
    function showColumns(){
      if(!scope.current())return;
      chooser?.abort();chooserScope?.destroy();chooser=new AbortController();chooserScope=AppUILifecycle.createScope();
      const body=document.createElement('div');body.className='appui-dt-column-choices';
      const visible=new Set(getColumns().map(col=>col.id));
      const checks=[];
      for(const col of allColumns){
        const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=visible.has(col.id);input.setAttribute('aria-label',col.label||col.id);
        label.append(input,document.createTextNode(col.label||col.id));body.append(label);checks.push([col,input]);
        chooserScope.listen(input,'change',()=>{if(!setVisible(col.id,input.checked))input.checked=true;for(const [,check]of checks)check.disabled=checks.filter(([,c])=>c.checked).length===1&&check.checked;});
      }
      for(const [,check]of checks)check.disabled=visible.size===1&&check.checked;
      AppUIDialog.show({title:'Table columns',body,signal:chooser.signal,onClose:()=>chooserScope?.destroy(),buttons:[{text:'Show all',action:()=>{for(const col of allColumns)setVisible(col.id,true);}},{text:'Reset columns',action:resetColumns},{text:'Close',primary:true}]});
    }
    scope.listen(columnsButton,'click',showColumns);
    scope.listen(container,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'&&opts.controls!==false&&opts.find!==false){event.preventDefault();event.stopPropagation();search.focus();search.select();}});
    let menuController;
    async function showMenu(col,event){
      const point={x:event.clientX??event.x,y:event.clientY??event.y};
      menuController?.abort();const controller=new AbortController();menuController=controller;
      try{await AppUIAssets.load('contextMenu');}catch(error){if(scope.current())AppUIToast.error(error.message);return;}
      if(!scope.current()||controller.signal.aborted)return;
      const columns=getColumns(),index=columns.findIndex(c=>c.id===col.id);
      AppUIContextMenu.show(point,[
        {label:'Sort ascending',disabled:col.sortable===false||!!col.actions||!!col.checkbox,action:()=>sortColumn(col.id,true)},
        {label:'Sort descending',disabled:col.sortable===false||!!col.actions||!!col.checkbox,action:()=>sortColumn(col.id,false)},
        ...(clearSort?[{label:'Clear sort',action:clearSort}]:[]),
        {label:'Copy column name',action:()=>{try{navigator.clipboard.writeText(String(col.id)).catch(()=>{});}catch{}}},
        {label:'Filter '+(col.label||col.id),disabled:col.filterable===false||!!col.actions||!!col.checkbox,action:()=>showFilter(col)},
        {label:'Clear filters',disabled:!Object.keys(getFilters()).length,action:clearFilters},
        {separator:true},
        {label:'Hide column',disabled:columns.length<=1,action:()=>setVisible(col.id,false)},
        {label:'Choose columns...',action:showColumns},
        {label:'Move left',disabled:opts.reorderable===false||index<=0,action:()=>moveColumn(col.id,columns[index-1].id)},
        {label:'Move right',disabled:opts.reorderable===false||index===columns.length-1,action:()=>moveColumn(col.id,columns[index+1].id)},
        {label:'Reset columns',action:resetColumns},...(opts.columnMenuItems?.(col)||[])
      ],{signal:controller.signal});
    }
    if(opts.controls===false)host.style.display='none';
    return {showMenu,showColumns,update({query,count:total,filtered}){if(search.value!==query)search.value=query;count.textContent=total+(total===1?' row':' rows');clear.disabled=!filtered;},destroy(){chooser?.abort();chooserScope?.destroy();menuController?.abort();scope.destroy();host.remove();}};
  }
};
