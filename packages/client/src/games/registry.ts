import type { Component } from 'vue';

/**
 * Maps gameId -> lazy-loaded board component.
 * Add one line here for each new game, e.g.:
 * 'my-game': defineAsyncComponent(() => import('./my-game/Board.vue')),
 */
export const boardComponents: Record<string, Component> = {};
