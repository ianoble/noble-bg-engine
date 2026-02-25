import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';

/**
 * Maps gameId -> lazy-loaded board component.
 * Add one line here for each new game.
 */
export const boardComponents: Record<string, Component> = {
  'tic-tac-toe': defineAsyncComponent(() => import('./tic-tac-toe/Board.vue')),
};
