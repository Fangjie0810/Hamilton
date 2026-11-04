import assert from 'node:assert/strict';

export async function freezeCheck(page, selector, attribute) {
  await page.waitForFunction(({ selector, attribute }) => Number.isFinite(parseFloat(document.querySelector(selector)?.getAttribute(attribute))), { selector, attribute });
  await page.keyboard.press('Escape');
  await page.locator('.d3-settings[open]').waitFor();
  const before = await page.locator(selector).getAttribute(attribute);
  if (process.env.HAMILTON_CHECK_LANG_SWITCH === '1') {
    const original = await page.locator('#d3-language').inputValue();
    for (const mode of ['en', 'zh', 'dual-en', 'dual', original]) await page.locator('#d3-language').selectOption(mode);
  }
  await page.waitForTimeout(350);
  assert.equal(await page.locator(selector).getAttribute(attribute), before, `paused ${attribute}`);
  await page.locator('.d3-settings .d3-primary').click();
}

export async function playActivity(page, failure = false, options = {}) {
  const checkPause = options.freezeCheck ?? freezeCheck;
  const overlay = page.locator('.activity-overlay');
  const kind = await overlay.getAttribute('data-activity');
  let paused = false;
  for (let step = 0; step < 120 && await overlay.count(); step++) {
    const phase = await overlay.getAttribute('data-phase');
    if (process.env.HAMILTON_LANGUAGE === 'en') assert.ok(!/\p{Script=Han}/u.test(await overlay.innerText()), `English ${kind}/${phase} has no Chinese residue`);
    if (kind === 'debate') {
      if (phase === 'argument') await overlay.locator('.primary').click();
      else if (phase === 'choose') {
        if (!paused) { await checkPause(page, '.activity-overlay', 'data-elapsed'); paused = true; }
        if (failure && await overlay.getAttribute('data-round') === '0') {
          await page.waitForFunction(() => document.querySelector('.activity-overlay')?.getAttribute('data-phase') === 'feedback');
        } else await page.keyboard.press(failure ? '3' : '1');
      } else if (phase === 'beat') {
        if (!failure) await page.waitForFunction(() => Number(document.querySelector('.activity-overlay')?.getAttribute('data-elapsed')) >= 1130);
        await page.keyboard.press('Space');
      } else if (phase === 'feedback') await overlay.locator('.primary').click();
      else if (phase === 'result') {
        const score = Number((await overlay.locator('.activity-score').textContent()).split('/')[0].trim());
        assert.ok(failure ? score === 0 : score >= 70, `debate score ${score}`);
        await page.screenshot({ path: `artifacts/debate-${failure ? 'miss' : 'win'}.png` });
        await overlay.locator('.primary').click();
      }
    } else if (kind === 'writing') {
      if (phase === 'briefing') await overlay.locator('.primary').click();
      else if (phase === 'sort') {
        if (!paused) { await checkPause(page, '.activity-overlay', 'data-remaining'); paused = true; }
        if (!failure) {
          const fragments = await overlay.locator('[data-fragment]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.fragment, label: node.dataset.fragment.split('-').at(-1).toUpperCase() })));
          for (const [i, fragment] of fragments.entries()) {
            const bin = ['TIME', 'OBJECTIVE'].includes(fragment.label) ? 'PRIORITY' : fragment.label === 'POSITION' ? 'CONTEXT' : 'ACTION';
            if (i === 0) await overlay.locator(`[data-fragment="${fragment.id}"]`).dragTo(overlay.locator(`[data-bin="${bin}"]`));
            else { await overlay.locator(`[data-fragment="${fragment.id}"]`).click(); await page.keyboard.press(String(['PRIORITY', 'ACTION', 'CONTEXT'].indexOf(bin) + 1)); }
          }
          if (await overlay.getAttribute('data-round') === '0') {
            await page.setViewportSize({ width: 1024, height: 640 });
            assert.ok(await overlay.evaluate(node => node.scrollWidth <= window.innerWidth));
            await page.screenshot({ path: 'artifacts/writing-1024.png' });
            await page.setViewportSize({ width: 1440, height: 900 });
          }
        }
        await overlay.locator('.primary').click();
      } else if (phase === 'feedback') await overlay.locator('.primary').click();
      else if (phase === 'result') {
        assert.ok((await overlay.locator('.activity-score').textContent()).startsWith(failure ? '0 /' : '100 /'));
        await overlay.locator('.primary').click();
      }
    } else if (kind === 'yorktown') {
      if (phase === 'briefing') await overlay.locator('.primary').click();
      else if (phase === 'approach') {
        if (!paused) {
          await page.keyboard.press('e'); // leave soldiers waiting, then release all held inputs on pause
          await page.keyboard.down('d'); await page.waitForTimeout(500);
          await checkPause(page, '.activity-overlay', 'data-x'); await page.keyboard.up('d');
          await page.keyboard.press('e'); paused = true;
          await page.screenshot({ path: 'artifacts/yorktown-approach.png' });
        }
        await page.keyboard.down('d');
        try { await page.waitForFunction(() => document.querySelector('.activity-overlay')?.getAttribute('data-phase') === 'command', undefined, { timeout: 20000 }); }
        finally { await page.keyboard.up('d'); }
      } else if (phase === 'command') {
        for (let i = 0; i < 3; i++) await overlay.locator(`button[data-squad="${i}"][data-order="${failure ? ['HOLD', 'ADVANCE', 'FLANK'][i] : ['ADVANCE', 'FLANK', 'HOLD'][i]}"]`).click();
        await page.screenshot({ path: `artifacts/yorktown-command-${failure ? 'miss' : 'win'}.png` });
        await overlay.locator('.deploy-button').click();
      } else if (phase === 'assault-ready') await overlay.locator('.primary').click();
      else if (phase === 'assault') {
        if (!failure) await page.waitForFunction(() => Number(document.querySelector('.activity-overlay')?.getAttribute('data-elapsed')) >= 1130);
        const commandKey = await overlay.getAttribute('data-command-key');
        const key = commandKey === ' ' ? 'Space' : commandKey;
        await page.keyboard.press(failure ? (key === 's' ? 'a' : 's') : key);
      } else if (phase === 'feedback') await page.waitForFunction(() => document.querySelector('.activity-overlay')?.getAttribute('data-phase') !== 'feedback');
      else if (phase === 'result') {
        const score = Number((await overlay.locator('.activity-score').textContent()).split('/')[0]);
        assert.ok(failure ? score <= 20 : score >= 70, `Yorktown score ${score}`);
        await page.screenshot({ path: `artifacts/yorktown-result-${failure ? 'miss' : 'win'}.png` });
        await overlay.locator('.primary').click();
      }
    }
    await page.waitForTimeout(20);
  }
  assert.equal(await overlay.count(), 0, `${kind} completed`);
  console.log(`PASS ${kind}: ${failure ? 'mistakes continue' : 'successful inputs'}, pause and completion`);
}
