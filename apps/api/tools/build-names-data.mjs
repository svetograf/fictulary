/**
 * Builds the names snapshot loaded by the names migration.
 *
 *   npx nx run api:build-names-data [--out=apps/api/src/migrations/data/names-vN.json]
 *
 * Sources:
 * - Popular baby names, 1880-2024 (aruljohn/popular-baby-names, MIT;
 *   data from the US Social Security Administration).
 * - Cities, countries and lakes from FreeGeoDB (delight-im/FreeGeoDB,
 *   CC BY 4.0).
 *
 * Only single words are kept: book words are single tokens, so "New York"
 * could never match. Names are lowercased like book words. Month and day
 * names are left out: they're in the baby names but are vocabulary.
 *
 * A snapshot is loaded by one migration and must not change afterwards. To
 * refresh the data, write a new file and add a migration for the difference.
 */
import { writeFileSync } from 'node:fs';

const BABY_NAMES =
  'https://raw.githubusercontent.com/aruljohn/popular-baby-names/master';
const FREE_GEO_DB =
  'https://raw.githubusercontent.com/delight-im/FreeGeoDB/master/Distribution/CSV';
const FIRST_YEAR = 1880;
const LAST_YEAR = 2024;

/** Same shape as book words (see apps/api/src/app/books/text/tokenize.ts). */
const SINGLE_WORD = /^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u;
const EXCLUDED = new Set(
  'january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday'.split(
    ' ',
  ),
);

const out =
  process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ??
  'apps/api/src/migrations/data/names-v1.json';

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return response.text();
}

/** RFC 4180 CSV: quoted fields may contain commas, quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function collect(target, values) {
  for (const value of values) {
    const name = value?.normalize('NFKC').trim().toLowerCase();
    if (name && SINGLE_WORD.test(name) && !EXCLUDED.has(name)) {
      target.add(name);
    }
  }
}

const names = {
  PERSON: new Set(),
  CITY: new Set(),
  COUNTRY: new Set(),
  LAKE: new Set(),
};

const years = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
);
for (let i = 0; i < years.length; i += 20) {
  const files = await Promise.all(
    years
      .slice(i, i + 20)
      .map((year) =>
        download(`${BABY_NAMES}/${year}/girl_boy_names_${year}.csv`),
      ),
  );
  for (const file of files) {
    for (const row of parseCsv(file)) {
      collect(names.PERSON, [row['Girl Name'], row['Boy Name']]);
    }
  }
}

for (const row of parseCsv(await download(`${FREE_GEO_DB}/cities.csv`))) {
  collect(names.CITY, [row.name, row.name_ascii]);
}
for (const row of parseCsv(await download(`${FREE_GEO_DB}/countries.csv`))) {
  collect(names.COUNTRY, [row.name, row.sovereign]);
}
for (const row of parseCsv(await download(`${FREE_GEO_DB}/lakes.csv`))) {
  collect(names.LAKE, [row.name]);
}

const snapshot = {
  generated: new Date().toISOString().slice(0, 10),
  sources: [
    {
      name: `Popular baby names ${FIRST_YEAR}-${LAST_YEAR}`,
      url: 'https://github.com/aruljohn/popular-baby-names',
      license: 'MIT (data: US Social Security Administration)',
    },
    {
      name: 'FreeGeoDB: cities, countries, lakes',
      url: 'https://github.com/delight-im/FreeGeoDB',
      license: 'CC BY 4.0 (changes: single-word names only, lowercased)',
    },
  ],
  names: Object.fromEntries(
    Object.entries(names).map(([kind, set]) => [kind, [...set].sort()]),
  ),
};
writeFileSync(out, JSON.stringify(snapshot) + '\n');
console.log(
  `Wrote ${out}:`,
  Object.entries(snapshot.names)
    .map(([kind, list]) => `${list.length} ${kind.toLowerCase()}`)
    .join(', '),
);
