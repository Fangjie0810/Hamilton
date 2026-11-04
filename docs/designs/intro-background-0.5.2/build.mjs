import { readFile, writeFile } from 'node:fs/promises';
import { versions, labels, languageOptions } from './content.ts';

const root = new URL('./', import.meta.url);
const content = { versions, labels, languageOptions };
function check(value, path = 'content') {
  if (!value || typeof value !== 'object') return;
  if ('zh' in value || 'en' in value) {
    if (typeof value.zh !== 'string' || typeof value.en !== 'string' || !value.zh.trim() || !value.en.trim()) throw new Error(`Missing pair: ${path}`);
    return;
  }
  for (const [key, child] of Object.entries(value)) check(child, `${path}.${key}`);
}
check(content);
const template = await readFile(new URL('preview.template.html',root),'utf8');
const json = JSON.stringify(content).replaceAll('<','\\u003c');
await writeFile(new URL('preview.html',root),template.replace('/*__CONTENT__*/',json));
let copy = '# 开场背景介绍 · 两版中英成稿\n\n独立设计稿，未接入主代码。详细落点、历史核对和视觉说明见 [README](README.md)。\n';
for (const [id, version] of Object.entries(versions)) {
  copy += `\n## ${version.label.zh}\n\n`;
  for (const lang of ['zh','en']) {
    copy += `### ${lang === 'zh' ? '中文' : 'English'}\n\n${version.era[lang]}\n\n**${version.title[lang]}**\n\n*${version.subtitle[lang]}*\n\n`;
    copy += version.paragraphs.map(pair => pair[lang]).join('\n\n');
    copy += `\n\n**${version.closing[lang]}**\n\n`;
    if (id === 'b') copy += `${labels.playerRole[lang]}\n\n`;
    copy += `${labels.note[lang]}\n\n`;
  }
}
await writeFile(new URL('copy.md',root),copy);
console.log('Built paired copy.md and portable preview.html; no production files changed.');
