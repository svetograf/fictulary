# Names data

`names-v*.json` are snapshots built by `npx nx run api:build-names-data`
(`apps/api/tools/build-names-data.mjs`) from:

- **Popular baby names, 1880–2024** — <https://github.com/aruljohn/popular-baby-names>,
  MIT License. Data originally from the US Social Security Administration.
- **FreeGeoDB** (cities, countries, lakes) — <https://github.com/delight-im/FreeGeoDB>
  by delight.im, licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Changes: only single-word names are kept, lowercased; geometry and other
  fields are dropped.

Month and day names are left out on purpose.
