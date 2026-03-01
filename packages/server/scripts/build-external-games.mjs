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

// Only build external games to dist/; in-repo games are bundled into the server via the generated registry.
const all = [...externalEntries];
if (all.length > 0) {
  await build({
    entryPoints: Object.fromEntries(all.map((e) => [e.out, e.in])),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['@noble/bg-engine', 'boardgame.io', 'boardgame.io/core'],
  });
  for (const e of all) {
    console.log('[build-external-games] Wrote', e.out);
  }
}
