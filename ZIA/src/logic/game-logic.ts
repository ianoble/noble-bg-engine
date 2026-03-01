import type { Game, Ctx } from 'boardgame.io';
import { defineGame } from '@engine/client';
import type { BaseGameState } from '@engine/client';
import { INVALID_MOVE } from 'boardgame.io/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

export type CellValue = 'X' | 'O' | null;

export interface TemplateGameState extends BaseGameState {
	cells: CellValue[];
	players: Record<string, { color: PlayerColor; score: number }>;
	winner: string | undefined;
	isDraw: boolean;
	endGameScored: boolean;
	endGameScoreBreakdown: Record<string, { label: string; vp: number }[]>;
}

// ---------------------------------------------------------------------------
// Game logic
// ---------------------------------------------------------------------------

function checkWinner(cells: CellValue[]): string | null {
	const lines = [
		[0, 1, 2], [3, 4, 5], [6, 7, 8],
		[0, 3, 6], [1, 4, 7], [2, 5, 8],
		[0, 4, 8], [2, 4, 6],
	];
	for (const [a, b, c] of lines) {
		if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
			return cells[a] === 'X' ? '0' : '1';
		}
	}
	return null;
}

export const TemplateGame: Game<TemplateGameState> = {
	name: 'template-game',

	setup: (ctx): TemplateGameState => {
		const players: Record<string, { color: PlayerColor; score: number }> = {};
		for (let i = 0; i < ctx.numPlayers; i++) {
			players[String(i)] = { color: PLAYER_COLORS[i % PLAYER_COLORS.length], score: 0 };
		}
		return {
			cells: Array(9).fill(null),
			players,
			winner: undefined,
			isDraw: false,
			endGameScored: false,
			endGameScoreBreakdown: {},
			history: [],
		};
	},

	moves: {
		setPlayerColor: ({ G, ctx }: { G: TemplateGameState; ctx: Ctx }, color: PlayerColor) => {
			if (!PLAYER_COLORS.includes(color)) return INVALID_MOVE;
			const pid = ctx.playerID;
			if (pid && G.players[pid]) {
				G.players[pid].color = color;
			}
		},
		clickCell: ({ G, ctx }: { G: TemplateGameState; ctx: Ctx }, cellIndex: number) => {
			if (cellIndex < 0 || cellIndex > 8 || G.cells[cellIndex] !== null) return INVALID_MOVE;
			G.cells[cellIndex] = ctx.currentPlayer === '0' ? 'X' : 'O';
			const winner = checkWinner(G.cells);
			const isDraw = G.cells.every((c) => c !== null) && !winner;
			if (winner || isDraw) {
				G.endGameScored = true;
				const pids = Object.keys(G.players);
				for (const pid of pids) {
					G.players[pid].score = winner === pid ? 1 : 0;
					if (isDraw) G.players[pid].score = 0;
				}
				G.endGameScoreBreakdown = {};
				for (const pid of pids) {
					G.endGameScoreBreakdown[pid] = [
						{ label: 'Score during game', vp: 0 },
						{ label: 'Final score', vp: G.players[pid].score },
					];
				}
				if (winner) G.winner = winner;
				if (isDraw) G.isDraw = true;
			}
		},
	},

	endIf: ({ G }: { G: TemplateGameState }) => {
		if (G.endGameScored) return G.winner ? { winner: G.winner } : G.isDraw ? { isDraw: true } : undefined;
		const winner = checkWinner(G.cells);
		if (winner) return { winner };
		if (G.cells.every((c) => c !== null)) return { isDraw: true };
		return undefined;
	},

	turn: {
		minMoves: 1,
		maxMoves: 1,
	},
};

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export const gameDef = defineGame<TemplateGameState>({
	game: TemplateGame,
	id: 'template-game',
	displayName: 'Template Game',
	description: 'Minimal game scaffold. Replace logic and board to build your game.',
	minPlayers: 2,
	maxPlayers: 4,

	validateMove({ G, playerID, currentPlayer }, moveName, ...args) {
		if (playerID !== currentPlayer && moveName !== 'setPlayerColor') return 'Not your turn';
		if (moveName === 'setPlayerColor') {
			const color = args[0];
			if (!PLAYER_COLORS.includes(color as PlayerColor)) return 'Invalid color';
			return true;
		}
		if (moveName === 'clickCell') {
			const cellIndex = args[0];
			if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) return 'Invalid cell';
			if (G.cells[cellIndex] !== null) return 'Cell already occupied';
			return true;
		}
		return true;
	},
});

/** Rankings for the final score table (by score desc). */
export function getPlayerRankings(G: TemplateGameState): { playerId: string; score: number; cities: number }[] {
	const rankings = Object.keys(G.players).map((pid) => ({
		playerId: pid,
		score: G.players[pid].score,
		cities: 0,
	}));
	rankings.sort((a, b) => b.score - a.score);
	return rankings;
}
