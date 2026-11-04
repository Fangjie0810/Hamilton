import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { checkSource } from '../../scripts/check-i18n';

const root = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => resolve(root, f));
const config = ts.parseJsonConfigFileContent(JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8')), ts.sys, root);
const program = ts.createProgram(files, config.options);
const checker = program.getTypeChecker();
const errors = files.flatMap(file => checkSource(program.getSourceFile(file)!, checker));
const chart = JSON.parse(readFileSync(resolve(root, 'chart.json'), 'utf8'));
for (const section of chart.sections) {
  for (const key of ['label', 'description']) {
    if (!section[key]?.zh?.trim() || !section[key]?.en?.trim()) errors.push(`Missing section ${key} pair: ${section.id}`);
  }
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`PASS rhythm bilingual source coverage: ${files.length} files and all chart sections`);
