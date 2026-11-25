/* Shared browser VFS data plane. Install only from an application-scoped worker.
 * Browser-owned, read-only Google access tokens; never send them to Pylon.
 * No CacheStorage, persistent tokens, redirects or automatic proxy fallback.
 */
"use strict";
const scope = new URL(self.registration.scope);
const prefix = scope.pathname + "direct-media/";
const sessions = new Map();
const MAX = 2*1024*1024, FIRST = 256*1024, LIMIT=4;
let active=0;
const headers = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","Accept-Ranges":"bytes"};
const fail = (status=503,extra={})=>new Response(null,{status,headers:{...headers,...extra}});
const validMime = s=>typeof s==="string" && /^(audio\/(mpeg|flac|wav|mp4|aac|ogg|aiff|webm)|video\/(mp4|webm)|image\/(jpeg|png|gif|webp|avif)|application\/octet-stream)$/.test(s);
const validHandle=h=>h && /^[A-Za-z0-9_-]{1,200}$/.test(h.file_id) && Number.isSafeInteger(h.size)&&h.size>0&&h.size<=1024*1024*1024*1024 && typeof h.version==="string"&&/^\d{1,40}$/.test(h.version)&&/^[a-f0-9]{32}$/.test(h.md5)&&validMime(h.mime);
function clear(client){const s=sessions.get(client);if(s){s.controller.abort();sessions.delete(client);}}
function prune(){for(const [id,s] of sessions){if(s.expires<=Date.now())clear(id);}}
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{
  const p=event.ports[0],client=event.source;
  if(!p||!client||client.type!=="window")return;
  const u=new URL(client.url);
  if(u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname)){p.postMessage({ok:false});return;}
  const m=event.data||{};
  prune();
  if(m.type==="release"){const old=sessions.get(client.id);if(!m.id||old?.id===m.id)clear(client.id);p.postMessage({ok:true});return;}
  if(m.type!=="bind"||!validHandle(m.handle)||!(/^[a-f0-9]{48}$/.test(m.id||""))||typeof m.access!=="string"||!m.access||m.access.length>8192||/[\s\x00-\x1f]/.test(m.access)||!Number.isFinite(m.expires)||m.expires<=Date.now()||m.expires>Date.now()+3600000){p.postMessage({ok:false});return;}
  if(sessions.size>=32&&!sessions.has(client.id)){p.postMessage({ok:false});return;}
  clear(client.id);
  sessions.set(client.id,{id:m.id,handle:{...m.handle},access:m.access,expires:m.expires,controller:new AbortController()});
  p.postMessage({ok:true});
});
function range(value,size){
  if(!value)return [0,size-1,200];
  const m=/^bytes=(\d{0,15})-(\d{0,15})$/.exec(value);
  if(!m||(!m[1]&&!m[2]))throw Error("range");
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
  const end=m[1]&&m[2]?Math.min(size-1,Number(m[2])):size-1;
  if(start<0||start>end||end>=size)throw Error("range");
  return [start,end,206];
}
async function get(s,params,extra={},signal){
  if(Date.now()>=s.expires||s.controller.signal.aborted)throw Error("authorization expired");
  const u=new URL("https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(s.handle.file_id));
  u.search=new URLSearchParams({...params,supportsAllDrives:"true"});
  return fetch(u,{method:"GET",mode:"cors",credentials:"omit",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",headers:{Authorization:"Bearer "+s.access,...extra},signal});
}
async function check(s,signal){
  const r=await get(s,{fields:"id,size,version,md5Checksum,trashed,capabilities(canDownload)"},{},signal);
  if(!r.ok)throw Error("permission");
  const m=await r.json(),h=s.handle;
  if(m.trashed||m.capabilities?.canDownload!==true||m.id!==h.file_id||String(m.size)!==String(h.size)||String(m.version)!==h.version||m.md5Checksum!==h.md5)throw Error("version changed");
}
async function read(s,a,b,signal){
  await check(s,signal);
  const r=await get(s,{alt:"media"},{Range:"bytes="+a+"-"+b},signal),n=b-a+1;
  // Google Drive's live CORS response exposes Content-Length, but not
  // Content-Range. Trust the authenticated fixed Google endpoint's single-range
  // HTTP 206 semantics, verify the header whenever visible and always check
  // exact byte count plus the version before/after. No claim of independent
  // offset verification when the provider hides Content-Range.
  const reported=r.headers.get("Content-Range"),length=r.headers.get("Content-Length");
  if(r.status!==206||(reported!==null&&reported!=="bytes "+a+"-"+b+"/"+s.handle.size)||(length!==null&&Number(length)!==n)||!r.body){await r.body?.cancel();throw Error("range or CORS");}
  const reader=r.body.getReader(),out=new Uint8Array(n);let pos=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;if(pos+value.length>n)throw Error("range length");out.set(value,pos);pos+=value.length;}if(pos!==n)throw Error("short range");}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  await check(s,signal);
  return out;
}
async function serve(event,id){
  prune();
  const s=sessions.get(event.clientId);
  if(!s||s.id!==id)return fail(401);
  const req=event.request;
  if(!["GET","HEAD"].includes(req.method))return fail(405);
  let a,b,status;
  try{[a,b,status]=range(req.headers.get("Range"),s.handle.size);}catch(_){return fail(416,{"Content-Range":"bytes */"+s.handle.size});}
  const h={...headers,"Content-Type":s.handle.mime,"Content-Length":String(b-a+1)};
  if(status===206)h["Content-Range"]="bytes "+a+"-"+b+"/"+s.handle.size;
  if(req.method==="HEAD")return new Response(null,{status,headers:h});
  if(active>=LIMIT)return fail(503);
  active++;
  const local=new AbortController();
  const cancel=()=>local.abort();
  s.controller.signal.addEventListener("abort",cancel,{once:true});
  req.signal.addEventListener("abort",cancel,{once:true});
  if(req.signal.aborted||s.controller.signal.aborted)cancel();
  let done=false;
  const finish=()=>{if(done)return;done=true;active--;local.abort();s.controller.signal.removeEventListener("abort",cancel);req.signal.removeEventListener("abort",cancel);};
  let first,last=Math.min(b,a+FIRST-1);
  try{first=await read(s,a,last,local.signal);}catch(_){finish();return fail(502);}
  let pos=last+1;
  const stream=new ReadableStream({
    start(c){c.enqueue(first);first=null;if(pos>b){c.close();finish();}},
    async pull(c){if(done)return;try{const end=Math.min(b,pos+MAX-1),data=await read(s,pos,end,local.signal);if(done)return;c.enqueue(data);pos=end+1;if(pos>b){c.close();finish();}}catch(_){if(!done){c.error(new Error("Direct Drive stream interrupted"));finish();}}},
    cancel(){finish();}
  });
  return new Response(stream,{status,headers:h});
}
self.addEventListener("fetch",event=>{
  const u=new URL(event.request.url);
  if(u.origin!==scope.origin||!u.pathname.startsWith(prefix))return;
  const id=u.pathname.slice(prefix.length);
  event.respondWith(/^[a-f0-9]{48}$/.test(id)&&!u.search?serve(event,id):Promise.resolve(fail(404)));
});
