import {loginSchema,emptySchema,recordSchema,csrfSchema,sessionTokenSchema} from '../security/schemas.js';
import {HttpError,json,securityHeaders,validateHeaders,sameOrigin,readJSON,limited,verifyPassword,digest,randomToken,readCookie,sessionCookie} from './security.js';
export {AdminSessions} from './sessions.js';
const TTL=3600;
async function sessionCall(env,path,data){if(!env.ADMIN_SESSIONS?.idFromName)throw new HttpError(503);const stub=env.ADMIN_SESSIONS.get(env.ADMIN_SESSIONS.idFromName('admin-sessions'));return stub.fetch(new Request('https://internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}))}
async function currentSession(request,env){const token=readCookie(request);if(!sessionTokenSchema.safeParse(token).success)throw new HttpError(401);const key=await digest(token);const response=await sessionCall(env,'/read',{key});if(response.status===404)throw new HttpError(401);if(!response.ok)throw new HttpError(503);const session=await response.json();if(session.expiresAt<=Date.now()||session.username!==env.ADMIN_USERNAME)throw new HttpError(401);return {...session,key}}
function csrfCheck(request,session){const csrf=request.headers.get('X-CSRF-Token');if(!csrfSchema.safeParse(csrf).success||csrf!==session.csrf)throw new HttpError(403)}
export default {async fetch(request,env){const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/')){const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);for(const [key,value] of Object.entries(securityHeaders()))headers.set(key,value);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}
 const requestId=crypto.randomUUID();
 try{
  // Reject unexpected query parameters; browser-supplied IP forwarding headers are never used.
  validateHeaders(request);if([...url.searchParams].length)throw new HttpError(400);
  const known=['/api/auth/login','/api/auth/session','/api/auth/logout','/api/records/validate'];if(!known.includes(url.pathname))throw new HttpError(404);
  const method=url.pathname==='/api/auth/session'?'GET':'POST';if(request.method!==method)throw new HttpError(405);
  const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
  await limited(env.API_LIMITER,'api:'+ip);
  if(method==='POST'||request.headers.has('Origin'))sameOrigin(request);
  if(url.pathname==='/api/auth/login'){
   // Native edge limits are shared across requests; no per-process JS counters or fail-open fallback.
   await limited(env.LOGIN_LIMITER,'login-ip:'+ip);await limited(env.LOGIN_ACCOUNT_LIMITER,'admin-account');
   const input=await readJSON(request,loginSchema);
   if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<8||env.ADMIN_PASSWORD.length>128)throw new HttpError(503);
   const passwordOK=await verifyPassword(input.password,env.ADMIN_PASSWORD);
   if(!passwordOK||input.username!==env.ADMIN_USERNAME)throw new HttpError(401);
   const token=randomToken(),csrf=randomToken(),expiresAt=Date.now()+TTL*1000;
   const previous=readCookie(request);if(sessionTokenSchema.safeParse(previous).success){const old=await sessionCall(env,'/delete',{key:await digest(previous)});if(!old.ok)throw new HttpError(503)}
   const result=await sessionCall(env,'/create',{key:await digest(token),session:{username:env.ADMIN_USERNAME,csrf,expiresAt}});if(!result.ok)throw new HttpError(503);
   return json({user:env.ADMIN_USERNAME,csrf,expiresAt},200,{'Set-Cookie':sessionCookie(token,TTL)});
  }
  const session=await currentSession(request,env);
  if(url.pathname==='/api/auth/session')return json({user:session.username,csrf:session.csrf,expiresAt:session.expiresAt});
  csrfCheck(request,session);
  if(url.pathname==='/api/auth/logout'){await readJSON(request,emptySchema);const result=await sessionCall(env,'/delete',{key:session.key});if(!result.ok)throw new HttpError(503);return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)})}
  // Data validation only: this endpoint does not claim to persist or synchronize local records.
  const record=await readJSON(request,recordSchema);return json({ok:true,record});
 }catch(error){
  const status=error instanceof HttpError?error.status:500;
  // Do not log credentials, session cookies, CSRF values, body, query values or raw headers.
  // Unexpected errors keep their stack in internal Worker logs only, never in the response.
  if(!(error instanceof HttpError))console.error(JSON.stringify({event:'request_failed',requestId,route:url.pathname,errorType:error?.name,stack:error?.stack}));
  else if([401,403,429].includes(status))console.warn(JSON.stringify({event:status===429?'rate_limited':status===401?'auth_denied':'request_denied',requestId,route:url.pathname,status}));
  else if(status>=500)console.error(JSON.stringify({event:'service_unavailable',requestId,route:url.pathname,status}));
  const message=status===401?'Credenciais inválidas ou acesso não autorizado.':status>=500?'Serviço temporariamente indisponível.':'Não foi possível processar a solicitação.';
  return json({error:message,requestId},status,{...(status===429?{'Retry-After':'60'}:{}),...(status===405?{'Allow':url.pathname==='/api/auth/session'?'GET':'POST'}:{})});
 }
}};
