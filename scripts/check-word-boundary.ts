import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NEW_WORD_PAIRS } from '../packages/engine/src/words.js';

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
let checked = 0; let violations = 0;
for (const file of await files('apps/web/dist')) {
  if (!/\.(?:js|json|map|html)$/u.test(file)) continue;
  const content = await readFile(file, 'utf8'); checked++;
  if (/clueAxes|word-data|legacyWords|packages\/engine/u.test(content) || NEW_WORD_PAIRS.some(pair => content.includes(pair.id))) violations++;
}
console.log(JSON.stringify({ clientAssetsChecked: checked, catalogueBoundaryViolations: violations }));
if (violations) process.exitCode = 1;
