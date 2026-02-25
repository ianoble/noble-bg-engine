import {
	defineGame,
	INVALID_MOVE,
	createSquareBoard,
	getSquareCell,
	flipCell,
	placePiece,
	createResourcePool,
	addResource,
	removeResource,
	hasResource,
	createTrack,
	advanceTrack,
	createSlot,
	addToSlot,
	type BaseGameState,
	type Game,
	type Ctx,
	type SquareBoard,
	type GamePiece,
	type ResourcePool,
	type Track,
	type Slot,
} from '@noble/bg-engine/client';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SamplerPlayerState {
	resources: ResourcePool;
	score: Track;
	claimed: Slot<GamePiece>;
}

export interface SamplerState extends BaseGameState {
	board: SquareBoard<GamePiece>;
	players: Record<string, SamplerPlayerState>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOARD_SIZES: Record<number, [number, number]> = {
	2: [3, 3],
	3: [4, 3],
	4: [4, 4],
};

function targetScore(totalCells: number, numPlayers: number): number {
	return Math.floor(totalCells / numPlayers);
}

let pieceCounter = 0;

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

const SamplerGame: Game<SamplerState> = {
	name: '__GAME_ID__',

	setup: ({ ctx }: { ctx: Ctx }): SamplerState => {
		const [rows, cols] = BOARD_SIZES[ctx.numPlayers] ?? [3, 3];
		const total = rows * cols;
		const goal = targetScore(total, ctx.numPlayers);

		const board = createSquareBoard<GamePiece>(rows, cols, () => ({
			pieces: [],
			faceDown: true,
		}));

		const players: Record<string, SamplerPlayerState> = {};
		for (let i = 0; i < ctx.numPlayers; i++) {
			players[String(i)] = {
				resources: createResourcePool({ gold: 0 }),
				score: createTrack(0, goal, 0, 'Score'),
				claimed: createSlot<GamePiece>(goal, 'Claimed'),
			};
		}

		pieceCounter = 0;

		return { board, players, history: [] };
	},

	moves: {
		revealTile: ({ G, ctx }: { G: SamplerState; ctx: Ctx }, row: number, col: number) => {
			const cell = getSquareCell(G.board, row, col);
			if (!cell) return INVALID_MOVE;
			if (!cell.faceDown) return INVALID_MOVE;

			flipCell(G.board, row, col, false);
			addResource(G.players[ctx.currentPlayer].resources, 'gold', 1);
		},

		claimTile: ({ G, ctx }: { G: SamplerState; ctx: Ctx }, row: number, col: number) => {
			const cell = getSquareCell(G.board, row, col);
			if (!cell) return INVALID_MOVE;
			if (cell.faceDown) return INVALID_MOVE;
			if (cell.pieces.length > 0) return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!hasResource(player.resources, 'gold', 2)) return INVALID_MOVE;

			removeResource(player.resources, 'gold', 2);

			const piece: GamePiece = {
				id: `p${pieceCounter++}`,
				type: 'claim',
				owner: ctx.currentPlayer,
			};

			placePiece(G.board, row, col, piece);
			addToSlot(player.claimed, piece);
			advanceTrack(player.score, 1);
		},
	},

	endIf: ({ G }: { G: SamplerState }) => {
		for (const [pid, p] of Object.entries(G.players)) {
			if (p.score.position >= p.score.max) {
				return { winner: pid };
			}
		}
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

export const gameDef = defineGame<SamplerState>({
	game: SamplerGame,
	id: '__GAME_ID__',
	displayName: '__GAME_TITLE__',
	description: 'A feature sampler showcasing boards, resources, tracks, and slots.',
	minPlayers: 2,
	maxPlayers: 4,
});
