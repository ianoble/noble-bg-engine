#!/usr/bin/env node
const fs = require("fs-extra");
const path = require("path");

const gameName = process.argv[2] || "new-noble-game";
const targetDir = path.join(process.cwd(), gameName);
const templateDir = path.join(__dirname, "../template");

function toTitle(slug) {
	return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toPascalCase(slug) {
	return slug.replace(/(^|[-_]+)\w/g, (m) => m.replace(/[-_]+/, "").toUpperCase());
}

async function replaceInFile(filePath, find, replace) {
	const content = await fs.readFile(filePath, "utf-8");
	await fs.writeFile(filePath, content.replaceAll(find, replace));
}

async function scaffold() {
	try {
		await fs.copy(templateDir, targetDir, {
			filter: (src) => !src.includes("node_modules"),
		});

		const pkgPath = path.join(targetDir, "package.json");
		const pkg = await fs.readJson(pkgPath);
		pkg.name = gameName;
		await fs.writeJson(pkgPath, pkg, { spaces: 2 });

		const gameTitle = toTitle(gameName);
		const gameId = toPascalCase(gameName);

		await replaceInFile(path.join(targetDir, "index.html"), "__GAME_TITLE__", gameTitle);

		const logicPath = path.join(targetDir, "src/logic/game-logic.ts");
		await replaceInFile(logicPath, "__GAME_ID__", gameId);
		await replaceInFile(logicPath, "__GAME_TITLE__", gameTitle);

		console.log(`\nSuccessfully created ${gameName}!\n`);
		console.log(`Next steps:`);
		console.log(`  cd ${gameName}`);
		console.log(`  npm install`);
		console.log(`  npm run dev`);
		console.log(``);
		console.log(`In a separate terminal, start the game server:`);
		console.log(`  cd ${path.relative(process.cwd(), path.join(__dirname, ".."))}`);
		console.log(`  npm run dev -w packages/server`);
	} catch (err) {
		console.error("Scaffolding failed:", err);
	}
}

scaffold();
