import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const url = process.env.BASE_URL ?? process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage();
const report = { url, generatedAt: new Date().toISOString(), checks: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  report.actors = await page.evaluate(async () => {
    const [{ PixelActor }, { StoryNpc }, { disposeWorld }, cameraOrbit, facing, THREE] = await Promise.all([
      import('/src/demo3d/PixelActor.ts'), import('/src/story3d/StoryNpc.ts'), import('/src/demo3d/SceneWorld.ts'),
      import('/src/demo3d/CameraOrbit.ts'), import('/src/demo3d/Facing.ts'), import('/node_modules/.vite/deps/three.js'),
    ]);
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    // Solid, contrasting sheets make GPU data ownership observable independently
    // of authored palette, pose or facial features. The production actor APIs,
    // materials, frame UVs, source switch and world disposal remain in use.
    const canvas = color => {
      const result = document.createElement('canvas'); result.width = 128; result.height = 128;
      const context = result.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 128, 128);
      return result;
    };
    const results = [];
    for (const kind of ['PixelActor', 'StoryNpc']) {
      const standard = canvas('#ff0000'), high = canvas('#0000ff');
      const baseTexture = new THREE.CanvasTexture(standard), highTexture = new THREE.CanvasTexture(high);
      for (const texture of [baseTexture, highTexture]) {
        texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
        texture.repeat.set(1 / facing.ATLAS_COLUMNS, 1 / facing.ATLAS_ROWS);
      }
      const actors = kind === 'PixelActor'
        ? [new PixelActor(baseTexture, false, highTexture), new PixelActor(baseTexture, true, highTexture)]
        : [new StoryNpc(standard, 'loyalist', high), new StoryNpc(standard, 'citizen', high)];
      const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setSize(480, 240);
      const target = new THREE.WebGLRenderTarget(480, 240); renderer.setRenderTarget(target);
      const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 3));
      actors.forEach(actor => scene.add(actor.root));
      const camera = new THREE.OrthographicCamera(-4, 4, 3, -1, .1, 20); camera.position.z = 10;
      const pixels = new Uint8Array(480 * 240 * 4), phases = [];
      const update = (actor, index, pitch) => {
        const position = { x: index ? 1.5 : -1.5, z: 0 }, direction = { x: 0, z: 1 };
        if (kind === 'PixelActor') actor.update(position, direction, 0, false, 0, true, pitch);
        else actor.update(position, direction, 0, { delta: .1, arguing: false, paused: true, reducedMotion: true }, pitch);
      };
      const render = (name, highViews) => {
        actors.forEach((actor, index) => update(actor, index, highViews[index] ? cameraOrbit.MAX_CAMERA_PITCH : cameraOrbit.MIN_CAMERA_PITCH));
        renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, 480, 240, pixels);
        const samples = actors.map((actor, index) => {
          const point = new THREE.Vector3(0, .65, 0).applyMatrix4(actor.body.matrixWorld).project(camera);
          const x = Math.floor((point.x + 1) * .5 * 480), y = Math.floor((point.y + 1) * .5 * 240);
          const rgba = [...pixels.slice((y * 480 + x) * 4, (y * 480 + x) * 4 + 4)];
          const channel = highViews[index] ? 2 : 0, other = highViews[index] ? 0 : 2;
          check(rgba[channel] > 100 && rgba[other] < 5 && rgba[3] === 255,
            `${kind}/${name}/${index}: expected ${highViews[index] ? 'blue' : 'red'} GPU pixels, received ${rgba}`);
          check(actor.texture.image === (highViews[index] ? high : standard), `${kind}/${name}/${index}: CPU source is correct`);
          const vertices = actor.body.geometry.getAttribute('position');
          const ys = Array.from({ length: vertices.count }, (_, vertex) => vertices.getY(vertex));
          const top = Math.max(...ys), bottom = Math.min(...ys);
          const foot = new THREE.Vector3(0, top - (top - bottom) * 120 / 128, 0).applyMatrix4(actor.body.matrixWorld);
          check(foot.distanceTo(actor.root.position) < 1e-10, `${kind}/${name}/${index}: rotation keeps the boot-line pivot planted`);
          return { rgba, frame: actor.frame, offset: actor.texture.offset.toArray(), highAngle: actor.highAngle };
        });
        const sharedGpu = renderer.properties.get(actors[0].texture).__webglTexture === renderer.properties.get(actors[1].texture).__webglTexture;
        if (kind === 'PixelActor') check(sharedGpu === (highViews[0] === highViews[1]), `${kind}/${name}: GPU sharing matches the active sources`);
        const result = { name, samples, sharedGpu, textures: renderer.info.memory.textures }; phases.push(result); return result;
      };
      const initial = render('initial', [false, false]);
      for (let cycle = 0; cycle < 4; cycle++) {
        render(`${cycle}/first-high`, [true, false]);
        render(`${cycle}/both-high`, [true, true]);
        render(`${cycle}/first-standard`, [false, true]);
        const restored = render(`${cycle}/both-standard`, [false, false]);
        check(restored.textures === initial.textures, `${kind}: repeated source switches do not leak GPU textures`);
        for (let index = 0; index < actors.length; index++)
          check(JSON.stringify(restored.samples[index]) === JSON.stringify(initial.samples[index]), `${kind}: frame, UV and pixels survive round trips`);
      }
      // Chapter changes can dispose the whole old cast while high art is active.
      render('dispose-while-high', [true, true]);
      disposeWorld(scene); target.dispose(); baseTexture.dispose(); highTexture.dispose();
      const finalTextures = renderer.info.memory.textures;
      check(finalTextures === 0, `${kind}: chapter/world disposal releases every GPU texture (${finalTextures} remain)`);
      renderer.dispose(); renderer.forceContextLoss();
      results.push({ kind, phases, finalTextures });
    }
    return results;
  });
  assert.deepEqual(report.errors, [], 'the actual actor APIs cause no browser errors');
  report.checks.push('Actual PixelActor and StoryNpc APIs preserve independently selected standard/high GPU pixels.');
  report.checks.push('Four complete round trips retain frame UVs and planted boot pivots, without GPU texture growth.');
  report.checks.push('Disposing both actual actor types while high-angle art is active releases every GPU texture without errors.');
  report.passed = true;
  console.log(JSON.stringify({ passed: true, checks: report.checks }, null, 2));
} catch (error) {
  report.passed = false; report.failure = error instanceof Error ? error.stack : String(error);
  console.error(report.failure); process.exitCode = 1;
} finally {
  await writeFile('artifacts/high-angle-textures-check.json', JSON.stringify(report, null, 2));
  await browser.close();
}
