<script setup lang="ts">
import { ref, computed } from 'vue';
import {
	useGame,
	SquareGrid,
	PieceToken,
	ResourceCounter,
	TrackMeter,
	SlotArea,
	getResource,
	type GamePiece,
} from '@noble/bg-engine/client';
import { gameDef, type SamplerState } from '../logic/game-logic';

const { state, isMyTurn, move, playerID } = useGame();

type ActionMode = 'reveal' | 'claim';
const mode = ref<ActionMode>('reveal');

const G = computed(() => state.value as unknown as SamplerState | undefined);
const myPlayer = computed(() => G.value?.players[playerID.value ?? '0']);
const gold = computed(() => myPlayer.value ? getResource(myPlayer.value.resources, 'gold') : 0);
const goldLimit = computed(() => myPlayer.value?.resources.limits?.gold);

const revealableCells = computed<[number, number][]>(() => {
	const board = G.value?.board;
	if (!board) return [];
	const cells: [number, number][] = [];
	for (let r = 0; r < board.rows; r++) {
		for (let c = 0; c < board.cols; c++) {
			if (board.cells[r][c].faceDown) cells.push([r, c]);
		}
	}
	return cells;
});

const claimableCells = computed<[number, number][]>(() => {
	const board = G.value?.board;
	if (!board || gold.value < 2) return [];
	const cells: [number, number][] = [];
	for (let r = 0; r < board.rows; r++) {
		for (let c = 0; c < board.cols; c++) {
			const cell = board.cells[r][c];
			if (!cell.faceDown && cell.pieces.length === 0) cells.push([r, c]);
		}
	}
	return cells;
});

const validCells = computed(() => mode.value === 'reveal' ? revealableCells.value : claimableCells.value);

function onCellClick(row: number, col: number) {
	if (!isMyTurn.value) return;
	if (mode.value === 'reveal') {
		move('revealTile', row, col);
	} else {
		move('claimTile', row, col);
	}
}
</script>

<template>
	<div v-if="G" class="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
		<h2 class="text-xl font-semibold">{{ gameDef.displayName }}</h2>

		<!-- Action mode toggle -->
		<div class="flex gap-2">
			<button
				class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
				:class="mode === 'reveal'
					? 'bg-blue-600 text-white'
					: 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'"
				:disabled="!isMyTurn"
				@click="mode = 'reveal'"
			>
				Reveal Tile (+1 gold)
			</button>
			<button
				class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
				:class="mode === 'claim'
					? 'bg-green-600 text-white'
					: 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'"
				:disabled="!isMyTurn || gold < 2"
				@click="mode = 'claim'"
			>
				Claim Tile (-2 gold)
			</button>
		</div>

		<!-- Board -->
		<div class="p-4 bg-slate-800 border border-slate-700 rounded-xl">
			<SquareGrid
				:board="G.board"
				:cell-size="72"
				:valid-cells="isMyTurn ? validCells : []"
				@cell-click="onCellClick"
			>
				<template #cell="{ cell }">
					<div
						v-if="cell.faceDown"
						class="w-full h-full flex items-center justify-center bg-slate-700 rounded text-2xl font-bold text-slate-500 select-none"
					>
						?
					</div>
					<div
						v-else-if="cell.pieces.length > 0"
						class="w-full h-full flex items-center justify-center bg-slate-900/50 rounded"
					>
						<PieceToken :piece="(cell.pieces[0] as GamePiece)" :size="36" />
					</div>
					<div
						v-else
						class="w-full h-full flex items-center justify-center bg-slate-600/30 rounded"
					/>
				</template>
			</SquareGrid>
		</div>

		<!-- Player panel -->
		<div v-if="myPlayer" class="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-4">
			<h3 class="text-sm font-medium text-slate-400">Your Status</h3>

			<div class="flex flex-wrap items-center gap-4">
				<ResourceCounter name="gold" :amount="gold" :limit="goldLimit" />
				<TrackMeter :track="myPlayer.score" orientation="horizontal" />
			</div>

			<SlotArea :slot="myPlayer.claimed" direction="row">
				<template #item="{ item }">
					<PieceToken :piece="(item as GamePiece)" :size="24" />
				</template>
			</SlotArea>
		</div>

		<!-- All players overview -->
		<div class="w-full grid gap-3" :style="{ gridTemplateColumns: `repeat(${Object.keys(G.players).length}, 1fr)` }">
			<div
				v-for="(p, pid) in G.players"
				:key="pid"
				class="p-3 bg-slate-800 border rounded-lg text-center text-sm"
				:class="pid === playerID ? 'border-blue-500' : 'border-slate-700'"
			>
				<p class="font-medium" :class="pid === playerID ? 'text-blue-400' : 'text-slate-300'">
					Player {{ pid }}
				</p>
				<p class="text-slate-500 text-xs mt-1">
					Score {{ p.score.position }}/{{ p.score.max }} &middot; Gold {{ getResource(p.resources, 'gold') }}
				</p>
			</div>
		</div>
	</div>
</template>
