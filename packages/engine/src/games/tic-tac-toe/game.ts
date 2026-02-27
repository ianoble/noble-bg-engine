import type { Game, Ctx } from 'boardgame.io';
import type { TicTacToeState } from './types.js';

const INVALID_MOVE = 'INVALID_MOVE';

function checkWinner(cells: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const [a, b, c] of lines) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a];
    }
  }
  return null;
}

export const TicTacToe: Game<TicTacToeState> = {
  name: 'tic-tac-toe',

  setup: (): TicTacToeState => ({
    cells: Array(9).fill(null),
    winner: undefined,
    isDraw: false,
    history: [],
  }),

  moves: {
    clickCell: ({ G, ctx }: { G: TicTacToeState; ctx: Ctx }, cellIndex: number) => {
      if (G.cells[cellIndex] !== null) return INVALID_MOVE;
      G.cells[cellIndex] = ctx.currentPlayer === '0' ? 'X' : 'O';
    },
  },

  endIf: ({ G }: { G: TicTacToeState }) => {
    const symbol = checkWinner(G.cells);
    if (symbol) {
      return { winner: symbol === 'X' ? '0' : '1' };
    }
    if (G.cells.every((c) => c !== null)) {
      return { isDraw: true };
    }
    return undefined;
  },

  turn: {
    minMoves: 1,
    maxMoves: 1,
  },
};
