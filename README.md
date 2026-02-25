# Board Game Framework

A multiplayer board game framework built with **Vue 3**, **Boardgame.io**, and **Pinia**.

## Monorepo Structure

```
packages/
  shared/   — TypeScript interfaces & game definitions (used by both client and server)
  server/   — Boardgame.io multiplayer server (Koa + Socket.IO)
  client/   — Vue 3 + Vite frontend with Pinia state management
```

## Quick Start

```bash
# Install all dependencies
npm install

# Build the shared package (required before first run)
npm run build:shared

# Start server + client in parallel
npm run dev
```

- **Server** listens on `http://localhost:8000`
- **Client** serves on `http://localhost:5173`

## How It Works

1. Open the client in two browser tabs.
2. In the first tab, click **Create Match** — you'll join as **X** (player 0).
3. Copy the match ID from the URL (or the badge on the game page).
4. In the second tab, paste the match ID and click **Join** — you'll join as **O** (player 1).
5. Take turns clicking cells. State synchronisation is handled by boardgame.io via Socket.IO and mirrored into a Pinia store.

## Adding a New Game

1. Define your game state interface in `packages/shared/src/types.ts`.
2. Create a `boardgame.io` Game object in `packages/shared/src/`.
3. Register the game in `packages/server/src/index.ts`.
4. Build a Vue component and connect it via a Pinia store (see `packages/client/src/stores/game.ts` for the pattern).
