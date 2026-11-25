/* Shared VFS browser-direct client. Google authorizes the browser, not the VM. */
window.VFSDriveDirect=(()=>{
  "use strict";
  const SCOPE="https://www.googleapis.com/auth/drive.readonly";
  let gisPromise;
  function loadGIS(){
    if(window.google?.accounts?.oauth2)return Promise.resolve();
    if(!gisPromise)gisPromise=new Promise((resolve,reject)=>{
      const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.referrerPolicy="no-referrer";s.async=true;
      s.onload=()=>window.google?.accounts?.oauth2?resolve():reject(Error("Google authorization unavailable"));
      s.onerror=()=>{gisPromise=null;s.remove();reject(Error("Google authorization script unavailable"));};
      document.head.append(s);
    });
    return gisPromise;
  }
  function create({scope,worker,onStatus=()=>{}}){
    const target=new URL(scope,location.origin);
    if(target.origin!==location.origin||!target.pathname.startsWith((window.PYLON_STATIC_BASE||"")+"/apps/")||!target.pathname.endsWith("/"))throw Error("Invalid direct VFS scope");
    let registration,access=null,expires=0,oauth,configuredId="",current=null,epoch=0,connecting=false;
    const connected=()=>!!access&&expires>Date.now()+5000;
    function rpc(data){
      const controller=navigator.serviceWorker.controller;
      if(!controller||new URL(controller.scriptURL).pathname!==new URL(worker,location.origin).pathname)throw Error("Direct worker not controlling this page. Reload and reconnect.");
      return new Promise((resolve,reject)=>{
        const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error("Direct worker did not respond"));},5000);
        channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();e.data?.ok?resolve():reject(Error("Direct worker rejected session"));};
        controller.postMessage(data,[channel.port2]);
      });
    }
    async function setup(id){
      if(!window.isSecureContext||!navigator.serviceWorker)throw Error("Direct streaming needs HTTPS and service workers.");
      if(typeof id!=="string"||!/^[A-Za-z0-9._-]{5,200}\.apps\.googleusercontent\.com$/.test(id))throw Error("Enter a Google Web application OAuth client ID (not a secret).");
      registration=await navigator.serviceWorker.register(worker,{scope:target.pathname,updateViaCache:"none"});
      if(new URL(registration.scope).pathname!==target.pathname)throw Error("Incorrect direct worker scope");
      if(new URL(navigator.serviceWorker.controller?.scriptURL||location.href).pathname!==new URL(worker,location.origin).pathname){
        await new Promise((resolve,reject)=>{
          let timer;
          function cleanup(){clearTimeout(timer);navigator.serviceWorker.removeEventListener("controllerchange",check);}
          function check(){if(new URL(navigator.serviceWorker.controller?.scriptURL||location.href).pathname===new URL(worker,location.origin).pathname){cleanup();resolve();}}
          navigator.serviceWorker.addEventListener("controllerchange",check);timer=setTimeout(()=>{cleanup();reject(Error("Worker activation pending. Reload, then try again."));},10000);check();
        });
      }
      await loadGIS();
      configuredId=id;
      onStatus("Google authorization ready. Click Authorize Google.");
    }
    function authorize(){
      if(!configuredId||!window.google?.accounts?.oauth2)throw Error("Set up direct connection first.");
      if(connecting)return;
      connecting=true;const generation=++epoch;
      const reject=()=>{if(epoch===generation){connecting=false;onStatus("Google authorization cancelled or failed. Try again.");}};
      oauth=google.accounts.oauth2.initTokenClient({client_id:configuredId,scope:SCOPE,include_granted_scopes:false,
        callback:r=>{
          if(epoch!==generation)return;
          connecting=false;
          const scopes=String(r.scope||"").split(/\s+/).filter(Boolean),life=Number(r.expires_in);
          if(r.error||!r.access_token||!scopes.includes(SCOPE)||scopes.some(x=>x!==SCOPE)||!Number.isFinite(life)||life<30){onStatus("Read-only Google Drive authorization was not granted.");return;}
          access=r.access_token;expires=Date.now()+Math.min(life-15,3600)*1000;
          onStatus("Browser-direct authorized. New playback uses Google Drive directly.");
        },error_callback:reject});
      try{oauth.requestAccessToken({prompt:"select_account"});}catch(_){reject();}
    }
    async function open(handle){
      if(!connected())throw Error("Direct authorization expired or missing. Authorize Google, then resume.");
      const id=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,"0")).join("");
      await rpc({type:"bind",id,handle,access,expires});current=id;
      return {url:target.pathname+"direct-media/"+id,token:id,bytes:handle.size,mode:"direct"};
    }
    async function release(id){
      if(current===id)current=null;
      try{await rpc({type:"release",id});}catch(_){}
    }
    async function disconnect(){
      epoch++;connecting=false;access=null;expires=0;current=null;
      try{await rpc({type:"release"});}catch(_){}
      onStatus("Browser-direct disconnected. No Google access token retained.");
    }
    return {setup,authorize,connected,open,release,disconnect};
  }
  return {create};
})();
