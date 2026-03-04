/**
 * Builds game bundles into dist/games/*.js so the server can load them at startup.
 *
 * Scaling: no config list to maintain.
 * - In-repo: every .ts and .js in src/games/ is built automatically. Add a game = add a file.
 * - External: optional EXTERNAL_GAMES_CONFIG or legacy env (THE_GOLDEN_AGES_PATH / sibling).
 *
 * Uses one esbuild run with multiple entry points for fast builds with many games.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Output in dist/ (same dir as index.cjs) so deploy uploads include it; use game-*.js to avoid clashing with index.cjs.
const serverRoot = path.resolve(__dirname, '..');
const outDir = path.join(serverRoot, 'dist');
// Discover from script-relative and cwd-relative (npm -w from repo root may leave cwd at root).
const gamesSrcCandidates = [
  path.join(serverRoot, 'src', 'games'),
  path.join(process.cwd(), 'src', 'games'),
  path.join(process.cwd(), 'packages', 'server', 'src', 'games'),
];

console.log('[build-external-games] cwd=', process.cwd(), '| outDir=', outDir);
fs.mkdirSync(outDir, { recursive: true });

const entryPoints = [];
const seen = new Set();

// 1. Discover all games in src/games/ from any candidate path.
for (const gamesSrcDir of gamesSrcCandidates) {
  if (!fs.existsSync(gamesSrcDir) || !fs.statSync(gamesSrcDir).isDirectory()) continue;
  const files = fs.readdirSync(gamesSrcDir);
  for (const file of files) {
    if (!/\.(ts|js)$/.test(file)) continue;
    const fullPath = path.join(gamesSrcDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    const basename = path.basename(file, path.extname(file));
    if (seen.has(basename)) continue;
    seen.add(basename);
    entryPoints.push({ in: fullPath, out: path.join(outDir, `game-${basename}.js`) });
  }
  if (entryPoints.length > 0) {
    console.log('[build-external-games] found', entryPoints.length, 'game(s), first from', gamesSrcDir);
    break;
  }
}
if (entryPoints.length === 0) {
  console.log('[build-external-games] no .ts/.js in any of', gamesSrcCandidates);
}

// 1b. Generate in-repo games registry so the server bundle can include them (one index.cjs, no extra deploy files).
const generatedDir = path.join(serverRoot, 'src', 'generated');
fs.mkdirSync(generatedDir, { recursive: true });
const registryPath = path.join(generatedDir, 'in-repo-games.ts');
const lines =
  entryPoints.length > 0
    ? [
        '/** Auto-generated; do not edit. In-repo games are bundled into the server. */',
        "import { registerGame } from '@noble/bg-engine';",
        ...entryPoints.map((e, i) => {
          const basename = path.basename(e.in, path.extname(e.in));
          return `import { gameDef as def${i} } from '../games/${basename}.js';`;
        }),
        'export function registerInRepoGames(): void {',
        ...entryPoints.map((_, i) => `  registerGame(def${i});`),
        '}',
      ]
    : [
        '/** Auto-generated; do not edit. */',
        'export function registerInRepoGames(): void {}',
      ];
fs.writeFileSync(registryPath, lines.join('\n') + '\n', 'utf8');
console.log('[build-external-games] generated', registryPath, entryPoints.length > 0 ? `(${entryPoints.length} game(s))` : '(no in-repo games)');

// 2. Optional: external games (other repos). Set EXTERNAL_GAMES_CONFIG to a JSON array of
//    { "slug": "my-game", "path": "/absolute/path/to/entry.ts" }.
const externalEntries = [];
if (process.env.EXTERNAL_GAMES_CONFIG) {
  try {
    const config = JSON.parse(process.env.EXTERNAL_GAMES_CONFIG);
    if (Array.isArray(config)) {
      for (const item of config) {
        if (item?.slug && item?.path && fs.existsSync(item.path)) {
          externalEntries.push({ in: item.path, out: path.join(outDir, `game-${item.slug}.js`) });
        }
      }
    }
  } catch (_) {}
}

// 3. Legacy: single external game via THE_GOLDEN_AGES_PATH or sibling the-golden-ages.
const engineRoot = path.join(serverRoot, '..', '..');
const legacyPaths = [];
if (process.env.THE_GOLDEN_AGES_PATH) {
  const root = path.resolve(process.cwd(), process.env.THE_GOLDEN_AGES_PATH);
  for (const ext of ['.ts', '.js']) {
    const p = path.join(root, 'src', 'logic', 'game-logic' + ext);
    if (fs.existsSync(p)) {
      legacyPaths.push({ in: p, out: path.join(outDir, 'game-the-golden-ages.js') });
      break;
    }
  }
}
if (legacyPaths.length === 0) {
  const sibling = path.join(engineRoot, '..', 'the-golden-ages');
  for (const ext of ['.ts', '.js']) {
    const p = path.join(sibling, 'src', 'logic', 'game-logic' + ext);
    if (fs.existsSync(p)) {
      legacyPaths.push({ in: p, out: path.join(outDir, 'game-the-golden-ages.js') });
      break;
    }
  }
}
const hasGoldenAgesInRepo = entryPoints.length > 0 && entryPoints.some((e) => path.basename(e.in, path.extname(e.in)) === 'the-golden-ages');
if (!hasGoldenAgesInRepo) {
  for (const e of legacyPaths) externalEntries.push(e);
}

// 4. Compile game: COMPILE_GAME_PATH or sibling compile-game (full game with phases).
const compilePaths = [];
if (process.env.COMPILE_GAME_PATH) {
  const root = path.resolve(process.cwd(), process.env.COMPILE_GAME_PATH);
  for (const ext of ['.ts', '.js']) {
    const p = path.join(root, 'src', 'logic', 'game-logic' + ext);
    if (fs.existsSync(p)) {
      compilePaths.push({ in: p, out: path.join(outDir, 'game-compile.js') });
      break;
    }
  }
}
if (compilePaths.length === 0) {
  // Sibling: noble-bg-engine and compile-game both in e.g. c:\code
  const siblingCompile = path.join(engineRoot, '..', 'compile-game');
  for (const ext of ['.ts', '.js']) {
    const p = path.join(siblingCompile, 'src', 'logic', 'game-logic' + ext);
    if (fs.existsSync(p)) {
      compilePaths.push({ in: p, out: path.join(outDir, 'game-compile.js') });
      break;
    }
  }
}
if (compilePaths.length === 0) {
  // Nested: noble-bg-engine inside compile-game (e.g. compile-game/noble-bg-engine)
  const parentAsCompile = path.join(engineRoot, '..');
  for (const ext of ['.ts', '.js']) {
    const p = path.join(parentAsCompile, 'src', 'logic', 'game-logic' + ext);
    if (fs.existsSync(p)) {
      compilePaths.push({ in: p, out: path.join(outDir, 'game-compile.js') });
      console.log('[build-external-games] compile-game found (parent)', parentAsCompile);
      break;
    }
  }
}
if (compilePaths.length === 0) {
  // Fallback: cwd or cwd/../compile-game
  const cwdAsCompile = process.cwd();
  const cwdParent = path.join(process.cwd(), '..');
  for (const root of [cwdAsCompile, path.join(cwdParent, 'compile-game')]) {
    for (const ext of ['.ts', '.js']) {
      const p = path.join(root, 'src', 'logic', 'game-logic' + ext);
      if (fs.existsSync(p)) {
        compilePaths.push({ in: p, out: path.join(outDir, 'game-compile.js') });
        console.log('[build-external-games] compile-game found at', root);
        break;
      }
    }
    if (compilePaths.length > 0) break;
  }
}
if (compilePaths.length > 0) {
  console.log('[build-external-games] building game-compile.js from', compilePaths[0].in);
  for (const e of compilePaths) externalEntries.push(e);
} else {
  console.log('[build-external-games] compile-game not found (engineRoot=', engineRoot, '| sibling=', path.join(engineRoot, '..', 'compile-game'), ')');
}

// Only build external games to dist/; in-repo games are bundled into the server via the generated registry.
const all = [...externalEntries];
if (all.length > 0) {
  await build({
    entryPoints: Object.fromEntries(all.map((e) => [path.basename(e.out), e.in])),
    outdir: outDir,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['@noble/bg-engine', 'boardgame.io', 'boardgame.io/core'],
    // compile-game (and similar) use @engine/client; resolve to engine package for server bundle
    alias: {
      '@engine/client': '@noble/bg-engine',
      '@engine/client/index': '@noble/bg-engine',
    },
    logLevel: 'warning',
  });
  for (const e of all) {
    console.log('[build-external-games] Wrote', e.out);
  }
}
