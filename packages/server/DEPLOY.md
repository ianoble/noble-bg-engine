# Deploying the server with external games

To serve games like **Golden Ages** (so e.g. `POST /games/TheGoldenAges/create` works), the server must load their game definitions at startup. Use the **games directory** (recommended) so adding a new game is a single config change.

## Where the server looks for games

At startup the server loads external games in this order (see [load-games.ts](src/load-games.ts)):

1. **`dist/games/*.js` and `cwd/games/*.js`** — Every `.js` file in those directories is loaded. Each file may export `gameDef` (one game) or `gameDefs` (array of games); all are registered. This is the preferred place so you can add games without changing server code.
2. **Legacy single-file (only if no games were loaded from the directory above):**
   - **`EXTERNAL_GAME_PATH`** — Single module path (e.g. `file://` URL) for local dev.
   - **`./game-logic.js`** in the process cwd or next to the server entry.

On Render, the server typically runs as `node dist/index.cjs`, so the server entry dir is `dist/`. Putting built games in **`dist/games/`** (e.g. `dist/games/the-golden-ages.js`) means they are found automatically.

---

## Adding a new game (zero config for in-repo games)

**In-repo games:** Add a single file under `packages/server/src/games/` (e.g. `my-game.ts`) that exports `gameDef` or `gameDefs`. The build script **discovers all `.ts` and `.js` files** in that directory and bundles each to `dist/games/<filename>.js`. No config list to edit — add a file, it gets built.

**Game repos (zia, root-draft, ...):** Add one line to `external-games.json` at the repo root:
```json
{ "slug": "my-game", "repo": "https://github.com/ianoble/my-game" }
```
`npm run fetch:external-games -- --fresh` clones every listed repo to `../<slug>` (without `--fresh` it only clones missing ones and never touches existing folders, so local checkouts are safe). The build then bundles `../<slug>/src/logic/index.ts` (or `game-logic.ts`) as `game-<slug>.js`. Set `<SLUG>_PATH` (e.g. `ROOT_DRAFT_PATH`) to build from another folder. Render build command:
```
npm install --include=dev && npm run fetch:external-games -- --fresh && npm run build -w packages/engine && npm run build:with-external-games -w packages/server
```

**Other external games:** Set the env var `EXTERNAL_GAMES_CONFIG` to a JSON array, e.g.:
```json
[{"slug": "my-game", "path": "/absolute/path/to/entry.ts"}]
```
Or use the legacy `THE_GOLDEN_AGES_PATH` (and sibling `the-golden-ages`) for that one game only.

**Build and start:** Run `npm run build:external-games` or `npm run build:with-external-games`. One esbuild run builds all discovered games, so adding many games doesn’t slow the build down.

---

## Build commands

From `packages/server`:

- **`npm run build:external-games`** — Builds all games in `src/games/` (and any external config) into `dist/games/*.js`.
- **`npm run build:with-external-games`** — Runs `build:external-games` then the normal server `build`. Use this on Render (or any deploy).

---

## Option: manual game bundle

If you build a game outside this script (e.g. from another repo’s build):

1. Produce a Node CJS file that exports `gameDef` or `gameDefs`, with `@noble/bg-engine` and `boardgame.io` as externals.
2. Put it in `dist/games/<any-name>.js` (or in a `games/` directory that is the process cwd when the server runs). The server will load it automatically.

---

## Option: `EXTERNAL_GAME_PATH` (single game, local dev)

For local dev when the game is in another repo and you don’t want to bundle:

1. Set `EXTERNAL_GAME_PATH` to the path of the game module (e.g. `file:///C:/code/the-golden-ages/src/logic/game-logic.js` on Windows).
2. Start the server. It loads that module only if no games were loaded from `dist/games/` or `cwd/games/`.

On Render you usually don’t have the other repo, so use the games directory and `build:with-external-games` instead.
