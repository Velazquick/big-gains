import {test as base} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// WebKit's driver-level setOffline causes an internal navigation error rather
// than exercising worker fallback here. Use the protected PWA corpus's real
// server-transport outage model on WebKit. Chromium retains setOffline coverage.
export const test=base.extend({
 appTransport:async({browserName},use)=>{
  if(browserName!=='webkit'){await use(null);return;}
  const root=fileURLToPath(new URL('../../',import.meta.url));let down=false;
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.wav':'audio/wav'};
  const server=createServer(async(req,res)=>{
   if(down){req.socket.destroy();return;}
   const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
   const path=resolve(root,name);
   if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}
   try{const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await use({origin:`http://127.0.0.1:${server.address().port}`,setUnavailable:value=>{down=value;}});}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 },
 baseURL:async({appTransport},use)=>{await use(appTransport?.origin||'http://127.0.0.1:4173');},
 setAppNetworkUnavailable:async({context,appTransport},use)=>{await use(async value=>{if(appTransport)appTransport.setUnavailable(value);else await context.setOffline(value);});}
});
