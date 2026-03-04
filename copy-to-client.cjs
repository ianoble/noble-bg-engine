/**
 * Copy noble-bg-engine to client repos (so they use the in-repo copy after npm run build/start).
 * Paths are derived from this script location. Project folder is compile-game (not compile).
 */
const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const engineRoot = scriptDir;
const source = path.join(engineRoot, 'packages', 'engine');
const codeRoot = path.dirname(engineRoot);

if (!fs.existsSync(source)) {
  console.warn('Engine source not found:', source);
  process.exit(1);
}

function copyDir(src, dest) {
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  const parent = path.dirname(dest);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

// Only copy to a client if its project folder exists (e.g. c:\code\compile-game).
// On Render/CI only the engine repo is present, so we skip and do not create sibling dirs.
const dests = [
  ['the-golden-ages', path.join(codeRoot, 'the-golden-ages'), path.join(codeRoot, 'the-golden-ages', 'noble-bg-engine', 'packages', 'engine')],
  ['ZIA', path.join(codeRoot, 'ZIA'), path.join(codeRoot, 'ZIA', 'noble-bg-engine', 'packages', 'engine')],
  ['compile-game', path.join(codeRoot, 'compile-game'), path.join(codeRoot, 'compile-game', 'noble-bg-engine', 'packages', 'engine')],
];

const baseTsconfig = path.join(engineRoot, 'tsconfig.base.json');
for (const [name, projectDir, dest] of dests) {
  if (!fs.existsSync(projectDir)) continue;
  copyDir(source, dest);
  // So the copied engine's "extends": "../../tsconfig.base.json" resolves
  const destParent = path.dirname(path.dirname(dest));
  if (fs.existsSync(baseTsconfig) && destParent) {
    const destBase = path.join(destParent, 'tsconfig.base.json');
    fs.mkdirSync(destParent, { recursive: true });
    fs.copyFileSync(baseTsconfig, destBase);
  }
  console.log('Copied engine to', name);
}
