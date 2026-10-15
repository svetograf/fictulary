---
name: run-fictulary
description: Start, run, and drive Fictulary (NestJS API + Angular/Ionic web app) locally and take screenshots. Use when asked to run or start the app, sign in to it, click through a page, screenshot the UI, smoke-test an API route, or confirm a change works in the real app rather than only in tests.
---

Fictulary is an Nx workspace with two apps that run together: `apps/api`
(NestJS + Postgres) and `apps/web` (Angular + Ionic). Start both with
`.claude/skills/run-fictulary/start.sh`, then drive the web app by piping
commands to `.claude/skills/run-fictulary/driver.mjs` (headless Chromium via
`playwright-core`). Hit the API with `curl`.

All paths are relative to the repo root.

## Prerequisites

Verified on Linux with Node 22, Docker Compose, `lsof` and `curl` on the
PATH. Postgres runs from the repo's `docker-compose.yml`, which `start.sh`
starts for you.

One-time driver setup. It installs into the skill directory (gitignored),
not the workspace, and downloads the Chromium build that matches the
pinned `playwright-core`:

```bash
npm install --prefix .claude/skills/run-fictulary
npx --prefix .claude/skills/run-fictulary playwright-core install chromium
```

## Run (agent path)

```bash
.claude/skills/run-fictulary/start.sh   # ~15s; prints "Ready: ..." when both answer
NO_APPLE=1 .claude/skills/run-fictulary/start.sh   # same, with Apple sign-in off (button hidden)
```

This starts the following and leaves them running in the background:
- The API on **:3399** against a fresh database, **`fictulary_run`**, which
  is dropped and recreated on every start. Migrations run on startup.
  `AUTH_DEV_LOGIN=true` is set, and the OAuth settings are placeholders.
- The web dev server on **:4300**, with `/api` proxied to :3399.

Logs and screenshots go to `.claude/skills/run-fictulary/out/`. Your own
`apps/api/.env` database is never touched.

Drive it by piping commands to the driver, one per line:

```bash
node .claude/skills/run-fictulary/driver.mjs <<'EOF'
nav /upload
wait Continue with Apple
shot 1-sign-in
fill email dev@example.com
click Sign in as this user
wait What should we call you?
fill name Dev User
click Continue
wait-url /upload
click-css #account-menu
click Account
wait Delete account
shot 2-account
signin ada@example.com Ada Lovelace
nav /my-dictionary
shot 3-dictionary
errors
EOF
```

Each line prints `ok <command> [<current path>]` or `FAIL ...` with the
reason. By default it stops at the first failure and exits 1; set
`KEEP_GOING=1` to continue past failures. `shot` prints the PNG's path,
so **open it and look at it**.

| command | what it does |
|---|---|
| `nav <path>` | go to a path (or a full URL) and wait for the network to go idle |
| `signin <email> [name…]` | sign in through `POST /api/auth/dev`, store the token, reload. Without a name the account has none, and the app routes to `/welcome` |
| `signout` | drop the stored token and reload |
| `click <exact text>` | click the first *visible* element with exactly that text |
| `click-css <selector>` | click by Playwright selector, e.g. `ion-alert button:has-text("Delete account")` |
| `fill <formControlName> <value…>` | type into an `ion-input` (fills its inner `<input>`) |
| `wait <text>` / `wait-url <path>` | wait up to 15s for visible text or a URL ending |
| `text [selector]` | print the inner text (default: the current page) |
| `shot [name]` | wait 600ms for Ionic animations, then save `out/<name>.png` |
| `viewport <w> <h>` | resize the page, e.g. `viewport 360 640` for a small phone |
| `last-page` | switch to the newest tab or popup (e.g. the Google sign-in popup) |
| `eval <js>` | evaluate JS in the page and print the result |
| `errors` | print the browser console errors collected so far |
| `url`, `sleep <ms>`, `help` | as named |

API smoke check with `curl`, while `start.sh`'s servers are up:

```bash
curl -s localhost:3399/api/auth/providers
curl -s -XPOST localhost:3399/api/auth/dev -H 'content-type: application/json' -d '{"email":"curl@example.com"}'
```

Stop the servers and drop the database:

```bash
.claude/skills/run-fictulary/stop.sh
```

## Run (human path)

`npm run start:api` and `npm run start:web` (port 4200) use
`apps/api/.env` (see `apps/api/.env.example`). They apply migrations to
**your** dev database on startup.

## Test

```bash
npx nx run-many -t lint test build -p api web shared-models
```

## Gotchas

- **Real Google and Apple sign-in can't be completed here.** With the
  placeholder client ID, "Continue with Google" opens a Google popup
  that shows `invalid_client`; you can reach it with `last-page`. Apple
  never accepts `localhost` return URLs. Use `signin` or the dev form on
  `/sign-in`, which appears only while `AUTH_DEV_LOGIN=true`.
- **`nav /sign-in` while signed in lands on `/`**, because the sign-in
  page sends signed-in users home. Run `signout` first.
- **Ionic overlays fade in and out.** Screenshots taken immediately catch
  popovers and alerts half-transparent, which is why `shot` waits first.
  An alert's buttons sit inside `ion-alert`; click them with
  `click-css ion-alert button:has-text("…")`.
- **"Account" appears twice** while the account menu is open: as the
  toolbar label (when there's no name) and as the menu item. `click`
  only considers visible matches; if it still hits the wrong one, use
  `click-css`.
- **`ion-input` hides its real `<input>`.** Filling the host does
  nothing; `fill` targets `ion-input[formcontrolname=X] input`.
- **Your own `nx serve web` blocks a second one.** Nx makes another
  `web:serve` wait ("Waiting for web:serve:development in another nx
  process") instead of starting it. `start.sh` gives its Nx a separate
  workspace data directory (`out/nx-data`) and `NX_DAEMON=false`, so it
  runs alongside yours.
- **The API also reads `apps/api/.env`** for anything not set in the
  environment. `start.sh` sets every required value itself (including
  `JWT_SECRET`). With `NO_APPLE=1` it sets the `APPLE_*` values to empty
  strings, because unsetting them would let values from your `.env` fill
  them in.
- **Don't `pkill -f dist/apps/api/main.js`.** The pattern also matches
  the shell running it, which kills the agent's command (exit 144).
  `stop.sh` kills by port instead.

## Troubleshooting

- **`page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot`**:
  `playwright-core` doesn't match the Chromium build it launched. Keep
  the version pinned in `package.json` and rerun
  `npx --prefix .claude/skills/run-fictulary playwright-core install chromium`.
  Note that `install` deletes older `chromium-*` builds from
  `~/.cache/ms-playwright`.
- **`BEWARE: your OS is not officially supported by Playwright; downloading fallback build for ubuntu24.04-x64`**
  during `install` (seen on Arch Linux): harmless. The fallback build runs
  fine.
- **`start.sh` prints "Not ready"**: read `out/api.log`. The API exits
  at startup if any required OAuth setting is missing, and `start.sh`
  supplies placeholders for all of them. A new required setting has to be
  added to the `env` line in `start.sh`.
- **`dev sign-in: 404`** from `signin`: the API isn't running with
  `AUTH_DEV_LOGIN=true`, for example because it was started with
  `npm run start:api` instead of `start.sh`.
