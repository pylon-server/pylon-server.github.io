/* Shared read-only catalog view. The gateway grants only each catalog's list operation. */
(()=>{"use strict";
const profile=window.PYLON_FRONTEND_PROFILE;
const config={"book":{"title":"Book Catalog","sections":[]},"music_catalog":{"title":"Music & Classical Catalog","sections":["Music","Classical"]},"movie":{"title":"Movie Catalog","sections":["Movie","avdbs"]},"shopping":{"title":"Shopping Archive","sections":[]},"youtube":{"title":"YouTube Archive","sections":[]}}[profile];
if(!config)return;
const title=config.title,sections=config.sections;
const auth=window.PylonFrontendAuth,api=new URL(window.PYLON_API_ORIGIN);
let generation=0,currentPage=1,connected=false;
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
function mount(host){
 const root=make("section");root.className="home-launch";host.append(root);
 root.append(make("h1",title));
 const tools=make("div");tools.className="home-actions";root.append(tools);
 const connect=make("button","Connect Pylon"),disconnect=make("button","Disconnect Pylon"),full=make("a","Open backend catalog"),home=make("a","Home");
 full.href=api.origin+"/apps/personal/"+profile+"/";home.href="/apps/platform/home/";full.className=home.className="home-button";tools.append(connect,disconnect,home,full);
 const controls=make("div");controls.className="home-actions";root.append(controls);
 const input=make("input");input.type="search";input.placeholder="Search catalog";input.setAttribute("aria-label","Search catalog");
 const search=make("button","Search"),section=make("select");section.setAttribute("aria-label","Section");
 for(const name of sections){const o=make("option",name);o.value=name;section.append(o);}
 controls.append(input,search);if(sections.length)controls.append(section);
 const status=make("p","Disconnected");status.setAttribute("role","status");root.append(status);
 const list=make("div");root.append(list);
 const pager=make("div");pager.className="home-actions";root.append(pager);
 const prev=make("button","Previous"),next=make("button","Next");pager.append(prev,next);
 function state(ok){connected=ok;connect.hidden=ok;disconnect.hidden=!ok;input.disabled=search.disabled=section.disabled=!ok;prev.disabled=next.disabled=true;if(!ok){list.replaceChildren();input.value="";currentPage=1;}}
 async function load(n=1){
  const seq=++generation,token=auth.getToken();if(!token){state(false);status.textContent="Disconnected — connect to view your catalog";return}
  state(true);list.replaceChildren();status.textContent="Loading…";
  const args={page:n,page_size:50,query:input.value.trim()};if(sections.length)args.section=section.value;
  try{
   const res=await fetch(api.origin+"/v1/apps/personal/"+profile+"/list",{method:"POST",credentials:"omit",cache:"no-store",redirect:"error",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(args)});
   const data=await res.json();if(seq!==generation||!auth.getToken())return;
   if(!res.ok||!data.ok||!Array.isArray(data.items))throw Error("Catalog request failed");
   currentPage=n;
   status.textContent=String(data.total)+" entries · page "+n;
   for(const item of data.items){const row=make("article");row.className="catalog-row";row.append(make("h3",String(item.title||"Untitled")),make("p",String(item.summary||item.source_id||"")));list.append(row);}
   if(!data.items.length)list.append(make("p","No matching entries."));
   prev.disabled=n<=1;next.disabled=!data.has_more&&!(n*50<Number(data.total));
  }catch(_){if(seq!==generation)return;status.textContent="Catalog unavailable — refresh or reconnect";if(!auth.getToken())state(false);}
 }
 connect.onclick=()=>auth.connect().catch(()=>{status.textContent="Connection failed"});
 disconnect.onclick=async()=>{++generation;state(false);status.textContent="Disconnected";await auth.disconnect()};
 search.onclick=()=>load(1);input.onkeydown=e=>{if(e.key==="Enter")load(1)};section.onchange=()=>load(1);prev.onclick=()=>load(currentPage-1);next.onclick=()=>load(currentPage+1);
 state(false);auth.ready.then(()=>load(1));
 const timer=setInterval(()=>{if(connected&&!auth.getToken()){++generation;state(false);status.textContent="Session expired — reconnect";}},1000);
 window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
}
window.AppUIReady.then(()=>window.AppUI.createApp({id:"static-"+profile,title,menubar:{theme:true},content:{render:mount},statusbar:{}}));
})();