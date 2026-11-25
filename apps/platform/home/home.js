/* Read-only static Home directory; operations stay on their owner-authenticated backend pages. */
(()=>{"use strict";
const api=new URL(window.PYLON_API_ORIGIN),auth=window.PylonFrontendAuth;
let apps=[],connected=false,epoch=0;
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
function appUrl(a){
  if(typeof a.app_id!=="string"||!(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/).test(a.app_id)||a.url!=="/apps/"+a.app_id+"/")return null;
  if(a.app_id==="personal/music_player")return a.url;
  return api.origin+a.url;
}
async function get(path){
  if(!["/v1/apps","/v1/endpoints"].includes(path))throw Error("Directory path denied");
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
  const status=el("p","Disconnected");status.setAttribute("role","status");main.append(status);
  const search=el("input");search.type="search";search.placeholder="Search applications";search.setAttribute("aria-label","Search applications");main.append(search);
  const grid=el("div");grid.className="home-apps";main.append(grid);
  function render(){
    grid.replaceChildren();const q=search.value.toLowerCase().trim();
    for(const a of apps){const url=appUrl(a);if(!url||!(String(a.title)+" "+a.app_id).toLowerCase().includes(q))continue;
      const link=el("a");link.href=url;link.append(el("strong",a.title||a.app_id),el("small",a.app_id));grid.append(link);}
  }
  function state(ok){connected=ok;connect.hidden=ok;disconnect.hidden=!ok;refresh.disabled=!ok;search.disabled=!ok;if(!ok){apps=[];search.value="";render();}}
  async function load(){
    const n=++epoch;if(!auth.getToken()){state(false);status.textContent="Disconnected — connect to view your applications";return}
    state(true);status.textContent="Loading directory…";
    try{const [a,e]=await Promise.all([get("/v1/apps"),get("/v1/endpoints")]);if(n!==epoch)return;
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
  const timer=setInterval(()=>{if(connected&&!auth.getToken()){++epoch;state(false);status.textContent="Session expired — reconnect";}},1000);
  window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
}
window.AppUIReady.then(()=>{window.AppUI.createApp({id:"static-home",title:"Pylon Home",menubar:{theme:true},content:{render:mount},statusbar:{}})}).catch(e=>{console.warn("Home mount",e.message);document.getElementById("app-content-body").textContent="Home failed to load. Open the backend Home directly."});
})();