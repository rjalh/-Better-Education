// Vercel-функция: все запросы /api/* обрабатывает тот же код, что и локальный сервер.
// Демо-режим: без входа и без базы данных (env пустой).
import {handleApi} from '../server/api.js';

export default async function handler(req,res){
  try{
    const method=req.method||'GET';
    let body;
    if(!['GET','HEAD'].includes(method)){
      if(typeof req.body==='string')body=req.body;
      else if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))body=JSON.stringify(req.body);
      else if(Buffer.isBuffer(req.body))body=req.body;
    }
    const request=new Request('https://'+(req.headers.host||'localhost')+req.url,{
      method,headers:{'content-type':'application/json'},...(body!==undefined?{body}:{})
    });
    const r=await handleApi(request,{});
    res.statusCode=r.status;
    r.headers.forEach((v,k)=>res.setHeader(k,v));
    res.end(Buffer.from(await r.arrayBuffer()));
  }catch(e){
    res.statusCode=500;
    res.setHeader('content-type','application/json; charset=utf-8');
    res.end(JSON.stringify({error:'Ошибка сервера: '+e.message}));
  }
}
