# Dartsly

A mobile-first darts scoreboard that installs like a native app and runs entirely on-device. Pick a mode, tap throws, keep history — no accounts, no network, no server.

Live: **https://maastrich.github.io/dartsly/**

## Why it exists

Phone-sized darts trackers either ship tacked-on web shells or gate the basics behind accounts. Dartsly is a standalone PWA built for the scoreboard use case: one-handed input at the oche, tabular numerals big enough to read from three steps back, and all state persisted locally in IndexedDB so matches survive offline play and page reloads.

## Game modes

- **X01** — count down from 101–1001. Single / double / master out rules.
- **Cricket** — close 15–20 + bull. Normal or cut-throat scoring, optional points cap.
- **Killer** — standard (countdown from 3 or 5 lives) or progressive (start at 0, 3 hits arm you, any hit damages, die at −1). Random or manual target assignment, safe or suicide self-double rule.

Every throw is event-sourced: rounds, scores, closures, lives, winners all derive from the append-only event log. Undo peels the last event off.

## Stack

- **Vite 6** + **React 19** + **TypeScript**
- **React Router 7** (BrowserRouter with GitHub Pages SPA fallback)
- **Tailwind CSS v4** with an OKLCH darts-board palette, tokens defined inline in `src/globals.css`
- **Dexie 4** over IndexedDB; live queries via `dexie-react-hooks`
- **vite-plugin-pwa** with Workbox (`registerType: "autoUpdate"`)
- **Radix UI** primitives + **shadcn**-style components in `src/components/ui`
- **sonner** for toasts, **lucide-react** for icons

## Design target

Designed and optimised for **mobile devices running as an installed PWA**. The shell pins with `position: fixed; inset: 0` to dodge the iOS-Safari child-of-body height bug; safe-area insets are respected on every sticky surface; touch targets are ≥ 44pt; haptics fire on meaningful actions. Desktop viewports work but are not the target.

See `AGENTS.md` for the design hard rules.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # outputs ./dist (static assets)
pnpm preview      # serve the production build
```

No `.env` is required — there is no backend. `VITE_BASE_PATH` can be set at build time to serve under a subpath (the GitHub Pages workflow sets it to `/${repo}/`).

## Project layout

```
src/
  App.tsx                    router + shell mount
  main.tsx                   entry + SW registration
  globals.css                tokens, iOS PWA layout fix, fonts
  components/
    app-shell.tsx            fixed-inset container, header, outlet, bottom nav
    bottom-nav.tsx           iOS tab-bar style navigation
    install-prompt.tsx       add-to-home-screen guidance
    ui/                      Radix + shadcn primitives
  lib/
    db.ts                    Dexie schema (players, games, participants, events)
    game-actions.ts          persistence layer (startGame, recordThrow, undoLastThrow, finishGame, …)
    games-shared.ts          mode configs and event types
  pages/
    home.tsx                 mode picker
    players.tsx              roster CRUD
    games-list.tsx           history
    new-game.tsx             per-mode setup + player order
    game-detail.tsx          loads game + dispatches to board
    mode-x01.tsx             X01 board
    mode-cricket.tsx         Cricket board
    mode-killer.tsx          Killer board
public/
  404.html                   SPA fallback for GitHub Pages deep links
  icon-*.png, favicon-*.png  PWA icons
```

## Data model

All tables live in the `dartsly` IndexedDB database. No user scoping — a device is a user.

- **players** `{ id, name, createdAt }`
- **games** `{ id, mode, status, config, winnerParticipantId, startedAt, finishedAt }`
- **participants** `{ id, gameId, playerId, position, finalStats }`
- **events** `{ id, gameId, participantId, roundIndex, data, createdAt }` — one row per throw; mode-specific shape in `data`

Schema is versioned via `db.version(n).stores(…)` in `src/lib/db.ts`.

## Deployment

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds on push to `main` and publishes `dist/` to GitHub Pages. The workflow sets `VITE_BASE_PATH=/${repo}/` so the bundle, service worker, and router basename all resolve correctly under a project-page URL. A `404.html` copy of `index.html` is shipped so deep links survive a hard refresh.

Because everything is static, `dist/` can be served by any CDN — GitHub Pages is not special.

## Offline & install

The service worker precaches the whole app shell (JS, CSS, HTML, fonts, icons) and falls back to `index.html` for navigations. Once installed and loaded once, the app is fully usable offline. Updates apply automatically on next launch (`registerType: "autoUpdate"`).

On iOS, install is Safari → Share → Add to Home Screen. The in-app `InstallPrompt` surfaces the flow contextually; on Android/desktop it hooks `beforeinstallprompt` to trigger the native dialog.

## License

MIT.
