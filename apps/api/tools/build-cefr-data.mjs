/**
 * Builds the CEFR-J vocabulary snapshot used for knowledge-level word lists.
 *
 *   npx nx run api:build-cefr-data [--out=apps/api/src/app/levels/data/cefrj-v1.json]
 *
 * Source: the CEFR-J Wordlist 1.5 (Yukio Tono, Tokyo University of Foreign
 * Studies) as published by Open Language Profiles; free for research and
 * commercial use with citation.
 *
 * Headwords like "colour/color" are split into their variants. Only single
 * words are kept: book words are single tokens, so "ice cream" could never
 * match. A word listed under several parts of speech keeps its lowest level.
 * Words are lowercased like book words but not lemmatized: the API runs them
 * through the same lemmatizer as books when it builds a list.
 */
import { writeFileSync } from 'node:fs';

const SOURCE =
  'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv';
const LEVELS = ['A1', 'A2', 'B1', 'B2'];

/** Same shape as book words (see apps/api/src/app/books/text/tokenize.ts). */
const SINGLE_WORD = /^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u;

const out =
  process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ??
  'apps/api/src/app/levels/data/cefrj-v1.json';

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`${SOURCE}: HTTP ${response.status}`);
}
// No quoted fields in this file: headwords and levels never contain commas.
const [header, ...rows] = (await response.text())
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split(','));
const headwordColumn = header.indexOf('headword');
const levelColumn = header.indexOf('CEFR');

/** Lowest level per word. */
const levelOf = new Map();
for (const row of rows) {
  const level = row[levelColumn];
  if (!LEVELS.includes(level)) {
    throw new Error(`Unexpected level ${level} for ${row[headwordColumn]}`);
  }
  for (const variant of row[headwordColumn].split('/')) {
    const word = variant.normalize('NFKC').trim().toLowerCase();
    if (!SINGLE_WORD.test(word)) {
      continue;
    }
    const known = levelOf.get(word);
    if (!known || LEVELS.indexOf(level) < LEVELS.indexOf(known)) {
      levelOf.set(word, level);
    }
  }
}

const snapshot = {
  generated: new Date().toISOString().slice(0, 10),
  source: {
    name: 'CEFR-J Wordlist Version 1.5, compiled by Yukio Tono, Tokyo University of Foreign Studies',
    url: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
    license:
      'Free for research and commercial use with citation; copyright Tono Laboratory, TUFS',
  },
  levels: Object.fromEntries(
    LEVELS.map((level) => [
      level,
      [...levelOf]
        .filter(([, l]) => l === level)
        .map(([word]) => word)
        .sort(),
    ]),
  ),
};
writeFileSync(out, JSON.stringify(snapshot) + '\n');
console.log(
  `Wrote ${out}:`,
  Object.entries(snapshot.levels)
    .map(([level, words]) => `${words.length} ${level}`)
    .join(', '),
);
