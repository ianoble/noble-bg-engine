/**
 * Loads external game definitions. In-repo games (src/games/) are bundled into
 * the server via generated/in-repo-games.ts. Optional: game-*.js next to index.cjs,
 * dist/games/*.js, or EXTERNAL_GAME_PATH.
 */
import { registerGame } from '@noble/bg-engine';
import { registerInRepoGames } from './generated/in-repo-games.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directory of the server entry script (CJS bundle: require.main; else cwd). */
function getServerDir(): string {
  const main = typeof require !== 'undefined' && (require as NodeJS.Require).main;
  if (main && typeof main === 'object' && main.filename) return path.dirname(main.filename);
  return process.cwd();
}

async function registerModule(mod: { gameDef?: unknown; gameDefs?: unknown[] }): Promise<boolean> {
  if (mod.gameDef) {
    registerGame(mod.gameDef as Parameters<typeof registerGame>[0]);
    return true;
  }
  if (Array.isArray(mod.gameDefs)) {
    for (const def of mod.gameDefs) if (def) registerGame(def as Parameters<typeof registerGame>[0]);
    return mod.gameDefs.length > 0;
  }
  return false;
}

export async function loadExternalGames(): Promise<void> {
  registerInRepoGames();

  const serverDir = getServerDir();
  // game-*.js next to index.cjs, dist/games/*.js, cwd/games/*.js
  const serverDirFiles = fs.existsSync(serverDir) && fs.statSync(serverDir).isDirectory()
    ? fs.readdirSync(serverDir).filter((f) => f.startsWith('game-') && f.endsWith('.js'))
    : [];
  // 2) dist/games/*.js and cwd/games/*.js
  const gamesDirs = [path.join(serverDir, 'games'), path.join(process.cwd(), 'games')];
  let registeredFromGamesDir = false;

  const dirStatus = [
    path.join(serverDir, 'game-*.js') + ` (${serverDirFiles.length} file(s))`,
    ...gamesDirs.map((d) => {
      const exists = fs.existsSync(d) && fs.statSync(d).isDirectory();
      const count = exists ? fs.readdirSync(d).filter((f) => f.endsWith('.js')).length : 0;
      return `${d} (${exists ? count + ' .js' : 'missing'})`;
    }),
  ];
  console.log('[bgf] external games: serverDir=', serverDir, '|', dirStatus.join(' | '));

  for (const file of serverDirFiles) {
    try {
      const fullPath = path.join(serverDir, file);
      const url = pathToFileURL(path.resolve(fullPath)).href;
      const mod = await import(/* @vite-ignore */ url);
      if (await registerModule(mod as { gameDef?: unknown; gameDefs?: unknown[] })) {
        registeredFromGamesDir = true;
        console.log('[bgf] loaded external game from', file);
      }
    } catch (err) {
      console.warn('[bgf] failed to load game bundle', file, err);
    }
  }

  for (const dir of gamesDirs) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      try {
        const fullPath = path.join(dir, file);
        const url = pathToFileURL(path.resolve(fullPath)).href;
        const mod = await import(/* @vite-ignore */ url);
        if (await registerModule(mod as { gameDef?: unknown; gameDefs?: unknown[] })) {
          registeredFromGamesDir = true;
          console.log('[bgf] loaded external game from', file);
        }
      } catch (err) {
        console.warn('[bgf] failed to load game bundle', file, err);
      }
    }
  }

  if (registeredFromGamesDir) return;

  const singleFileCandidates: string[] = [];
  if (process.env.EXTERNAL_GAME_PATH) singleFileCandidates.push(process.env.EXTERNAL_GAME_PATH);
  singleFileCandidates.push(path.join(process.cwd(), 'game-logic.js'), path.join(serverDir, 'game-logic.js'));

  for (const candidate of singleFileCandidates) {
    try {
      if (!candidate.startsWith('file://') && !fs.existsSync(candidate)) continue;
      const url = candidate.startsWith('file://') ? candidate : pathToFileURL(path.resolve(candidate)).href;
      const mod = await import(/* @vite-ignore */ url);
      if (await registerModule(mod as { gameDef?: unknown; gameDefs?: unknown[] })) break;
    } catch {
      // Path missing or invalid; try next.
    }
  }
}
