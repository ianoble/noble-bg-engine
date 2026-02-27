import {
	defineGame,
	createSquareBoard,
	createTileLayer,
	placeTile as placeTileOnLayer,
	canPlaceTile,
	getTileAt,
	rotateTileOffsets,
	getCellKey,
	shuffle,
	defineTileShape,
	STANDARD_TILE_SHAPES,
	INVALID_MOVE,
	type BaseGameState,
	type Game,
	type Ctx,
	type SquareBoard,
	type GamePiece,
	type TileLayer,
	type TileRotation,
	type TileShape,
} from '@noble/bg-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';

export type Era = 'I' | 'II' | 'III' | 'IV';

export type CardType =
	| 'civilisation'
	| 'wonder'
	| 'building'
	| 'futureTech'
	| 'historysJudgement';

export type BackColor = 'green' | 'purple' | 'orange' | 'blue' | 'gray';

export type GamePhase = 'eraStart' | 'tilePlacement' | 'actions';

export type ResourceType = 'gem' | 'rock' | 'game' | 'wheat';

export type EdgeType = 'water' | 'land';
export type CellEdges = [EdgeType, EdgeType, EdgeType, EdgeType]; // [top, right, bottom, left]

export type ActionType =
	| 'explorer'
	| 'builder'
	| 'artist'
	| 'soldier'
	| 'buildWonder'
	| 'activateBuildingOrWonder'
	| 'developTechnology'
	| 'startGoldenAge';

export interface ActionMeta {
	type: ActionType;
	label: string;
	description: string;
	requiresWorker: boolean;
}

export const TECH_COSTS = [0, 3, 5, 8, 12];

export const TECH_TREE: { name: string; description: string; cost: number }[][] = [
	[
		{ name: 'Wheel', description: 'Move workers up to 1 space', cost: 0 },
		{ name: 'Carriage', description: 'Move workers up to 2 spaces (Wheel obsolete)', cost: 3 },
		{ name: 'Rail', description: 'Move workers up to 3 spaces (Carriage obsolete)', cost: 5 },
		{ name: 'Aviation', description: 'Move workers anywhere (Rail obsolete)', cost: 8 },
		{ name: 'Rocketry', description: '3 VP per gem you control. Attack anywhere without a worker, then found a city', cost: 12 },
	],
	[
		{ name: 'Hunting', description: 'Gain 1 gold when taking a game symbol', cost: 0 },
		{ name: 'Agriculture', description: '1 gold when you take a wheat symbol', cost: 3 },
		{ name: 'Architecture', description: 'Use building space 3 (no Writing needed)', cost: 5 },
		{ name: 'Medicine', description: '3 gold when you take a wheat symbol (Agriculture obsolete)', cost: 8 },
		{ name: 'Genetics', description: '2 VP per wheat you control. Builder action without a worker', cost: 12 },
	],
	[
		{ name: 'Fire', description: 'Use building space 1', cost: 0 },
		{ name: 'Metallurgy', description: '1 gold when you take a rock symbol', cost: 3 },
		{ name: 'Construction', description: 'Must place 2 cubes when founding a city', cost: 5 },
		{ name: 'Engineering', description: '3 gold when you take a rock symbol (Metallurgy obsolete)', cost: 8 },
		{ name: 'Computer Science', description: '2 VP per rock you control. 2 extra VP when colonist goes to agora', cost: 12 },
	],
	[
		{ name: 'Barter', description: 'Gain 1 gold when placing a cube', cost: 0 },
		{ name: 'Writing', description: 'Use building space 2', cost: 3 },
		{ name: 'Currency', description: '2 gold when you take a gem symbol', cost: 5 },
		{ name: 'Commerce', description: '2 gold when you place a cube (Barter obsolete)', cost: 8 },
		{ name: 'Economy', description: '1 VP per cube on map. 4 gold when you take a gem (Currency obsolete)', cost: 12 },
	],
];

export const ACTION_TYPES: ActionMeta[] = [
	{ type: 'explorer', label: 'Explorer', description: 'Send a worker to explore new lands', requiresWorker: true },
	{ type: 'builder', label: 'Builder', description: 'Send a worker to build structures', requiresWorker: true },
	{ type: 'artist', label: 'Artist', description: 'Send a worker to create art', requiresWorker: true },
	{ type: 'soldier', label: 'Soldier', description: 'Send a worker to wage war', requiresWorker: true },
	{ type: 'buildWonder', label: 'Build a Wonder', description: 'Spend resources to build a wonder', requiresWorker: false },
	{ type: 'activateBuildingOrWonder', label: 'Activate', description: 'Activate a building or wonder ability', requiresWorker: false },
	{ type: 'developTechnology', label: 'Develop Technology', description: 'Advance your civilisation\'s technology', requiresWorker: false },
	{ type: 'startGoldenAge', label: 'Start a Golden Age', description: 'End your era and receive income on future turns', requiresWorker: false },
];

export interface GameCard {
	id: string;
	cardType: CardType;
	era?: Era;
	backColor: BackColor;
	name: string;
	number?: number;
	buildingType?: string;
	civType?: string;
	judgementType?: string;
	futureTechType?: string;
	wonderType?: string;
	wonderCost?: number;
	wonderDiscountCiv?: string;
	wonderDiscountCost?: number;
	description?: string;
}

export interface JudgementDef {
	type: string;
	name: string;
	description: string;
}

export const JUDGEMENT_DEFS: JudgementDef[] = [
	{ type: 'mostUrbanized', name: 'Most Urbanized', description: '3 VP per building on your player board' },
	{ type: 'strongest', name: 'Strongest', description: '2 VP per glory token you own' },
	{ type: 'richest', name: 'Richest', description: '1 VP per 3 gold you own' },
	{ type: 'mostPopulous', name: 'Most Populous', description: '1 VP per cube on the board' },
	{ type: 'mostMagnificent', name: 'Most Magnificent', description: '2 VP per gem controlled' },
	{ type: 'mostIndustrial', name: 'Most Industrial', description: '2 VP per rock controlled' },
	{ type: 'mostEcological', name: 'Most Ecological', description: '2 VP per game controlled' },
	{ type: 'mostAgricultural', name: 'Most Agricultural', description: '2 VP per wheat controlled' },
	{ type: 'mostWealthy', name: 'Most Wealthy', description: '4 VP per wonder you have built' },
	{ type: 'mostAdvanced', name: 'Most Advanced', description: '1 VP per developed tech' },
];

export interface FutureTechDef {
	type: string;
	name: string;
	description: string;
}

export const FUTURE_TECH_DEFS: FutureTechDef[] = [
	{ type: 'newWorldOrder', name: 'New World Order', description: '8 VPs if you have the most gold' },
	{ type: 'artificialIntelligence', name: 'Artificial Intelligence', description: '8 VPs if you have the most developed techs' },
	{ type: 'timeTravel', name: 'Time Travel', description: '8 VPs if you have the most wonders built' },
	{ type: 'psychohistory', name: 'Psychohistory', description: '8 VPs if you have the most cubes on the board' },
	{ type: 'spaceFlight', name: 'Space Flight', description: '8 VPs if you have the most glory tokens' },
	{ type: 'nanotechnology', name: 'Nanotechnology', description: '8 VPs if you have the most rock symbols' },
	{ type: 'biotechnology', name: 'Biotechnology', description: '8 VPs if you have the most game symbols' },
	{ type: 'coldFusion', name: 'Cold Fusion', description: '8 VPs if you have the most gem symbols' },
	{ type: 'underseaAgriculture', name: 'Undersea Agriculture', description: '8 VPs if you have the most wheat symbols' },
];

export interface WonderDef {
	type: string;
	name: string;
	description: string;
	cost: number;
	discountCiv?: string;
	discountCost?: number;
	activateDescription?: string;
}

export const WONDER_DEFS: Record<Era, WonderDef[]> = {
	I: [
		{ type: 'colossus', name: 'Colossus', description: '2 VP per cube on map', cost: 3, discountCiv: 'phoenicia', discountCost: 2, activateDescription: 'Receive 1 VP' },
		{ type: 'greatLibrary', name: 'Great Library', description: 'Develop a tech for free', cost: 4, discountCiv: 'china', discountCost: 3 },
		{ type: 'pyramids', name: 'Pyramids', description: '2 VP per rock controlled', cost: 3, discountCiv: 'egypt', discountCost: 2, activateDescription: 'Receive 1 VP' },
		{ type: 'hangingGardens', name: 'Hanging Gardens', description: '2 VP per wheat controlled', cost: 3, discountCiv: 'babylon', discountCost: 2, activateDescription: 'Receive 1 VP' },
	],
	II: [
		{ type: 'notreDame', name: 'Notre Dame', description: 'Move exhausted workers: map→Agora or Agora→capital', cost: 6, discountCiv: 'france', discountCost: 4, activateDescription: 'Move exhausted workers: map→Agora or Agora→capital' },
		{ type: 'hagiaSophia', name: 'Hagia Sophia', description: 'Permanent: 2 gold when you found a city', cost: 6, discountCiv: 'byzantine', discountCost: 4 },
		{ type: 'spiralMinaret', name: 'Spiral Minaret', description: 'End of game: 2 extra VP per level 4 & 5 tech', cost: 6, discountCiv: 'arabia', discountCost: 4 },
		{ type: 'greatWall', name: 'Great Wall', description: 'Permanent: 3 gold when another player attacks', cost: 8, discountCiv: 'china', discountCost: 6 },
	],
	III: [
		{ type: 'oxfordUniversity', name: 'Oxford University', description: 'Develop 2 technologies for free', cost: 14, discountCiv: 'england', discountCost: 11 },
		{ type: 'versailles', name: 'Versailles', description: '1 VP per wheat controlled', cost: 6 },
		{ type: 'eiffelTower', name: 'Eiffel Tower', description: '1 VP per rock controlled', cost: 6 },
		{ type: 'porcelainTower', name: 'Porcelain Tower', description: '3 VP per glory token collected', cost: 6, discountCiv: 'china', discountCost: 4 },
	],
	IV: [
		{ type: 'kremlin', name: 'Kremlin', description: '1 VP per exhausted worker on the map (all players)', cost: 8, discountCiv: 'russia', discountCost: 6 },
		{ type: 'apolloProgram', name: 'Apollo Program', description: '2 VP per gem controlled', cost: 8 },
		{ type: 'internet', name: 'Internet', description: '1 VP per your city and capital on the map', cost: 6 },
		{ type: 'unitedNations', name: 'United Nations', description: 'Permanent: Receive the gold another player pays to attack', cost: 8, discountCiv: 'usa', discountCost: 6 },
	],
};

export interface BuildingDef {
	type: string;
	name: string;
	description: string;
}

export const BUILDING_DEFS: Record<Era, BuildingDef[]> = {
	I: [
		{ type: 'market', name: 'Market', description: 'Receive 1 gold for each worker in the Agora' },
		{ type: 'library', name: 'Library', description: 'Develop a technology with a 2 gold discount' },
		{ type: 'granary', name: 'Granary', description: '1 gold per non-exhausted worker of yours on the map' },
	],
	II: [
		{ type: 'bank', name: 'Bank', description: 'Receive 4 gold' },
		{ type: 'university', name: 'University', description: 'Develop a technology with a 3 gold discount' },
		{ type: 'wall', name: 'Wall', description: 'Permanent: attackers pay 3 extra gold (6 with two Walls)' },
	],
	III: [
		{ type: 'museum', name: 'Museum', description: 'Receive 6 gold' },
		{ type: 'observatory', name: 'Observatory', description: 'Develop a technology with a 5 gold discount' },
		{ type: 'factory', name: 'Factory', description: 'Reactivate one of your exhausted workers on the map' },
	],
	IV: [
		{ type: 'movieTheater', name: 'Movie Theater', description: '2 VP for each worker in the Agora' },
		{ type: 'laboratory', name: 'Laboratory', description: 'Develop a technology for free' },
		{ type: 'central', name: 'Central', description: '2 gold for each of your cities and capital on the map' },
	],
};

export interface CivDef {
	type: string;
	name: string;
	number: number;
	description: string;
}

export const CIV_DEFS: Record<Era, CivDef[]> = {
	I: [
		{ type: 'babylon', number: 1, name: 'Babylonian Empire', description: 'Immediately develop Agriculture for free' },
		{ type: 'phoenicia', number: 2, name: 'Phoenicia', description: 'Immediately develop Writing for free' },
		{ type: 'egypt', number: 3, name: 'Egypt', description: 'Immediately develop Metallurgy for free' },
		{ type: 'greece', number: 4, name: 'Greece', description: 'Build a wonder for free (once per game)' },
		{ type: 'persia', number: 5, name: 'Persia', description: 'Immediately develop Carriage for free' },
		{ type: 'rome', number: 6, name: 'Roman Empire', description: 'Receive 2 gold. Builder action without a worker' },
		{ type: 'china', number: 7, name: 'China', description: 'Pay 2 gold less when attacking. Examine 2 glory tiles after attack' },
	],
	II: [
		{ type: 'inca', number: 1, name: 'Inca Empire', description: 'Receive 2 extra gold when taking control of a wheat symbol' },
		{ type: 'aztec', number: 2, name: 'Aztec Empire', description: 'Receive 2 extra gold when taking control of a gem symbol' },
		{ type: 'mongolia', number: 3, name: 'Mongolia', description: 'Receive 2 extra gold when taking control of a rock symbol' },
		{ type: 'france', number: 4, name: 'France', description: 'Receive 4 gold after you attack' },
		{ type: 'arabia', number: 5, name: 'Arabia', description: 'Receive 4 gold. Builder action without a worker' },
		{ type: 'byzantine', number: 6, name: 'Byzantine Empire', description: 'Immediately receive 5 gold' },
	],
	III: [
		{ type: 'spain', number: 1, name: 'Spain', description: 'Receive 3 extra gold when taking control of a gem symbol' },
		{ type: 'turkey', number: 2, name: 'Turkey', description: 'If you have Agriculture, develop Architecture for free. If already researched, gain 6 gold' },
		{ type: 'england', number: 3, name: 'England', description: 'If you have Writing, develop Currency for free. If already researched, gain 6 gold' },
		{ type: 'portugal', number: 4, name: 'Portugal', description: 'Receive 4 gold. Workers passing through east/west board edge earn 3 gold' },
		{ type: 'prussia', number: 5, name: 'Prussia', description: 'If you have Carriage, develop Rail for free. If already researched, gain 6 gold' },
		{ type: 'austria', number: 6, name: 'Austria', description: 'If you have Metallurgy, develop Construction for free. If already researched, gain 6 gold' },
	],
	IV: [
		{ type: 'russia', number: 1, name: 'Russia', description: 'Workers don\'t exhaust when used as Explorers' },
		{ type: 'japan', number: 2, name: 'Japan', description: 'Pay 2 gold less on techs. May develop multiple techs per action' },
		{ type: 'usa', number: 3, name: 'United States', description: 'Receive 4 gold when your worker lands on an opponent\'s space (before attack)' },
		{ type: 'eu', number: 4, name: 'European Union', description: 'Receive 4 gold every time a worker goes to the Agora' },
		{ type: 'india', number: 5, name: 'India', description: 'Immediately develop a level 5 tech (skip prereqs, no immediate VPs)' },
		{ type: 'brazil', number: 6, name: 'Brazil', description: 'Receive 4 extra gold when taking control of a gem symbol' },
	],
};

export type EraDecks = Record<Era, GameCard[]>;

export interface CardDecks {
	wonder: EraDecks;
	building: EraDecks;
}

export type BoardCubeKey = `${number},${number}`;

export interface GoldenAgesPlayerState {
	color: PlayerColor;
	gold: number;
	hand: GameCard[];
	workers: number;
	cubes: number;
	boardCubes: Record<BoardCubeKey, number>;
	researchedTechs: boolean[][];
	capitalFlipped: boolean;
	passedThisEra: boolean;
	historyCards: GameCard[];
	score: number;
	assignedLTile: TileTemplate | null;
	assignedDominoTiles: Record<Era, TileTemplate | null>;
	builtBuildings: (GameCard | null)[];
	activatedBuildings: boolean[];
	usedGreeceWonder: boolean;
	invasionTrackPos: number;
	gloryTokens: number[];
	builtWonders: GameCard[];
	activatedWonders: boolean[];
}

export const INVASION_COSTS = [3, 5, 8, 12];

export const GLORY_TOKEN_POOL: number[] = [
	...Array(2).fill(2),
	...Array(4).fill(3),
	...Array(4).fill(4),
	...Array(4).fill(5),
	...Array(2).fill(6),
];

export function getUnlockedBuildingSlots(player: GoldenAgesPlayerState): boolean[] {
	return [
		player.researchedTechs[2][0],
		player.researchedTechs[3][1],
		player.researchedTechs[1][2],
	];
}

export interface BoardPiece {
	id: string;
	type: 'capital' | 'worker';
	owner: string;
	row: number;
	col: number;
	exhausted?: boolean;
	inAgora?: boolean;
}

export interface BoardCity {
	owner: string;
	row: number;
	col: number;
	cubes: number;
}

export interface GoldenAgesState extends BaseGameState {
	board: SquareBoard<GamePiece>;
	tiles: TileLayer;
	decks: CardDecks;
	historyJudgementCards: GameCard[];
	players: Record<string, GoldenAgesPlayerState>;
	pieces: BoardPiece[];
	currentEra: Era;
	phase: GamePhase;
	tilesPlacedThisEra: number;
	availableWonders: GameCard[];
	availableBuildings: GameCard[];
	activeCivCard: Record<string, GameCard | null>;
	eraStartDone: number;
	firstPlayer: string;
	boardResources: Record<string, ResourceType[]>;
	controlledResources: Record<string, string>;
	cities: BoardCity[];
	gloryTokenSupply: number[];
	eraJudgementCard: GameCard | null;
	eraIVRemainingTurns: number;
	endGameScored: boolean;
	boardEdges: Record<string, CellEdges>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

const BOARD_ROWS = 6;
const BOARD_COLS = 10;

const STARTING_TILE_ANCHOR: [number, number] = [2, 4];

const CARD_CONFIG: Record<string, { backColor: BackColor }> = {
	civilisation: { backColor: 'green' },
	wonder: { backColor: 'purple' },
	building: { backColor: 'orange' },
	futureTech: { backColor: 'blue' },
	historysJudgement: { backColor: 'gray' },
};

const ERA_COUNTS: Record<string, Record<Era, number>> = {
	civilisation: { I: 7, II: 6, III: 6, IV: 6 },
	wonder: { I: 4, II: 4, III: 4, IV: 4 },
	building: { I: 6, II: 6, III: 6, IV: 6 },
};

const SMALL_L = defineTileShape('SmallL', [[0, 0], [1, 0], [1, 1]], 'Small L');
/** Index of the corner cell in SMALL_L offsets (the cell connecting both arms). */
const SMALL_L_CORNER_INDEX = 1;

/** The tile shape used during each era. */
export const ERA_TILE_SHAPES: Record<Era, TileShape> = {
	I: SMALL_L,
	II: STANDARD_TILE_SHAPES['1x2'],
	III: STANDARD_TILE_SHAPES['1x2'],
	IV: STANDARD_TILE_SHAPES['1x2'],
};

export const ROTATIONS: TileRotation[] = [0, 90, 180, 270];

const ERAS: Era[] = ['I', 'II', 'III', 'IV'];

const L: EdgeType = 'land';
const W: EdgeType = 'water';

export interface TileTemplate {
	id: number;
	resources: ResourceType[][];
	edges: CellEdges[];
}

const ALL_LAND: CellEdges = [L, L, L, L];

export const L_TILE_TEMPLATES: TileTemplate[] = [
	{ id: 1, resources: [['wheat'], ['wheat'], ['rock']], edges: [[W,W,L,W], [L,L,W,W], [L,L,W,L]] },
	{ id: 2, resources: [['wheat'], ['game'], ['rock']], edges: [[L,L,L,L], [L,L,W,L], [L,W,W,L]] },
	{ id: 3, resources: [['wheat'], ['rock'], ['rock']], edges: [[L,L,L,L], [L,L,W,W], [L,W,W,L]] },
	{ id: 4, resources: [['rock'], ['game'], ['wheat']], edges: [[W,W,L,W], [L,L,L,W], [W,W,L,L]] },
];

export const DOMINO_TILE_TEMPLATES: TileTemplate[] = [
	{ id: 5, resources: [['gem'], ['rock']], edges: [[L,L,L,L], [L,W,W,L]] },
	{ id: 6, resources: [['game'], ['gem']], edges: [[W,L,L,L], [W,W,L,L]] },
	{ id: 7, resources: [['rock'], ['gem']], edges: [[W,L,L,W], [W,W,L,L]] },
	{ id: 8, resources: [['wheat'], ['gem']], edges: [[W,L,W,L], [L,W,W,L]] },
	{ id: 9, resources: [['game', 'game'], ['gem']], edges: [[L,L,W,W], [W,W,W,L]] },
	{ id: 10, resources: [['gem'], ['wheat']], edges: [[W,L,L,L], [W,L,L,L]] },
	{ id: 11, resources: [['gem'], ['wheat']], edges: [[L,L,W,W], [L,W,W,L]] },
	{ id: 12, resources: [['rock'], ['rock']], edges: [ALL_LAND, ALL_LAND] }, // all land confirmed
	{ id: 13, resources: [['rock'], ['gem']], edges: [ALL_LAND, [L,W,L,L]] },
	{ id: 14, resources: [['game', 'game'], ['gem']], edges: [[W,L,L,W], [W,W,W,L]] },
	{ id: 15, resources: [['gem'], ['game']], edges: [[W,L,L,W], [W,W,L,L]] },
	{ id: 16, resources: [['wheat'], ['wheat']], edges: [[W,L,W,W], [W,W,W,L]] },
];

export const BOARD_RESOURCES: Record<string, ResourceType[]> = {
	'0,3': ['gem'],
	'0,7': ['wheat', 'wheat'],
	'1,2': ['rock', 'game'],
	'2,0': ['game', 'wheat'],
	'3,9': ['game', 'rock'],
	'5,2': ['rock', 'rock'],
	'4,7': ['wheat', 'game'],
	'5,6': ['gem'],
};

const STARTING_TILE_RESOURCES: Record<string, ResourceType[]> = {
	'2,4': ['game'],
	'2,5': ['wheat'],
	'3,4': ['rock'],
	'3,5': ['game'],
};

const STARTING_GOLD = 3;
const STARTING_WORKERS = 3;
const STARTING_CUBES_AVAILABLE = 5;

const INITIAL_BOARD_CUBES: Record<BoardCubeKey, number> = {
	'1,2': 1, '1,3': 1,
	'2,2': 1, '2,3': 2,
	'3,2': 1,
	'4,2': 1,
};
const HISTORY_JUDGEMENT_DRAW = 5;
const GOLDEN_AGE_INCOME = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateEraDeck(
	cardType: CardType,
	backColor: BackColor,
	era: Era,
	count: number,
): GameCard[] {
	const cards: GameCard[] = [];
	for (let i = 0; i < count; i++) {
		const card: GameCard = {
			id: `${cardType}-${era}-${i}`,
			cardType,
			era,
			backColor,
			name: `${cardType} ${era}-${i + 1}`,
		};
		if (cardType === 'civilisation') {
			card.number = i + 1;
		}
		cards.push(card);
	}
	return shuffle(cards);
}

function buildWonderDecks(): EraDecks {
	const backColor: BackColor = 'purple';
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: EraDecks = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = WONDER_DEFS[era];
		if (defs.length === 0) {
			result[era] = generateEraDeck('wonder', backColor, era, ERA_COUNTS.wonder[era]);
			continue;
		}
		const cards: GameCard[] = defs.map((def) => ({
			id: `wonder-${era}-${def.type}`,
			cardType: 'wonder' as CardType,
			era,
			backColor,
			name: def.name,
			wonderType: def.type,
			wonderCost: def.cost,
			wonderDiscountCiv: def.discountCiv,
			wonderDiscountCost: def.discountCost,
			description: def.description,
		}));
		result[era] = shuffle(cards);
	}
	return result;
}

function buildBuildingDecks(): EraDecks {
	const backColor: BackColor = 'orange';
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: EraDecks = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = BUILDING_DEFS[era];
		if (defs.length === 0) {
			result[era] = generateEraDeck('building', backColor, era, ERA_COUNTS.building[era]);
			continue;
		}
		const cards: GameCard[] = [];
		let copyIdx = 0;
		for (const def of defs) {
			for (let copy = 0; copy < 2; copy++) {
				cards.push({
					id: `building-${era}-${copyIdx}`,
					cardType: 'building',
					era,
					backColor,
					name: def.name,
					buildingType: def.type,
					description: def.description,
				});
				copyIdx++;
			}
		}
		result[era] = shuffle(cards);
	}
	return result;
}

function buildCivDecks(): EraDecks {
	const backColor: BackColor = 'green';
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: EraDecks = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = CIV_DEFS[era];
		if (defs.length === 0) {
			result[era] = generateEraDeck('civilisation', backColor, era, ERA_COUNTS.civilisation[era]);
			continue;
		}
		const cards: GameCard[] = [];
		for (const def of defs) {
			cards.push({
				id: `civilisation-${era}-${def.type}`,
				cardType: 'civilisation',
				era,
				backColor,
				name: def.name,
				number: def.number,
				civType: def.type,
				description: def.description,
			});
		}
		result[era] = shuffle(cards);
	}
	return result;
}

function buildJudgementDeck(): GameCard[] {
	const cards: GameCard[] = JUDGEMENT_DEFS.map((def) => ({
		id: `judgement-${def.type}`,
		cardType: 'historysJudgement' as CardType,
		backColor: CARD_CONFIG.historysJudgement.backColor as BackColor,
		name: def.name,
		judgementType: def.type,
		description: def.description,
	}));
	return shuffle(cards);
}

function buildFutureTechDeck(): GameCard[] {
	const cards: GameCard[] = FUTURE_TECH_DEFS.map((def) => ({
		id: `futureTech-${def.type}`,
		cardType: 'futureTech' as CardType,
		backColor: CARD_CONFIG.futureTech.backColor as BackColor,
		name: def.name,
		futureTechType: def.type,
		description: def.description,
	}));
	return shuffle(cards);
}

// ---------------------------------------------------------------------------
// Tile placement validation
// ---------------------------------------------------------------------------

const EDGE_NEIGHBORS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function rotateCellEdges(edges: CellEdges, rotation: TileRotation): CellEdges {
	const [t, r, b, l] = edges;
	switch (rotation) {
		case 0: return [t, r, b, l];
		case 90: return [l, t, r, b];
		case 180: return [b, l, t, r];
		case 270: return [r, b, l, t];
	}
}

function hasAdjacentTile(
	layer: TileLayer,
	shape: TileShape,
	anchorRow: number,
	anchorCol: number,
	rotation: TileRotation,
): boolean {
	const offsets = rotateTileOffsets(shape.offsets, rotation);
	const tileCells = new Set(offsets.map(([dr, dc]) => getCellKey(anchorRow + dr, anchorCol + dc)));

	for (const [dr, dc] of offsets) {
		const r = anchorRow + dr;
		const c = anchorCol + dc;
		for (const [nr, nc] of EDGE_NEIGHBORS) {
			const neighborKey = getCellKey(r + nr, c + nc);
			if (!tileCells.has(neighborKey) && layer.occupancy[neighborKey] !== undefined) {
				return true;
			}
		}
	}
	return false;
}

// Maps neighbor direction [dr,dc] to [myEdgeIndex, theirEdgeIndex]
const EDGE_MATCH_MAP: Record<string, [number, number]> = {
	'-1,0': [0, 2], // neighbor above: my top vs their bottom
	'1,0': [2, 0],  // neighbor below: my bottom vs their top
	'0,-1': [3, 1], // neighbor left: my left vs their right
	'0,1': [1, 3],  // neighbor right: my right vs their left
};

function edgesMatch(
	layer: TileLayer,
	boardEdges: Record<string, CellEdges>,
	shape: TileShape,
	tileEdges: CellEdges[],
	anchorRow: number,
	anchorCol: number,
	rotation: TileRotation,
): boolean {
	const offsets = rotateTileOffsets(shape.offsets, rotation);
	const tileCells = new Set(offsets.map(([dr, dc]) => getCellKey(anchorRow + dr, anchorCol + dc)));

	for (let idx = 0; idx < offsets.length; idx++) {
		const [dr, dc] = offsets[idx];
		const r = anchorRow + dr;
		const c = anchorCol + dc;
		const rotatedEdges = rotateCellEdges(tileEdges[idx], rotation);

		for (const [nr, nc] of EDGE_NEIGHBORS) {
			const neighborKey = getCellKey(r + nr, c + nc);
			if (tileCells.has(neighborKey)) continue;
			const neighborEdges = boardEdges[neighborKey];
			if (!neighborEdges) continue;

			const [myIdx, theirIdx] = EDGE_MATCH_MAP[`${nr},${nc}`];
			if (rotatedEdges[myIdx] !== neighborEdges[theirIdx]) return false;
		}
	}
	return true;
}

/** Full placement check: in-bounds, no overlap, adjacent, and edges match. */
export function canPlaceGameTile(
	layer: TileLayer,
	board: SquareBoard,
	shape: TileShape,
	anchorRow: number,
	anchorCol: number,
	rotation: TileRotation,
	boardEdges?: Record<string, CellEdges>,
	tileEdges?: CellEdges[],
): boolean {
	if (!canPlaceTile(layer, board, shape, anchorRow, anchorCol, rotation)) return false;
	if (!hasAdjacentTile(layer, shape, anchorRow, anchorCol, rotation)) return false;
	if (boardEdges && tileEdges) {
		if (!edgesMatch(layer, boardEdges, shape, tileEdges, anchorRow, anchorCol, rotation)) return false;
	}
	return true;
}

export function getPlayerTileEdges(G: GoldenAgesState, playerId: string): CellEdges[] | undefined {
	const player = G.players[playerId];
	if (!player) return undefined;
	if (G.currentEra === 'I') return player.assignedLTile?.edges;
	return player.assignedDominoTiles?.[G.currentEra]?.edges;
}

// ---------------------------------------------------------------------------
// Era start: reveal market cards
// ---------------------------------------------------------------------------

function revealEraCards(G: GoldenAgesState, numPlayers: number): void {
	const era = G.currentEra;
	G.availableWonders = G.decks.wonder[era].splice(0);
	G.availableBuildings = G.decks.building[era].splice(0, numPlayers);
	G.phase = 'eraStart';
	G.eraStartDone = 0;
}

// ---------------------------------------------------------------------------
// Era transition
// ---------------------------------------------------------------------------

const NEXT_ERA: Record<Era, Era | null> = { I: 'II', II: 'III', III: 'IV', IV: null };

function applyImmediateTechEffects(G: GoldenAgesState, player: GoldenAgesPlayerState, row: number, col: number): void {
	if (col !== 4) return;
	const resourceToCount: Record<number, ResourceType> = { 0: 'gem', 1: 'wheat', 2: 'rock' };
	const vpPerResource: Record<number, number> = { 0: 3, 1: 2, 2: 2 };

	if (row <= 2) {
		const targetRes = resourceToCount[row];
		const vpPer = vpPerResource[row];
		let count = 0;
		for (const [key, owner] of Object.entries(G.controlledResources)) {
			if (owner !== Object.keys(G.players).find((id) => G.players[id] === player)) continue;
			const resources = G.boardResources[key];
			if (resources) {
				for (const r of resources) {
					if (r === targetRes) count++;
				}
			}
		}
		player.score += count * vpPer;
	} else if (row === 3) {
		let cubesOnMap = 0;
		const playerId = Object.keys(G.players).find((id) => G.players[id] === player);
		for (const city of G.cities) {
			if (city.owner === playerId) cubesOnMap += city.cubes;
		}
		player.score += cubesOnMap;
	}
}

const CIV_FREE_TECH: Record<string, [number, number]> = {
	babylon: [1, 1],
	phoenicia: [3, 1],
	egypt: [2, 1],
	persia: [0, 1],
};

function applyCivCardEffect(G: GoldenAgesState, player: GoldenAgesPlayerState, card: GameCard, indiaRow?: number): void {
	if (!card.civType) return;

	const freeTech = CIV_FREE_TECH[card.civType];
	if (freeTech) {
		const [row, col] = freeTech;
		if (!player.researchedTechs[row][col]) {
			player.researchedTechs[row][col] = true;
			const cubeKey: BoardCubeKey = `${row + 1},${col + 1}`;
			if (player.boardCubes[cubeKey]) {
				player.cubes += player.boardCubes[cubeKey];
				delete player.boardCubes[cubeKey];
			}
			applyImmediateTechEffects(G, player, row, col);
		}
	}

	if (card.civType === 'rome') {
		player.gold += 2;
	}
	if (card.civType === 'arabia') {
		player.gold += 4;
	}
	if (card.civType === 'byzantine') {
		player.gold += 5;
	}
	if (card.civType === 'portugal') {
		player.gold += 4;
	}

	const CIV_CONDITIONAL_TECH: Record<string, { prereq: [number, number]; target: [number, number] }> = {
		turkey: { prereq: [1, 1], target: [1, 2] },
		england: { prereq: [3, 1], target: [3, 2] },
		prussia: { prereq: [0, 1], target: [0, 2] },
		austria: { prereq: [2, 1], target: [2, 2] },
	};
	const conditional = CIV_CONDITIONAL_TECH[card.civType ?? ''];
	if (conditional) {
		const { prereq, target } = conditional;
		if (player.researchedTechs[prereq[0]][prereq[1]]) {
			if (player.researchedTechs[target[0]][target[1]]) {
				player.gold += 6;
			} else {
				player.researchedTechs[target[0]][target[1]] = true;
				const cubeKey: BoardCubeKey = `${target[0] + 1},${target[1] + 1}`;
				if (player.boardCubes[cubeKey]) {
					player.cubes += player.boardCubes[cubeKey];
					delete player.boardCubes[cubeKey];
				}
				applyImmediateTechEffects(G, player, target[0], target[1]);
			}
		}
	}

	if (card.civType === 'india' && indiaRow !== undefined) {
		const col = 4;
		if (indiaRow >= 0 && indiaRow < TECH_TREE.length && !player.researchedTechs[indiaRow][col]) {
			player.researchedTechs[indiaRow][col] = true;
			const cubeKey: BoardCubeKey = `${indiaRow + 1},${col + 1}`;
			if (player.boardCubes[cubeKey]) {
				player.cubes += player.boardCubes[cubeKey];
				delete player.boardCubes[cubeKey];
			}
			// India skips immediate VP effects — only gets end-game VP from the tech's back side
		}
	}
}

export function getAttackCost(G: GoldenAgesState, attackerId: string, defenderId: string): number {
	const attacker = G.players[attackerId];
	if (!attacker || attacker.invasionTrackPos >= INVASION_COSTS.length) return Infinity;

	let cost = INVASION_COSTS[attacker.invasionTrackPos];

	const defender = G.players[defenderId];
	if (defender) {
		const wallCount = defender.builtBuildings.filter((b) => b?.buildingType === 'wall').length;
		cost += wallCount * 3;
	}

	const attackerCiv = G.activeCivCard[attackerId];
	if (attackerCiv?.civType === 'china') {
		cost = Math.max(0, cost - 2);
	}

	return cost;
}

function countPlayerResources(G: GoldenAgesState, playerId: string, resType: ResourceType): number {
	let count = 0;
	for (const [key, owner] of Object.entries(G.controlledResources)) {
		if (owner !== playerId) continue;
		const resources = G.boardResources[key];
		if (resources) {
			for (const r of resources) {
				if (r === resType) count++;
			}
		}
	}
	return count;
}

function scoreJudgementCard(G: GoldenAgesState, card: GameCard): void {
	const jt = card.judgementType;
	if (!jt) return;

	for (const [pid, player] of Object.entries(G.players)) {
		let vp = 0;
		switch (jt) {
			case 'mostUrbanized':
				vp = player.builtBuildings.filter((b) => b !== null).length * 3;
				break;
			case 'strongest':
				vp = player.gloryTokens.length * 2;
				break;
			case 'richest':
				vp = Math.floor(player.gold / 3);
				break;
			case 'mostPopulous': {
				let cubesOnBoard = 0;
				for (const city of G.cities) {
					if (city.owner === pid) cubesOnBoard += city.cubes;
				}
				vp = cubesOnBoard;
				break;
			}
			case 'mostMagnificent':
				vp = countPlayerResources(G, pid, 'gem') * 2;
				break;
			case 'mostIndustrial':
				vp = countPlayerResources(G, pid, 'rock') * 2;
				break;
			case 'mostEcological':
				vp = countPlayerResources(G, pid, 'game') * 2;
				break;
			case 'mostAgricultural':
				vp = countPlayerResources(G, pid, 'wheat') * 2;
				break;
			case 'mostWealthy':
				vp = (player.builtWonders?.length ?? 0) * 4;
				break;
			case 'mostAdvanced': {
				let techCount = 0;
				for (const row of player.researchedTechs) {
					for (const researched of row) {
						if (researched) techCount++;
					}
				}
				vp = techCount;
				break;
			}
		}
		player.score += vp;
	}
}

function getFutureTechCount(G: GoldenAgesState, playerId: string, ftType: string): number {
	const player = G.players[playerId];
	if (!player) return 0;
	switch (ftType) {
		case 'newWorldOrder':
			return player.gold;
		case 'artificialIntelligence': {
			let count = 0;
			for (const row of player.researchedTechs) {
				for (const researched of row) {
					if (researched) count++;
				}
			}
			return count;
		}
		case 'timeTravel':
			return player.builtWonders.length;
		case 'psychohistory': {
			let cubes = 0;
			for (const city of G.cities) {
				if (city.owner === playerId) cubes += city.cubes;
			}
			return cubes;
		}
		case 'spaceFlight':
			return player.gloryTokens.length;
		case 'nanotechnology':
			return countPlayerResources(G, playerId, 'rock');
		case 'biotechnology':
			return countPlayerResources(G, playerId, 'game');
		case 'coldFusion':
			return countPlayerResources(G, playerId, 'gem');
		case 'underseaAgriculture':
			return countPlayerResources(G, playerId, 'wheat');
		default:
			return 0;
	}
}

const TECH_BACKSIDE_VP: Record<number, number> = { 2: 1, 3: 2, 4: 4 };

function performEndGameScoring(G: GoldenAgesState): void {
	if (G.endGameScored) return;
	G.endGameScored = true;

	const pids = Object.keys(G.players);

	// Future Tech cards: 8 VPs to sole leader, no ties
	const ftTypes = new Set<string>();
	for (const player of Object.values(G.players)) {
		for (const card of player.hand) {
			if (card.futureTechType) ftTypes.add(card.futureTechType);
		}
	}
	for (const ftType of ftTypes) {
		let bestCount = -1;
		let bestPid: string | null = null;
		let tied = false;
		for (const pid of pids) {
			const count = getFutureTechCount(G, pid, ftType);
			if (count > bestCount) {
				bestCount = count;
				bestPid = pid;
				tied = false;
			} else if (count === bestCount) {
				tied = true;
			}
		}
		if (bestPid && !tied) {
			G.players[bestPid].score += 8;
		}
	}

	for (const player of Object.values(G.players)) {
		// 1 VP per 3 gold
		player.score += Math.floor(player.gold / 3);

		// Tech back-side VPs: col 2 (level 3) = 1 VP, col 3 (level 4) = 2 VP, col 4 (level 5) = 4 VP
		for (const row of player.researchedTechs) {
			for (let col = 2; col < row.length; col++) {
				if (row[col] && TECH_BACKSIDE_VP[col]) {
					player.score += TECH_BACKSIDE_VP[col];
				}
			}
		}

		// Glory token points
		for (const val of player.gloryTokens) {
			player.score += val;
		}

		// Spiral Minaret: 2 extra VP per level 4 (col 3) and level 5 (col 4) tech
		if (hasWonder(player, 'spiralMinaret')) {
			for (const row of player.researchedTechs) {
				if (row[3]) player.score += 2;
				if (row[4]) player.score += 2;
			}
		}
	}
}

export function getPlayerRankings(G: GoldenAgesState): { playerId: string; score: number; cities: number }[] {
	const rankings = Object.keys(G.players).map((pid) => {
		const cityCount = G.cities.filter((c) => c.owner === pid).length;
		return { playerId: pid, score: G.players[pid].score, cities: cityCount };
	});
	rankings.sort((a, b) => b.score - a.score || b.cities - a.cities);
	return rankings;
}

function hasWonder(player: GoldenAgesPlayerState, wonderType: string): boolean {
	return player.builtWonders.some((w) => w.wonderType === wonderType);
}

function researchFreeTech(G: GoldenAgesState, player: GoldenAgesPlayerState, row: number, col: number): void {
	if (row < 0 || row >= TECH_TREE.length || col < 1 || col >= TECH_TREE[0].length) return;
	if (player.researchedTechs[row][col] || !player.researchedTechs[row][col - 1]) return;
	player.researchedTechs[row][col] = true;
	const cubeKey: BoardCubeKey = `${row + 1},${col + 1}`;
	if (player.boardCubes[cubeKey]) {
		player.cubes += player.boardCubes[cubeKey];
		delete player.boardCubes[cubeKey];
	}
	applyImmediateTechEffects(G, player, row, col);
}

function applyWonderInstantEffect(G: GoldenAgesState, player: GoldenAgesPlayerState, card: GameCard, playerId: string): void {
	switch (card.wonderType) {
		case 'colossus': {
			let cubes = 0;
			for (const city of G.cities) {
				if (city.owner === playerId) cubes += city.cubes;
			}
			player.score += cubes * 2;
			break;
		}
		case 'greatLibrary': {
			// Instant: develop a tech for free -- handled via argB/argC in the buildWonder action
			// The actual tech choice is deferred to the UI flow
			break;
		}
		case 'pyramids':
			player.score += countPlayerResources(G, playerId, 'rock') * 2;
			break;
		case 'hangingGardens':
			player.score += countPlayerResources(G, playerId, 'wheat') * 2;
			break;
		case 'oxfordUniversity':
			// Handled via argB in the buildWonder action (2 free techs)
			break;
		case 'versailles':
			player.score += countPlayerResources(G, playerId, 'wheat');
			break;
		case 'eiffelTower':
			player.score += countPlayerResources(G, playerId, 'rock');
			break;
		case 'porcelainTower':
			player.score += player.gloryTokens.length * 3;
			break;
		case 'kremlin': {
			const exhaustedOnMap = G.pieces.filter((p) => p.type === 'worker' && p.exhausted && !p.inAgora).length;
			player.score += exhaustedOnMap;
			break;
		}
		case 'apolloProgram':
			player.score += countPlayerResources(G, playerId, 'gem') * 2;
			break;
		case 'internet': {
			const myCities = G.cities.filter((c) => c.owner === playerId).length;
			const hasCapital = G.pieces.some((p) => p.type === 'capital' && p.owner === playerId);
			player.score += myCities + (hasCapital ? 1 : 0);
			break;
		}
	}
}

function checkEraEnd(G: GoldenAgesState): void {
	const allPassed = Object.values(G.players).every((p) => p.passedThisEra);
	if (!allPassed) return;

	if (G.eraJudgementCard) {
		scoreJudgementCard(G, G.eraJudgementCard);
		G.eraJudgementCard = null;
	}

	const nextEra = NEXT_ERA[G.currentEra];
	if (!nextEra) {
		performEndGameScoring(G);
		return;
	}

	G.currentEra = nextEra;
	G.tilesPlacedThisEra = 0;
	for (const p of Object.values(G.players)) {
		p.passedThisEra = false;
		p.activatedBuildings = [false, false, false];
		p.activatedWonders = p.builtWonders.map(() => false);
	}
	for (const piece of G.pieces) {
		if (piece.type === 'worker') {
			piece.exhausted = false;
			if (piece.inAgora) {
				const capital = G.pieces.find((p) => p.type === 'capital' && p.owner === piece.owner);
				if (capital) {
					piece.row = capital.row;
					piece.col = capital.col;
				}
				piece.inAgora = false;
			}
		}
	}

	revealEraCards(G, Object.keys(G.players).length);
}

// ---------------------------------------------------------------------------
// Resource control
// ---------------------------------------------------------------------------

function tryTakeControl(G: GoldenAgesState, playerId: string, row: number, col: number): void {
	const key = `${row},${col}`;
	const resources = G.boardResources[key];
	if (!resources || resources.length === 0) return;
	if (G.controlledResources[key] === playerId) return;

	G.controlledResources[key] = playerId;
	const player = G.players[playerId];
	if (!player) return;

	const civType = G.activeCivCard[playerId]?.civType;

	for (const res of resources) {
		if (res === 'game') {
			if (player.researchedTechs[1][0]) player.gold += 1;
		} else if (res === 'wheat') {
			if (player.researchedTechs[1][3]) player.gold += 3;
			else if (player.researchedTechs[1][1]) player.gold += 1;
			if (civType === 'inca') player.gold += 2;
		} else if (res === 'rock') {
			if (player.researchedTechs[2][3]) player.gold += 3;
			else if (player.researchedTechs[2][1]) player.gold += 1;
			if (civType === 'mongolia') player.gold += 2;
		} else if (res === 'gem') {
			if (player.researchedTechs[3][4]) player.gold += 4;
			else if (player.researchedTechs[3][2]) player.gold += 2;
			if (civType === 'aztec') player.gold += 2;
			if (civType === 'spain') player.gold += 3;
			if (civType === 'brazil') player.gold += 4;
		}
	}
}

// ---------------------------------------------------------------------------
// Movement helpers
// ---------------------------------------------------------------------------

const MOVEMENT_RANGES = [1, 2, 3, Infinity, Infinity];

export function getMovementRange(player: GoldenAgesPlayerState): number {
	let highest = 0;
	for (let col = 0; col < MOVEMENT_RANGES.length; col++) {
		if (player.researchedTechs[0][col]) highest = col;
	}
	return MOVEMENT_RANGES[highest];
}

export function getReachableCells(
	boardRows: number,
	boardCols: number,
	startRow: number,
	startCol: number,
	range: number,
): [number, number][] {
	if (!isFinite(range)) {
		const cells: [number, number][] = [];
		for (let r = 0; r < boardRows; r++) {
			for (let c = 0; c < boardCols; c++) {
				if (r === startRow && c === startCol) continue;
				cells.push([r, c]);
			}
		}
		return cells;
	}

	const visited = new Set<string>();
	visited.add(`${startRow},${startCol}`);
	let frontier: [number, number][] = [[startRow, startCol]];
	const result: [number, number][] = [];

	for (let step = 0; step < range; step++) {
		const nextFrontier: [number, number][] = [];
		for (const [r, c] of frontier) {
			for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
				const nr = r + dr;
				const nc = c + dc;
				const key = `${nr},${nc}`;
				if (nr < 0 || nr >= boardRows || nc < 0 || nc >= boardCols) continue;
				if (visited.has(key)) continue;
				visited.add(key);
				nextFrontier.push([nr, nc]);
				result.push([nr, nc]);
			}
		}
		frontier = nextFrontier;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Capital relocation
// ---------------------------------------------------------------------------

function relocateCapital(
	G: GoldenAgesState,
	playerId: string,
	destRow: number,
	destCol: number,
): void {
	const capital = G.pieces.find((p) => p.type === 'capital' && p.owner === playerId);
	if (!capital) return;

	const srcRow = capital.row;
	const srcCol = capital.col;

	capital.row = destRow;
	capital.col = destCol;

	for (const piece of G.pieces) {
		if (piece.type === 'worker' && piece.owner === playerId && piece.row === srcRow && piece.col === srcCol) {
			piece.row = destRow;
			piece.col = destCol;
		}
	}

	tryTakeControl(G, playerId, destRow, destCol);
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

const GoldenAgesGame: Game<GoldenAgesState> = {
	name: 'TheGoldenAges',

	setup: ({ ctx }: { ctx: Ctx }): GoldenAgesState => {
		const board = createSquareBoard<GamePiece>(BOARD_ROWS, BOARD_COLS);

		const tiles = createTileLayer();
		placeTileOnLayer(
			tiles,
			board,
			STANDARD_TILE_SHAPES['2x2'],
			STARTING_TILE_ANCHOR[0],
			STARTING_TILE_ANCHOR[1],
			0,
			null,
			'starting-tile',
		);

		// Build all decks
		const civDecks = buildCivDecks();
		const wonderDecks = buildWonderDecks();
		const buildingDecks = buildBuildingDecks();
		const futureTechDeck = buildFutureTechDeck();
		const historyDeck = buildJudgementDeck();

		// Draw 5 History's Judgement cards face-up
		const historyJudgementCards = historyDeck.slice(0, HISTORY_JUDGEMENT_DRAW);

		// Shuffle and deal L-tiles
		const lTiles = shuffle([...L_TILE_TEMPLATES]);

		// Shuffle and deal domino tiles (4 per era for up to 4 players)
		const dominoes = shuffle([...DOMINO_TILE_TEMPLATES]);
		const dominosByEra: Record<Era, TileTemplate[]> = { I: [], II: [], III: [], IV: [] };
		const dominoEras: Era[] = ['II', 'III', 'IV'];
		for (let e = 0; e < dominoEras.length; e++) {
			for (let p = 0; p < 4; p++) {
				const tile = dominoes[e * 4 + p];
				if (tile) dominosByEra[dominoEras[e]].push(tile);
			}
		}

		// Deal cards and resources to each player
		const players: Record<string, GoldenAgesPlayerState> = {};
		for (let i = 0; i < ctx.numPlayers; i++) {
			const hand: GameCard[] = [];

			for (const era of ERAS) {
				const card = civDecks[era].pop();
				if (card) hand.push(card);
			}

			const ftCard = futureTechDeck.pop();
			if (ftCard) hand.push(ftCard);

			players[String(i)] = {
				color: PLAYER_COLORS[i],
				gold: STARTING_GOLD,
				hand,
				workers: STARTING_WORKERS,
				cubes: STARTING_CUBES_AVAILABLE,
				boardCubes: { ...INITIAL_BOARD_CUBES },
				researchedTechs: TECH_TREE.map((row) => row.map((_, col) => col === 0)),
				capitalFlipped: false,
				passedThisEra: false,
				historyCards: [],
				score: 0,
				assignedLTile: lTiles[i] ?? null,
				assignedDominoTiles: {
					I: null,
					II: dominosByEra.II[i] ?? null,
					III: dominosByEra.III[i] ?? null,
					IV: dominosByEra.IV[i] ?? null,
				},
				builtBuildings: [null, null, null],
				activatedBuildings: [false, false, false],
				usedGreeceWonder: false,
				invasionTrackPos: 0,
				gloryTokens: [],
				builtWonders: [],
				activatedWonders: [],
			};
		}

		// Only wonder and building decks remain in play
		const decks: CardDecks = {
			wonder: wonderDecks,
			building: buildingDecks,
		};

		const activeCivCard: Record<string, GameCard | null> = {};
		for (let i = 0; i < ctx.numPlayers; i++) {
			activeCivCard[String(i)] = null;
		}

		const state: GoldenAgesState = {
			board,
			tiles,
			decks,
			historyJudgementCards,
			players,
			pieces: [],
			currentEra: 'I',
			phase: 'tilePlacement',
			tilesPlacedThisEra: 0,
			availableWonders: [],
			availableBuildings: [],
			activeCivCard,
			eraStartDone: 0,
			firstPlayer: '0',
			boardResources: { ...BOARD_RESOURCES, ...STARTING_TILE_RESOURCES },
			controlledResources: {},
			cities: [],
			gloryTokenSupply: shuffle([...GLORY_TOKEN_POOL]),
			eraJudgementCard: null,
			eraIVRemainingTurns: -1,
			endGameScored: false,
			boardEdges: {
				'2,4': [W, L, L, L],
				'2,5': [W, L, L, L],
				'3,4': [L, L, L, L],
				'3,5': [L, W, L, L],
			},
			history: [],
		};

		revealEraCards(state, ctx.numPlayers);

		return state;
	},

	moves: {
		chooseCivCard: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			keepOld?: boolean,
			indiaRow?: number,
		) => {
			if (G.phase !== 'eraStart') return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player) return INVALID_MOVE;

			const era = G.currentEra;
			const newCardIdx = player.hand.findIndex(
				(c) => c.cardType === 'civilisation' && c.era === era,
			);
			if (newCardIdx === -1) return INVALID_MOVE;

			const [newCard] = player.hand.splice(newCardIdx, 1);

			if (era === 'I') {
				G.activeCivCard[ctx.currentPlayer] = newCard;
				applyCivCardEffect(G, player, newCard, indiaRow);
			} else {
				if (keepOld) {
					// Discard the new card (just removed from hand already)
				} else {
					G.activeCivCard[ctx.currentPlayer] = newCard;
					applyCivCardEffect(G, player, newCard, indiaRow);
				}
			}

			G.eraStartDone++;
			if (G.eraStartDone >= ctx.numPlayers) {
				// Determine first player: lowest civ card number
				let lowestNum = Infinity;
				let lowestPlayer = G.firstPlayer;
				for (const [pid, card] of Object.entries(G.activeCivCard)) {
					if (card && card.number !== undefined && card.number < lowestNum) {
						lowestNum = card.number;
						lowestPlayer = pid;
					}
				}
				G.firstPlayer = lowestPlayer;
				G.phase = 'tilePlacement';
			}
		},

		placeTile: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			anchorRow: number,
			anchorCol: number,
			rotation: TileRotation,
			moveCapital?: boolean,
		) => {
			if (G.phase !== 'tilePlacement') return INVALID_MOVE;

			const shape = ERA_TILE_SHAPES[G.currentEra];
			const tileEdges = getPlayerTileEdges(G, ctx.currentPlayer);
			if (!canPlaceGameTile(G.tiles, G.board, shape, anchorRow, anchorCol, rotation, G.boardEdges, tileEdges)) {
				return INVALID_MOVE;
			}

			placeTileOnLayer(
				G.tiles,
				G.board,
				shape,
				anchorRow,
				anchorCol,
				rotation,
				ctx.currentPlayer,
			);

			const rotated = rotateTileOffsets(shape.offsets, rotation);

			if (tileEdges) {
				for (let idx = 0; idx < rotated.length; idx++) {
					const key = `${anchorRow + rotated[idx][0]},${anchorCol + rotated[idx][1]}`;
					G.boardEdges[key] = rotateCellEdges(tileEdges[idx], rotation);
				}
			}

			const targetRow = anchorRow + rotated[0][0];
			const targetCol = anchorCol + rotated[0][1];

			if (G.currentEra === 'I') {
				const cornerOffset = rotated[SMALL_L_CORNER_INDEX];
				const cornerRow = anchorRow + cornerOffset[0];
				const cornerCol = anchorCol + cornerOffset[1];

				G.pieces.push({
					id: `capital-${ctx.currentPlayer}`,
					type: 'capital',
					owner: ctx.currentPlayer,
					row: cornerRow,
					col: cornerCol,
				});

				for (let w = 0; w < STARTING_WORKERS; w++) {
					G.pieces.push({
						id: `worker-${ctx.currentPlayer}-${w}`,
						type: 'worker',
						owner: ctx.currentPlayer,
						row: cornerRow,
						col: cornerCol,
					});
				}

				const player = G.players[ctx.currentPlayer];
				if (player?.assignedLTile) {
					for (let idx = 0; idx < rotated.length; idx++) {
						const cellRow = anchorRow + rotated[idx][0];
						const cellCol = anchorCol + rotated[idx][1];
						const key = `${cellRow},${cellCol}`;
						const res = player.assignedLTile.resources[idx];
						if (res && res.length > 0) {
							G.boardResources[key] = res;
						} else {
							delete G.boardResources[key];
						}
					}
					player.assignedLTile = null;
				}

				tryTakeControl(G, ctx.currentPlayer, cornerRow, cornerCol);
			} else if (moveCapital) {
				relocateCapital(G, ctx.currentPlayer, targetRow, targetCol);
			}

			if (G.currentEra !== 'I') {
				const player = G.players[ctx.currentPlayer];
				const dominoTile = player?.assignedDominoTiles?.[G.currentEra];
			if (dominoTile) {
				for (let idx = 0; idx < rotated.length; idx++) {
					const cellRow = anchorRow + rotated[idx][0];
					const cellCol = anchorCol + rotated[idx][1];
					const key = `${cellRow},${cellCol}`;
					const res = dominoTile.resources[idx];
					if (res && res.length > 0) {
						G.boardResources[key] = res;
					} else {
						delete G.boardResources[key];
					}
				}
				player.assignedDominoTiles[G.currentEra] = null;
			}
			}

			G.tilesPlacedThisEra++;
			if (G.tilesPlacedThisEra >= ctx.numPlayers) {
				G.phase = 'actions';
			}
		},

		performAction: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			actionType: ActionType,
			argA?: string | number | number[],
			argB?: number | number[],
			argC?: number,
			argD?: boolean,
		) => {
			if (G.phase !== 'actions') return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player || player.passedThisEra) return INVALID_MOVE;

			if (actionType === 'explorer') {
				const workerId = argA as string;
				const destRow = argB as number;
				const destCol = argC as number;
				const foundCity = argD ?? false;

				if (!workerId || destRow === undefined || destCol === undefined) return INVALID_MOVE;

				const worker = G.pieces.find((p) => p.id === workerId);
				if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
				if (worker.exhausted) return INVALID_MOVE;

				if (destRow < 0 || destRow >= BOARD_ROWS || destCol < 0 || destCol >= BOARD_COLS) return INVALID_MOVE;

				const range = getMovementRange(player);
				const reachable = getReachableCells(BOARD_ROWS, BOARD_COLS, worker.row, worker.col, range);
				if (!reachable.some(([r, c]) => r === destRow && c === destCol)) return INVALID_MOVE;

				worker.row = destRow;
				worker.col = destCol;
				const isRussia = G.activeCivCard[ctx.currentPlayer]?.civType === 'russia';
				worker.exhausted = !isRussia;

				if (G.activeCivCard[ctx.currentPlayer]?.civType === 'usa') {
					const hasOpponent =
						G.pieces.some((p) => p.type !== undefined && p.owner !== ctx.currentPlayer && p.row === destRow && p.col === destCol && !p.inAgora) ||
						G.cities.some((c) => c.owner !== ctx.currentPlayer && c.row === destRow && c.col === destCol);
					if (hasOpponent) player.gold += 4;
				}

				tryTakeControl(G, ctx.currentPlayer, destRow, destCol);

				if (foundCity) {
					const tile = getTileAt(G.tiles, destRow, destCol);
					if (!tile) return INVALID_MOVE;

					const hasCapitalOrCity =
						G.pieces.some((p) => p.type === 'capital' && p.row === destRow && p.col === destCol) ||
						G.cities.some((c) => c.row === destRow && c.col === destCol);
					if (hasCapitalOrCity) return INVALID_MOVE;

					const hasConstruction = player.researchedTechs[2][1];
					const cubeCost = hasConstruction ? 2 : 1;
					if (player.cubes < cubeCost) return INVALID_MOVE;

					player.cubes -= cubeCost;
					G.cities.push({ owner: ctx.currentPlayer, row: destRow, col: destCol, cubes: cubeCost });

					const cubesPlaced = cubeCost;
					for (let i = 0; i < cubesPlaced; i++) {
						if (player.researchedTechs[3][3]) player.gold += 2;
						else if (player.researchedTechs[3][0]) player.gold += 1;
					}
					if (hasWonder(player, 'hagiaSophia')) player.gold += 2;
				}
			} else if (actionType === 'soldier') {
				const workerId = argA as string;
				const destRow = argB as number;
				const destCol = argC as number;
				const foundCity = argD ?? false;

				if (!workerId || destRow === undefined || destCol === undefined) return INVALID_MOVE;

				const worker = G.pieces.find((p) => p.id === workerId);
				if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
				if (worker.exhausted) return INVALID_MOVE;

				if (destRow < 0 || destRow >= BOARD_ROWS || destCol < 0 || destCol >= BOARD_COLS) return INVALID_MOVE;

				const range = getMovementRange(player);
				const reachable = getReachableCells(BOARD_ROWS, BOARD_COLS, worker.row, worker.col, range);
				if (!reachable.some(([r, c]) => r === destRow && c === destCol)) return INVALID_MOVE;

				const enemyWorkers = G.pieces.filter(
					(p) => p.type === 'worker' && p.owner !== ctx.currentPlayer && p.row === destRow && p.col === destCol && !p.inAgora,
				);
				const enemyCities = G.cities.filter(
					(c) => c.owner !== ctx.currentPlayer && c.row === destRow && c.col === destCol,
				);
				const hasEnemies = enemyWorkers.length > 0 || enemyCities.length > 0;

				if (hasEnemies && G.activeCivCard[ctx.currentPlayer]?.civType === 'usa') {
					player.gold += 4;
				}

				if (hasEnemies) {
					const defenderIds = new Set<string>();
					for (const ew of enemyWorkers) defenderIds.add(ew.owner);
					for (const ec of enemyCities) defenderIds.add(ec.owner);

					let totalAttackCost = 0;
					for (const defenderId of defenderIds) {
						const cost = getAttackCost(G, ctx.currentPlayer, defenderId);
						if (cost === Infinity || player.gold < cost) return INVALID_MOVE;
						player.gold -= cost;
						totalAttackCost += cost;
					}

					for (const [pid, p] of Object.entries(G.players)) {
						if (pid !== ctx.currentPlayer && hasWonder(p, 'greatWall')) p.gold += 3;
						if (pid !== ctx.currentPlayer && hasWonder(p, 'unitedNations')) p.gold += totalAttackCost;
					}

					for (const ew of enemyWorkers) {
						const capital = G.pieces.find((p) => p.type === 'capital' && p.owner === ew.owner);
						if (capital) {
							ew.row = capital.row;
							ew.col = capital.col;
						}
						ew.exhausted = true;
					}

					for (const ec of enemyCities) {
						const defender = G.players[ec.owner];
						if (defender) defender.cubes += ec.cubes;
					}
					G.cities = G.cities.filter(
						(c) => !(c.owner !== ctx.currentPlayer && c.row === destRow && c.col === destCol),
					);

					player.invasionTrackPos++;

					const isChina = G.activeCivCard[ctx.currentPlayer]?.civType === 'china';
					if (isChina && G.gloryTokenSupply.length >= 2) {
						const a = G.gloryTokenSupply.pop()!;
						const b = G.gloryTokenSupply.pop()!;
						const keep = Math.max(a, b);
						const returnToken = Math.min(a, b);
						player.gloryTokens.push(keep);
						G.gloryTokenSupply.unshift(returnToken);
					} else if (G.gloryTokenSupply.length > 0) {
						player.gloryTokens.push(G.gloryTokenSupply.pop()!);
					}

					if (G.activeCivCard[ctx.currentPlayer]?.civType === 'france') {
						player.gold += 4;
					}
				}

				worker.row = destRow;
				worker.col = destCol;
				worker.exhausted = true;

				tryTakeControl(G, ctx.currentPlayer, destRow, destCol);

				if (foundCity) {
					const tile = getTileAt(G.tiles, destRow, destCol);
					if (!tile) return INVALID_MOVE;

					const hasCapitalOrCity =
						G.pieces.some((p) => p.type === 'capital' && p.row === destRow && p.col === destCol) ||
						G.cities.some((c) => c.row === destRow && c.col === destCol);
					if (hasCapitalOrCity) return INVALID_MOVE;

					const hasConstruction = player.researchedTechs[2][1];
					const cubeCost = hasConstruction ? 2 : 1;
					if (player.cubes < cubeCost) return INVALID_MOVE;

					player.cubes -= cubeCost;
					G.cities.push({ owner: ctx.currentPlayer, row: destRow, col: destCol, cubes: cubeCost });

					for (let i = 0; i < cubeCost; i++) {
						if (player.researchedTechs[3][3]) player.gold += 2;
						else if (player.researchedTechs[3][0]) player.gold += 1;
					}
					if (hasWonder(player, 'hagiaSophia')) player.gold += 2;
				}
			} else if (actionType === 'artist') {
				const workerId = argA as string;
				if (!workerId) return INVALID_MOVE;

				const worker = G.pieces.find((p) => p.id === workerId);
				if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
				if (worker.exhausted || worker.inAgora) return INVALID_MOVE;

				worker.inAgora = true;
				worker.exhausted = true;
				player.score += 3;

				if (player.researchedTechs[2][4]) player.score += 2;
				if (G.activeCivCard[ctx.currentPlayer]?.civType === 'eu') player.gold += 4;
			} else if (actionType === 'builder') {
				const workerId = argA as string;
				const buildingCardId = argB as unknown as string;
				if (!buildingCardId) return INVALID_MOVE;

				const civType = G.activeCivCard[ctx.currentPlayer]?.civType;
				const hasWorkerlessCiv = civType === 'rome' || civType === 'arabia';
				const hasGenetics = player.researchedTechs[1][4];
				const workerless = hasWorkerlessCiv || hasGenetics;

				if (!workerless) {
					if (!workerId) return INVALID_MOVE;
					const worker = G.pieces.find((p) => p.id === workerId);
					if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
					if (worker.exhausted || worker.inAgora) return INVALID_MOVE;
					worker.inAgora = true;
					worker.exhausted = true;
					if (player.researchedTechs[2][4]) player.score += 2;
					if (G.activeCivCard[ctx.currentPlayer]?.civType === 'eu') player.gold += 4;
				}

				const cardIdx = G.availableBuildings.findIndex((c) => c.id === buildingCardId);
				if (cardIdx === -1) return INVALID_MOVE;

				const unlockedSlots = getUnlockedBuildingSlots(player);
				const targetSlot = unlockedSlots.findIndex((unlocked, i) => unlocked && player.builtBuildings[i] === null);
				if (targetSlot === -1) return INVALID_MOVE;

				const [card] = G.availableBuildings.splice(cardIdx, 1);
				player.builtBuildings[targetSlot] = card;
			} else if (actionType === 'buildWonder') {
				const wonderCardId = argA as string;
				if (!wonderCardId) return INVALID_MOVE;

				const wonderIdx = G.availableWonders.findIndex((c) => c.id === wonderCardId);
				if (wonderIdx === -1) return INVALID_MOVE;

				const wonderCard = G.availableWonders[wonderIdx];

				const isGreece = G.activeCivCard[ctx.currentPlayer]?.civType === 'greece';
				const useFreeGreece = isGreece && !player.usedGreeceWonder;

				let cost = wonderCard.wonderCost ?? 0;
				if (!useFreeGreece) {
					const activeCiv = G.activeCivCard[ctx.currentPlayer]?.civType;
					if (activeCiv && activeCiv === wonderCard.wonderDiscountCiv) {
						cost = wonderCard.wonderDiscountCost ?? cost;
					}
				} else {
					cost = 0;
				}

				if (player.gold < cost) return INVALID_MOVE;
				player.gold -= cost;
				if (useFreeGreece) player.usedGreeceWonder = true;

				// Free tech wonders: Great Library (1 tech), Oxford University (2 techs)
				if (wonderCard.wonderType === 'greatLibrary') {
					const techRow = argB as number;
					const techCol = argC as unknown as number;
					if (techRow !== undefined && techCol !== undefined) {
						researchFreeTech(G, player, techRow, techCol);
					}
				} else if (wonderCard.wonderType === 'oxfordUniversity') {
					if (Array.isArray(argB)) {
						for (let i = 0; i < argB.length - 1; i += 2) {
							researchFreeTech(G, player, argB[i], argB[i + 1]);
						}
					}
				}

				const [card] = G.availableWonders.splice(wonderIdx, 1);
				player.builtWonders.push(card);
				player.activatedWonders.push(false);

				applyWonderInstantEffect(G, player, card, ctx.currentPlayer);
			} else if (actionType === 'activateBuildingOrWonder') {
				const rawIndex = argA as number;
				if (rawIndex === undefined) return INVALID_MOVE;

				// Indices >= 100 are wonder activations (wonderIndex = rawIndex - 100)
				if (rawIndex >= 100) {
					const wonderIndex = rawIndex - 100;
					if (wonderIndex < 0 || wonderIndex >= player.builtWonders.length) return INVALID_MOVE;
					if (player.activatedWonders[wonderIndex]) return INVALID_MOVE;

					const wCard = player.builtWonders[wonderIndex];
					if (!wCard.wonderType) return INVALID_MOVE;

					const def = WONDER_DEFS[wCard.era ?? 'I']?.find((d) => d.type === wCard.wonderType);
					if (!def?.activateDescription) return INVALID_MOVE;

					player.activatedWonders[wonderIndex] = true;

					if (wCard.wonderType === 'colossus' || wCard.wonderType === 'pyramids' || wCard.wonderType === 'hangingGardens') {
						player.score += 1;
					} else if (wCard.wonderType === 'notreDame') {
						const direction = argB as number;
						if (direction === 0) {
							// Map → Agora: move exhausted workers from map to agora
							for (const piece of G.pieces) {
								if (piece.type === 'worker' && piece.owner === ctx.currentPlayer && piece.exhausted && !piece.inAgora) {
									piece.inAgora = true;
								}
							}
						} else if (direction === 1) {
							// Agora → Capital: move workers from agora to capital
							const capital = G.pieces.find((p) => p.type === 'capital' && p.owner === ctx.currentPlayer);
							if (capital) {
								for (const piece of G.pieces) {
									if (piece.type === 'worker' && piece.owner === ctx.currentPlayer && piece.inAgora) {
										piece.inAgora = false;
										piece.row = capital.row;
										piece.col = capital.col;
									}
								}
							}
						}
					}
				} else {
					// Building activation (slots 0-2)
					const slotIndex = rawIndex;
					if (slotIndex < 0 || slotIndex >= 3) return INVALID_MOVE;

				const card = player.builtBuildings[slotIndex];
				if (!card || !card.buildingType) return INVALID_MOVE;
				if (player.activatedBuildings[slotIndex]) return INVALID_MOVE;

				player.activatedBuildings[slotIndex] = true;

				if (card.buildingType === 'market') {
					const workersInAgora = G.pieces.filter((p) => p.type === 'worker' && p.inAgora).length;
					player.gold += workersInAgora;
				} else if (card.buildingType === 'granary') {
					const myWorkers = G.pieces.filter(
						(p) => p.type === 'worker' && p.owner === ctx.currentPlayer && !p.exhausted && !p.inAgora,
					);
					player.gold += myWorkers.length;
				} else if (card.buildingType === 'bank') {
					player.gold += 4;
				} else if (card.buildingType === 'museum') {
					player.gold += 6;
				} else if (card.buildingType === 'library' || card.buildingType === 'university' || card.buildingType === 'observatory' || card.buildingType === 'laboratory') {
					const discounts: Record<string, number> = { library: 2, university: 3, observatory: 5, laboratory: 99 };
					const discount = discounts[card.buildingType] ?? 0;
					const techRow = argB as number;
					const techCol = argC as unknown as number;
					if (techRow === undefined || techCol === undefined) return INVALID_MOVE;
					if (techRow < 0 || techRow >= TECH_TREE.length || techCol < 1 || techCol >= TECH_TREE[0].length) return INVALID_MOVE;
					if (player.researchedTechs[techRow][techCol]) return INVALID_MOVE;
					if (!player.researchedTechs[techRow][techCol - 1]) return INVALID_MOVE;
					const cost = Math.max(0, TECH_COSTS[techCol] - discount);
					if (player.gold < cost) return INVALID_MOVE;
					player.gold -= cost;
					player.researchedTechs[techRow][techCol] = true;
					const cubeKey: `${number},${number}` = `${techRow + 1},${techCol + 1}`;
					if (player.boardCubes[cubeKey]) {
						player.cubes += player.boardCubes[cubeKey];
						delete player.boardCubes[cubeKey];
					}
					applyImmediateTechEffects(G, player, techRow, techCol);
				} else if (card.buildingType === 'factory') {
					const workerId = argB as unknown as string;
					if (!workerId) return INVALID_MOVE;
					const worker = G.pieces.find((p) => p.id === workerId);
					if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
					if (!worker.exhausted || worker.inAgora) return INVALID_MOVE;
					worker.exhausted = false;
				} else if (card.buildingType === 'movieTheater') {
					const workersInAgora = G.pieces.filter((p) => p.type === 'worker' && p.inAgora).length;
					player.score += workersInAgora * 2;
				} else if (card.buildingType === 'central') {
					const myCities = G.cities.filter((c) => c.owner === ctx.currentPlayer).length;
					const hasCapital = G.pieces.some((p) => p.type === 'capital' && p.owner === ctx.currentPlayer);
					player.gold += (myCities + (hasCapital ? 1 : 0)) * 2;
				} else if (card.buildingType === 'wall') {
					return INVALID_MOVE;
				}
				}
			} else if (actionType === 'startGoldenAge') {
				const standingWorkers = G.pieces.filter(
					(p) => p.type === 'worker' && p.owner === ctx.currentPlayer && !p.exhausted && !p.inAgora,
				);
				if (standingWorkers.length > 0) return INVALID_MOVE;

				const historyCardId = argA as string | undefined;
				const isFirstThisEra = !Object.values(G.players).some((p) => p.passedThisEra);

				if (isFirstThisEra && G.historyJudgementCards.length > 0) {
					if (!historyCardId) return INVALID_MOVE;
					const cardIdx = G.historyJudgementCards.findIndex((c) => c.id === historyCardId);
					if (cardIdx === -1) return INVALID_MOVE;
					const [card] = G.historyJudgementCards.splice(cardIdx, 1);
					player.historyCards.push(card);
					G.eraJudgementCard = card;
				}

				player.passedThisEra = true;

				if (G.currentEra === 'IV' && isFirstThisEra) {
					G.eraIVRemainingTurns = Object.keys(G.players).length - 1;
				}
			} else if (actionType === 'developTechnology') {
				const isJapan = G.activeCivCard[ctx.currentPlayer]?.civType === 'japan';
				const discount = isJapan ? 2 : 0;

				const techPairs: [number, number][] = Array.isArray(argA)
					? Array.from({ length: argA.length / 2 }, (_, i) => [argA[i * 2], argA[i * 2 + 1]])
					: [[argA as number, argB as number]];

				if (techPairs.length > 1 && !isJapan) return INVALID_MOVE;

				for (const [row, col] of techPairs) {
					if (row === undefined || col === undefined) return INVALID_MOVE;
					if (row < 0 || row >= TECH_TREE.length || col < 1 || col >= TECH_TREE[0].length) return INVALID_MOVE;
					if (player.researchedTechs[row][col]) return INVALID_MOVE;
					if (!player.researchedTechs[row][col - 1]) return INVALID_MOVE;

					const cost = Math.max(0, TECH_COSTS[col] - discount);
					if (player.gold < cost) return INVALID_MOVE;

					player.gold -= cost;
					player.researchedTechs[row][col] = true;

					const cubeKey: BoardCubeKey = `${row + 1},${col + 1}`;
					if (player.boardCubes[cubeKey]) {
						player.cubes += player.boardCubes[cubeKey];
						delete player.boardCubes[cubeKey];
					}

					applyImmediateTechEffects(G, player, row, col);
				}
			}

			if (G.eraIVRemainingTurns > 0) {
				G.eraIVRemainingTurns--;
				if (G.eraIVRemainingTurns === 0) {
					if (G.eraJudgementCard) {
						scoreJudgementCard(G, G.eraJudgementCard);
						G.eraJudgementCard = null;
					}
					performEndGameScoring(G);
				}
			}

			checkEraEnd(G);
		},

		collectGoldenAgeIncome: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
		) => {
			if (G.phase !== 'actions') return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player || !player.passedThisEra) return INVALID_MOVE;

			player.gold += GOLDEN_AGE_INCOME;

			if (G.eraIVRemainingTurns > 0) {
				G.eraIVRemainingTurns--;
				if (G.eraIVRemainingTurns === 0) {
					if (G.eraJudgementCard) {
						scoreJudgementCard(G, G.eraJudgementCard);
						G.eraJudgementCard = null;
					}
					performEndGameScoring(G);
				}
			}

			checkEraEnd(G);
		},
	},

	endIf: ({ G }: { G: GoldenAgesState }) => {
		if (G.eraIVRemainingTurns === 0) {
			return { gameOver: true };
		}
		if (G.currentEra === 'IV' && Object.values(G.players).every((p) => p.passedThisEra)) {
			return { gameOver: true };
		}
	},

	turn: {
		minMoves: 1,
		maxMoves: 1,
	},
};

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------

export const gameDef = defineGame<GoldenAgesState>({
	game: GoldenAgesGame,
	id: 'TheGoldenAges',
	displayName: 'The Golden Ages',
	description: 'Build your civilisation across the ages and leave your mark on history.',
	minPlayers: 2,
	maxPlayers: 4,
});
