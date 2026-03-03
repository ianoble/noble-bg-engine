import {
	defineGame,
	INVALID_MOVE,
	type BaseGameState,
	type Game,
	type Ctx,
} from '@noble/bg-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

export interface CompileGameState extends BaseGameState {
	players: Record<string, { color: PlayerColor; score: number }>;
	endGameScored: boolean;
	endGameScoreBreakdown: Record<string, { label: string; vp: number }[]>;
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export const CompileGame: Game<CompileGameState> = {
	name: 'compile',

	setup: (ctx): CompileGameState => {
		const players: Record<string, { color: PlayerColor; score: number }> = {};
		for (let i = 0; i < ctx.numPlayers; i++) {
			players[String(i)] = {
				color: PLAYER_COLORS[i % PLAYER_COLORS.length],
				score: 0,
			};
		}
		return {
			players,
			endGameScored: false,
			endGameScoreBreakdown: {},
			history: [],
		};
	},

	moves: {
		setPlayerColor: ({ G, ctx }: { G: CompileGameState; ctx: Ctx }, color: PlayerColor) => {
			if (!PLAYER_COLORS.includes(color)) return INVALID_MOVE;
			const pid = ctx.playerID;
			if (pid && G.players[pid]) {
				G.players[pid].color = color;
			}
		},
	},

	endIf: ({ G }: { G: CompileGameState }) => {
		if (!G.endGameScored) return undefined;
		const pids = Object.keys(G.players);
		const scores = pids.map((pid) => G.players[pid].score);
		const maxScore = Math.max(...scores);
		const winners = pids.filter((pid) => G.players[pid].score === maxScore);
		if (winners.length === 1) return { winner: winners[0] };
		if (winners.length > 1) return { isDraw: true };
		return undefined;
	},

	turn: {
		minMoves: 0,
		maxMoves: 1,
	},
};

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export const gameDef = defineGame<CompileGameState>({
	game: CompileGame,
	id: 'compile',
	displayName: 'Compile',
	description: 'A clone of the Compile card game.',
	minPlayers: 2,
	maxPlayers: 4,

	validateMove({ playerID, currentPlayer }, moveName) {
		if (playerID !== currentPlayer && moveName !== 'setPlayerColor') return 'Not your turn';
		return true;
	},
});
