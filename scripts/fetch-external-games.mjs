/**
 * Clones every game listed in external-games.json next to this repo (../<slug>), where the
 * server build (packages/server/scripts/build-external-games.mjs) picks them up.
 *
 *   node scripts/fetch-external-games.mjs           clone games that are missing; keep existing checkouts
 *   node scripts/fetch-external-games.mjs --fresh   delete and re-clone every game (for deploys)
 *
 * Without --fresh an existing folder is never touched, so local working copies are safe.
 * Adding a game to the deployed server = adding one line to external-games.json.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fresh = process.argv.includes('--fresh');
const games = JSON.parse(fs.readFileSync(path.join(engineRoot, 'external-games.json'), 'utf8'));

for (const { slug, repo, branch } of games) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`[fetch-external-games] bad slug: ${slug}`);
  const dir = path.join(engineRoot, '..', slug);
  if (fs.existsSync(dir)) {
    if (!fresh) {
      console.log(`[fetch-external-games] ${slug}: keeping existing ${dir}`);
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[fetch-external-games] ${slug}: cloning ${repo}${branch ? ` (${branch})` : ''}`);
  execFileSync('git', ['clone', '--depth', '1', ...(branch ? ['--branch', branch] : []), repo, dir], {
    stdio: 'inherit',
  });
}
