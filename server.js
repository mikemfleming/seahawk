import {localEditor} from './local/server.js';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.js': 'text/javascript; charset=utf-8' };
export function createApp({ directory = resolve('dist'), editing = false, correctionsFile } = {}) {
  const root = resolve(directory);
  const editor=editing?localEditor({directory,correctionsFile}):null;
  return createServer(async(req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https://tile.openstreetmap.org; style-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    if(editor){
      res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
      if(await editor(req,res,new URL(req.url,"http://localhost").pathname))return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' });res.end('This is a read-only notebook.');return; }
    let path;
    try { path = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400);res.end('Invalid URL.');return; }
    if (path === '/workspace' || path.startsWith('/workspace/')) { res.writeHead(302,{Location:'/'});res.end();return; }
    if (path === '/') path = '/index.html';
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + sep) || !types[extname(file)]) { res.writeHead(404);res.end('Not found.');return; }
    try {
      const stat = statSync(file);
      if (!stat.isFile()) throw Error();
      let body = req.method === 'HEAD' ? null : readFileSync(file);
      if(editor&&path==='/index.html'&&body)body=Buffer.from(body.toString().replace("connect-src 'none'","connect-src 'self'").replace('</head>','<link rel="stylesheet" href="/__local/editor.css"></head>').replace('</body>','<script type="module" src="/__local/editor.js"></script></body>'));
      res.writeHead(200, {'Content-Type':types[extname(file)],'Content-Length':body?.length??stat.size,'Cache-Control':'no-cache'});
      res.end(body);
    } catch { res.writeHead(404);res.end('Not found.'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8127);
  if (!Number.isInteger(port) || port<1 || port>65535) throw Error('PORT must be between 1 and 65535.');
  const app = createApp({editing:process.argv.includes('--edit')});
  app.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use.`:'Could not start the notebook.');process.exitCode=1;});
  app.listen(port,'127.0.0.1',()=>console.log(`Seahawk notebook · http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>app.close(()=>process.exit(0)));
}
