/**
 * Optionally register external game definitions with the server.
 *
 * Only loads when EXTERNAL_GAME_PATH is set (e.g. for local dev when the-golden-ages
 * is a sibling project). On Render or other deploys, leave it unset so the server
 * builds and runs with only the built-in games (e.g. tic-tac-toe).
 *
 * For local dev with the-golden-ages at c:\code\the-golden-ages, set:
 *   EXTERNAL_GAME_PATH to the absolute path of the game module, e.g.
 *   file:///c:/code/the-golden-ages/src/logic/game-logic.js
 *   (Node ESM dynamic import requires file:// for absolute paths on Windows.)
 */
import { registerGame } from '@noble/bg-engine';

export async function loadExternalGames(): Promise<void> {
  const path = process.env.EXTERNAL_GAME_PATH;
  if (!path) return;
  try {
    const mod = await import(/* @vite-ignore */ path);
    if (mod?.gameDef) registerGame(mod.gameDef);
  } catch {
    // Path missing or invalid (e.g. on Render); skip.
  }
}
