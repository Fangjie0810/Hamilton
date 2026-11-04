import './portable.css';
import { configureBundledImages } from '../../demo3d/imageAssets';
import { startExperience } from '../Experience';
import { bi, setText } from '../../i18n/text';

async function start() {
  const source = document.getElementById('hamilton-bundled-images');
  if (!source?.textContent) throw new Error('Bundled scene art is missing');
  configureBundledImages(JSON.parse(source.textContent));
  await startExperience();
}

void start().catch(error => {
  console.error('Scene review could not start', error);
  const app = document.querySelector<HTMLElement>('#app')!;
  const panel = document.createElement('section'); panel.className = 'portable-error';
  const title = document.createElement('h1'), message = document.createElement('p'), retry = document.createElement('button');
  setText(title, bi('场景暂时未能打开', 'The scenes could not open'));
  setText(message, bi('请先解压文件，用电脑浏览器打开 HTML。若仍无法打开，请确认浏览器支持 WebGL 2。', 'Extract the files and open the HTML in a desktop browser. If it still does not open, check that the browser supports WebGL 2.'));
  setText(retry, bi('重新打开', 'Try again')); retry.onclick = () => location.reload();
  panel.append(title, message, retry); app.replaceChildren(panel);
});
