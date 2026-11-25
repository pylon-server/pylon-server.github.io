/* Static adapter: run the existing AppUI app only after a scoped owner grant.
 * The gateway is the authoritative operation allowlist. */
(()=>{"use strict";
const auth=window.PylonFrontendAuth;
const config=window.PYLON_NATIVE_APP;
if(!auth||!config)return;
const scriptPath=new URL(config.script,location.href);
if(scriptPath.origin!==location.origin||!scriptPath.pathname.startsWith(location.pathname+"assets/"))throw Error("Invalid native app script");
const button=(text,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=text;b.onclick=fn;return b};
const panel=document.createElement("div");panel.style.cssText="padding:14px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #8885";
const status=document.createElement("span");status.setAttribute("role","status");status.textContent="Disconnected";
const connect=button("Connect Pylon",()=>auth.connect().catch(()=>status.textContent="Connection failed"));
const disconnect=button("Disconnect Pylon",async()=>{await auth.disconnect();location.replace(location.pathname)});
const home=document.createElement("a");home.href="/apps/platform/home/";home.textContent="Home";
const fallback=document.createElement("a");fallback.href=window.PYLON_API_ORIGIN+location.pathname;fallback.textContent="Backend app";
panel.append(connect,disconnect,home,fallback,status);
document.body.prepend(panel);
const app=document.getElementById("app-main");app.hidden=true;disconnect.hidden=true;
auth.ready.then(async()=>{
 if(!auth.getToken())return;
 connect.hidden=true;disconnect.hidden=false;app.hidden=false;status.textContent="Connected";
 await window.AppUIReady;
 if(!auth.getToken()){location.replace(location.pathname);return;}
 const script=document.createElement("script");script.src=scriptPath.href;
 script.onerror=()=>{status.textContent="Application failed to load"};
 document.body.append(script);
 const timer=setInterval(()=>{if(!auth.getToken()){clearInterval(timer);location.replace(location.pathname)}},1000);
 window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
}).catch(()=>{status.textContent="Connection failed"});
})();