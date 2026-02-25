<script setup lang="ts">
import { computed } from 'vue';
import { useGame } from '@noble/bg-engine/client';
import type { TicTacToeState } from '@noble/bg-engine';

const { state, isMyTurn, gameover, move } = useGame<TicTacToeState>();

const cells = computed(() => state.value.cells);

function handleClick(i: number) {
  if (isMyTurn.value && !gameover.value) {
    move('clickCell', i);
  }
}
</script>

<template>
  <div class="board">
    <button
      v-for="(cell, i) in cells"
      :key="i"
      class="cell"
      :class="{
        x: cell === 'X',
        o: cell === 'O',
        clickable: isMyTurn && !cell && !gameover,
      }"
      :disabled="!isMyTurn || !!cell || !!gameover"
      @click="handleClick(i)"
    >
      {{ cell ?? '' }}
    </button>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  width: 300px;
  height: 300px;
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 2rem;
  font-weight: 700;
  cursor: default;
  transition: background 0.15s, transform 0.1s;
  color: var(--text-muted);
}

.cell.x {
  color: var(--accent-hover);
}

.cell.o {
  color: var(--danger);
}

.cell.clickable {
  cursor: pointer;
}

.cell.clickable:hover {
  background: var(--border);
  transform: scale(1.04);
}
</style>
