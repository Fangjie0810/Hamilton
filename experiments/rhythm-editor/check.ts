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
if (errors.length) throw new Error(errors.join('\n'));
console.log(`PASS editor bilingual source coverage: ${files.length} files`);
