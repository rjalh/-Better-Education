// Сборка демо-версии для Vercel: статический сайт в папку public/
import {build} from 'esbuild';
import {writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {demoState} from '../server/data.js';

await writeFile('src/demo.json',JSON.stringify(demoState()));
await rm('public',{recursive:true,force:true});
await mkdir('public/assets',{recursive:true});
await build({
  entryPoints:['src/App.jsx'],bundle:true,minify:true,format:'iife',
  outfile:'public/assets/app.js',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'
});
await cp('assets/beka.png','public/assets/beka.png');
await writeFile('public/assets/favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#2476df"/><text x="9" y="32" font-family="Arial,sans-serif" font-size="27" font-weight="bold" fill="white" letter-spacing="-3">be</text></svg>');
await writeFile('public/index.html','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#2476df"><title>Better Education — твой путь к большему</title><meta name="description" content="Учись, проверяй знания, отмечай успехи. Better Education с помощником Beka."><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script src="/assets/app.js" defer></script></body></html>');
console.log('Готово: демо-версия для Vercel собрана в папке public/');
