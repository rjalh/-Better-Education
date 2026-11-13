import {handleApi} from './api.js';
import {assets} from '../work/assets.js';
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(request.method)){
     const origin=request.headers.get('origin');
     if(origin&&origin!==url.origin)return Response.json({error:'Запрос с другого сайта отклонён.'},{status:403});
   }
   return handleApi(request,env);
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=assets[url.pathname]||(url.pathname==='/'?assets['/']:null);
 if(!asset)return new Response('Страница не найдена',{status:404});
 const data=asset.base64?Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)):asset.text;
 return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':asset.type,'cache-control':url.pathname.endsWith('.png')?'public, max-age=3600':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});
}};
