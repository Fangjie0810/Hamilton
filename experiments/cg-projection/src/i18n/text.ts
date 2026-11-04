export interface BiText { readonly zh: string; readonly en: string }
export type Text = BiText | string;
export type LanguageMode = 'zh' | 'en' | 'dual';
export const LANGUAGE_KEY = 'project-hamilton:language:v1';
export const bi = (zh: string, en: string): BiText => ({ zh, en });
export const languagePart = (text: Text | number, language: 'zh' | 'en'): string => typeof text === 'object' ? text[language] : String(text);
export function f(template: BiText, ...args: (Text | number | undefined)[]): BiText {
  const format = (language: 'zh' | 'en') => template[language].replace(/\{(\d+)\}/g, (_, index: string) => languagePart(args[Number(index)] ?? '', language));
  return bi(format('zh'), format('en'));
}
export function cat(parts: TemplateStringsArray, ...args: (Text | number | undefined)[]): BiText {
  const format = (language: 'zh' | 'en') => parts.reduce((result, part, i) => result + part + (i < args.length ? languagePart(args[i] ?? '', language) : ''), '');
  return bi(format('zh'), format('en'));
}
export function loadLanguage(storage?: Pick<Storage, 'getItem'>): LanguageMode {
  try { const value = storage?.getItem(LANGUAGE_KEY); return value === 'zh' || value === 'en' || value === 'dual' ? value : 'dual'; } catch { return 'dual'; }
}
function browserStorage() { try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; } }
let mode = loadLanguage(browserStorage());
const listeners = new Set<() => void>();
export const getLanguage = () => mode;
export const primaryText = (text: Text) => languagePart(text, mode === 'en' ? 'en' : 'zh');
export const accessibleText = (text: Text) => typeof text === 'string' ? text : mode === 'dual' && text.zh !== text.en ? `${text.zh} / ${text.en}` : primaryText(text);
export function onLanguageChange(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }

interface Binding { text?: Text; progress: number; attributes: Map<string, Text> }
const bindings = new WeakMap<HTMLElement, Binding>();
/** Full paired text for speech; independent of subtitle mode or typewriter progress. */
export function boundText(node: Element): Text | undefined { return bindings.get(node as HTMLElement)?.text; }
function binding(node: HTMLElement) {
  let value = bindings.get(node);
  if (!value) { value = { progress: 1, attributes: new Map() }; bindings.set(node, value); node.dataset.localized = ''; }
  return value;
}
function render(node: HTMLElement, value: Binding) {
  if (value.text !== undefined) {
    const text = value.text;
    if (node instanceof HTMLOptionElement) node.textContent = accessibleText(text);
    else if (typeof text === 'string') node.textContent = text.slice(0, Math.ceil(text.length * value.progress));
    else {
      let main = node.querySelector<HTMLElement>(':scope > .text-primary');
      if (!main) { main = document.createElement('span'); main.className = 'text-primary'; node.replaceChildren(main); }
      const primary = primaryText(text);
      main.textContent = primary.slice(0, Math.ceil(primary.length * value.progress)); main.lang = mode === 'en' ? 'en' : 'zh-CN';
      let secondary = node.querySelector<HTMLElement>(':scope > .text-secondary');
      if (mode === 'dual' && text.zh !== text.en) {
        if (!secondary) { secondary = document.createElement('span'); secondary.className = 'text-secondary'; secondary.lang = 'en'; node.append(secondary); }
        secondary.textContent = text.en.slice(0, Math.ceil(text.en.length * value.progress));
      } else secondary?.remove();
    }
  }
  for (const [attribute, text] of value.attributes) node.setAttribute(attribute, accessibleText(text));
}
export function setText(element: Element, text: Text, progress = 1) {
  const node = element as HTMLElement;
  // Plain labels and empty containers are not rebound: translating a parent must never erase its controls.
  if (typeof text === 'string') {
    const previous = bindings.get(node); if (previous) previous.text = undefined;
    if (node.textContent !== text) node.textContent = text;
    return;
  }
  const value = binding(node); const previous = value.text;
  const same = previous === text || (typeof previous === 'object' && typeof text === 'object' && previous.zh === text.zh && previous.en === text.en);
  if (same && value.progress === progress) return;
  value.text = text; value.progress = Math.max(0, Math.min(1, progress)); render(node, value);
}
export function setLabel(node: HTMLElement, attribute: string, text: Text) { const value = binding(node); value.attributes.set(attribute, text); render(node, value); }
export function setLanguage(next: LanguageMode) {
  if (!['zh', 'en', 'dual'].includes(next)) return;
  mode = next;
  try { browserStorage()?.setItem(LANGUAGE_KEY, next); } catch { /* Language controls work without persistent storage. */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN'; document.documentElement.dataset.language = next;
    document.querySelectorAll<HTMLElement>('[data-localized]').forEach(node => { const value = bindings.get(node); if (value) render(node, value); });
  }
  listeners.forEach(listener => listener());
}
// Apply the default/saved mode without requiring storage or DOM in core tests.
if (typeof document !== 'undefined') { document.documentElement.lang = mode === 'en' ? 'en' : 'zh-CN'; document.documentElement.dataset.language = mode; }
