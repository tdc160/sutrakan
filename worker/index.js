import {expenseItemInputSchema} from '../security/expense-item-schemas.js';
import {shedCommandSchema} from '../security/shed-schemas.js';
import {propertyDeleteSchema,propertyProvisionSchema,propertyInputSchema,propertyIdSchema} from '../security/property-schemas.js';
import {LEGACY_PROPERTY_ID,assistantContext} from '../property-model.js';
import {registryCall,farmCall,propertyAccess,propertiesFor,identity} from './property-service.js';
import {feedActionSchema} from '../security/feed-schemas.js';
import {userCreateSchema,userUpdateSchema,centralRecordSchema,farmImportSchema} from '../security/schemas.js';
import {loginSchema,emptySchema,recordSchema,csrfSchema,sessionTokenSchema} from '../security/schemas.js';
import {HttpError,json,securityHeaders,validateHeaders,sameOrigin,readJSON,limited,verifyPassword,digest,randomToken,readCookie,sessionCookie} from './security.js';
export {FarmStore} from './farm.js';
export {AdminSessions} from './sessions.js';
const TTL=3600;
const sessionCall=registryCall;
async function currentSession(request,env){const token=readCookie(request);if(!sessionTokenSchema.safeParse(token).success)throw new HttpError(401);const key=await digest(token);const response=await sessionCall(env,'/read',{key});if(response.status===404)throw new HttpError(401);if(!response.ok)throw new HttpError(503);const session=await response.json();if(session.expiresAt<=Date.now()||(session.root||session.revision===undefined)&&session.username!==env.ADMIN_USERNAME)throw new HttpError(401);return {...session,role:session.role||'admin',key}}
function csrfCheck(request,session){const csrf=request.headers.get('X-CSRF-Token');if(!csrfSchema.safeParse(csrf).success||csrf!==session.csrf)throw new HttpError(403)}
export default {async fetch(request,env){const url=new URL(request.url);
 // This navigation stays outside the old service worker fallback (/api/ is denied).
 // It serves the current app shell without deleting records, drafts or caches.
 if(!url.pathname.startsWith('/api/')||url.pathname==='/api/app/update'&&request.method==='GET'){const updating=url.pathname==='/api/app/update';const response=await env.ASSETS.fetch(updating?new Request(new URL('/',url),request):request);const headers=new Headers(response.headers);if(updating)headers.set('Cache-Control','no-store');for(const [key,value] of Object.entries(securityHeaders()))headers.set(key,value);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}
 const requestId=crypto.randomUUID();
 try{
  // Reject unexpected query parameters; browser-supplied IP forwarding headers are never used.
  validateHeaders(request);if([...url.searchParams].length)throw new HttpError(400);
  const known=['/api/auth/login','/api/auth/session','/api/auth/logout','/api/records/validate','/api/users','/api/users/update','/api/farm','/api/farm/records','/api/farm/import','/api/farm/feed','/api/farm/sheds','/api/farm/expense-items','/api/auth/register','/api/properties','/api/properties/update','/api/properties/delete','/api/assistant/context'];if(!known.includes(url.pathname))throw new HttpError(404);
  const method=request.method;if(!(['/api/users','/api/properties'].includes(url.pathname)?['GET','POST']:['/api/auth/session','/api/farm','/api/assistant/context'].includes(url.pathname)?['GET']:['POST']).includes(method))throw new HttpError(405);
  const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
  await limited(env.API_LIMITER,'api:'+ip);
  if(method==='POST'||request.headers.has('Origin'))sameOrigin(request);
  if(url.pathname==='/api/auth/register')throw new HttpError(403);
  if(url.pathname==='/api/auth/login'){
   // Native edge limits are shared across requests; no per-process JS counters or fail-open fallback.
   await limited(env.LOGIN_LIMITER,'login-ip:'+ip);
   const input=await readJSON(request,loginSchema);await limited(env.LOGIN_ACCOUNT_LIMITER,'account:'+await digest(input.username.toLowerCase()));
   const root=input.username===env.ADMIN_USERNAME;
   let account;
   if(root){if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<8||env.ADMIN_PASSWORD.length>128)throw new HttpError(503);if(!await verifyPassword(input.password,env.ADMIN_PASSWORD))throw new HttpError(401);account={username:env.ADMIN_USERNAME,role:'admin',root:true}}
   else{const lookup=await sessionCall(env,'/users/authenticate',input);if(lookup.status===401)throw new HttpError(401);if(!lookup.ok)throw new HttpError(503);const user=await lookup.json();account={username:user.username,role:user.role,revision:user.revision,root:false};}

   const token=randomToken(),csrf=randomToken(),expiresAt=Date.now()+TTL*1000;
   const previous=readCookie(request);if(sessionTokenSchema.safeParse(previous).success){const old=await sessionCall(env,'/delete',{key:await digest(previous)});if(!old.ok)throw new HttpError(503)}
   const result=await sessionCall(env,'/create',{key:await digest(token),session:{...account,csrf,expiresAt}});if(!result.ok)throw new HttpError(503);
   const properties=await propertiesFor(env,account);return json({user:account.username,generalAdministrator:identity(account,env).root,role:properties[0]?.role||'operator',csrf,expiresAt,properties},200,{'Set-Cookie':sessionCookie(token,TTL)});
  }
  const session=await currentSession(request,env);
  if(url.pathname==='/api/auth/session'){const properties=await propertiesFor(env,session);return json({user:session.username,generalAdministrator:identity(session,env).root,role:properties[0]?.role||'operator',csrf:session.csrf,expiresAt:session.expiresAt,properties})}
  if(url.pathname==='/api/auth/logout'){csrfCheck(request,session);await readJSON(request,emptySchema);await sessionCall(env,'/delete',{key:session.key});return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)})}
  if(url.pathname==='/api/properties/delete'){
   if(!identity(session,env).root)throw new HttpError(403);csrfCheck(request,session);
   const data=await readJSON(request,propertyDeleteSchema),result=await registryCall(env,'/properties/delete',{...identity(session,env),data});if(!result.ok)throw new HttpError([400,403,404].includes(result.status)?result.status:503);
   const purge=await farmCall(env,await result.json(),'/delete');if(!purge.ok)throw new HttpError(503);const completed=await registryCall(env,'/properties/delete-complete',{...identity(session,env),data});if(!completed.ok)throw new HttpError(503);
   return json({properties:await propertiesFor(env,session)});
  }
  if(url.pathname==='/api/properties'){
   if(method==='GET')return json({properties:await propertiesFor(env,session)});
   if(!identity(session,env).root)throw new HttpError(403);csrfCheck(request,session);const data=await readJSON(request,propertyProvisionSchema),result=await registryCall(env,'/properties/create',{...identity(session,env),data});if(!result.ok)throw new HttpError([400,409].includes(result.status)?result.status:503);return json({properties:await propertiesFor(env,session)},201);
  }
  // IDs from headers are selectors, never authority. Every domain route resolves a live membership.
  const requestedId=request.headers.get('X-Property-Id')||LEGACY_PROPERTY_ID;if(!propertyIdSchema.safeParse(requestedId).success)throw new HttpError(400);
  const access=await propertyAccess(env,session,requestedId);session.role=access.role;
  if(url.pathname==='/api/farm/expense-items'){if(access.role!=='admin')throw new HttpError(403);csrfCheck(request,session);const item=await readJSON(request,expenseItemInputSchema),result=await farmCall(env,access,'/expense-items',{item,username:session.username});if(!result.ok)throw new HttpError([400,409,413].includes(result.status)?result.status:503);return json(await result.json())}
  if(url.pathname==='/api/farm/sheds'){
   if(access.role!=='admin')throw new HttpError(403);csrfCheck(request,session);const command=await readJSON(request,shedCommandSchema);
   if(command.action==='delete'){
    // Reauthenticate the property's responsible administrator; never trust a client role or password flag.
    await limited(env.LOGIN_LIMITER,'shed-delete-ip:'+ip);await limited(env.LOGIN_ACCOUNT_LIMITER,'shed-delete:'+await digest(access.ownerUsername.toLowerCase()));
    if(access.ownerUsername===env.ADMIN_USERNAME){if(!env.ADMIN_PASSWORD||!await verifyPassword(command.password,env.ADMIN_PASSWORD))throw new HttpError(403)}
    else{const verified=await sessionCall(env,'/users/authenticate',{username:access.ownerUsername,password:command.password});if(!verified.ok)throw new HttpError(verified.status===401?403:503)}
   }
   const result=await farmCall(env,access,'/sheds',{command,username:session.username});if(!result.ok)throw new HttpError([400,409,413].includes(result.status)?result.status:503);return json(await result.json());
  }
  if(url.pathname==='/api/properties/update'){if(access.role!=='admin')throw new HttpError(403);csrfCheck(request,session);const profile=await readJSON(request,propertyInputSchema),result=await farmCall(env,access,'/property-update',{profile});if(!result.ok)throw new HttpError([400,409].includes(result.status)?result.status:503);return json({property: (await result.json()).property,properties:await propertiesFor(env,session)})}
  if(url.pathname==='/api/assistant/context'){const result=await farmCall(env,access,'/read');if(!result.ok)throw new HttpError(503);return json(assistantContext(await result.json()))}

  if(url.pathname.startsWith('/api/farm')){
   if(!env.FARM_STORE?.idFromName)throw new HttpError(503);
   let path='/read',payload={};
   if(method==='POST'){
    csrfCheck(request,session);
    if(url.pathname==='/api/farm/feed'){
     const command=await readJSON(request,feedActionSchema,512*1024);
     // Operators can produce and reconcile due consumption; only admins configure opening stock/plans/adjustments.
     if(!['produce','settle'].includes(command.action)&&session.role!=='admin')throw new HttpError(403);
     path='/feed';payload={command,username:session.username};
    }else if(url.pathname==='/api/farm/import'){if(session.role!=='admin')throw new HttpError(403);path='/import';payload=await readJSON(request,farmImportSchema,10*1024*1024)}
    else{path='/record';payload={record:await readJSON(request,centralRecordSchema),username:session.username}}
   }
   const result=await farmCall(env,access,path,payload);
   if(!result.ok)throw new HttpError([400,409,413].includes(result.status)?result.status:503);
   return json(await result.json());
  }
  if(url.pathname.startsWith('/api/users')){
   // Authorization is enforced on the server; hiding controls is not a security boundary.
   if(session.role!=='admin')throw new HttpError(403);
   if(method==='GET'){const result=await sessionCall(env,'/users/list',{...identity(session,env),propertyId:requestedId});if(!result.ok)throw new HttpError(503);const listed=await result.json();return json({users:[{username:access.ownerUsername,name:access.property.owner,role:'admin',active:true,root:true,bootstrap:access.ownerUsername===env.ADMIN_USERNAME},...listed.filter(u=>u.username!==access.ownerUsername)]})}
   csrfCheck(request,session);
   const create=url.pathname==='/api/users',input=await readJSON(request,create?userCreateSchema:userUpdateSchema);
   // The owner account cannot be disabled, demoted or shadowed; recovery remains via runtime secret.
   if(input.username.toLowerCase()===env.ADMIN_USERNAME.toLowerCase())throw new HttpError(409);
   if(!create&&input.username.toLowerCase()===session.username.toLowerCase())throw new HttpError(409);
   if(!create&&Object.keys(input).length<2)throw new HttpError(400);
   const result=await sessionCall(env,create?'/users/create':'/users/update',{...identity(session,env),actor:session.username,username:input.username,propertyId:requestedId,...(create?{user:input}:{patch:input})});
   if(!result.ok)throw new HttpError([400,404,409].includes(result.status)?result.status:503);
   return json({ok:true},create?201:200);
  }
  csrfCheck(request,session);
  if(url.pathname==='/api/auth/logout'){await readJSON(request,emptySchema);const result=await sessionCall(env,'/delete',{key:session.key});if(!result.ok)throw new HttpError(503);return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)})}
  // Data validation only: this endpoint does not claim to persist or synchronize local records.
  const record=await readJSON(request,recordSchema);return json({ok:true,propertyId:requestedId,record});
 }catch(error){
  const status=error instanceof HttpError?error.status:500;
  // Do not log credentials, session cookies, CSRF values, body, query values or raw headers.
  // Unexpected errors keep their stack in internal Worker logs only, never in the response.
  if(!(error instanceof HttpError))console.error(JSON.stringify({event:'request_failed',requestId,route:url.pathname,errorType:error?.name,stack:error?.stack}));
  else if([401,403,429].includes(status))console.warn(JSON.stringify({event:status===429?'rate_limited':status===401?'auth_denied':'request_denied',requestId,route:url.pathname,status}));
  else if(status>=500)console.error(JSON.stringify({event:'service_unavailable',requestId,route:url.pathname,status}));
  const message=status===401?'Credenciais inválidas ou acesso não autorizado.':status>=500?'Serviço temporariamente indisponível.':'Não foi possível processar a solicitação.';
  return json({error:message,requestId},status,{...(status===429?{'Retry-After':'60'}:{}),...(status===405?{'Allow':url.pathname==='/api/users'?'GET, POST':['/api/auth/session','/api/farm','/api/assistant/context'].includes(url.pathname)?'GET':'POST'}:{})});
 }
},async scheduled(controller,env,ctx){
 // Cloudflare Cron runs independently of open browsers. All debits are serialized/idempotent in FarmStore.
 const task=(async()=>{if(!env.FARM_STORE?.idFromName)throw Error('Missing farm binding');const response=await env.FARM_STORE.get(env.FARM_STORE.idFromName('santo-expedito')).fetch(new Request('https://internal/feed-settle',{method:'POST',body:'{}'}));if(!response.ok&&![409,410].includes(response.status))throw Error('Daily feed settlement failed')})();ctx.waitUntil(task);
}};
