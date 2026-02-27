<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useGame, loadSession, GameLog } from '@noble/bg-engine/client';
import { boardComponents } from '../games/registry.js';
import { gameMap } from '@noble/bg-engine';
import { IconLoader2 } from '@tabler/icons-vue';

const props = defineProps<{ gameId: string; matchID: string; playerID: string }>();
const game = useGame();
const { isConnected, isMyTurn: myTurn, gameover: gameoverState, reconnecting } = game;

const BoardComponent = computed(() => boardComponents[props.gameId]);
const gameDef = computed(() => gameMap[props.gameId]);

onMounted(() => {
  const session = loadSession(props.gameId, props.matchID);
  const creds = session?.playerID === props.playerID ? session.credentials : undefined;
  game.connect(props.gameId, props.matchID, props.playerID, creds);
});

onUnmounted(() => game.disconnect());
</script>

<template>
  <div class="game-layout">
    <div class="game-main">
      <!-- Reconnecting overlay -->
      <Transition name="fade">
        <div v-if="reconnecting" class="reconnecting-overlay">
          <div class="reconnecting-card">
            <IconLoader2 :size="28" class="spin" />
            <span class="reconnecting-text">Reconnecting&hellip;</span>
            <span class="reconnecting-hint">Restoring your session</span>
          </div>
        </div>
      </Transition>

      <div class="status-bar">
        <span class="badge">{{ gameDef?.displayName }}</span>
        <span class="badge">Match <code>{{ matchID }}</code></span>
        <span class="badge">Player <strong>{{ playerID }}</strong></span>
        <span :class="['indicator', isConnected ? 'connected' : 'disconnected']">
          {{ isConnected ? 'Connected' : 'Connecting…' }}
        </span>
      </div>

      <component :is="BoardComponent" v-if="BoardComponent && !reconnecting" />
      <p v-else-if="!BoardComponent && !reconnecting" class="error">
        No board component registered for "{{ gameId }}"
      </p>

      <div v-if="gameoverState" class="gameover-banner">
        <template v-if="gameoverState.winner !== undefined">
          <span v-if="gameoverState.winner === playerID" class="win">You win!</span>
          <span v-else class="lose">You lose.</span>
        </template>
        <span v-else class="draw">It's a draw.</span>
      </div>

      <p v-else-if="!reconnecting" class="turn-hint">
        {{ myTurn ? "Your turn" : "Waiting for opponent…" }}
      </p>

      <div class="bottom-row">
        <router-link to="/" class="back-link">&larr; Back to lobby</router-link>
      </div>
    </div>

    <!-- GameLog renders: mobile toggle + teleported sidebar + desktop panel -->
    <GameLog />
  </div>
</template>

<style scoped>
.game-layout {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  align-items: flex-start;
}

.game-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: 480px;
}

/* --- reconnecting --- */
.reconnecting-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 17, 23, 0.8);
  backdrop-filter: blur(4px);
  border-radius: 12px;
}

.reconnecting-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2rem;
}

.reconnecting-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.reconnecting-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.spin {
  color: var(--accent-hover);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* --- status --- */
.status-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.badge {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
}

.badge code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-hover);
}

.indicator {
  font-size: 0.8rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
}

.connected {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

.disconnected {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.error {
  color: var(--danger);
  font-size: 0.9rem;
}

.gameover-banner {
  font-size: 1.5rem;
  font-weight: 700;
}

.win { color: var(--success); }
.lose { color: var(--danger); }
.draw { color: var(--text-muted); }

.turn-hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.bottom-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
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

/* --- fade transition --- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
