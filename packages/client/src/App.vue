<script setup lang="ts">
import {
  provideGameContext,
  provideToastContext,
  provideCardInspect,
  provideCardDrag,
  ToastOverlay,
  CardInspector,
  DragOverlay,
} from '@noble/bg-engine/client';
import '@noble/bg-engine/styles';

provideToastContext();
provideCardInspect();
provideCardDrag();
provideGameContext();
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <h1>Board Game Framework</h1>
      <nav>
        <router-link to="/">Lobby</router-link>
      </nav>
    </header>
    <main class="app-main">
      <router-view />
    </main>
    <ToastOverlay />
    <CardInspector />
    <DragOverlay />
  </div>
</template>

<style>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.app-header h1 {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.app-header nav a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.15s;
}

.app-header nav a:hover,
.app-header nav a.router-link-active {
  color: var(--accent-hover);
}

.app-main {
  max-width: 1020px;
  margin: 2rem auto;
  padding: 0 1rem;
}
</style>
