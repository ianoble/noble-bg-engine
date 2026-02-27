import { Server, Origins } from 'boardgame.io/server';
import { PostgresStore } from 'bgio-postgres';
import { gameRegistry, prepareGame } from '@noble/bg-engine';
import './load-games.js';

const PORT = Number(process.env.PORT) || 8000;

const db = process.env.DATABASE_URL
  ? new PostgresStore(process.env.DATABASE_URL, {
      logging: false,
      dialectOptions: {
        ssl: { rejectUnauthorized: false },
      },
    })
  : undefined;

const origins: (string | RegExp)[] = [Origins.LOCALHOST];
if (process.env.FRONTEND_URL) {
  origins.push(process.env.FRONTEND_URL);
}

const server = Server({
  games: gameRegistry.map((def) => prepareGame(def)),
  origins,
  db,
});

server.run(PORT, () => {
  console.log(`[bgf] boardgame.io server listening on http://localhost:${PORT}`);
  console.log(`[bgf] storage: ${db ? 'PostgreSQL' : 'in-memory'}`);
  console.log(`[bgf] registered games: ${gameRegistry.map((d) => d.id).join(', ')}`);
});
