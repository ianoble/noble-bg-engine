/**
 * Register external game definitions with the server.
 *
 * For deployment, game-logic files are copied into ./games/ so esbuild can
 * bundle them. For local dev you can also import via a relative path to an
 * external project (the file must import from `@noble/bg-engine`, not
 * `@noble/bg-engine/client`).
 */
import { registerGame } from '@noble/bg-engine';
import { gameDef } from './games/the-golden-ages.js';

registerGame(gameDef);
