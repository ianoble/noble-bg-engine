<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { saveSession, loadSession } from '@noble/bg-engine/client';
import { gameDef } from '../logic/game-logic';

const SERVER_URL = 'http://localhost:8000';

const props = defineProps<{ matchID: string }>();
const router = useRouter();

const playerName = ref(localStorage.getItem('bgf:playerName') ?? '');
const status = ref<'name' | 'joining' | 'error'>('name');
const errorMsg = ref('');

onMounted(() => {
	const existing = loadSession(gameDef.id, props.matchID);
	if (existing) {
		router.replace(`/game/${props.matchID}/${existing.playerID}`);
	}
});

function persistName(): string {
	const name = playerName.value.trim() || 'Player';
	localStorage.setItem('bgf:playerName', name);
	return name;
}

async function joinMatch() {
	if (!playerName.value.trim()) return;
	status.value = 'joining';
	errorMsg.value = '';

	try {
		const name = persistName();

		const matchRes = await fetch(`${SERVER_URL}/games/${gameDef.id}/${props.matchID}`);
		if (!matchRes.ok) throw new Error('Match not found');
		const matchData = (await matchRes.json()) as {
			players: Array<{ id: number; name?: string }>;
		};

		const openSeat = matchData.players.find((p) => !p.name);
		if (!openSeat) throw new Error('No open seats — the match is full');
		const seatID = String(openSeat.id);

		const joinRes = await fetch(`${SERVER_URL}/games/${gameDef.id}/${props.matchID}/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerID: seatID, playerName: name }),
		});
		if (!joinRes.ok) throw new Error('Failed to claim seat');
		const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

		saveSession(gameDef.id, props.matchID, {
			playerID: seatID,
			credentials: playerCredentials,
			playerName: name,
		});

		router.replace(`/game/${props.matchID}/${seatID}`);
	} catch (e: unknown) {
		status.value = 'error';
		errorMsg.value = e instanceof Error ? e.message : 'Failed to join match';
	}
}
</script>

<template>
	<div class="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
		<div class="w-full max-w-sm space-y-6">
			<h1 class="text-2xl font-bold text-center">Join {{ gameDef.displayName }}</h1>
			<p class="text-sm text-slate-400 text-center">Match: <code class="text-blue-400">{{ matchID }}</code></p>

			<template v-if="status === 'joining'">
				<p class="text-center text-slate-400">Joining match...</p>
			</template>

			<template v-else>
				<div class="space-y-2">
					<label class="block text-sm font-medium text-slate-400">Your Name</label>
					<input
						v-model="playerName"
						placeholder="Enter your name"
						maxlength="24"
						class="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
						@keyup.enter="joinMatch"
					/>
				</div>

				<button
					class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					:disabled="!playerName.trim()"
					@click="joinMatch"
				>
					Join Game
				</button>
			</template>

			<p v-if="errorMsg" class="text-sm text-red-400 text-center">{{ errorMsg }}</p>

			<div class="text-center">
				<router-link to="/" class="text-sm text-slate-500 hover:text-slate-300 transition-colors">
					&larr; Back to lobby
				</router-link>
			</div>
		</div>
	</div>
</template>
