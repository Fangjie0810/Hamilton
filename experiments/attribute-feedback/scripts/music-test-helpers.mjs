import assert from 'node:assert/strict';

export const songs = { Opening: 'alexander-hamilton', Arrival: 'aaron-burr-sir', Tavern: 'my-shot', Debate: 'farmer-refuted', Washington: 'history-has-its-eyes-on-you', Yorktown: 'yorktown' };
export async function instrumentMusic(page) {
  await page.addInitScript(() => {
    window.__musicMedia = [];
    window.__musicStarts = [];
    window.__musicStops = [];
    window.__musicVolumeWrites = [];
    window.__musicCurtains = [];
    const volume = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      ...volume,
      set(value) {
        volume.set.call(this, value);
        if (this.src.includes('/audio/bgm/') && !this.paused) window.__musicVolumeWrites.push({ src: this.src, volume: this.volume, time: this.currentTime });
      },
    });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/audio/bgm/')) {
        if (!window.__musicMedia.includes(this)) window.__musicMedia.push(this);
        window.__musicStarts.push({ src: this.src, time: this.currentTime, curtain: !!document.querySelector('.d3-chapter-loading'), film: !!document.querySelector('.opening-film') });
      }
      return play.call(this);
    };
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () {
      if (this.src.includes('/audio/bgm/') && !this.paused) window.__musicStops.push({ src: this.src, volume: this.volume, muted: this.muted, time: this.currentTime });
      return pause.call(this);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches('.d3-chapter-loading')) window.__musicCurtains.push({ chapter: this.dataset.chapter, playing: window.__musicMedia.some(media => !media.paused) });
      return animate.call(this, frames, options);
    };
  });
}
export async function musicState(page) {
  return page.evaluate(() => window.__musicMedia.map(media => ({ src: media.src, time: media.currentTime, duration: media.duration, paused: media.paused, volume: media.volume, loop: media.loop, muted: media.muted, ready: media.readyState })));
}
export async function expectMusicPaused(page) {
  await page.waitForFunction(() => window.__musicMedia.every(media => media.paused));
}
export async function expectSong(page, song) {
  await page.waitForFunction(song => window.__musicMedia.some(media => media.src.endsWith(`/audio/bgm/${song}.mp3`) && !media.paused && media.readyState >= 2), song);
  const tracks = await musicState(page);
  assert.equal(tracks.length, 1, 'one reusable BGM element throughout the run');
  assert.equal(tracks[0].loop, true);
}
export async function checkMusicTiming(page) {
  const timing = await page.evaluate(() => ({ starts: window.__musicStarts, stops: window.__musicStops, curtains: window.__musicCurtains }));
  assert.ok(timing.starts.every(start => !start.curtain || start.src.endsWith('/alexander-hamilton.mp3')), 'chapter music never starts before the curtain is removed');
  assert.ok(timing.stops.every(stop => stop.muted || stop.volume <= .001), 'outgoing music reaches silence before it is paused');
  return timing;
}
