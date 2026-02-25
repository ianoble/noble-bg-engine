<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { saveSession } from '@noble/bg-engine/client';
import { gameDef } from '../logic/game-logic';

const SERVER_URL = 'http://localhost:8000';

const router = useRouter();

const playerName = ref(localStorage.getItem('bgf:playerName') ?? '');
const numPlayers = ref(gameDef.minPlayers);
const creating = ref(false);
const errorMsg = ref('');
const createdMatchID = ref<string | null>(null);
const linkCopied = ref(false);
const players = ref<Array<{ id: number; name?: string }>>([]);

let pollTimer: ReturnType<typeof setInterval> | null = null;

const allSeatsFilled = computed(() =>
	players.value.length > 0 && players.value.every((p) => p.name),
);

const filledCount = computed(() => players.value.filter((p) => p.name).length);

function persistName(): string {
	const name = playerName.value.trim() || 'Player';
	localStorage.setItem('bgf:playerName', name);
	return name;
}

async function createMatch() {
	creating.value = true;
	errorMsg.value = '';
	createdMatchID.value = null;

	try {
		const name = persistName();

		const createRes = await fetch(`${SERVER_URL}/games/${gameDef.id}/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ numPlayers: numPlayers.value }),
		});
		if (!createRes.ok) throw new Error('Server rejected match creation');
		const { matchID } = (await createRes.json()) as { matchID: string };

		const joinRes = await fetch(`${SERVER_URL}/games/${gameDef.id}/${matchID}/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerID: '0', playerName: name }),
		});
		if (!joinRes.ok) throw new Error('Failed to claim host seat');
		const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

		saveSession(gameDef.id, matchID, {
			playerID: '0',
			credentials: playerCredentials,
			playerName: name,
		});

		createdMatchID.value = matchID;
		startPolling(matchID);
	} catch (e: unknown) {
		errorMsg.value = e instanceof Error ? e.message : 'Failed to create match';
	} finally {
		creating.value = false;
	}
}

function startPolling(matchID: string) {
	stopPolling();
	pollMatch(matchID);
	pollTimer = setInterval(() => pollMatch(matchID), 2000);
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

async function pollMatch(matchID: string) {
	try {
		const res = await fetch(`${SERVER_URL}/games/${gameDef.id}/${matchID}`);
		if (!res.ok) return;
		const data = (await res.json()) as { players: Array<{ id: number; name?: string }> };
		players.value = data.players;
	} catch {
		// silent — will retry
	}
}

function inviteLink(): string {
	if (!createdMatchID.value) return '';
	return `${window.location.origin}/join/${createdMatchID.value}`;
}

async function copyLink() {
	try {
		await navigator.clipboard.writeText(inviteLink());
		linkCopied.value = true;
		setTimeout(() => { linkCopied.value = false; }, 2000);
	} catch {
		errorMsg.value = 'Clipboard access denied';
	}
}

function startGame() {
	if (!createdMatchID.value) return;
	stopPolling();
	router.push(`/game/${createdMatchID.value}/0`);
}

onUnmounted(stopPolling);
</script>

<template>
	<div class="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
		<div class="w-full max-w-md space-y-6">
			<h1 class="text-3xl font-bold text-center">{{ gameDef.displayName }}</h1>

			<!-- Name input -->
			<div class="space-y-2">
				<label class="block text-sm font-medium text-slate-400">Your Name</label>
				<input
					v-model="playerName"
					placeholder="Enter your name"
					maxlength="24"
					class="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
				/>
			</div>

			<!-- Pre-creation: player count + create button -->
			<template v-if="!createdMatchID">
				<div class="space-y-2">
					<label class="block text-sm font-medium text-slate-400">Number of Players</label>
					<div class="flex items-center gap-3">
						<button
							class="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-lg font-bold hover:bg-slate-700 transition-colors disabled:opacity-40"
							:disabled="numPlayers <= gameDef.minPlayers"
							@click="numPlayers--"
						>
							-
						</button>
						<span class="text-2xl font-bold w-8 text-center">{{ numPlayers }}</span>
						<button
							class="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-lg font-bold hover:bg-slate-700 transition-colors disabled:opacity-40"
							:disabled="numPlayers >= gameDef.maxPlayers"
							@click="numPlayers++"
						>
							+
						</button>
						<span class="text-sm text-slate-500 ml-2">
							({{ gameDef.minPlayers }}–{{ gameDef.maxPlayers }})
						</span>
					</div>
				</div>

				<button
					class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					:disabled="creating || !playerName.trim()"
					@click="createMatch"
				>
					{{ creating ? 'Creating...' : 'Create Game' }}
				</button>
			</template>

			<!-- Post-creation: invite link, player list, start button -->
			<template v-if="createdMatchID">
				<div class="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-3">
					<p class="text-sm font-medium text-green-400">Game created!</p>

					<div class="space-y-1">
						<label class="block text-xs text-slate-500">Invite Link</label>
						<div class="flex gap-2">
							<code class="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-blue-400 truncate">
								{{ inviteLink() }}
							</code>
							<button
								class="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
								@click="copyLink"
							>
								{{ linkCopied ? 'Copied!' : 'Copy' }}
							</button>
						</div>
					</div>

					<div class="space-y-1">
						<label class="block text-xs text-slate-500">Match ID</label>
						<code class="block px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300">
							{{ createdMatchID }}
						</code>
					</div>
				</div>

				<!-- Player list -->
				<div class="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-slate-400">Players</span>
						<span class="text-sm text-slate-500">{{ filledCount }} / {{ players.length }}</span>
					</div>
					<ul class="space-y-2">
						<li
							v-for="p in players"
							:key="p.id"
							class="flex items-center gap-3 px-3 py-2 bg-slate-900 rounded-lg"
						>
							<span
								class="w-2 h-2 rounded-full"
								:class="p.name ? 'bg-green-400' : 'bg-slate-600'"
							/>
							<span class="text-sm" :class="p.name ? 'text-white' : 'text-slate-600'">
								{{ p.name || 'Waiting...' }}
							</span>
							<span v-if="p.id === 0" class="ml-auto text-xs text-slate-500">Host</span>
						</li>
					</ul>
				</div>

				<button
					class="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					:disabled="!allSeatsFilled"
					@click="startGame"
				>
					{{ allSeatsFilled ? 'Start Game' : `Waiting for players (${filledCount}/${players.length})...` }}
				</button>
			</template>

			<p v-if="errorMsg" class="text-sm text-red-400 text-center">{{ errorMsg }}</p>
		</div>
	</div>
</template>
