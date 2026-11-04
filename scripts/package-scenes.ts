import { build } from 'vite';
import { readFile, writeFile, mkdir, rm, readdir, stat, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { SCENE_IMAGE_PATHS, sceneGuide } from '../src/sceneExperience/portable/distribution';

const repo = fileURLToPath(new URL('..', import.meta.url));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const output = resolve(repo, 'artifacts/scene-offline', stamp);
const temporary = join(output, '.bundle'), folder = join(output, 'Hamilton-Scene-Review');
await mkdir(folder, { recursive: true });
await build({ configFile: false, root: repo, publicDir: false, base: './', build: {
  outDir: temporary, emptyOutDir: true, copyPublicDir: false, minify: true,
  lib: { entry: join(repo, 'src/sceneExperience/portable/main.ts'), name: 'HamiltonScenes', formats: ['iife'], fileName: () => 'scenes.js', cssFileName: 'scenes' },
  rollupOptions: { output: { inlineDynamicImports: true } },
}});
const files = await readdir(temporary);
if (files.filter(name => name.endsWith('.js')).length !== 1 || !files.includes('scenes.css')) throw new Error('Expected one JS bundle and CSS');
const js = await readFile(join(temporary, 'scenes.js'), 'utf8'), css = await readFile(join(temporary, 'scenes.css'), 'utf8');
if (/\bimport\s*\(/.test(js) || /\bimport\.meta\b/.test(js) || /@import\b/.test(css) || /url\(\s*["']?(?!data:)[^)]/i.test(css)) throw new Error('Portable build contains an external dependency');
const images: Record<string, string> = {}, sourceImages: { path: string; bytes: number; sha256: string }[] = [];
for (const path of SCENE_IMAGE_PATHS) {
  const data = await readFile(join(repo, 'public', path));
  if (data.subarray(1, 4).toString() !== 'PNG') throw new Error('Invalid PNG: ' + path);
  images[path] = `data:image/png;base64,${data.toString('base64')}`;
  sourceImages.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="theme-color" content="#171d1c"><title>Hamilton · Scene Review</title><link rel="icon" href="data:,">
<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="app"></div>
<script id="hamilton-bundled-images" type="application/json">${JSON.stringify(images)}</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>\n`;
const htmlPath = join(folder, 'Hamilton-Scenes.html');
await writeFile(htmlPath, html);
await writeFile(join(folder, '使用说明-README.txt'), '\ufeff' + sceneGuide.map(text => text.zh).join('\n\n') + '\n\n' + '='.repeat(48) + '\n\n' + sceneGuide.map(text => text.en).join('\n\n') + '\n');
await copyFile(join(repo, 'node_modules/three/LICENSE'), join(folder, 'LICENSE-THREE.txt'));
const zip = join(output, 'Hamilton-Scenes-Offline.zip');
execFileSync('python3', ['-c', `import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for path in sorted(root.rglob('*')):
  if path.is_file(): z.write(path,path.relative_to(root.parent))
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 for path in root.rglob('*'):
  if path.is_file(): assert z.read(str(path.relative_to(root.parent))) == path.read_bytes()
`, folder, zip], { stdio: 'inherit' });
const packageInfo = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'));
const manifest = {
  version: packageInfo.version, builtAt: stamp, zip, html: htmlPath,
  bytes: (await stat(zip)).size, sha256: createHash('sha256').update(await readFile(zip)).digest('hex'),
  htmlBytes: Buffer.byteLength(html), htmlSha256: createHash('sha256').update(html).digest('hex'), sourceImages,
};
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(output, 'SHA256.txt'), manifest.sha256 + '  Hamilton-Scenes-Offline.zip\n');
await rm(temporary, { recursive: true });
console.log(JSON.stringify(manifest, null, 2));
