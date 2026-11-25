window.AppUIReady.then(()=>{
  const appId="personal/music_player",base="/v1/apps/"+appId+"/";
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const btn=(label,fn)=>{const b=el("button",label);b.type="button";b.onclick=fn;return b;};
  async function api(op,args={}){
    const r=await AppUIApi.requestResponse(base+op,args,{method:"POST",timeout:180000,decode:r=>r.json()});
    if(!r.data?.ok)throw new Error(r.data?.error||"Music library unavailable");
    return r.data;
  }
  let tree,body,roots=[],tracks=[],queue=[],index=-1,current=null,token=null,busy=false,folderEpoch=0,folder="",folderLoading=false,nextOffset=null,playingEpoch=0,treeEpoch=0,scanEpoch=0,scanning=false,waitingNext=false;
  const MAX_SCAN_FOLDERS=512,MAX_QUEUE=5000;
  let scanStatus,cancelScanButton,queueCount,queueDisplay=0;
  let directClient=null,directMode=false,streamMode="proxy",directFeedback,directToggle,authorizeButton,clientIdInput;
  let libraryRoot="",resumeButton,resumeAt=0,rememberedTrack=null,hydrated=false,restoringSeek=false,lastSave=0,saveTimer=null,restoreNotice="";
  let audio,trackList,queueList,title,subtitle,feedback,location,filter,repeat,shuffle,more,rootInput;
  const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:"base"});
  const message=(s)=>{if(feedback)feedback.textContent=s;};
  const bytes=n=>n==null?"":(n/1048576).toFixed(1)+" MB";
  // Folder URLs contain only read-only VFS locations, never media session tokens.
  const validPath=v=>typeof v==="string"&&v.length<=2048&&/^vfs:\/\/(?:gdrive|alias):\/\/[^\\?#%\x00-\x1f\x7f]+$/.test(v)&&v.split("://")[2].split("/").every(x=>x&&x!=="."&&x!=="..");
  const urlSchema={folder:{maxLength:2048,pattern:/^vfs:\/\/(?:gdrive|alias):\/\//}};
  function readFolder(){const value=AppUIUrlFields.read(urlSchema).folder;return validPath(value)?value:null;}
  function updateFolderUrl(value,mode="push"){
    if(!validPath(value)||readFolder()===value)return;
    const url=new URL(window.location.href);url.searchParams.set("folder",value);
    history[mode==="replace"?"replaceState":"pushState"](history.state,"",url.href);
  }
  const STORAGE="music-player:playback:v1",POSITION="music-player:position:v1";
  function cleanTrack(t){
    if(!t||!validPath(t.url)||typeof t.name!=="string"||!t.name||t.name.length>1024)return null;
    return {url:t.url,name:t.name,size:Number.isFinite(t.size)&&t.size>=0?t.size:null};
  }
  function storageGet(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function saveQueue(){
    if(!hydrated)return;
    try{
      const rows=queue.slice(0,MAX_QUEUE).map(cleanTrack).filter(Boolean);
      const snapshot={version:1,folder:validPath(folder)?folder:null,queue:rows,index,track:cleanTrack(rememberedTrack),repeat:repeat.value,shuffle:shuffle.checked,volume:audio.volume,muted:audio.muted};
      localStorage.setItem(STORAGE,JSON.stringify(snapshot));savePosition(true);
    }catch(_){restoreNotice="Playback state could not be saved (browser storage unavailable or full).";if(resumeButton)resumeButton.title=restoreNotice;}
  }
  function savePosition(force=false){
    if(!hydrated||restoringSeek)return;
    if(!force&&Date.now()-lastSave<2000)return;
    if(token&&audio.readyState>=1&&rememberedTrack&&current?.url===rememberedTrack.url&&Number.isFinite(audio.currentTime))resumeAt=audio.ended?0:Math.max(0,audio.currentTime);
    lastSave=Date.now();
    try{localStorage.setItem(POSITION,JSON.stringify({url:rememberedTrack?.url||null,seconds:resumeAt}));}catch(_){}
  }
  function persistQueue(immediate=false){
    if(!hydrated)return;
    clearTimeout(saveTimer);
    if(immediate)saveQueue();else saveTimer=setTimeout(saveQueue,200);
  }
  function restorePlayback(){
    let s,pos;
    try{s=JSON.parse(storageGet(STORAGE)||"null");pos=JSON.parse(storageGet(POSITION)||"null");}catch(_){}
    if(s?.version===1){
      queue=Array.isArray(s.queue)?s.queue.slice(0,MAX_QUEUE).map(cleanTrack).filter(Boolean):[];
      rememberedTrack=cleanTrack(s.track);
      if(rememberedTrack){
        index=Number.isInteger(s.index)&&queue[s.index]?.url===rememberedTrack.url?s.index:queue.findIndex(t=>t.url===rememberedTrack.url);
        resumeAt=pos?.url===rememberedTrack.url&&Number.isFinite(pos.seconds)?Math.max(0,Math.min(pos.seconds,86400)):0;
        current=rememberedTrack;title.textContent=current.name;subtitle.textContent="Saved position · "+formatTime(resumeAt);
        queueDisplay=index>=0?Math.floor(index/200)*200:0;
        if(resumeButton)resumeButton.hidden=false;
      }
      if(["off","all","one"].includes(s.repeat))repeat.value=s.repeat;
      shuffle.checked=s.shuffle===true;
      if(Number.isFinite(s.volume))audio.volume=Math.max(0,Math.min(1,s.volume));
      audio.muted=s.muted===true;
    }
    hydrated=true;renderQueue();renderTracks();
    return validPath(s?.folder)?s.folder:null;
  }
  function formatTime(seconds){const n=Math.floor(seconds||0);return Math.floor(n/60)+":"+String(n%60).padStart(2,"0");}
  async function resumeSaved(){
    if(busy||!rememberedTrack)return;
    let i=index;
    if(queue[i]?.url!==rememberedTrack.url)i=queue.findIndex(t=>t.url===rememberedTrack.url);
    if(i<0){if(queue.length>=MAX_QUEUE)queue.pop();queue.unshift(rememberedTrack);i=0;}
    await playIndex(i,resumeAt);
  }
  async function revealFolder(value,epoch){
    if(!tree||!validPath(value))return;
    const root=roots.filter(r=>value===r.url||value.startsWith(r.url+"/")).sort((a,b)=>b.url.length-a.url.length)[0];
    if(!root){roots.unshift({name:value.split("/").at(-1),url:value});renderTree();tree.setActive(value);return;}
    if(root.url===value){tree.setActive(value);return;}
    await tree.revealPath(value,{rootPath:root.url,select:false,getChildren:async path=>{
      if(epoch!==folderEpoch)return [];
      const r=await api("browse",{url:path,complete:true,fresh:true});
      if(epoch!==folderEpoch)return [];
      return r.entries.filter(e=>e.kind==="dir").map(folderNode);
    }});
    if(epoch===folderEpoch)tree.setActive(value);
  }
  const folderNode=(r)=>({name:r.name,path:r.url,icon:"📁",hasChildren:true,data:{folder:true}});
  function renderTree(){
    treeEpoch++;if(tree)tree.setRoots(roots.map(folderNode));
  }
  function sidebar(host){
    const wrap=el("div");wrap.className="mp-sidebar";host.append(wrap);
    wrap.append(el("h2","Library"));
    const bar=el("div");bar.className="mp-actions";
    bar.append(btn("Google Drive",()=>setLibrary("vfs://gdrive://root")),btn("Refresh",refreshLibrary));
    rootInput=el("input");rootInput.placeholder="vfs://gdrive://My Music";rootInput.setAttribute("aria-label","Music library VFS URL");
    const open=btn("Open library",()=>setLibrary(rootInput.value.trim()));
    rootInput.onkeydown=e=>{if(e.key==="Enter")open.click();};
    const setup=el("a","Google Drive connection");setup.href="/apps/file/gdrive/";wrap.append(bar,rootInput,open,setup);
    const node=el("div");node.className="mp-tree";wrap.append(node);
    tree=AppUITree.create({container:node,searchable:true,searchPlaceholder:"Filter folders…",storageKey:"music-player:folders",
      onExpand:async(n,done)=>{
        const epoch=treeEpoch;
        try{
          const r=await api("browse",{url:n.data?.parent||n.path,offset:n.data?.offset||0,fresh:true});
          if(epoch!==treeEpoch)return done([]);
          const kids=r.entries.filter(x=>x.kind==="dir").map(folderNode);
          if(r.next_offset!==null)kids.push({name:"More folders…",path:(n.data?.parent||n.path)+"#page-"+r.next_offset,hasChildren:true,data:{parent:n.data?.parent||n.path,offset:r.next_offset,more:true}});
          if(r.ambiguous)message("Some duplicate Drive names were omitted; resolve duplicates in Drive.");
          done(kids);
        }catch(e){if(epoch===treeEpoch)message(e.message);done([]);}
      },
      onSelect:n=>{if(n.data?.folder)browse(n.path,false,"push").catch(()=>{});}
    });renderTree();
  }
  async function refreshLibrary(){
    message("Refreshing from Google Drive…");
    // Rebuild expanded branches from fresh provider data, not retained children.
    const r=await api("roots").catch(e=>{message(e.message);return null;});
    if(!r)return;
    const custom=roots.filter(x=>!r.roots.some(y=>y.url===x.url));
    roots=[...custom,...r.roots];renderTree();
    if(folder)await browse(folder,false,"none",true).catch(()=>{});
  }
  async function setLibrary(url){
    if(!url)return;
    const previous=roots.slice();
    try{
      const result=await browse(url,false,"push");if(!result)return;
      libraryRoot=url;const item={name:url.split("/").filter(Boolean).at(-1)==="root"?"Google Drive":url.split("/").filter(Boolean).at(-1),url:folder};
      roots=[item,...previous.filter(x=>x.url!==item.url)];
      renderTree();rootInput.value=url;
      try{localStorage.setItem("music-player:library",url);}catch(_){}
    }catch(e){message(e.message);}
  }
  async function browse(url,append=false,historyMode="none",reveal=false){
    const epoch=++folderEpoch;folderLoading=true;message("Loading Drive folder…");
    try{
      const r=await api("browse",{url,offset:append?nextOffset:0,fresh:true});
      if(epoch!==folderEpoch)return;
      folder=r.url;nextOffset=r.next_offset;
      const found=r.entries.filter(x=>x.kind==="track");
      tracks=(append?[...tracks,...found]:found).sort((a,b)=>collator.compare(a.name,b.name));
      tracks=[...new Map(tracks.map(x=>[x.url,x])).values()];
      location.textContent=folder;location.title=folder;
      renderTracks();
      message((tracks.length?tracks.length+" audio tracks. ":"No audio files at this level. Select a folder in the tree. ")+(r.ambiguous?"Duplicate names omitted. ":"")+(nextOffset!==null?"More entries available. ":"")+(r.checked_at?"Drive checked "+new Date(r.checked_at*1000).toLocaleTimeString():""));
      tree?.setActive(folder);
      if(!append){if(historyMode!=="none")updateFolderUrl(folder,historyMode);persistQueue();if(reveal)void revealFolder(folder,epoch).catch(()=>{});}
      return true;
    }catch(e){if(epoch===folderEpoch){tracks=[];nextOffset=null;renderTracks();message("Refresh failed: "+e.message);}throw e;}finally{if(epoch===folderEpoch)folderLoading=false;}
  }
  function cancelScan(note=""){
    scanEpoch++;scanning=false;waitingNext=false;
    if(cancelScanButton)cancelScanButton.hidden=true;
    if(scanStatus)scanStatus.textContent=note;
  }
  function appendQueue(items){
    const room=Math.max(0,MAX_QUEUE-queue.length);
    queue.push(...items.slice(0,room));renderQueue();
    return items.length<=room;
  }
  async function scanFolders(url,play){
    if(!url||busy)return;
    cancelScan();
    const epoch=scanEpoch;scanning=true;cancelScanButton.hidden=false;
    if(play){await dropToken();if(epoch!==scanEpoch)return;queue=[];index=-1;current=null;rememberedTrack=null;resumeAt=0;resumeButton.hidden=true;queueDisplay=0;renderQueue();renderTracks();subtitle.textContent="Finding audio in subfolders…";}
    let visited=0,found=0,skipped=0,started=false,limited=false;
    const stack=[{url,depth:0}],seen=new Set();
    const status=()=>{if(epoch===scanEpoch)scanStatus.textContent="Scanning "+url.split("/").at(-1)+" and subfolders · "+visited+" folders · "+found+" tracks"+(skipped?" · "+skipped+" skipped":"");};
    status();
    try{
      while(stack.length&&epoch===scanEpoch){
        if(visited>=MAX_SCAN_FOLDERS||found>=MAX_QUEUE){limited=true;break;}
        const node=stack.pop();
        if(seen.has(node.url))continue;
        seen.add(node.url);visited++;status();
        let r;
        try{r=await api("browse",{url:node.url,fresh:true,complete:true});}
        catch(e){if(epoch!==scanEpoch)return;if(visited===1)throw e;skipped++;continue;}
        if(epoch!==scanEpoch)return;
        if(r.next_offset!=null)throw new Error("Incomplete folder listing; choose a smaller folder.");
        skipped+=r.ambiguous||0;
        const order=(a,b)=>collator.compare(a.name,b.name)||a.name.localeCompare(b.name);
        const files=r.entries.filter(x=>x.kind==="track").sort(order);
        const dirs=r.entries.filter(x=>x.kind==="dir").sort(order);
        if(node.depth<32){const room=Math.max(0,MAX_SCAN_FOLDERS-visited-stack.length);if(dirs.length>room)limited=true;for(const child of dirs.slice(0,room).reverse())stack.push({url:child.url,depth:node.depth+1});}
        else if(dirs.length)limited=true;
        if(files.length){
          if(play&&!started)started=true;
          const before=queue.length,items=files.slice(0,Math.max(0,MAX_QUEUE-found));
          const all=appendQueue(items);found+=queue.length-before;status();
          if(play&&started&&index===-1&&queue.length&&!busy){void playIndex(0);}
          else if(waitingNext&&index+1<queue.length&&!busy){waitingNext=false;void playIndex(index+1);}
          if(!all||items.length<files.length||queue.length>=MAX_QUEUE){limited=true;break;}
        }
      }
      if(epoch!==scanEpoch)return;
      scanStatus.textContent=(limited?"Partial scan (limit reached)":skipped?"Scan finished with omissions":"Scan complete")+" · "+visited+" folders · "+found+" tracks"+(skipped?" · "+skipped+" unavailable or ambiguous entries skipped":"")+(found?"":" · No playable tracks found");
    }catch(e){if(epoch===scanEpoch)scanStatus.textContent="Folder scan stopped: "+e.message+" · "+found+" tracks added";}
    finally{if(epoch===scanEpoch){scanning=false;cancelScanButton.hidden=true;waitingNext=false;persistQueue(true);}}
  }
  function row(track,i,isQueue=false){
    const r=el("div");r.className="mp-track";
    if(current?.url===track.url)r.classList.add("mp-current");
    const num=el("span",String(i+1).padStart(2,"0"));num.className="mp-num";
    const name=btn(track.name,()=>{if(isQueue)playIndex(i);else if(!busy){cancelScan();queue=visibleTracks().slice();queueDisplay=0;playIndex(queue.findIndex(x=>x.url===track.url));}});
    name.className="mp-track-name";name.title=track.url;name.setAttribute("aria-label",track.name);
    if(isQueue){const parent=el("small",track.url.split("/").slice(-2,-1)[0]||"");parent.className="mp-track-parent";name.append(parent);}
    const meta=el("span",bytes(track.size));meta.className="mp-size";
    const action=btn(isQueue?"Remove":"＋",()=>{if(busy)return;if(isQueue){queue.splice(i,1);if(i<index)index--;else if(i===index)index=i-1;}else if(queue.length<MAX_QUEUE)queue.push(track);else message("Queue limit reached.");renderQueue();});
    action.setAttribute("aria-label",(isQueue?"Remove ":"Add to queue ")+track.name);
    r.append(num,name,meta,action);return r;
  }
  function visibleTracks(){const q=filter.value.trim().toLowerCase();return tracks.filter(t=>t.name.toLowerCase().includes(q));}
  function renderTracks(){
    if(!trackList)return;
    const rows=visibleTracks();trackList.replaceChildren();
    if(!rows.length)trackList.append(el("p","No matching tracks."));
    rows.forEach((t,i)=>trackList.append(row(t,i)));more.hidden=nextOffset===null;
  }
  function renderQueue(){
    queueList.replaceChildren();
    if(queueCount)queueCount.textContent=queue.length+" tracks"+(index>=0?" · Track "+(index+1):"");
    persistQueue();if(!queue.length)queueList.append(el("p","Queue is empty. Play a folder or add tracks."));
    const start=Math.min(queueDisplay,Math.max(0,Math.floor((queue.length-1)/200)*200));
    const limit=Math.min(queue.length,start+200);
    if(start)queueList.append(btn("Previous 200 tracks",()=>{queueDisplay=Math.max(0,start-200);renderQueue();}));
    if(index>=0&&(index<start||index>=limit))queueList.append(btn("Show current track",()=>{queueDisplay=Math.floor(index/200)*200;renderQueue();}));
    for(let i=start;i<limit;i++)queueList.append(row(queue[i],i,true));
    if(limit<queue.length)queueList.append(btn("Next 200 tracks",()=>{queueDisplay=limit;renderQueue();}));
  }
  async function dropToken(){
    savePosition(true);const old=token,oldMode=streamMode;token=null;streamMode="proxy";audio.pause();audio.removeAttribute("src");audio.load();
    if(old){try{if(oldMode==="direct")await directClient.release(old);else await api("release",{token:old});}catch(_){}}
  }
  async function playIndex(i,position=0){
    if(busy){message("A track is still preparing from Drive.");return;}
    if(i<0||i>=queue.length)return;
    busy=true;const epoch=++playingEpoch;const track=queue[i];index=i;queueDisplay=Math.floor(i/200)*200;
    try{
      await dropToken();if(epoch!==playingEpoch)return;current=track;rememberedTrack=track;resumeAt=Math.max(0,position||0);restoringSeek=resumeAt>0;try{localStorage.setItem(POSITION,JSON.stringify({url:track.url,seconds:resumeAt}));}catch(_){}resumeButton.hidden=true;title.textContent=track.name;subtitle.textContent="Opening Google Drive stream…";renderTracks();renderQueue();persistQueue(true);
      message("Resolving track through VFS…");
      const selectedMode=directMode?"direct":"proxy";
      let r;
      if(selectedMode==="direct"){
        if(!directClient?.connected())throw Error("Authorize Google for browser-direct playback, or explicitly select VM proxy.");
        const descriptor=await api("direct_prepare",{url:track.url});
        if(epoch!==playingEpoch)return;
        r=await directClient.open(descriptor.handle);
      }else r=await api("prepare",{url:track.url});
      if(epoch!==playingEpoch){if(selectedMode==="direct")await directClient.release(r.token);else await api("release",{token:r.token});return;}
      streamMode=selectedMode;token=r.token;
      const begin=()=>{if(epoch!==playingEpoch||token!==r.token)return;audio.play().catch(()=>{if(epoch===playingEpoch&&token===r.token)message("Track ready. Press play in the audio controls; your browser may block autoplay or not support this format.");});};
      if(restoringSeek){
        const seek=()=>{if(epoch!==playingEpoch||token!==r.token)return;try{audio.currentTime=Number.isFinite(audio.duration)?Math.min(resumeAt,Math.max(0,audio.duration-.25)):resumeAt;}catch(_){}restoringSeek=false;savePosition(true);begin();};
        audio.addEventListener("loadedmetadata",seek,{once:true});
      }
      audio.src=r.url;subtitle.textContent=bytes(r.bytes)+(streamMode==="direct"?" · Browser-direct Google Drive":" · Pylon proxy");
      message("Buffering audio from Google Drive…");
      if(!restoringSeek)begin();
    }catch(e){restoringSeek=false;resumeButton.hidden=!rememberedTrack;subtitle.textContent="Playback unavailable";message(e.message);}
    finally{busy=false;}
  }
  function advance(delta=1,ended=false){
    if(busy){message("A track is still preparing from Drive.");return;}
    if(!queue.length)return;
    if(ended&&repeat.value==="one"){audio.currentTime=0;audio.play().catch(()=>{});return;}
    let n=index+delta;
    if(!scanning&&shuffle.checked&&queue.length>1&&delta>0){do{n=Math.floor(Math.random()*queue.length);}while(n===index);}
    if(n>=queue.length&&scanning&&delta>0){waitingNext=true;message("Waiting for more subfolder tracks…");return;}
    if(n>=queue.length&&repeat.value==="all")n=0;
    if(n<0&&repeat.value==="all")n=queue.length-1;
    if(n>=0&&n<queue.length)playIndex(n);else message("End of queue.");
  }
  let playlists=[],playlistRevision=null,playlistSelect,playlistName,playlistStatus,playlistBusy=false,playlistButtons=[];
  function playlistMessage(text){playlistStatus.textContent=text;}
  function showPlaylists(r,selected){
    playlists=r.playlists;playlistRevision=r.revision;
    const keep=selected||playlistSelect.value;
    playlistSelect.replaceChildren(new Option("Select a saved playlist",""));
    for(const p of playlists)playlistSelect.add(new Option(p.name+" · "+p.count+" tracks",p.id));
    playlistSelect.value=playlists.some(p=>p.id===keep)?keep:"";
    if(playlistSelect.value)playlistName.value=playlists.find(p=>p.id===playlistSelect.value).name;
  }
  async function playlistTask(fn){
    if(playlistBusy)return;
    playlistBusy=true;playlistButtons.forEach(b=>b.disabled=true);
    try{await fn();}catch(e){playlistMessage(e.message);}
    finally{playlistBusy=false;playlistButtons.forEach(b=>b.disabled=false);}
  }
  function refreshPlaylists(){return playlistTask(async()=>{playlistMessage("Loading saved playlists from Drive…");showPlaylists(await api("playlists_list"));playlistMessage(playlists.length+" saved playlists");});}
  function selectedPlaylist(){const p=playlists.find(x=>x.id===playlistSelect.value);if(!p)throw new Error("Select a saved playlist first.");return p;}
  function changePlaylist(action){
    return playlistTask(async()=>{
      if(playlistRevision===null){showPlaylists(await api("playlists_list"));}
      const p=action==="create"?null:selectedPlaylist(),name=playlistName.value.trim();
      if((action==="create"||action==="rename")&&!name)throw new Error("Enter a playlist name.");
      if((action==="create"||action==="replace")&&(!queue.length||scanning))throw new Error(scanning?"Finish or cancel the folder scan before saving.":"Add tracks to the queue first.");
      const snapshot=queue.map(t=>({url:t.url}));
      const question=action==="create"?"Save "+snapshot.length+" tracks as “"+name+"” to Google Drive?":action==="replace"?"Replace the tracks in “"+p.name+"” with the current "+snapshot.length+" tracks?":action==="rename"?"Rename “"+p.name+"” to “"+name+"”?":"Delete playlist “"+p.name+"”? Audio files will not be deleted.";
      if(!await AppUIDialog.confirmAsync(question,{danger:action==="delete"}))return;
      playlistMessage("Saving playlist collection…");
      const args={action,confirm:true,expected_revision:playlistRevision};
      if(p)args.id=p.id;
      if(action==="create"||action==="rename")args.name=name;
      if(action==="create"||action==="replace")args.tracks=snapshot;
      const r=await api("playlist_change",args);showPlaylists(r,action==="delete"?"":r.id);
      if(action==="delete")playlistName.value="";
      playlistMessage(action==="delete"?"Playlist deleted. Audio unchanged.":"Saved and verified on Google Drive.");
    });
  }
  function openPlaylist(mode){
    return playlistTask(async()=>{
      if(busy)throw new Error("Wait for the current track to open.");
      const p=selectedPlaylist();playlistMessage("Loading “"+p.name+"”…");
      const r=await api("playlist_get",{id:p.id});
      if(r.revision!==playlistRevision)throw new Error("Playlists changed elsewhere. Refresh playlists first.");
      const items=r.playlist.tracks.map(cleanTrack).filter(Boolean);
      if(!items.length)throw new Error("No valid tracks in playlist.");
      if(mode==="append"){if(queue.length+items.length>MAX_QUEUE)throw new Error("Queue limit reached.");appendQueue(items);persistQueue(true);}
      else{
        cancelScan();await dropToken();queue=items;index=-1;current=null;rememberedTrack=null;resumeAt=0;restoringSeek=false;queueDisplay=0;resumeButton.hidden=true;title.textContent=r.playlist.name;subtitle.textContent="Saved playlist · "+items.length+" tracks";renderTracks();renderQueue();persistQueue(true);
        if(mode==="play")void playIndex(0);
      }
      playlistMessage("Loaded “"+p.name+"” · "+items.length+" tracks");
    });
  }
  function playlistPanel(){
    const section=el("section");section.className="mp-playlists";
    section.append(el("h2","Saved playlists"));
    playlistSelect=el("select");playlistSelect.setAttribute("aria-label","Saved playlist");playlistSelect.add(new Option("Select a saved playlist",""));
    playlistName=el("input");playlistName.placeholder="Playlist name";playlistName.maxLength=120;playlistName.setAttribute("aria-label","Playlist name");
    playlistSelect.onchange=()=>{playlistName.value=playlists.find(p=>p.id===playlistSelect.value)?.name||"";};
    const actions=el("div");actions.className="mp-actions";
    const actions2=el("div");actions2.className="mp-actions";
    for(const [label,fn] of [["Play playlist",()=>openPlaylist("play")],["Load playlist",()=>openPlaylist("load")],["Add to queue",()=>openPlaylist("append")],["Refresh playlists",refreshPlaylists]]){const b=btn(label,fn);playlistButtons.push(b);actions.append(b);}
    for(const [label,fn] of [["Save queue as new playlist",()=>changePlaylist("create")],["Update playlist from queue",()=>changePlaylist("replace")],["Rename playlist",()=>changePlaylist("rename")],["Delete playlist",()=>changePlaylist("delete")]]){const b=btn(label,fn);playlistButtons.push(b);actions2.append(b);}
    playlistStatus=el("p","Saved on Google Drive, not in browser storage.");playlistStatus.className="mp-feedback";playlistStatus.setAttribute("role","status");
    section.append(playlistSelect,actions,playlistName,actions2,playlistStatus);
    return section;
  }
  function directPanel(){
    const panel=el("section");panel.className="mp-direct";
    panel.append(el("h2","Playback transport"));
    const mode=el("select");mode.setAttribute("aria-label","Playback transport");
    mode.add(new Option("VM proxy (default)","proxy"));mode.add(new Option("Browser-direct Google Drive","direct"));
    directMode=!!window.PYLON_API_ORIGIN||storageGet("music-player:transport")==="direct";mode.value=directMode?"direct":"proxy";if(window.PYLON_API_ORIGIN)mode.options[0].disabled=true;
    const config=el("div");config.className="mp-direct-config";config.hidden=!directMode;
    const description=el("p","Direct playback uses a separate read-only Google authorization in this browser. No server access token is shared.");
    clientIdInput=el("input");clientIdInput.setAttribute("aria-label","Google Web OAuth client ID");clientIdInput.placeholder="Web application OAuth client ID";
    clientIdInput.value=storageGet("music-player:direct-client-id")||"";
    directFeedback=el("p","Set up a Web application client in Google Cloud with this authorized JavaScript origin: "+window.location.origin);directFeedback.className="mp-feedback";directFeedback.setAttribute("role","status");
    const setup=btn("Set up direct access",async()=>{
      setup.disabled=true;
      try{
        const id=clientIdInput.value.trim();
        if(!directClient)throw Error("Browser-direct VFS unavailable.");
        await directClient.setup(id);
        try{localStorage.setItem("music-player:direct-client-id",id);}catch(_){}
        authorizeButton.disabled=false;
      }catch(e){directFeedback.textContent=e.message;}finally{setup.disabled=false;}
    });
    authorizeButton=btn("Authorize Google",()=>{try{directClient.authorize();}catch(e){directFeedback.textContent=e.message;}});authorizeButton.disabled=true;
    const disconnect=btn("Disconnect Google",async()=>{
      if(streamMode==="direct"){if(busy)playingEpoch++;await dropToken();restoringSeek=false;resumeButton.hidden=!rememberedTrack;subtitle.textContent="Direct connection disconnected";}
      await directClient?.disconnect();authorizeButton.disabled=false;
    });
    try{directClient=window.VFSDriveDirect.create({scope:(window.PYLON_STATIC_BASE||"")+"/apps/personal/music_player/",worker:(window.PYLON_STATIC_BASE||"")+"/apps/personal/music_player/direct-worker.js",onStatus:s=>{directFeedback.textContent=s;}});}catch(_){mode.options[1].disabled=true;if(directMode)directFeedback.textContent="Browser-direct unavailable; explicitly select VM proxy to play.";}
    mode.onchange=async()=>{
      directMode=mode.value==="direct";config.hidden=!directMode;try{localStorage.setItem("music-player:transport",mode.value);}catch(_){}
      if(busy)playingEpoch++;
      if(token||busy){await dropToken();restoringSeek=false;resumeButton.hidden=!rememberedTrack;subtitle.textContent="Transport changed · resume playback";}
      if(!directMode)await directClient?.disconnect();
    };
    const buttons=el("div");buttons.className="mp-actions";buttons.append(setup,authorizeButton,disconnect);
    config.append(description,clientIdInput,buttons,directFeedback);
    panel.append(mode,config);
    return panel;
  }
  function content(host){
    body=el("div");body.className="mp-main";host.append(body);
    const top=el("div");top.className="mp-now";const artwork=el("div","♫");artwork.className="mp-art";
    const info=el("div");info.className="mp-info";title=el("h1","Music Player");subtitle=el("p","Select a library folder to listen");info.append(title,subtitle);
    top.append(artwork,info);body.append(top);
    const controls=el("div");controls.className="mp-controls";
    audio=el("audio");audio.controls=true;audio.preload="metadata";audio.setAttribute("aria-label","Audio playback");
    audio.onplaying=()=>message(streamMode==="direct"?"Playing directly from Google Drive (no VM media traffic).":"Playing from Google Drive through Pylon.");audio.onwaiting=()=>{if(token)message("Buffering audio from Google Drive…");};audio.ontimeupdate=()=>savePosition();audio.onpause=()=>savePosition(true);audio.onseeked=()=>savePosition(true);audio.onvolumechange=()=>persistQueue();audio.onended=()=>{resumeAt=0;savePosition(true);advance(1,true);};audio.onerror=()=>{if(!audio.getAttribute("src"))return;restoringSeek=false;if(rememberedTrack)resumeButton.hidden=false;message(streamMode==="direct"?"Direct stream interrupted. Reauthorize if needed, then Resume saved playback; no automatic proxy fallback.":"Browser could not decode this audio or playback expired. Try another track.");};
    repeat=el("select");repeat.setAttribute("aria-label","Repeat");for(const [v,t] of [["off","Repeat off"],["all","Repeat all"],["one","Repeat track"]])repeat.add(new Option(t,v));
    shuffle=el("input");shuffle.type="checkbox";const sh=el("label","Shuffle ");sh.append(shuffle);
    repeat.onchange=()=>persistQueue(true);shuffle.onchange=()=>persistQueue(true);resumeButton=btn("Resume saved playback",resumeSaved);resumeButton.hidden=true;
    controls.append(resumeButton,btn("Previous",()=>advance(-1)),btn("Next",()=>advance(1)),repeat,sh,btn("Stop",async()=>{cancelScan("Folder scan stopped.");if(busy)playingEpoch++;await dropToken();restoringSeek=false;resumeButton.hidden=!rememberedTrack;subtitle.textContent="Stopped · "+formatTime(resumeAt);persistQueue(true);message("Playback copy released.");}));
    body.append(audio,controls,directPanel());
    if(window.PylonFrontendAuth){
      const authPanel=el("div");authPanel.className="mp-actions";
      authPanel.append(btn("Connect Pylon",()=>window.PylonFrontendAuth.connect().catch(e=>message(e.message))),
        btn("Disconnect Pylon",async()=>{cancelScan();if(busy)playingEpoch++;await dropToken();await window.PylonFrontendAuth.disconnect();message("Pylon disconnected. Connect again to browse.");}));
      body.prepend(authPanel);
    }
    feedback=el("p","Choose a Drive folder in the sidebar.");feedback.className="mp-feedback";feedback.setAttribute("role","status");body.append(feedback);
    const split=el("div");split.className="mp-split";body.append(split);
    const listPanel=el("section");listPanel.className="mp-panel";listPanel.append(el("h2","Folder tracks"));
    location=el("p","Google Drive");location.className="mp-path";listPanel.append(location);
    filter=el("input");filter.type="search";filter.placeholder="Filter tracks…";filter.setAttribute("aria-label","Filter tracks");filter.oninput=renderTracks;
    const actions=el("div");actions.className="mp-actions";
    actions.append(btn("Play folder",()=>{if(!busy&&visibleTracks().length){cancelScan();queue=visibleTracks().slice();queueDisplay=0;renderQueue();playIndex(0);}}),btn("Add folder to queue",()=>{if(!appendQueue(visibleTracks()))message("Queue limit reached.");}));
    const recursive=el("div");recursive.className="mp-actions";
    recursive.append(btn("Play folder & subfolders",()=>{if(!folderLoading)scanFolders(folder,true);}),btn("Add folder & subfolders",()=>{if(!folderLoading)scanFolders(folder,false);}));
    cancelScanButton=btn("Cancel scan",()=>cancelScan("Folder scan cancelled; discovered tracks retained."));cancelScanButton.hidden=true;recursive.append(cancelScanButton);
    scanStatus=el("p","");scanStatus.className="mp-feedback";scanStatus.setAttribute("role","status");scanStatus.id="mp-scan-status";
    trackList=el("div");trackList.className="mp-list";more=btn("Load more",()=>browse(folder,true).catch(()=>{}));more.hidden=true;
    listPanel.append(filter,actions,recursive,scanStatus,trackList,more);
    const qPanel=el("section");qPanel.className="mp-panel";qPanel.append(el("h2","Play queue"),btn("Clear queue",async()=>{if(!busy){cancelScan();await dropToken();queue=[];index=-1;current=null;rememberedTrack=null;resumeAt=0;resumeButton.hidden=true;queueDisplay=0;title.textContent="Music Player";subtitle.textContent="Select a library folder to listen";renderTracks();renderQueue();persistQueue(true);}}));queueCount=el("p","0 tracks");queueCount.className="mp-path";qPanel.append(queueCount);queueList=el("div");queueList.className="mp-list";qPanel.append(queueList,playlistPanel());
    split.append(listPanel,qPanel);renderTracks();renderQueue();
  }
  AppUI.createApp({id:"personal-music-player",title:"Music Player",leftSidebar:{width:300,tabs:[{id:"library",label:"Library",active:true,render:sidebar}]},content:{render:content},statusbar:{}});
  async function start(){
    const savedFolder=restorePlayback();
    if(window.PylonFrontendAuth){
      await window.PylonFrontendAuth.ready;
      if(!window.PylonFrontendAuth.getToken()){message("Connect Pylon to browse your library. Then authorize Google for direct playback.");return;}
    }
    void refreshPlaylists();
    try{
      const r=await api("roots");roots=r.roots;libraryRoot=storageGet("music-player:library")||r.default_url||"vfs://gdrive://root";
      if(!validPath(libraryRoot))libraryRoot=r.default_url;
      if(!roots.some(x=>x.url===libraryRoot))roots.unshift({name:libraryRoot.split("/").at(-1),url:libraryRoot});
      rootInput.value=libraryRoot;renderTree();
      const target=readFolder()||savedFolder||libraryRoot;
      await browse(target,false,"replace",true);
      if(rememberedTrack)message("Playback restored at "+formatTime(resumeAt)+". Resume when ready.");
    }catch(e){message(e.message);}
  }
  window.addEventListener("popstate",()=>{const target=readFolder()||libraryRoot;if(target)browse(target,false,"none",true).catch(()=>{});});
  window.addEventListener("pagehide",()=>{saveQueue();savePosition(true);});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveQueue();});
  start();
}).catch(e=>{document.getElementById("app-content-body").textContent="Music Player unavailable: "+String(e.message||e);});
