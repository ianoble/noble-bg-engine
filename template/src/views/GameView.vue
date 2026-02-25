<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useGame, loadSession } from '@noble/bg-engine/client';
import { gameDef } from '../logic/game-logic';
import GameBoard from '../components/GameBoard.vue';

const props = defineProps<{ matchID: string; playerID: string }>();

const { isConnected, isMyTurn, gameover, reconnecting, connect, disconnect } = useGame();

onMounted(() => {
	const session = loadSession(gameDef.id, props.matchID);
	const creds = session?.playerID === props.playerID ? session.credentials : undefined;
	connect(gameDef.id, props.matchID, props.playerID, creds);
});

onUnmounted(() => disconnect());
</script>

<template>
	<div class="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6">
		<!-- Status bar -->
		<div class="flex gap-3 flex-wrap justify-center mb-6">
			<span class="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs">
				{{ gameDef.displayName }}
			</span>
			<span class="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs">
				Match <code class="text-blue-400">{{ matchID }}</code>
			</span>
			<span class="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs">
				Player <strong>{{ playerID }}</strong>
			</span>
			<span
				class="px-3 py-1 rounded-full text-xs"
				:class="isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'"
			>
				{{ isConnected ? 'Connected' : 'Connecting...' }}
			</span>
		</div>

		<!-- Reconnecting overlay -->
		<div v-if="reconnecting" class="text-center mb-6">
			<p class="text-slate-400">Reconnecting...</p>
		</div>

		<!-- Game board -->
		<GameBoard v-if="!reconnecting" />

		<!-- Game over / turn hint -->
		<div class="mt-6 text-center">
			<template v-if="gameover">
				<p v-if="gameover.winner === playerID" class="text-2xl font-bold text-green-400">You win!</p>
				<p v-else-if="gameover.winner !== undefined" class="text-2xl font-bold text-red-400">You lose.</p>
				<p v-else class="text-2xl font-bold text-slate-400">It's a draw.</p>
			</template>
			<p v-else-if="!reconnecting" class="text-sm text-slate-500">
				{{ isMyTurn ? "Your turn" : "Waiting for opponent..." }}
			</p>
		</div>

		<div class="mt-6">
			<router-link to="/" class="text-sm text-slate-500 hover:text-slate-300 transition-colors">
				&larr; Back to lobby
			</router-link>
		</div>
	</div>
</template>
