import { build } from 'esbuild';
import { renderEntryContext } from './render-context.js';
import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
if (!existsSync('web/index.html')) throw Error('Prepare the gallery before building. See README.md.');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
cpSync('web', 'dist', { recursive: true });
const browserOptions = {
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
};
await build({ ...browserOptions, entryPoints: ['frontend/reader.jsx'], outfile: 'dist/gallery.js' });
await build({ ...browserOptions, entryPoints: ['local/editor.jsx'], outfile: 'node_modules/.cache/seahawk/editor.js' });
if (existsSync('content/entry-context.json')) {
  const context = JSON.parse(readFileSync('content/entry-context.json', 'utf8'));
  if(existsSync('content/weekly-context.json'))context.weekly=JSON.parse(readFileSync('content/weekly-context.json','utf8'));
  writeFileSync('dist/index.html', renderEntryContext(readFileSync('web/index.html', 'utf8'), context, existsSync('content/corrections.json')?JSON.parse(readFileSync('content/corrections.json','utf8')):{},undefined,existsSync('content/artifacts.json')?JSON.parse(readFileSync('content/artifacts.json','utf8')):{items:[]}));
}
console.log('Built the static notebook in dist/. Optional local reading aids; no account service or database required.');
