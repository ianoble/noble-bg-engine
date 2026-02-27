<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { gameMap } from '@noble/bg-engine';
import { IconLoader2 } from '@tabler/icons-vue';
import { saveSession, loadSession } from '@noble/bg-engine/client';

const props = defineProps<{ gameId: string; matchID: string }>();
const router = useRouter();

const SERVER = 'http://localhost:8000';
const status = ref<'loading' | 'error'>('loading');
const errorMsg = ref('');

onMounted(async () => {
  const def = gameMap[props.gameId];
  if (!def) {
    status.value = 'error';
    errorMsg.value = `Unknown game: ${props.gameId}`;
    return;
  }

  const existing = loadSession(props.gameId, props.matchID);
  if (existing) {
    router.replace(`/game/${props.gameId}/${props.matchID}/${existing.playerID}`);
    return;
  }

  try {
    const matchRes = await fetch(`${SERVER}/games/${props.gameId}/${props.matchID}`);
    if (!matchRes.ok) throw new Error('Match not found');
    const matchData = (await matchRes.json()) as {
      players: Array<{ id: number; name?: string }>;
    };

    const openSeat = matchData.players.find((p) => !p.name);
    if (!openSeat) throw new Error('No open seats — the match is full');

    const seatID = String(openSeat.id);
    const name = localStorage.getItem('bgf:playerName') || 'Player';

    const joinRes = await fetch(`${SERVER}/games/${props.gameId}/${props.matchID}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerID: seatID, playerName: name }),
    });
    if (!joinRes.ok) throw new Error('Failed to claim seat');
    const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

    saveSession(props.gameId, props.matchID, {
      playerID: seatID,
      credentials: playerCredentials,
      playerName: name,
    });

    router.replace(`/game/${props.gameId}/${props.matchID}/${seatID}`);
  } catch (e: unknown) {
    status.value = 'error';
    errorMsg.value = e instanceof Error ? e.message : 'Failed to join match';
  }
});
</script>

<template>
  <div class="join-view">
    <template v-if="status === 'loading'">
      <IconLoader2 :size="32" class="spin" />
      <p class="join-text">Joining match&hellip;</p>
    </template>
    <template v-else>
      <p class="join-error">{{ errorMsg }}</p>
      <router-link to="/" class="back-link">&larr; Back to lobby</router-link>
    </template>
  </div>
</template>

<style scoped>
.join-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 40vh;
}

.spin {
  color: var(--accent-hover);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.join-text {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.join-error {
  color: var(--danger);
  font-size: 0.95rem;
  font-weight: 500;
}

.back-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.15s;
}

.back-link:hover {
  color: var(--accent-hover);
}
</style>
