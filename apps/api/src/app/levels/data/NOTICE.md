# Knowledge level data

`cefrj-v*.json` are snapshots built by `npx nx run api:build-cefr-data`
(`apps/api/tools/build-cefr-data.mjs`) from:

- **The CEFR-J Wordlist Version 1.5** — compiled by Yukio Tono, Tokyo
  University of Foreign Studies (<http://www.cefr-j.org/>), retrieved from
  <https://github.com/openlanguageprofiles/olp-en-cefrj>. Free for research
  and commercial use, provided the dataset is cited; copyright Tono
  Laboratory, TUFS.
  Changes: headword variants ("colour/color") are split, only single words
  are kept, lowercased, each at the lowest level it is listed at; parts of
  speech and other fields are dropped.
