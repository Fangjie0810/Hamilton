import {build} from 'vite';
import {readFile, writeFile, mkdir, rm, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {portableGuide} from '../experiments/rhythm-editor/distribution';

const repo = fileURLToPath(new URL('..', import.meta.url));
const editor = resolve(repo, 'experiments/rhythm-editor');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const output = resolve(repo, 'artifacts/rhythm-editor', stamp);
const temporary = join(output, '.bundle');
const folder = join(output, 'Hamilton-Chart-Editor');
await mkdir(folder, {recursive: true});
await build({configFile: false, root: editor, publicDir: false, base: './', build: {
  outDir: temporary, emptyOutDir: true, copyPublicDir: false, minify: true,
  lib: {entry: join(editor, 'main.ts'), name: 'HamiltonChartEditor', formats: ['iife'], fileName: () => 'editor.js', cssFileName: 'editor'},
}});
const files = await readdir(temporary);
if (files.filter(name => name.endsWith('.js')).length !== 1 || !files.includes('editor.css')) throw new Error('Expected a single JS bundle plus inline CSS');
const js = await readFile(join(temporary, 'editor.js'), 'utf8');
const css = await readFile(join(temporary, 'editor.css'), 'utf8');
if (/\bimport\s*\(/.test(js) || /\bimport\.meta\b/.test(js) || /@import\b/.test(css) || /url\(\s*["']?(?!data:)[^)]/i.test(css)) throw new Error('Portable build contains an external dependency');
const assets = JSON.parse(await readFile(join(editor, 'assets.json'), 'utf8'));
const recordings: Record<string, string> = {};
for (const [id, asset] of Object.entries(assets) as [string, {asset: string; sha256: string; byteLength: number; mimeType: string}][]) {
  const data = await readFile(join(editor, 'public', asset.asset));
  if (data.length !== asset.byteLength || createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error('Audio identity mismatch: ' + id);
  recordings[id] = `data:${asset.mimeType};base64,${data.toString('base64')}`;
}
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'">
<meta name="theme-color" content="#171c1e"><title>Hamilton · Chart Editor</title><link rel="icon" href="data:,">
<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="app"></div>
<script id="hamilton-bundled-audio" type="application/json">${JSON.stringify(recordings)}</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>\n`;
await writeFile(join(folder, 'Hamilton-Editor.html'), html);
await writeFile(join(folder, '使用说明-README.txt'), '\ufeff' + portableGuide.map(text => text.zh).join('\n\n') + '\n\n' + '='.repeat(48) + '\n\n' + portableGuide.map(text => text.en).join('\n\n') + '\n');
const zip = join(output, 'Hamilton-Chart-Editor-Offline.zip');
execFileSync('python3', ['-c', `import pathlib,zipfile,sys,hashlib
root=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for path in sorted(root.rglob('*')):
  if path.is_file(): z.write(path,path.relative_to(root.parent))
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 for path in root.rglob('*'):
  if path.is_file(): assert z.read(str(path.relative_to(root.parent))) == path.read_bytes()
`, folder, zip], {stdio: 'inherit'});
const digest = createHash('sha256').update(await readFile(zip)).digest('hex');
await writeFile(join(output, 'SHA256.txt'), digest + '  Hamilton-Chart-Editor-Offline.zip\n');
await rm(temporary, {recursive: true});
console.log(JSON.stringify({zip, html: join(folder, 'Hamilton-Editor.html'), bytes: (await stat(zip)).size, sha256: digest, tracks: Object.keys(recordings)}, null, 2));
