import type { Chapter, ChapterId } from '../data/types';
import type { ArtVariant } from '../data/art';
import { availableBackgrounds } from '../data/artInventory';
import { cat, setText, type Text } from '../i18n/text';

/** Reuse approved art for this chapter only; never request a nonexistent asset. */
export function chapterBackdropSource(chapter: ChapterId, variant: ArtVariant = 'a'): string | undefined {
  const scene = chapter.toLowerCase();
  const match = [variant, 'a', 'b', 'c'].find(candidate => availableBackgrounds.has(`${scene}-${candidate}`));
  return match ? `/art/backgrounds/${scene}-${match}.png` : undefined;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}

/** The caller owns all timing. An image load or language change never restarts a curtain. */
export function renderChapterTransition(root: HTMLElement, chapter: Chapter, variant: ArtVariant) {
  root.classList.add('d3-chapter-loading');
  root.dataset.chapter = chapter.id;
  root.replaceChildren();
  const source = chapterBackdropSource(chapter.id, variant);
  if (source) {
    const image = el('img', 'd3-chapter-art'); image.alt = ''; image.draggable = false;
    image.addEventListener('load', () => image.classList.add('is-ready'), { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = source; root.append(image);
    if (image.complete && image.naturalWidth > 0) image.classList.add('is-ready');
  }
  const shade = el('div', 'd3-chapter-shade'); shade.setAttribute('aria-hidden', 'true');
  const copy = el('div', 'd3-chapter-copy');
  const rule = el('span', 'd3-chapter-rule'); rule.setAttribute('aria-hidden', 'true');
  copy.append(el('span', 'd3-kicker', chapter.act), el('h1', '', chapter.title), rule,
    el('p', 'd3-chapter-subtitle', chapter.subtitle), el('p', 'd3-chapter-place', cat`${chapter.place} · ${chapter.year}`));
  root.append(shade, copy);
}

/** Warm the next chapter's artwork during play without holding up the scene lifecycle. */
export function preloadChapterBackdrop(chapter: ChapterId, variant: ArtVariant) {
  const source = chapterBackdropSource(chapter, variant);
  if (source) { const image = new Image(); image.src = source; }
}
