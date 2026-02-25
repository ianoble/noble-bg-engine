import { Server, Origins } from 'boardgame.io/server';
import { gameRegistry, prepareGame } from '@noble/bg-engine';

const PORT = Number(process.env.PORT) || 8000;

const server = Server({
  games: gameRegistry.map((def) => prepareGame(def)),
  origins: [Origins.LOCALHOST],
});

server.run(PORT, () => {
  console.log(`[bgf] boardgame.io server listening on http://localhost:${PORT}`);
  console.log(`[bgf] registered games: ${gameRegistry.map((d) => d.id).join(', ')}`);
});
