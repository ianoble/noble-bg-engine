<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { gameRegistry } from '@noble/bg-engine';
import type { GameDefinition } from '@noble/bg-engine';
import { Copy, Check, Plus, LogIn } from 'lucide-vue-next';
import { saveSession } from '@noble/bg-engine/client';

const router = useRouter();
const SERVER = 'http://localhost:8000';

const selectedGame = ref<GameDefinition | null>(null);
const playerName = ref(localStorage.getItem('bgf:playerName') ?? '');
const creating = ref(false);
const joining = ref(false);
const joinMatchID = ref('');
const errorMsg = ref('');
const createdMatchID = ref<string | null>(null);
const linkCopied = ref(false);

const showMatchActions = computed(() => selectedGame.value !== null);

function selectGame(def: GameDefinition) {
  selectedGame.value = def;
  errorMsg.value = '';
  joinMatchID.value = '';
  createdMatchID.value = null;
}

function persistName() {
  const name = playerName.value.trim() || 'Player';
  localStorage.setItem('bgf:playerName', name);
  return name;
}

async function createMatch() {
  if (!selectedGame.value) return;
  creating.value = true;
  errorMsg.value = '';
  createdMatchID.value = null;

  try {
    const gId = selectedGame.value.id;
    const name = persistName();

    const createRes = await fetch(`${SERVER}/games/${gId}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numPlayers: selectedGame.value.maxPlayers }),
    });
    if (!createRes.ok) throw new Error('Server rejected match creation');
    const { matchID } = (await createRes.json()) as { matchID: string };

    const joinRes = await fetch(`${SERVER}/games/${gId}/${matchID}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerID: '0', playerName: name }),
    });
    if (!joinRes.ok) throw new Error('Failed to claim seat');
    const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

    saveSession(gId, matchID, { playerID: '0', credentials: playerCredentials, playerName: name });
    createdMatchID.value = matchID;
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to create match';
  } finally {
    creating.value = false;
  }
}

function matchLink(matchID: string): string {
  const gId = selectedGame.value!.id;
  return `${window.location.origin}/join/${gId}/${matchID}`;
}

async function copyLink() {
  if (!createdMatchID.value) return;
  try {
    await navigator.clipboard.writeText(matchLink(createdMatchID.value));
    linkCopied.value = true;
    setTimeout(() => { linkCopied.value = false; }, 2000);
  } catch {
    errorMsg.value = 'Clipboard access denied';
  }
}

function enterMatch(gId: string, matchID: string, playerID: string) {
  router.push(`/game/${gId}/${matchID}/${playerID}`);
}

function goToCreatedMatch() {
  if (!createdMatchID.value || !selectedGame.value) return;
  enterMatch(selectedGame.value.id, createdMatchID.value, '0');
}

async function joinMatch() {
  if (!selectedGame.value || !joinMatchID.value.trim()) return;
  joining.value = true;
  errorMsg.value = '';

  try {
    const gId = selectedGame.value.id;
    const mID = joinMatchID.value.trim();
    const name = persistName();

    const matchRes = await fetch(`${SERVER}/games/${gId}/${mID}`);
    if (!matchRes.ok) throw new Error('Match not found');
    const matchData = (await matchRes.json()) as {
      players: Array<{ id: number; name?: string }>;
    };

    const openSeat = matchData.players.find((p) => !p.name);
    if (!openSeat) throw new Error('No open seats in this match');
    const seatID = String(openSeat.id);

    const joinRes = await fetch(`${SERVER}/games/${gId}/${mID}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerID: seatID, playerName: name }),
    });
    if (!joinRes.ok) throw new Error('Failed to claim seat');
    const { playerCredentials } = (await joinRes.json()) as { playerCredentials: string };

    saveSession(gId, mID, { playerID: seatID, credentials: playerCredentials, playerName: name });
    enterMatch(gId, mID, seatID);
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to join match';
  } finally {
    joining.value = false;
  }
}
</script>

<template>
  <div class="lobby">
    <section class="card">
      <h2>Choose a Game</h2>
      <div class="game-grid">
        <button
          v-for="def in gameRegistry"
          :key="def.id"
          class="game-card"
          :class="{ selected: selectedGame?.id === def.id }"
          @click="selectGame(def)"
        >
          <strong>{{ def.displayName }}</strong>
          <span class="desc">{{ def.description }}</span>
          <span class="meta">{{ def.minPlayers }}–{{ def.maxPlayers }} players</span>
        </button>
      </div>
    </section>

    <section v-if="showMatchActions" class="card">
      <h2>Your Name</h2>
      <input
        v-model="playerName"
        placeholder="Enter your name"
        class="input full"
        maxlength="24"
      />
    </section>

    <template v-if="showMatchActions">
      <section class="card">
        <h2>New Match</h2>
        <p class="hint">Create a <strong>{{ selectedGame!.displayName }}</strong> room and invite a friend.</p>
        <button class="btn-primary" :disabled="creating" @click="createMatch">
          <Plus :size="16" />
          {{ creating ? 'Creating…' : 'Create Room' }}
        </button>

        <div v-if="createdMatchID" class="created-box">
          <p class="created-label">Room created!</p>
          <div class="link-row">
            <code class="match-code">{{ createdMatchID }}</code>
            <button class="btn-icon" :title="linkCopied ? 'Copied!' : 'Copy invite link'" @click="copyLink">
              <Check v-if="linkCopied" :size="16" class="icon-success" />
              <Copy v-else :size="16" />
            </button>
          </div>
          <button class="btn-primary" @click="goToCreatedMatch">Enter Room</button>
        </div>
      </section>

      <section class="card">
        <h2>Join a Room</h2>
        <p class="hint">Paste the match ID or use a shared link.</p>
        <div class="form-row">
          <input v-model="joinMatchID" placeholder="Match ID" class="input" />
          <button class="btn-primary" :disabled="!joinMatchID.trim() || joining" @click="joinMatch">
            <LogIn :size="16" />
            {{ joining ? 'Joining…' : 'Join' }}
          </button>
        </div>
      </section>
    </template>

    <Transition name="fade">
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.lobby {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

.card h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.game-card:hover {
  border-color: var(--accent);
}

.game-card.selected {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
}

.game-card .desc {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.game-card .meta {
  color: var(--text-muted);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.hint {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
}

.input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--accent);
}

.input.full {
  width: 100%;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.btn-icon:hover {
  color: var(--text);
  border-color: var(--accent);
}

.icon-success {
  color: var(--success);
}

.created-box {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 10px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  background: rgba(99, 102, 241, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.created-label {
  color: var(--success);
  font-weight: 600;
  font-size: 0.875rem;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.match-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: var(--accent-hover);
  background: var(--bg);
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error {
  color: var(--danger);
  font-size: 0.875rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
