import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkSource(source: ts.SourceFile, checker?: ts.TypeChecker): string[] {
  const problems: string[] = [];
  const complain = (node: ts.Node, message: string) => problems.push(`${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`);
  const literal = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const hasPair = (type: ts.Type): boolean => type.isUnion() ? type.types.some(hasPair) : !!type.getProperty('zh') && !!type.getProperty('en');
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      const texts = ['el', 'element', 'setLabel'].includes(name) ? [node.arguments[2]]
        : name === 'setText' ? [node.arguments[1]]
        : name === 'canvasText' ? [node.arguments[3]]
        : name.endsWith('.curtain') ? [node.arguments[0], node.arguments[1]]
        : (['button', 'action'].includes(name) || name === 'super' && source.fileName.includes('/ui/')) ? [node.arguments[0]] : [];
      for (const text of texts) {
        const prose = text && (literal(text) ? text.text : ts.isTemplateExpression(text) ? text.head.text + text.templateSpans.map(span => span.literal.text).join('') : '');
        if (prose && /[A-Za-z]/.test(prose) && !['HAMILTON', 'ALEXANDER HAMILTON', 'H'].includes(prose)) complain(text!, 'UI prose must be paired even when it is authored in English first.');
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'bi' && !source.fileName.endsWith('/i18n/text.ts')) {
      const [zh, en] = node.arguments;
      if (node.arguments.length !== 2 || !zh || !en || !literal(zh) || !literal(en)) complain(node, 'Use two literal strings in bi(); use f() or cat for dynamic text.');
      else {
        if (!zh.text.trim() || !en.text.trim()) complain(node, 'Both Chinese and English are required.');
        if (/\p{Script=Han}/u.test(en.text)) complain(node, 'English text contains untranslated Chinese.');
        const slots = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort().join(',');
        if (slots(zh.text) !== slots(en.text)) complain(node, 'Chinese and English must have matching template parameters.');
      }
    }
    if (literal(node) && /\p{Script=Han}/u.test(node.text)) {
      const parent = node.parent;
      if (!(ts.isCallExpression(parent) && parent.expression.getText(source) === 'bi' && parent.arguments[0] === node)) complain(node, 'Player-facing Chinese must be paired with English through bi().');
    }
    if (ts.isTemplateExpression(node)) {
      if (/\p{Script=Han}/u.test(node.head.text + node.templateSpans.map(span => span.literal.text).join(''))) complain(node, 'Use a paired f() template for translated text.');
      const paired = checker && node.templateSpans.some(span => hasPair(checker.getTypeAtLocation(span.expression)));
      if (paired && !(ts.isTaggedTemplateExpression(node.parent) && node.parent.tag.getText(source) === 'cat')) complain(node, 'Interpolating paired text directly loses its languages. Use cat or f().');
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return problems;
}
export function checkProject() {
  const files: string[] = [];
  const collect = (dir: string) => { for (const entry of readdirSync(dir)) { const file = resolve(dir, entry); if (statSync(file).isDirectory()) collect(file); else if (file.endsWith('.ts')) files.push(file); } };
  collect('src');
  const config = ts.parseJsonConfigFileContent(JSON.parse(readFileSync('tsconfig.json', 'utf8')), ts.sys, process.cwd());
  const program = ts.createProgram(files, config.options); const checker = program.getTypeChecker();
  const problems = files.flatMap(file => checkSource(program.getSourceFile(file)!, checker));
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(`PASS bilingual source coverage: ${files.length} files; required pairs and matching parameters`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkProject();
