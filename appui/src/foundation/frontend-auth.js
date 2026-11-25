/* Static frontend sign-in: first-party owner login, single-use PKCE exchange.
 * Access grant stays in memory. No Google/deployer credential is requested.
 */
window.PylonFrontendAuth=(()=>{
  "use strict";
  const configured=window.PYLON_API_ORIGIN;
  if(!configured)return null;
  const origin=new URL(configured);
  if(origin.origin!==configured||origin.protocol!=="https:")throw Error("Invalid Pylon API origin");
  const profile=window.PYLON_FRONTEND_PROFILE==="home"?"home":"music";
  const BASE=origin.origin+"/_pylon/frontend/",KEY=profile==="home"?"pylon-home-pkce-v1":"pylon-static-pkce-v1";
  let access=null,expires=0;
  const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
  async function connect(){
    const verifier=random(),state=random();
    const challenge=encode(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
    sessionStorage.setItem(KEY,JSON.stringify({verifier,state,created:Date.now()}));
    window.location.assign(BASE+"connect?"+new URLSearchParams(profile==="home"?{challenge,state,profile}:{challenge,state}));
  }
  async function finish(){
    const params=new URLSearchParams(location.hash.slice(1));
    if(!params.has("pylon_code"))return false;
    const code=params.get("pylon_code"),state=params.get("state");
    history.replaceState(history.state,"",location.pathname+location.search);
    let local;
    try{local=JSON.parse(sessionStorage.getItem(KEY)||"null");}finally{sessionStorage.removeItem(KEY);}
    if(!local||local.state!==state||Date.now()-local.created>10*60*1000||!/^[-_A-Za-z0-9]{43}$/.test(code||""))throw Error("Authorization response invalid or expired; reconnect.");
    const response=await fetch(BASE+"exchange",{method:"POST",credentials:"omit",cache:"no-store",redirect:"error",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,state,verifier:local.verifier})});
    const r=await response.json();
    if(!response.ok||!r.ok||!/^[-_A-Za-z0-9]{43}$/.test(r.access_token||"")||!Number.isFinite(r.expires_in)||r.expires_in>900)throw Error("Pylon authorization failed; reconnect.");
    access=r.access_token;expires=Date.now()+(r.expires_in-5)*1000;
    return true;
  }
  const ready=finish().catch(e=>{console.warn("Pylon frontend sign-in failed");return false;});
  const getToken=()=>expires>Date.now()?access:null;
  async function disconnect(){
    const token=getToken();access=null;expires=0;
    if(token)try{await fetch(BASE+"revoke",{method:"POST",credentials:"omit",cache:"no-store",redirect:"error",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}"});}catch(_){}
  }
  return {connect,ready,getToken,disconnect};
})();
