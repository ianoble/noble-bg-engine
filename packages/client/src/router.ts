import { createRouter, createWebHistory } from 'vue-router';
import LobbyView from './views/LobbyView.vue';
import GameView from './views/GameView.vue';
import JoinView from './views/JoinView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LobbyView },
    { path: '/game/:gameId/:matchID/:playerID', component: GameView, props: true },
    { path: '/join/:gameId/:matchID', component: JoinView, props: true },
  ],
});
