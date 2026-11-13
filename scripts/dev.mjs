import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {context} from 'esbuild';
import {demoState} from '../server/data.js';
import {handleApi} from '../server/api.js';
await mkdir('work',{recursive:true});
await import('node:fs/promises').then(fs=>fs.writeFile('src/demo.json',JSON.stringify(demoState())));
const bundler=await context({entryPoints:['src/App.jsx'],bundle:true,outfile:'work/dev/app.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
await bundler.watch();
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Better Education · Local</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
if(path.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const r=await handleApi(new Request('http://localhost'+req.url,{method:req.method,headers:{'content-type':'application/json'},...(['GET','HEAD'].includes(req.method)?{}:{body})}),{});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;}
if(path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
const files={'/assets/app.js':['work/dev/app.js','text/javascript'],'/assets/app.css':['work/dev/app.css','text/css'],'/assets/beka.png':['assets/beka.png','image/png']};
if(!files[path]){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',files[path][1]);res.setHeader('Cache-Control','no-store');res.end(await readFile(files[path][0]));
}catch(e){res.writeHead(500);res.end('Local server error: '+e.message);}});
server.listen(5173,'127.0.0.1',()=>console.log('Better Education: http://localhost:5173\nEdit src/ and refresh the page. No ChatGPT account or API key required.'));
