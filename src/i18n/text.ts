export interface BiText { readonly zh: string; readonly en: string }
export type Text = BiText | string;
export type LanguageMode = 'zh' | 'en' | 'dual' | 'dual-en';
export const LANGUAGE_KEY = 'project-hamilton:language:v1';
export const bi = (zh: string, en: string): BiText => ({ zh, en });
const languageLabels = [
  ['dual', bi('双语 · 中文主字幕', 'Bilingual · Chinese first')],
  ['dual-en', bi('双语 · 英文主字幕', 'Bilingual · English first')],
  ['zh', bi('中文', 'Chinese')], ['en', bi('英文', 'English')],
] as const satisfies ReadonlyArray<readonly [LanguageMode, BiText]>;
// Language choices name themselves in their target language, regardless of the current UI.
export const languageOptions = languageLabels.map(([mode, label]) =>
  [mode, mode === 'en' || mode === 'dual-en' ? label.en : label.zh] as const);
export const subtitleHelp = bi('双语仅用于对话；小游戏、按钮和其他界面文字使用主字幕语言。', 'Bilingual text is used only for dialogue. Minigames, buttons and other interface text use the primary subtitle language.');
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
  try { const value = storage?.getItem(LANGUAGE_KEY); return languageOptions.some(([key]) => key === value) ? value as LanguageMode : 'dual'; } catch { return 'dual'; }
}
function browserStorage() { try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; } }
let mode = loadLanguage(browserStorage());
const listeners = new Set<() => void>();
export const getLanguage = () => mode;
export const getPrimaryLanguage = (language: LanguageMode = mode): 'zh' | 'en' => language === 'en' || language === 'dual-en' ? 'en' : 'zh';
export const primaryText = (text: Text) => languagePart(text, getPrimaryLanguage());
export const accessibleText = (text: Text) => primaryText(text);
export function onLanguageChange(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }

interface Binding { text?: Text; progress: number; dialogue: boolean; attributes: Map<string, Text> }
const bindings = new WeakMap<HTMLElement, Binding>();
/** Full paired text for speech; independent of subtitle mode or typewriter progress. */
export function boundText(node: Element): Text | undefined { return bindings.get(node as HTMLElement)?.text; }
function binding(node: HTMLElement) {
  let value = bindings.get(node);
  if (!value) { value = { progress: 1, dialogue: false, attributes: new Map() }; bindings.set(node, value); node.dataset.localized = ''; }
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
      const primaryLanguage = getPrimaryLanguage();
      main.textContent = primary.slice(0, Math.ceil(primary.length * value.progress)); main.lang = primaryLanguage === 'en' ? 'en' : 'zh-CN';
      let secondary = node.querySelector<HTMLElement>(':scope > .text-secondary');
      if (value.dialogue && (mode === 'dual' || mode === 'dual-en') && text.zh !== text.en) {
        if (!secondary) { secondary = document.createElement('span'); secondary.className = 'text-secondary'; node.append(secondary); }
        const secondaryLanguage = primaryLanguage === 'en' ? 'zh' : 'en';
        secondary.lang = secondaryLanguage === 'en' ? 'en' : 'zh-CN';
        const translation = text[secondaryLanguage];
        secondary.textContent = translation.slice(0, Math.ceil(translation.length * value.progress));
      } else secondary?.remove();
    }
  }
  for (const [attribute, text] of value.attributes) node.setAttribute(attribute, accessibleText(text));
}
function bindText(element: Element, text: Text, progress: number, dialogue: boolean) {
  const node = element as HTMLElement;
  // Plain labels and empty containers are not rebound: translating a parent must never erase its controls.
  if (typeof text === 'string') {
    const previous = bindings.get(node); if (previous) { previous.text = undefined; previous.dialogue = false; }
    if (node.textContent !== text) node.textContent = text;
    return;
  }
  const value = binding(node); const previous = value.text;
  const same = previous === text || (typeof previous === 'object' && typeof text === 'object' && previous.zh === text.zh && previous.en === text.en);
  if (same && value.progress === progress && value.dialogue === dialogue) return;
  value.text = text; value.progress = Math.max(0, Math.min(1, progress)); value.dialogue = dialogue; render(node, value);
}
/** Interface copy always follows the primary subtitle language. */
export function setText(element: Element, text: Text, progress = 1) { bindText(element, text, progress, false); }
/** Only spoken dialogue opts into the second subtitle line. */
export function setDialogueText(element: Element, text: Text, progress = 1) { bindText(element, text, progress, true); }
export function setLabel(node: HTMLElement, attribute: string, text: Text) { const value = binding(node); value.attributes.set(attribute, text); render(node, value); }
export function setLanguage(next: LanguageMode) {
  if (!languageOptions.some(([key]) => key === next)) return;
  mode = next;
  try { browserStorage()?.setItem(LANGUAGE_KEY, next); } catch { /* Language controls work without persistent storage. */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = getPrimaryLanguage() === 'en' ? 'en' : 'zh-CN'; document.documentElement.dataset.language = next;
    document.querySelectorAll<HTMLElement>('[data-localized]').forEach(node => { const value = bindings.get(node); if (value) render(node, value); });
  }
  listeners.forEach(listener => listener());
}
// Apply the default/saved mode without requiring storage or DOM in core tests.
if (typeof document !== 'undefined') { document.documentElement.lang = getPrimaryLanguage() === 'en' ? 'en' : 'zh-CN'; document.documentElement.dataset.language = mode; }
