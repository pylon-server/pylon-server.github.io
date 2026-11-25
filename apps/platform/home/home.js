/* Read-only static Home directory; operations stay on their owner-authenticated backend pages. */
(()=>{"use strict";
const api=new URL(window.PYLON_API_ORIGIN),auth=window.PylonFrontendAuth;
let apps=[],connected=false,epoch=0;
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
function appUrl(a){
  if(window.PYLON_HOSTING_DIRECTORY===true){
    if(typeof a.app_id!=="string"||!(/^[a-z][a-z0-9_-]*\/[a-z][a-z0-9_-]*$/).test(a.app_id))return null;
    try{
      const u=new URL(a.page_url),loop=["localhost","127.0.0.1","[::1]"].includes(u.hostname);
      if(u.username||u.password||u.search||u.hash||u.href!==a.page_url)return null;
      if(loop){
        if(a.page_scope!=="loopback"||!(/^[a-z][a-z0-9_-]{0,63}$/).test(a.device)||!u.port||!["http:","https:"].includes(u.protocol))return null;
      }else if(u.protocol!=="https:"||a.page_scope==="loopback")return null;
      return u.href
    }catch(_){return null}
  }
  if(typeof a.app_id!=="string"||!(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/).test(a.app_id)||a.url!=="/apps/"+a.app_id+"/")return null;
  if(a.app_id==="personal/music_player"||(window.PYLON_STATIC_CATALOGS===true&&["personal/book","personal/music_catalog","personal/movie","personal/shopping","personal/youtube"].includes(a.app_id))||(window.PYLON_STATIC_NATIVE===true&&["personal/travel_video","personal/fish"].includes(a.app_id)))return a.url;
  return api.origin+a.url;
}
async function get(path){
  if(!["/v1/apps","/v1/endpoints","/_pylon/frontend/hosting"].includes(path))throw Error("Directory path denied");
  const token=auth.getToken();if(!token)throw Error("Connect Pylon first");
  const r=await fetch(api.origin+path,{method:"GET",credentials:"omit",cache:"no-store",redirect:"error",headers:{Authorization:"Bearer "+token}});
  if(!r.ok)throw Error("Directory unavailable ("+r.status+")");return r.json();
}
function mount(host){
  const main=el("section");main.className="home-launch";host.append(main);
  main.append(el("h1","Pylon Home"));
  const desc=el("p","Browse applications from the live Pylon server. Full application operations use their authenticated pages.");desc.className="muted";main.append(desc);
  const actions=el("div");actions.className="home-actions";main.append(actions);
  const connect=el("button","Connect Pylon"),disconnect=el("button","Disconnect Pylon"),refresh=el("button","Refresh");
  const full=el("a","Full Home / administration");full.className="home-button";full.href=api.origin+"/apps/platform/home/";
  actions.append(connect,disconnect,refresh,full);
  if(window.PYLON_HOSTING_DIRECTORY===true){const manage=el("a","Hosting Manager");manage.className="home-button";manage.href=api.origin+"/_pylon/hosting";actions.append(manage);}
  const status=el("p","Disconnected");status.setAttribute("role","status");main.append(status);
  const search=el("input");search.type="search";search.placeholder="Search applications";search.setAttribute("aria-label","Search applications");main.append(search);
  const grid=el("div");grid.className="home-apps";main.append(grid);
  function render(){
    const expanded=new Set(Array.from(grid.querySelectorAll("details[open]")).map(x=>x.dataset.group));
    grid.replaceChildren();const q=search.value.toLowerCase().trim(),groups=new Map();
    for(const a of apps){const url=appUrl(a);if(!url||!(String(a.title)+" "+a.app_id+" "+(a.page_provider||"")).toLowerCase().includes(q))continue;
      const group=window.PYLON_HOSTING_DIRECTORY===true?(a.source||a.app_id.split("/")[0]):"";
      let parent=grid;
      if(group){
        if(!groups.has(group)){
          const folder=el("details");folder.dataset.group=group;folder.open=!!q||expanded.has(group)||expanded.size===0;
          folder.append(el("summary",group));const children=el("div");children.className="home-apps";folder.append(children);grid.append(folder);groups.set(group,children);
        }
        parent=groups.get(group);
      }
      const link=el("a");link.href=url;link.rel="noreferrer";
      if(a.requires_device){
        link.addEventListener("click",event=>{
          if(!window.confirm("This application requires device: "+a.requires_device+". Localhost refers to the computer running this browser. Continue only on that device?"))event.preventDefault();
        });
      }
      link.append(el("strong",a.title||a.app_id),el("small",a.app_id+(a.page_provider?" · "+a.page_provider:"")+(a.discovery_status==="stale"?" · stale discovery":"")+(a.requires_device?" · local device: "+a.requires_device:"")));if(a.source){
        const labels=[];
        if(a.health_status==="stale")labels.push("Health report stale");
        else if(a.health_status==="not_reported")labels.push("Health not reported");
        else if(a.health_status==="reported"){
          for(const kind of ["page","api"]){
            const h=a.health&&a.health[kind];
            if(h&&typeof h.status==="string")labels.push(kind.toUpperCase()+": "+h.status.replaceAll("_"," "));
          }
        }
        if(labels.length)link.append(el("small",labels.join(" · ")+" (member reported)"));
      }
      parent.append(link);
    }
  }
  function state(ok){connected=ok;connect.hidden=ok;disconnect.hidden=!ok;refresh.disabled=!ok;search.disabled=!ok;if(!ok){apps=[];search.value="";render();}}
  async function load(){
    const n=++epoch;if(!auth.getToken()){state(false);status.textContent="Disconnected — connect to view your applications";return}
    state(true);status.textContent="Loading directory…";
    try{const [a,e]=await Promise.all([get(window.PYLON_HOSTING_DIRECTORY===true?"/_pylon/frontend/hosting":"/v1/apps"),get("/v1/endpoints")]);if(n!==epoch)return;
      apps=Array.isArray(a.apps)?a.apps.slice():[];apps.sort((x,y)=>String(x.title||"").localeCompare(String(y.title||"")));
      const online=(Array.isArray(e.endpoints)?e.endpoints:[]).filter(x=>!x.stale).length;
      status.textContent=apps.length+" applications · "+online+" endpoints online";render();
    }catch(_){if(n!==epoch)return;apps=[];render();status.textContent="Directory unavailable — reconnect or refresh";if(!auth.getToken())state(false);}
  }
  connect.onclick=()=>auth.connect().catch(()=>{status.textContent="Connection failed"});
  disconnect.onclick=async()=>{++epoch;state(false);status.textContent="Disconnected";await auth.disconnect()};
  refresh.onclick=load;search.oninput=render;
  state(false);auth.ready.then(load);
  // Clear the directory at grant expiry; never leave private metadata on-screen
  // after the session expires or after a late response to disconnect.
  const refreshTimer=setInterval(()=>{if(connected&&auth.getToken()&&window.PYLON_HOSTING_DIRECTORY===true)load()},30000);
  const timer=setInterval(()=>{if(connected&&!auth.getToken()){++epoch;state(false);status.textContent="Session expired — reconnect";}},1000);
  window.addEventListener("pagehide",()=>{clearInterval(timer);clearInterval(refreshTimer)},{once:true});
}
window.AppUIReady.then(()=>{window.AppUI.createApp({id:"static-home",title:"Pylon Home",menubar:{theme:true},content:{render:mount},statusbar:{}})}).catch(e=>{console.warn("Home mount",e.message);document.getElementById("app-content-body").textContent="Home failed to load. Open the backend Home directly."});
})();