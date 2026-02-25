import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerGame } from '@noble/bg-engine/client';
import App from './App.vue';
import { router } from './router';
import { gameDef } from './logic/game-logic';
import '@noble/bg-engine/styles';
import './style.css';

registerGame(gameDef);

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
