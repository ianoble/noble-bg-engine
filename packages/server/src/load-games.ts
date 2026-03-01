/**
 * Register external game definitions with the server.
 *
 * For local dev: import from the the-golden-ages project (sibling of noble-bg-engine
 * at c:\code\the-golden-ages) so the server runs the same game logic as the client,
 * including setupData and the Cults & Culture expansion.
 *
 * For deployment when the-golden-ages is not a sibling: copy the game into ./games/
 * and switch the import to './games/the-golden-ages.js'.
 */
import { registerGame } from '@noble/bg-engine';

// Path from packages/server/src to c:\code\the-golden-ages\src\logic\game-logic
import { gameDef } from '../../../../the-golden-ages/src/logic/game-logic.js';

registerGame(gameDef);
