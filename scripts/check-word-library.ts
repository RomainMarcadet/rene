import { WORD_PAIRS, NEW_WORD_PAIRS, LEGACY_WORD_PAIRS, auditWordLibrary, libraryStatistics } from '../packages/engine/src/words.js';

const issues = auditWordLibrary(WORD_PAIRS);
console.log(JSON.stringify({ existing: LEGACY_WORD_PAIRS.length, added: libraryStatistics(NEW_WORD_PAIRS), catalogue: libraryStatistics(WORD_PAIRS), issues }, null, 2));
if (issues.length || NEW_WORD_PAIRS.length < 1000) process.exitCode = 1;
