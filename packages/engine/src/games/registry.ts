import type { GameDefinition } from '../types/index.js';
import { ticTacToeDef } from './tic-tac-toe/index.js';

/** All registered games. Add new games here. */
export const gameRegistry: GameDefinition[] = [
	ticTacToeDef,
];

/** Lookup a game definition by its id. */
export const gameMap: Record<string, GameDefinition> = Object.fromEntries(
	gameRegistry.map((def) => [def.id, def]),
);

/** Register a game at runtime so external projects can add their own games. */
export function registerGame(def: GameDefinition): void {
	if (gameMap[def.id]) return;
	gameRegistry.push(def);
	gameMap[def.id] = def;
}
