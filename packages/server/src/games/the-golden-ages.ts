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

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'black';

export type Era = 'I' | 'II' | 'III' | 'IV';

export type CardType =
	| 'civilisation'
	| 'wonder'
	| 'building'
	| 'futureTech'
	| 'historysJudgement'
	| 'culture';

export type BackColor = 'green' | 'purple' | 'orange' | 'blue' | 'gray' | 'teal';

export type CultureCardSubtype = 'progress' | 'cult' | 'government' | 'masterpiece' | 'building';

export type GamePhase = 'eraStart' | 'tilePlacement' | 'actions';

export type ResourceType = 'gem' | 'rock' | 'game' | 'wheat';

export type EdgeType = 'water' | 'land';
export type CellEdges = [EdgeType, EdgeType, EdgeType, EdgeType]; // [top, right, bottom, left]

export type ActionType =
	| 'explorer'
	| 'builder'
	| 'artist'
	| 'soldier'
	| 'culture'
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
	{ type: 'culture', label: 'Culture', description: 'Advance on a culture row and draw a culture card', requiresWorker: false },
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
	cultureSubtype?: CultureCardSubtype;
	cultSpots?: number;
	cultSpotVP?: number;
	vp?: number;
	gold?: number;
}

export interface CultureCardDef {
	type: string;
	name: string;
	subtype: CultureCardSubtype;
	description: string;
	cultSpots?: number;
	cultSpotVP?: number;
	vp?: number;
	gold?: number;
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

export const EXPANSION_JUDGEMENT_DEFS: JudgementDef[] = [
	{ type: 'mostSpiritual', name: 'The Most Spiritual Civ', description: '2 VP per Cult token controlled' },
	{ type: 'mostCultured', name: 'The Most Cultured Civ', description: '2 VP per Progress card possessed' },
	{ type: 'mostArtistic', name: 'The Most Artistic Civ', description: '2 VP per Masterpiece possessed' },
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

export const EXPANSION_FUTURE_TECH_DEFS: FutureTechDef[] = [
	{ type: 'spiritualMedicine', name: 'Spiritual Medicine', description: '8 VPs if you control the most Cult tokens' },
	{ type: 'hiveMind', name: 'Hive-Mind', description: '8 VPs if you have the most Progress cards' },
	{ type: 'virtualReality', name: 'Virtual Reality', description: '8 VPs if you have the most Masterpieces' },
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

export const EXPANSION_WONDER_DEFS: Record<Era, WonderDef[]> = {
	I: [
		{ type: 'stonehenge', name: 'Stonehenge', description: 'Permanent: 1 gold discount when developing a tech another player already has', cost: 5, discountCiv: 'celts', discountCost: 4 },
		{ type: 'lighthouse', name: 'Lighthouse', description: 'Your workers may move 1 extra space on the map', cost: 3 },
	],
	II: [
		{ type: 'angkorWat', name: 'Angkor Wat', description: 'Immediate: Score 2 VP per wheat you control', cost: 8 },
		{ type: 'machuPicchu', name: 'Machu Picchu', description: 'Immediate: Score 2 VP per rock you control', cost: 8, discountCiv: 'inca', discountCost: 6 },
	],
	III: [
		{ type: 'alhambra', name: 'Alhambra', description: 'Activate: Advance 1 space on a culture row (ignores requirements)', cost: 8, discountCiv: 'spain', discountCost: 6, activateDescription: 'Advance 1 space on a culture row (ignores requirements)' },
		{ type: 'tajMahal', name: 'Taj Mahal', description: 'Activate: Re-enable a used building or wonder this round', cost: 6, activateDescription: 'Re-enable a used building or wonder this round' },
	],
	IV: [
		{ type: 'christTheRedeemer', name: 'Christ the Redeemer', description: 'Immediate: Remove up to 5 of your cubes from the map. Score 2 VP per cube removed', cost: 8, discountCiv: 'brazil', discountCost: 6 },
		{ type: 'cnTower', name: 'CN Tower', description: 'Permanent: When developing a final-level tech, you may score VPs as if you were another player', cost: 10, discountCiv: 'canada', discountCost: 8 },
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

export const EXPANSION_BUILDING_DEFS: Record<Era, BuildingDef[]> = {
	I: [
		{ type: 'temple', name: 'Temple', description: 'Activate: Activate up to 2 spaces on the Culture Row (civ must meet requirements)' },
	],
	II: [
		{ type: 'barracks', name: 'Barracks', description: 'Activate: Draw 2 glory tokens, swap 1 you own with 1 drawn, return the rest' },
	],
	III: [
		{ type: 'cathedral', name: 'Cathedral', description: 'Activate: Advance 1 space on the Culture Row (ignores requirements)' },
	],
	IV: [
		{ type: 'militaryBase', name: 'Military Base', description: 'Immediate: Take a glory token onto this card (does not use Invasion track)' },
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

export const EXPANSION_CIV_DEFS: Record<Era, CivDef[]> = {
	I: [
		{ type: 'celts', number: 8, name: 'Celts', description: 'Immediate: Advance 1 space on a culture row (ignores requirements)' },
	],
	II: [
		{ type: 'vikings', number: 7, name: 'Vikings', description: 'After attacking, un-exhaust one of your exhausted workers (even the attacker)' },
		{ type: 'songhai', number: 8, name: 'Songhai', description: 'After attacking, advance on a culture row (ignores requirements)' },
	],
	III: [
		{ type: 'dutch', number: 7, name: 'Dutch', description: 'May build cities on the main map. Earn 2 gold each time' },
		{ type: 'iroquois', number: 8, name: 'Iroquois', description: 'After gaining control of a Game symbol, take 2 extra gold and advance 1 culture row space (ignores requirements). Doubled on double Game spaces' },
	],
	IV: [
		{ type: 'canada', number: 7, name: 'Canada', description: 'Take 1 gold for each Rock or Wheat symbol you control' },
		{ type: 'southAfrica', number: 8, name: 'South Africa', description: 'After taking control of a Gem symbol, advance on a culture row (ignores requirements)' },
	],
};

// ---------------------------------------------------------------------------
// Standalone Masterpiece cards (drawn from separate display)
// ---------------------------------------------------------------------------

export const MASTERPIECE_DEFS: CultureCardDef[] = [
	{ type: 'mondrianGrid', name: 'Mondrian Grid', subtype: 'masterpiece', description: '2 VP & 2 gold', vp: 2, gold: 2 },
	{ type: 'sistineChapel', name: 'Sistine Chapel', subtype: 'masterpiece', description: '1 VP & 3 gold', vp: 1, gold: 3 },
	{ type: 'discobolusOfMyron', name: 'Discobolus of Myron', subtype: 'masterpiece', description: '2 gold for each unique resource you control' },
	{ type: 'monaLisa', name: 'Mona Lisa', subtype: 'masterpiece', description: '1 VP for each unique resource you control' },
	{ type: 'cupidAndPsyche', name: 'Cupid & Psyche', subtype: 'masterpiece', description: '1 VP & 3 gold', vp: 1, gold: 3 },
	{ type: 'theWave', name: 'The Wave', subtype: 'masterpiece', description: '2 VP & 2 gold', vp: 2, gold: 2 },
];

// ---------------------------------------------------------------------------
// Culture cards (per-era decks, 10 cards each)
// ---------------------------------------------------------------------------

export const CULTURE_CARD_DEFS: Record<Era, CultureCardDef[]> = {
	I: [
		// Progress
		{ type: 'codeOfLaws', name: 'Code of Laws', subtype: 'progress', description: '2 extra gold when your worker(s) go to the Agora' },
		{ type: 'cartography', name: 'Cartography', subtype: 'progress', description: 'Workers move 1 extra space' },
		{ type: 'animalHusbandry', name: 'Animal Husbandry', subtype: 'progress', description: '1 extra gold when you take control of a Game symbol' },
		{ type: 'irrigation', name: 'Irrigation', subtype: 'progress', description: '1 extra gold when you take control of a Wheat symbol' },
		{ type: 'bronzeWorking', name: 'Bronze Working', subtype: 'progress', description: '1 extra gold when you take control of a Rock symbol' },
		// Cult
		{ type: 'mysticism', name: 'Mysticism', subtype: 'cult', description: 'End of game: 1 VP for each spot not covered', cultSpots: 5, cultSpotVP: 1 },
		// Government
		{ type: 'cityState', name: 'City-State', subtype: 'government', description: 'Discount of 1 gold when you attack' },
		{ type: 'monarchy', name: 'Monarchy', subtype: 'government', description: 'While in a Golden Age, gain 1 extra gold (normally 2)' },
		// Masterpiece
		{ type: 'odyssey', name: 'Odyssey', subtype: 'masterpiece', description: 'Immediately get 2 VPs', vp: 2 },
		// Building
		{ type: 'cultureLibrary', name: 'Library', subtype: 'building', description: 'Activate: Develop a tech at a discount of 2 gold' },
	],
	II: [
		// Progress
		{ type: 'gunpowder', name: 'Gunpowder', subtype: 'progress', description: 'Extra attack at a cost of 5 gold' },
		{ type: 'navigation', name: 'Navigation', subtype: 'progress', description: 'Workers move 2 extra spaces on the map' },
		{ type: 'alchemy', name: 'Alchemy', subtype: 'progress', description: '1 extra gold when you take control of a Gem symbol' },
		{ type: 'cropRotation', name: 'Crop Rotation', subtype: 'progress', description: '1 extra gold when you take control of a Wheat symbol' },
		{ type: 'ironWorking', name: 'Iron Working', subtype: 'progress', description: '1 extra gold when you take control of a Rock symbol' },
		// Cult
		{ type: 'religion', name: 'Religion', subtype: 'cult', description: 'End of game: 2 VP for each spot not covered', cultSpots: 4, cultSpotVP: 2 },
		// Government
		{ type: 'theocracy', name: 'Theocracy', subtype: 'government', description: 'When you spread a cult token, get 2 gold' },
		{ type: 'feudalism', name: 'Feudalism', subtype: 'government', description: 'After an attack, draw 2 glory tokens. Keep one, return the other' },
		// Masterpiece
		{ type: 'laPrimavera', name: 'La Primavera', subtype: 'masterpiece', description: 'Immediately get 3 VPs', vp: 3 },
		// Building
		{ type: 'cultureBarrack', name: 'Barrack', subtype: 'building', description: 'Activate: Draw 2 glory tokens, swap one with a glory token you own, return the other 2' },
	],
	III: [
		// Progress
		{ type: 'justiceSystem', name: 'Justice System', subtype: 'progress', description: '2 extra gold when one of your workers goes to the Agora' },
		{ type: 'militaryTactic', name: 'Military Tactic', subtype: 'progress', description: 'Extra attack at a cost of 8 gold' },
		{ type: 'chemistry', name: 'Chemistry', subtype: 'progress', description: '1 extra gold when you take control of a Gem symbol' },
		{ type: 'mechanizedAgriculture', name: 'Mechanized Agriculture', subtype: 'progress', description: '1 extra gold when you take control of a Wheat symbol' },
		{ type: 'combustion', name: 'Combustion', subtype: 'progress', description: '1 extra gold when you take control of a Rock symbol' },
		// Cult
		{ type: 'theology', name: 'Theology', subtype: 'cult', description: 'End of game: 3 VP for each spot not covered', cultSpots: 4, cultSpotVP: 3 },
		// Government
		{ type: 'republic', name: 'Republic', subtype: 'government', description: 'While in a Golden Age, gain 2 extra VPs on your turn (normally 0)' },
		{ type: 'totalitarianism', name: 'Totalitarianism', subtype: 'government', description: 'When you found a city, spread up to 4 cult tokens (may be from different cult cards)' },
		// Masterpiece
		{ type: 'waterLilies', name: 'Water Lilies', subtype: 'masterpiece', description: 'Immediately get 4 VPs', vp: 4 },
		// Building
		{ type: 'cultureFactory', name: 'Factory', subtype: 'building', description: 'Activate: Un-exhaust one of your exhausted workers on the map' },
	],
	IV: [
		// Progress
		{ type: 'atomicEnergy', name: 'Atomic Energy', subtype: 'progress', description: 'Immediate: Spend 2 gold per glory token you have, score 2 VP each' },
		{ type: 'satellites', name: 'Satellites', subtype: 'progress', description: 'Immediate: Spend any gold, score 1 VP per 2 gold spent' },
		{ type: 'superconductors', name: 'Superconductors', subtype: 'progress', description: 'Immediate: Spend 1 gold per Gem controlled, score 1 VP each' },
		{ type: 'sanitarySystem', name: 'Sanitary System', subtype: 'progress', description: 'Immediate: Spend 1 gold per Wheat controlled, score 1 VP each' },
		{ type: 'robotics', name: 'Robotics', subtype: 'progress', description: 'Immediate: Spend 1 gold per Rock controlled, score 1 VP each' },
		// Cult
		{ type: 'syncretism', name: 'Syncretism', subtype: 'cult', description: 'End of game: 5 VP for each spot not covered', cultSpots: 3, cultSpotVP: 5 },
		// Government
		{ type: 'democracy', name: 'Democracy', subtype: 'government', description: 'Whenever an opponent attacks you, score 4 VPs' },
		{ type: 'communism', name: 'Communism', subtype: 'government', description: 'Immediate: Discard all cult tokens under your control. Spend 1 gold per token for 2 VPs each' },
		// Masterpiece
		{ type: 'guernica', name: 'Guernica', subtype: 'masterpiece', description: 'Immediately get 5 VPs', vp: 5 },
		// Building
		{ type: 'cultureMilitaryBase', name: 'Military Base', subtype: 'building', description: 'Immediate: Take a glory token from the reserve, place it on the card' },
	],
};

export type EraDecks = Record<Era, GameCard[]>;

export interface CardDecks {
	wonder: EraDecks;
	building: EraDecks;
}

export type BoardCubeKey = `${number},${number}`;

// ---------------------------------------------------------------------------
// Culture Board types (Cults & Culture expansion)
// ---------------------------------------------------------------------------

export interface CultureGridCell {
	row: number;
	col: number;
	requirement: string | null;
}

export interface CultCardState {
	card: GameCard;
	remainingTokens: number;
	tokenTypes?: number[];
}

export interface CultureBoardState {
	grid: CultureGridCell[][];
	tokenPositions: Record<string, number[]>;
	cultureDecks: Record<Era, GameCard[]>;
	cultureDisplay: GameCard[];
	masterpieceDeck: GameCard[];
	cultTokensOnBoard: Record<string, number[]>;
	cultTokenSupply: number[];
}

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------

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
	assigned1x1Tile: TileTemplate | null;
	builtBuildings: (GameCard | null)[];
	activatedBuildings: boolean[];
	usedGreeceWonder: boolean;
	invasionTrackPos: number;
	gloryTokens: number[];
	builtWonders: GameCard[];
	activatedWonders: boolean[];
	cultureScore: number;
	progressCards: GameCard[];
	governmentCard: GameCard | null;
	cultCards: CultCardState[];
	masterpieceCards: GameCard[];
}

export const INVASION_COSTS = [3, 5, 8, 12];

const CULTURE_GRID_REQUIREMENTS: (string | null)[][] = [
	[null, 'tech_lvl_3', 'tech_lvl_4', 'tech_lvl_5'],
	[null, 'glory_1',    'glory_2',    'glory_3'],
	[null, 'cubes_3',    'cubes_6',    'cubes_9'],
	[null, 'wonders_1',  'wonders_2',  'wonders_3'],
	[null, 'gold_6',     'gold_12',    'gold_18'],
];

export const CULTURE_GRID_ROWS = CULTURE_GRID_REQUIREMENTS.length;
export const CULTURE_GRID_COLS = CULTURE_GRID_REQUIREMENTS[0].length;

export const CULTURE_GRID: CultureGridCell[][] = CULTURE_GRID_REQUIREMENTS.map((reqs, row) =>
	reqs.map((req, col) => ({ row, col, requirement: req })),
);

export function checkCultureRequirement(
	requirement: string | null,
	player: GoldenAgesPlayerState,
	G: GoldenAgesState,
	playerId: string,
): boolean {
	if (requirement === null) return true;

	const parts = requirement.split('_');
	const value = parseInt(parts[parts.length - 1], 10);

	if (requirement.startsWith('tech_lvl_')) {
		const col = value - 1;
		return player.researchedTechs.some((row) => row[col]);
	}
	if (requirement.startsWith('glory_')) {
		return player.gloryTokens.length >= value;
	}
	if (requirement.startsWith('cubes_')) {
		let cubesOnMap = 0;
		for (const city of G.cities) {
			if (city.owner === playerId) cubesOnMap += city.cubes;
		}
		return cubesOnMap >= value;
	}
	if (requirement.startsWith('wonders_')) {
		return player.builtWonders.length >= value;
	}
	if (requirement.startsWith('gold_')) {
		return player.gold >= value;
	}

	return false;
}

const CULTURE_DISPLAY_SIZE = 5;
const CULT_TOKEN_TYPES = 6;
const CULT_TOKENS_PER_TYPE = 3;

export function advanceCultureRow(
	G: GoldenAgesState,
	playerId: string,
	row: number,
	ignoreRequirements: boolean,
): boolean {
	if (!G.cultureBoard) return false;

	const positions = G.cultureBoard.tokenPositions[playerId];
	if (!positions) return false;

	const currentCol = positions[row];
	if (currentCol >= CULTURE_GRID_COLS - 1) return false;

	const nextCol = currentCol + 1;
	const player = G.players[playerId];
	if (!player) return false;

	if (!ignoreRequirements) {
		const cell = G.cultureBoard.grid[row][nextCol];
		if (!checkCultureRequirement(cell.requirement, player, G, playerId)) return false;
	}

	positions[row] = nextCol;
	player.cultureScore++;
	G.pendingCulturePicks++;
	return true;
}

function applyMasterpieceEffect(G: GoldenAgesState, player: GoldenAgesPlayerState, playerId: string, card: GameCard): void {
	player.score += card.vp ?? 0;
	player.gold += card.gold ?? 0;

	if (card.id === 'masterpiece-discobolusOfMyron') {
		const types: ResourceType[] = ['game', 'wheat', 'rock', 'gem'];
		let unique = 0;
		for (const t of types) {
			if (countPlayerResources(G, playerId, t) > 0) unique++;
		}
		player.gold += unique * 2;
	} else if (card.id === 'masterpiece-monaLisa') {
		const types: ResourceType[] = ['game', 'wheat', 'rock', 'gem'];
		let unique = 0;
		for (const t of types) {
			if (countPlayerResources(G, playerId, t) > 0) unique++;
		}
		player.score += unique;
	}
}

function receiveCultureCard(G: GoldenAgesState, playerId: string, card: GameCard): void {
	const player = G.players[playerId];
	if (!player) return;

	switch (card.cultureSubtype) {
		case 'progress':
			player.progressCards.push(card);
			break;
		case 'masterpiece':
			player.masterpieceCards.push(card);
			player.score += card.vp ?? 0;
			break;
		case 'government':
			player.governmentCard = card;
			break;
		case 'cult':
			if (!player.cultCards) player.cultCards = [];
			player.cultCards.push({
				card,
				remainingTokens: card.cultSpots ?? 0,
			});
			G.pendingCultFill = {
				cardIndex: player.cultCards.length - 1,
				spotsRemaining: card.cultSpots ?? 0,
			};
			break;
		case 'building':
			player.hand.push(card);
			break;
	}
}

function refillCultureDisplay(G: GoldenAgesState): void {
	if (!G.cultureBoard) return;
	const deck = G.cultureBoard.cultureDecks[G.currentEra];
	while (G.cultureBoard.cultureDisplay.length < CULTURE_DISPLAY_SIZE && deck.length > 0) {
		const card = deck.splice(0, 1)[0];
		if (card) G.cultureBoard.cultureDisplay.push(card);
	}
}

export const GLORY_TOKEN_POOL: number[] = [
	...Array(2).fill(2),
	...Array(4).fill(3),
	...Array(4).fill(4),
	...Array(4).fill(5),
	...Array(2).fill(6),
];

export const EXPANSION_GLORY_TOKENS: number[] = [
	...Array(2).fill(3),
	...Array(6).fill(4),
	...Array(2).fill(5),
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

export interface GameLogEntry {
	message: string;
	playerColor?: string;
}

const MAX_LOG_ENTRIES = 150;

function appendLog(G: GoldenAgesState, ctx: Ctx, message: string): void {
	if (!G.gameLog) G.gameLog = [];
	const player = G.players[ctx.currentPlayer];
	const playerColor = player?.color;
	G.gameLog.push({ message, playerColor });
	if (G.gameLog.length > MAX_LOG_ENTRIES) G.gameLog.shift();
}

export interface GoldenAgesSetupData {
	expansion?: boolean;
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
	/** Per-player breakdown of final score (filled by performEndGameScoring). */
	endGameScoreBreakdown: Record<string, { label: string; vp: number }[]>;
	boardEdges: Record<string, CellEdges>;
	gameLog: GameLogEntry[];
	setupOptions: { expansion: boolean };
	cultureBoard: CultureBoardState | null;
	pendingCulturePicks: number;
	pendingCultFill: { cardIndex: number; spotsRemaining: number } | null;
	pendingCultSpread: { cityRow: number; cityCol: number; remaining: number; usedDestinations: string[] } | null;
	/** Set when current player gains a glory token (for client to show a brief reveal animation). Cleared at start of next move. */
	lastGloryDraw: { playerId: string; vp: number } | null;
	/** Set when first player this era picks a History's Judgement card (so other players can see which card was picked). Cleared at start of next move. */
	lastHistoryCardPickPlayerId: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow', 'black'];

const BOARD_ROWS = 6;
const BOARD_COLS = 10;

const STARTING_TILE_ANCHOR: [number, number] = [2, 4];

const CARD_CONFIG: Record<string, { backColor: BackColor }> = {
	civilisation: { backColor: 'green' },
	wonder: { backColor: 'purple' },
	building: { backColor: 'orange' },
	futureTech: { backColor: 'blue' },
	historysJudgement: { backColor: 'gray' },
	culture: { backColor: 'teal' },
};

const ERA_COUNTS: Record<string, Record<Era, number>> = {
	civilisation: { I: 7, II: 6, III: 6, IV: 6 },
	wonder: { I: 4, II: 4, III: 4, IV: 4 },
	building: { I: 6, II: 6, III: 6, IV: 6 },
};

const SMALL_L = defineTileShape('SmallL', [[0, 0], [1, 0], [1, 1]], 'Small L');
const _SINGLE_1X1 = defineTileShape('1x1', [[0, 0]], '1x1'); // eslint-disable-line @typescript-eslint/no-unused-vars
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
	{ id: 1, resources: [['wheat'], ['wheat'], ['rock']], edges: [[W, W, L, W], [L, L, W, W], [L, L, W, L]] },
	{ id: 2, resources: [['wheat'], ['game'], ['rock']], edges: [[L, L, L, L], [L, L, W, L], [L, W, W, L]] },
	{ id: 3, resources: [['wheat'], ['rock'], ['rock']], edges: [[L, L, L, L], [L, L, W, W], [L, W, W, L]] },
	{ id: 4, resources: [['rock'], ['game'], ['wheat']], edges: [[W, W, L, W], [L, L, L, W], [W, W, L, L]] },
];

export const DOMINO_TILE_TEMPLATES: TileTemplate[] = [
	{ id: 5, resources: [['gem'], ['rock']], edges: [[L, L, L, L], [L, W, W, L]] },
	{ id: 6, resources: [['game'], ['gem']], edges: [[W, L, L, L], [W, W, L, L]] },
	{ id: 7, resources: [['rock'], ['gem']], edges: [[W, L, L, W], [W, W, L, L]] },
	{ id: 8, resources: [['wheat'], ['gem']], edges: [[W, L, W, L], [L, W, W, L]] },
	{ id: 9, resources: [['game', 'game'], ['gem']], edges: [[L, L, W, W], [W, W, W, L]] },
	{ id: 10, resources: [['gem'], ['wheat']], edges: [[W, L, L, L], [W, L, L, L]] },
	{ id: 11, resources: [['gem'], ['wheat']], edges: [[L, L, W, W], [L, W, W, L]] },
	{ id: 12, resources: [['rock'], ['rock']], edges: [ALL_LAND, ALL_LAND] }, // all land confirmed
	{ id: 13, resources: [['rock'], ['gem']], edges: [ALL_LAND, [L, W, L, L]] },
	{ id: 14, resources: [['game', 'game'], ['gem']], edges: [[W, L, L, W], [W, W, W, L]] },
	{ id: 15, resources: [['gem'], ['game']], edges: [[W, L, L, W], [W, W, L, L]] },
	{ id: 16, resources: [['wheat'], ['wheat']], edges: [[W, L, W, W], [W, W, W, L]] },
];

export const EXPANSION_1X1_TILE_TEMPLATES: TileTemplate[] = [
	{ id: 17, resources: [['gem']], edges: [[W, W, W, W]] },
	{ id: 18, resources: [['rock']], edges: [[W, W, L, W]] },
	{ id: 19, resources: [['wheat']], edges: [[W, L, L, L]] },
	{ id: 20, resources: [['gem']], edges: [ALL_LAND] },
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

function buildWonderDecks(expansion: boolean): EraDecks {
	const backColor: BackColor = 'purple';
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: EraDecks = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = [...WONDER_DEFS[era], ...(expansion ? EXPANSION_WONDER_DEFS[era] : [])];
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

function buildBuildingDecks(expansion: boolean): EraDecks {
	const backColor: BackColor = 'orange';
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: EraDecks = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = [...BUILDING_DEFS[era], ...(expansion ? EXPANSION_BUILDING_DEFS[era] : [])];
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

function buildCivDecks(expansion: boolean): EraDecks {
	const backColor: BackColor = 'green';
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: EraDecks = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = [...CIV_DEFS[era], ...(expansion ? EXPANSION_CIV_DEFS[era] : [])];
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

function buildJudgementDeck(expansion: boolean): GameCard[] {
	const defs = [...JUDGEMENT_DEFS, ...(expansion ? EXPANSION_JUDGEMENT_DEFS : [])];
	const cards: GameCard[] = defs.map((def) => ({
		id: `judgement-${def.type}`,
		cardType: 'historysJudgement' as CardType,
		backColor: CARD_CONFIG.historysJudgement.backColor as BackColor,
		name: def.name,
		judgementType: def.type,
		description: def.description,
	}));
	return shuffle(cards);
}

function buildFutureTechDeck(expansion: boolean): GameCard[] {
	const defs = [...FUTURE_TECH_DEFS, ...(expansion ? EXPANSION_FUTURE_TECH_DEFS : [])];
	const cards: GameCard[] = defs.map((def) => ({
		id: `futureTech-${def.type}`,
		cardType: 'futureTech' as CardType,
		backColor: CARD_CONFIG.futureTech.backColor as BackColor,
		name: def.name,
		futureTechType: def.type,
		description: def.description,
	}));
	return shuffle(cards);
}

function buildCultureDecks(): Record<Era, GameCard[]> {
	const backColor = CARD_CONFIG.culture.backColor;
	const eras: Era[] = ['I', 'II', 'III', 'IV'];
	const result: Record<Era, GameCard[]> = { I: [], II: [], III: [], IV: [] };
	for (const era of eras) {
		const defs = CULTURE_CARD_DEFS[era];
		const cards: GameCard[] = defs.map((def) => ({
			id: `culture-${era}-${def.type}`,
			cardType: 'culture' as CardType,
			era,
			backColor,
			name: def.name,
			description: def.description,
			cultureSubtype: def.subtype,
			cultSpots: def.cultSpots,
			cultSpotVP: def.cultSpotVP,
			vp: def.vp,
			gold: def.gold,
			...(def.subtype === 'building' ? { buildingType: def.type } : {}),
		}));
		result[era] = shuffle(cards);
	}
	return result;
}

function buildMasterpieceDeck(): GameCard[] {
	const backColor = CARD_CONFIG.culture.backColor;
	const cards: GameCard[] = MASTERPIECE_DEFS.map((def) => ({
		id: `masterpiece-${def.type}`,
		cardType: 'culture' as CardType,
		backColor,
		name: def.name,
		description: def.description,
		cultureSubtype: 'masterpiece' as CultureCardSubtype,
		vp: def.vp,
		gold: def.gold,
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
	if (!shape?.offsets?.length) return false;
	const offsets = rotateTileOffsets(shape.offsets, rotation);
	const tileCells = new Set(offsets.map(([dr, dc]) => getCellKey(anchorRow + dr, anchorCol + dc)));
	const occupancy = layer?.occupancy ?? {};

	for (const [dr, dc] of offsets) {
		const r = anchorRow + dr;
		const c = anchorCol + dc;
		for (const [nr, nc] of EDGE_NEIGHBORS) {
			const neighborKey = getCellKey(r + nr, c + nc);
			if (!tileCells.has(neighborKey) && occupancy[neighborKey] !== undefined) {
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
	if (!layer?.occupancy || !board) return false;
	if (!canPlaceTile(layer, board, shape, anchorRow, anchorCol, rotation)) return false;
	if (!hasAdjacentTile(layer, shape, anchorRow, anchorCol, rotation)) return false;
	if (boardEdges && tileEdges?.length) {
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
	const wonderDraw = ERA_COUNTS.wonder[era];
	G.availableWonders = G.decks.wonder[era].splice(0, wonderDraw);
	G.availableBuildings = G.decks.building[era].splice(0, numPlayers);

	if (G.cultureBoard) {
		G.cultureBoard.cultureDisplay = [];
		refillCultureDisplay(G);
	}

	G.phase = 'eraStart';
	G.eraStartDone = 0;
}

// ---------------------------------------------------------------------------
// Era transition
// ---------------------------------------------------------------------------

const NEXT_ERA: Record<Era, Era | null> = { I: 'II', II: 'III', III: 'IV', IV: null };

function applyImmediateTechEffects(
	G: GoldenAgesState,
	player: GoldenAgesPlayerState,
	row: number,
	col: number,
	mirrorResourcePlayerId?: string,
): void {
	if (col !== 4) return;
	const resourceToCount: Record<number, ResourceType> = { 0: 'gem', 1: 'wheat', 2: 'rock' };
	const vpPerResource: Record<number, number> = { 0: 3, 1: 2, 2: 2 };

	// CN Tower: score VPs using another player's resources/cubes instead of the developer's
	const countForPlayerId =
		mirrorResourcePlayerId && G.players[mirrorResourcePlayerId] && mirrorResourcePlayerId !== Object.keys(G.players).find((id) => G.players[id] === player)
			? mirrorResourcePlayerId
			: Object.keys(G.players).find((id) => G.players[id] === player);

	if (!countForPlayerId) return;

	if (row <= 2) {
		const targetRes = resourceToCount[row];
		const vpPer = vpPerResource[row];
		let count = 0;
		for (const [key, owner] of Object.entries(G.controlledResources)) {
			if (owner !== countForPlayerId) continue;
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
		for (const city of G.cities) {
			if (city.owner === countForPlayerId) cubesOnMap += city.cubes;
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

function applyCivCardEffect(
	G: GoldenAgesState,
	player: GoldenAgesPlayerState,
	card: GameCard,
	playerId: string,
	indiaRow?: number,
): void {
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

	if (card.civType === 'celts' && G.cultureBoard) {
		for (let r = 0; r < CULTURE_GRID_ROWS; r++) {
			if (advanceCultureRow(G, playerId, r, true)) break;
		}
	}
	if (card.civType === 'canada') {
		player.gold += countPlayerResources(G, playerId, 'rock') + countPlayerResources(G, playerId, 'wheat');
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
	if (hasGovernment(attacker, 'cityState')) {
		cost = Math.max(0, cost - 1);
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

function controlsCell(G: GoldenAgesState, playerId: string, r: number, c: number): boolean {
	for (const piece of G.pieces) {
		if (
			piece.row === r &&
			piece.col === c &&
			!piece.inAgora &&
			(piece.type === 'worker' || piece.type === 'capital') &&
			piece.owner === playerId
		) {
			return true;
		}
	}
	for (const city of G.cities) {
		if (city.row === r && city.col === c && city.owner === playerId) return true;
	}
	return false;
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
			// Expansion judgement: 2 VP per cult token / progress card / masterpiece
			case 'mostSpiritual': {
				let cultTokensControlled = 0;
				if (G.cultureBoard) {
					for (const [cellKey, cellTokens] of Object.entries(G.cultureBoard.cultTokensOnBoard)) {
						const [r, c] = cellKey.split(',').map(Number);
						const controls = controlsCell(G, pid, r, c);
						if (controls) cultTokensControlled += cellTokens.length;
					}
				}
				vp = cultTokensControlled * 2;
				break;
			}
			case 'mostCultured':
				vp = (player.progressCards?.length ?? 0) * 2;
				break;
			case 'mostArtistic':
				vp = (player.masterpieceCards?.length ?? 0) * 2;
				break;
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
		// Expansion future techs: count for "most" comparison
		case 'spiritualMedicine': {
			let cultTokens = 0;
			if (G.cultureBoard) {
				for (const [cellKey, cellTokens] of Object.entries(G.cultureBoard.cultTokensOnBoard)) {
					const [r, c] = cellKey.split(',').map(Number);
					if (controlsCell(G, playerId, r, c)) cultTokens += cellTokens.length;
				}
			}
			return cultTokens;
		}
		case 'hiveMind':
			return player.progressCards?.length ?? 0;
		case 'virtualReality':
			return player.masterpieceCards?.length ?? 0;
		default:
			return 0;
	}
}

const TECH_BACKSIDE_VP: Record<number, number> = { 2: 1, 3: 2, 4: 4 };

function getFutureTechName(ftType: string): string {
	const def = [...FUTURE_TECH_DEFS, ...EXPANSION_FUTURE_TECH_DEFS].find((d) => d.type === ftType);
	return def?.name ?? ftType;
}

function addScoreBreakdown(
	G: GoldenAgesState,
	pid: string,
	label: string,
	vp: number,
): void {
	G.players[pid].score += vp;
	if (G.endGameScoreBreakdown[pid]) {
		G.endGameScoreBreakdown[pid].push({ label, vp });
	}
}

function performEndGameScoring(G: GoldenAgesState): void {
	if (G.endGameScored) return;
	G.endGameScored = true;

	const pids = Object.keys(G.players);
	G.endGameScoreBreakdown = {};
	for (const pid of pids) {
		G.endGameScoreBreakdown[pid] = [{ label: 'Score during game', vp: G.players[pid].score }];
	}

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
			addScoreBreakdown(G, bestPid, `Future Tech: ${getFutureTechName(ftType)}`, 8);
		}
	}

	for (const [pid, player] of Object.entries(G.players)) {
		// 1 VP per 3 gold
		const goldVp = Math.floor(player.gold / 3);
		if (goldVp) addScoreBreakdown(G, pid, 'Gold (1 VP per 3)', goldVp);

		// Tech back-side VPs: col 2 (level 3) = 1 VP, col 3 (level 4) = 2 VP, col 4 (level 5) = 4 VP
		let techVp = 0;
		for (const row of player.researchedTechs) {
			for (let col = 2; col < row.length; col++) {
				if (row[col] && TECH_BACKSIDE_VP[col]) {
					techVp += TECH_BACKSIDE_VP[col];
				}
			}
		}
		if (techVp) addScoreBreakdown(G, pid, 'Tech levels (3–5)', techVp);

		// Glory token points
		let gloryVp = 0;
		for (const val of player.gloryTokens) {
			gloryVp += val;
		}
		if (gloryVp) addScoreBreakdown(G, pid, 'Glory tokens', gloryVp);

		// Spiral Minaret: 2 extra VP per level 4 (col 3) and level 5 (col 4) tech
		if (hasWonder(player, 'spiralMinaret')) {
			let spiralVp = 0;
			for (const row of player.researchedTechs) {
				if (row[3]) spiralVp += 2;
				if (row[4]) spiralVp += 2;
			}
			if (spiralVp) addScoreBreakdown(G, pid, 'Spiral Minaret', spiralVp);
		}

		// Cult card scoring: VPs for spots where tokens were spread (expansion only; guard for non-expansion)
		let cultCardVp = 0;
		for (const cultCard of player.cultCards ?? []) {
			const spots = cultCard.card.cultSpots ?? 0;
			const spread = spots - cultCard.remainingTokens;
			cultCardVp += spread * (cultCard.card.cultSpotVP ?? 0);
		}
		if (cultCardVp) addScoreBreakdown(G, pid, 'Cult cards (spread tokens)', cultCardVp);
	}

	// Board cult token scoring: each controlling player scores 1 VP per token on cells they control
	if (G.cultureBoard) {
		for (const [cellKey, tokens] of Object.entries(G.cultureBoard.cultTokensOnBoard)) {
			const [r, c] = cellKey.split(',').map(Number);
			const controllers = new Set<string>();
			for (const piece of G.pieces) {
				if (
					piece.row === r &&
					piece.col === c &&
					!piece.inAgora &&
					(piece.type === 'worker' || piece.type === 'capital')
				) {
					controllers.add(piece.owner);
				}
			}
			for (const city of G.cities) {
				if (city.row === r && city.col === c) controllers.add(city.owner);
			}
			for (const pid of controllers) {
				if (tokens.length) addScoreBreakdown(G, pid, 'Cult tokens on board', tokens.length);
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

/** When game is over and scored, return { winner } or { isDraw } for framework ctx.gameover. */
function getGameOverResult(G: GoldenAgesState): { winner: string } | { isDraw: true } | undefined {
	if (!G.endGameScored) return undefined;
	const base = getPlayerRankings(G);
	if (base.length === 0) return undefined;
	const breakdown = G.endGameScoreBreakdown;
	const hasValidBreakdown =
		breakdown &&
		Object.keys(breakdown).length > 0 &&
		base.every((r) => (breakdown[r.playerId]?.length ?? 0) > 0);
	const breakdownToUse = hasValidBreakdown ? (breakdown as Record<string, { label: string; vp: number }[]>) : computeEndGameBreakdown(G);
	const totalByPlayer: Record<string, number> = {};
	for (const r of base) {
		const sum = (breakdownToUse[r.playerId] ?? []).reduce((s, e) => s + e.vp, 0);
		totalByPlayer[r.playerId] = sum > 0 ? sum : r.score;
	}
	const sorted = [...base].sort(
		(a, b) => (totalByPlayer[b.playerId] ?? 0) - (totalByPlayer[a.playerId] ?? 0) || b.cities - a.cities,
	);
	const first = sorted[0];
	if (!first) return undefined;
	const firstTotal = totalByPlayer[first.playerId] ?? 0;
	const tiedForFirst = sorted.filter(
		(r) => (totalByPlayer[r.playerId] ?? 0) === firstTotal && r.cities === first.cities,
	);
	if (tiedForFirst.length > 1) return { isDraw: true };
	return { winner: first.playerId };
}

/** Compute end-game score breakdown from current state (read-only). Use when stored breakdown is missing (e.g. old saved games). */
export function computeEndGameBreakdown(
	G: GoldenAgesState,
): Record<string, { label: string; vp: number }[]> {
	const pids = Object.keys(G.players);
	const breakdown: Record<string, { label: string; vp: number }[]> = {};
	const endGameVpByPlayer: Record<string, number> = {};
	for (const pid of pids) endGameVpByPlayer[pid] = 0;

	// Future Tech: 8 VPs to sole leader per type
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
			endGameVpByPlayer[bestPid] += 8;
		}
	}

	for (const [pid, player] of Object.entries(G.players)) {
		const items: { label: string; vp: number }[] = [];

		const goldVp = Math.floor(player.gold / 3);
		if (goldVp) {
			items.push({ label: 'Gold (1 VP per 3)', vp: goldVp });
			endGameVpByPlayer[pid] += goldVp;
		}

		let techVp = 0;
		for (const row of player.researchedTechs) {
			for (let col = 2; col < row.length; col++) {
				if (row[col] && TECH_BACKSIDE_VP[col]) techVp += TECH_BACKSIDE_VP[col];
			}
		}
		if (techVp) {
			items.push({ label: 'Tech levels (3–5)', vp: techVp });
			endGameVpByPlayer[pid] += techVp;
		}

		let gloryVp = 0;
		for (const val of player.gloryTokens) gloryVp += val;
		if (gloryVp) {
			items.push({ label: 'Glory tokens', vp: gloryVp });
			endGameVpByPlayer[pid] += gloryVp;
		}

		// Future Tech: one entry per type this player won (matches performEndGameScoring format)
		for (const ftType of ftTypes) {
			let bestCount = -1;
			let bestPid: string | null = null;
			let tied = false;
			for (const p of pids) {
				const count = getFutureTechCount(G, p, ftType);
				if (count > bestCount) {
					bestCount = count;
					bestPid = p;
					tied = false;
				} else if (count === bestCount) tied = true;
			}
			if (bestPid === pid && !tied) {
				items.push({ label: `Future Tech: ${getFutureTechName(ftType)}`, vp: 8 });
			}
		}

		if (hasWonder(player, 'spiralMinaret')) {
			let spiralVp = 0;
			for (const row of player.researchedTechs) {
				if (row[3]) spiralVp += 2;
				if (row[4]) spiralVp += 2;
			}
			if (spiralVp) {
				items.push({ label: 'Spiral Minaret', vp: spiralVp });
				endGameVpByPlayer[pid] += spiralVp;
			}
		}

		let cultCardVp = 0;
		for (const cultCard of player.cultCards ?? []) {
			const spots = cultCard.card.cultSpots ?? 0;
			const spread = spots - cultCard.remainingTokens;
			cultCardVp += spread * (cultCard.card.cultSpotVP ?? 0);
		}
		if (cultCardVp) {
			items.push({ label: 'Cult cards (spread tokens)', vp: cultCardVp });
			endGameVpByPlayer[pid] += cultCardVp;
		}

		breakdown[pid] = items;
	}

	// Cult tokens on board (add to breakdown and to endGameVpByPlayer)
	if (G.cultureBoard) {
		for (const [cellKey, tokens] of Object.entries(G.cultureBoard.cultTokensOnBoard)) {
			const [r, c] = cellKey.split(',').map(Number);
			const controllers = new Set<string>();
			for (const piece of G.pieces) {
				if (
					piece.row === r &&
					piece.col === c &&
					!piece.inAgora &&
					(piece.type === 'worker' || piece.type === 'capital')
				) {
					controllers.add(piece.owner);
				}
			}
			for (const city of G.cities) {
				if (city.row === r && city.col === c) controllers.add(city.owner);
			}
			const vp = tokens.length;
			for (const pid of controllers) {
				if (vp) {
					breakdown[pid].push({ label: 'Cult tokens on board', vp });
					endGameVpByPlayer[pid] += vp;
				}
			}
		}
	}

	// Prepend "Score during game" = final score - sum of end-game components (clamp so we never show negative when server score is stale)
	for (const pid of pids) {
		const scoreDuringGame = Math.max(0, G.players[pid].score - endGameVpByPlayer[pid]);
		breakdown[pid].unshift({ label: 'Score during game', vp: scoreDuringGame });
	}

	return breakdown;
}

function hasWonder(player: GoldenAgesPlayerState, wonderType: string): boolean {
	return (player.builtWonders ?? []).some((w) => w.wonderType === wonderType);
}

function hasProgress(player: GoldenAgesPlayerState, type: string): boolean {
	return (player.progressCards ?? []).some((c) => c.id?.includes(type));
}

function hasGovernment(player: GoldenAgesPlayerState, type: string): boolean {
	return player.governmentCard?.id?.includes(type) ?? false;
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

function applyWonderInstantEffect(
	G: GoldenAgesState,
	player: GoldenAgesPlayerState,
	card: GameCard,
	playerId: string,
	optionalParams?: { cubesToRemove?: number },
): void {
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
		case 'angkorWat':
			player.score += countPlayerResources(G, playerId, 'wheat') * 2;
			break;
		case 'machuPicchu':
			player.score += countPlayerResources(G, playerId, 'rock') * 2;
			break;
		case 'christTheRedeemer': {
			const maxRemove = Math.min(5, optionalParams?.cubesToRemove ?? 5);
			let removed = 0;
			for (const city of G.cities) {
				if (city.owner !== playerId || removed >= maxRemove) continue;
				const onCity = city.cubes;
				const take = Math.min(onCity, maxRemove - removed);
				if (take > 0) {
					const c = city as { cubes: number };
					if (typeof c.cubes === 'number') c.cubes -= take;
					removed += take;
					player.cubes += take;
				}
			}
			player.score += removed * 2;
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
	if (!G.boardResources) return;
	const resources = G.boardResources[key];
	if (!resources || resources.length === 0) return;
	if (!G.controlledResources) G.controlledResources = {};
	if (G.controlledResources[key] === playerId) return;

	G.controlledResources[key] = playerId;
	const player = G.players[playerId];
	if (!player) return;

	const civType = G.activeCivCard[playerId]?.civType;

	for (const res of resources) {
		if (res === 'game') {
			if (player.researchedTechs[1][0]) player.gold += 1;
			if (hasProgress(player, 'animalHusbandry')) player.gold += 1;
			if (civType === 'iroquois') {
				player.gold += 2;
				if (G.cultureBoard) {
					for (let r = 0; r < CULTURE_GRID_ROWS; r++) {
						if (advanceCultureRow(G, playerId, r, true)) break;
					}
				}
			}
		} else if (res === 'wheat') {
			if (player.researchedTechs[1][3]) player.gold += 3;
			else if (player.researchedTechs[1][1]) player.gold += 1;
			if (civType === 'inca') player.gold += 2;
			if (hasProgress(player, 'irrigation')) player.gold += 1;
			if (hasProgress(player, 'cropRotation')) player.gold += 1;
			if (hasProgress(player, 'mechanizedAgriculture')) player.gold += 1;
		} else if (res === 'rock') {
			if (player.researchedTechs[2][3]) player.gold += 3;
			else if (player.researchedTechs[2][1]) player.gold += 1;
			if (civType === 'mongolia') player.gold += 2;
			if (hasProgress(player, 'bronzeWorking')) player.gold += 1;
			if (hasProgress(player, 'ironWorking')) player.gold += 1;
			if (hasProgress(player, 'combustion')) player.gold += 1;
		} else if (res === 'gem') {
			if (player.researchedTechs[3][4]) player.gold += 4;
			else if (player.researchedTechs[3][2]) player.gold += 2;
			if (civType === 'aztec') player.gold += 2;
			if (civType === 'spain') player.gold += 3;
			if (civType === 'brazil') player.gold += 4;
			if (hasProgress(player, 'alchemy')) player.gold += 1;
			if (hasProgress(player, 'chemistry')) player.gold += 1;
			if (civType === 'southAfrica' && G.cultureBoard) {
				for (let r = 0; r < CULTURE_GRID_ROWS; r++) {
					if (advanceCultureRow(G, playerId, r, true)) break;
				}
			}
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
	const baseRange = MOVEMENT_RANGES[highest];
	let bonus = 0;
	if (hasProgress(player, 'cartography')) bonus += 1;
	if (hasProgress(player, 'navigation')) bonus += 2;
	if (hasWonder(player, 'lighthouse')) bonus += 1;
	return baseRange + bonus;
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
// When a tile is placed, relocate any capital on a covered cell so workers have a valid destination
// ---------------------------------------------------------------------------

interface CapitalDisplacement {
	owner: string;
	fromRow: number;
	fromCol: number;
	toRow: number;
	toCol: number;
}

function relocateCapitalsOnCoveredCells(
	G: GoldenAgesState,
	coveredCells: [number, number][],
): CapitalDisplacement[] {
	const displaced: CapitalDisplacement[] = [];
	if (!G.pieces) return displaced;
	const coveredSet = new Set(coveredCells.map(([r, c]) => getCellKey(r, c)));
	const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
	for (const piece of G.pieces) {
		if (piece.type !== 'capital') continue;
		const key = getCellKey(piece.row, piece.col);
		if (!coveredSet.has(key)) continue;
		const fromRow = piece.row;
		const fromCol = piece.col;
		for (const [dr, dc] of dirs) {
			const nr = piece.row + dr;
			const nc = piece.col + dc;
			if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
			if (coveredSet.has(getCellKey(nr, nc))) continue;
			piece.row = nr;
			piece.col = nc;
			displaced.push({ owner: piece.owner, fromRow, fromCol, toRow: nr, toCol: nc });
			break;
		}
	}
	return displaced;
}

// ---------------------------------------------------------------------------
// Return workers on covered cells to their owner's capital (when a tile is placed on top of them)
// ---------------------------------------------------------------------------

function returnWorkersOnCellsToCapital(
	G: GoldenAgesState,
	coveredCells: [number, number][],
): void {
	if (!G.pieces) return;
	const coveredSet = new Set(coveredCells.map(([r, c]) => getCellKey(r, c)));
	for (const piece of G.pieces) {
		if (piece.type !== 'worker' || piece.inAgora) continue;
		const key = getCellKey(piece.row, piece.col);
		if (!coveredSet.has(key)) continue;
		const capital = G.pieces.find((p) => p.type === 'capital' && p.owner === piece.owner);
		if (capital) {
			piece.row = capital.row;
			piece.col = capital.col;
		}
	}
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

	setup: (firstArg: { ctx: Ctx; setupData?: GoldenAgesSetupData } | Ctx, secondArg?: GoldenAgesSetupData): GoldenAgesState => {
		const ctx = typeof (firstArg as { ctx?: Ctx }).ctx !== 'undefined' ? (firstArg as { ctx: Ctx }).ctx : (firstArg as Ctx);
		const setupData = (firstArg as { setupData?: GoldenAgesSetupData }).setupData ?? secondArg;
		const opts = { expansion: setupData?.expansion ?? false };

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
		const civDecks = buildCivDecks(opts.expansion);
		const wonderDecks = buildWonderDecks(opts.expansion);
		const buildingDecks = buildBuildingDecks(opts.expansion);
		const futureTechDeck = buildFutureTechDeck(opts.expansion);
		const historyDeck = buildJudgementDeck(opts.expansion);

		// Draw 5 History's Judgement cards face-up
		const historyJudgementCards = historyDeck.slice(0, HISTORY_JUDGEMENT_DRAW);

		// Build culture decks (expansion only)
		const cultureDecks = opts.expansion ? buildCultureDecks() : null;
		const masterpieceDeck = opts.expansion ? buildMasterpieceDeck() : null;

		let cultureBoard: CultureBoardState | null = null;
		if (opts.expansion && cultureDecks && masterpieceDeck) {
			const cultureDisplay = cultureDecks.I.splice(0, CULTURE_DISPLAY_SIZE);
			const tokenPositions: Record<string, number[]> = {};
			for (let i = 0; i < ctx.numPlayers; i++) {
				tokenPositions[String(i)] = Array(CULTURE_GRID_ROWS).fill(0);
			}
			cultureBoard = {
				grid: CULTURE_GRID.map((row) => row.map((cell) => ({ ...cell }))),
				tokenPositions,
				cultureDecks,
				cultureDisplay,
				masterpieceDeck,
				cultTokensOnBoard: {},
				cultTokenSupply: Array(CULT_TOKEN_TYPES).fill(CULT_TOKENS_PER_TYPE),
			};
		}

		// Shuffle and deal L-tiles (players 0-3 only; 5th player uses a domino for era I)
		const lTiles = shuffle([...L_TILE_TEMPLATES]);

		// Shuffle and deal domino tiles
		const is5Player = ctx.numPlayers === 5;
		const dominoes = shuffle([...DOMINO_TILE_TEMPLATES]);
		const dominosByEra: Record<Era, TileTemplate[]> = { I: [], II: [], III: [], IV: [] };
		let dominoIdx = 0;
		if (is5Player) {
			// 5th player gets a domino for era I
			if (dominoes[dominoIdx]) dominosByEra.I.push(dominoes[dominoIdx]);
			dominoIdx++;
		}
		const dominoEras: Era[] = ['II', 'III', 'IV'];
		for (const era of dominoEras) {
			const count = era === 'IV' && is5Player ? 4 : ctx.numPlayers;
			for (let p = 0; p < count; p++) {
				const tile = dominoes[dominoIdx];
				if (tile) dominosByEra[era].push(tile);
				dominoIdx++;
			}
		}

		// Shuffle 1x1 tiles for 5th player era IV
		const tiles1x1 = opts.expansion ? shuffle([...EXPANSION_1X1_TILE_TEMPLATES]) : [];

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

			const isFifthPlayer = is5Player && i === 4;
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
				assignedLTile: isFifthPlayer ? null : (lTiles[i] ?? null),
				assignedDominoTiles: {
					I: isFifthPlayer ? (dominosByEra.I[0] ?? null) : null,
					II: dominosByEra.II[i] ?? null,
					III: dominosByEra.III[i] ?? null,
					IV: isFifthPlayer ? null : (dominosByEra.IV[i] ?? null),
				},
				assigned1x1Tile: isFifthPlayer ? (tiles1x1[0] ?? null) : null,
				builtBuildings: [null, null, null],
				activatedBuildings: [false, false, false],
				usedGreeceWonder: false,
				invasionTrackPos: 0,
				gloryTokens: [],
				builtWonders: [],
				activatedWonders: [],
				cultureScore: 0,
				progressCards: [],
				governmentCard: null,
				cultCards: [],
				masterpieceCards: [],
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
			gloryTokenSupply: shuffle([...GLORY_TOKEN_POOL, ...(opts.expansion ? EXPANSION_GLORY_TOKENS : [])]),
			eraJudgementCard: null,
			eraIVRemainingTurns: -1,
			endGameScored: false,
			endGameScoreBreakdown: {},
			boardEdges: {
				'2,4': [W, L, L, L],
				'2,5': [W, L, L, L],
				'3,4': [L, L, L, L],
				'3,5': [L, W, L, L],
			},
			gameLog: [],
			history: [],
			setupOptions: opts,
			cultureBoard,
			pendingCulturePicks: 0,
			pendingCultFill: null,
			pendingCultSpread: null,
			lastGloryDraw: null,
			lastHistoryCardPickPlayerId: null,
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
				applyCivCardEffect(G, player, newCard, ctx.currentPlayer, indiaRow);
				appendLog(G, ctx, 'chose civilisation card');
			} else {
			if (keepOld) {
				// Discard the new card (just removed from hand already)
				appendLog(G, ctx, 'kept previous civilisation');
			} else {
				G.activeCivCard[ctx.currentPlayer] = newCard;
				applyCivCardEffect(G, player, newCard, ctx.currentPlayer, indiaRow);
				appendLog(G, ctx, 'chose civilisation card');
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
			capitalRow?: number,
			capitalCol?: number,
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
			const coveredCells: [number, number][] = rotated.map(([dr, dc]) => [anchorRow + dr, anchorCol + dc]);
			const displacements = relocateCapitalsOnCoveredCells(G, coveredCells);
			returnWorkersOnCellsToCapital(G, coveredCells);
			for (const d of displacements) {
				const ownerColor = G.players[d.owner]?.color;
				const logEntry = { message: `Capital displaced by new tile`, playerColor: ownerColor };
				if (!G.gameLog) G.gameLog = [];
				G.gameLog.push(logEntry);
				if (G.gameLog.length > MAX_LOG_ENTRIES) G.gameLog.shift();
			}

			if (!G.boardEdges) G.boardEdges = {};
			if (tileEdges) {
				for (let idx = 0; idx < rotated.length; idx++) {
					const key = `${anchorRow + rotated[idx][0]},${anchorCol + rotated[idx][1]}`;
					G.boardEdges[key] = rotateCellEdges(tileEdges[idx], rotation);
				}
			}

			if (G.currentEra === 'I') {
				const cornerOffset = rotated[SMALL_L_CORNER_INDEX];
				const cornerRow = anchorRow + cornerOffset[0];
				const cornerCol = anchorCol + cornerOffset[1];

				if (!G.pieces) G.pieces = [];
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
					if (!G.boardResources) G.boardResources = {};
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
				if (capitalRow == null || capitalCol == null) return INVALID_MOVE;
				const tileCellSet = new Set(coveredCells.map(([r, c]) => `${r},${c}`));
				if (!tileCellSet.has(`${capitalRow},${capitalCol}`)) {
					return INVALID_MOVE;
				}
				relocateCapital(G, ctx.currentPlayer, capitalRow, capitalCol);
			}

			if (G.currentEra !== 'I') {
				const player = G.players[ctx.currentPlayer];
				const dominoTile = player?.assignedDominoTiles?.[G.currentEra];
				if (dominoTile) {
					if (!G.boardResources) G.boardResources = {};
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

			appendLog(G, ctx, moveCapital ? 'placed a tile (moved capital)' : 'placed a tile');
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
			argE?: string,
		) => {
			G.lastHistoryCardPickPlayerId = null;
			// Clear glory reveal when another player moves (forced dismiss: only the drawer can dismiss on their turn)
			if (G.lastGloryDraw && ctx.currentPlayer !== G.lastGloryDraw.playerId) {
				G.lastGloryDraw = null;
			}
			// Current player must acknowledge their glory draw before any other action (force-dismiss dialog)
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (G.phase !== 'actions') return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player || player.passedThisEra) return INVALID_MOVE;

			if (G.pendingCulturePicks > 0 || G.pendingCultFill || G.pendingCultSpread) return INVALID_MOVE;

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

					const hasConstruction = player.researchedTechs[2][2];
					const cubeCost = hasConstruction ? 2 : 1;
					if (player.cubes < cubeCost) return INVALID_MOVE;

					player.cubes -= cubeCost;
					const newCity = { owner: ctx.currentPlayer, row: destRow, col: destCol, cubes: cubeCost };
					G.cities.push(newCity);
					try {
						Object.defineProperty(newCity, 'cubes', {
							get() { return cubeCost; },
							set(v: number) { console.trace('[FOUND CITY] cubes MUTATED to', v); },
						});
					} catch (e) { /* immer proxy may block this */ }

					const cubesPlaced = cubeCost;
					for (let i = 0; i < cubesPlaced; i++) {
						if (player.researchedTechs[3][3]) player.gold += 2;
						else if (player.researchedTechs[3][0]) player.gold += 1;
					}
					if (hasWonder(player, 'hagiaSophia')) player.gold += 2;
					if (G.activeCivCard[ctx.currentPlayer]?.civType === 'dutch') player.gold += 2;
				}

				if (G.cultureBoard && foundCity) {
					const hasCultTokens = (player.cultCards ?? []).some((c) => c.remainingTokens > 0);
					if (hasCultTokens) {
						const isTotalitarian = player.governmentCard?.id?.includes('totalitarianism');
						G.pendingCultSpread = {
							cityRow: destRow,
							cityCol: destCol,
							remaining: isTotalitarian ? 4 : 1,
							usedDestinations: [],
						};
					}
				}

				appendLog(G, ctx, foundCity ? 'Explorer (founded a city)' : 'Explorer');
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
				const enemyCapitals = G.pieces.filter(
					(p) => p.type === 'capital' && p.owner !== ctx.currentPlayer && p.row === destRow && p.col === destCol,
				);
				const hasEnemies = enemyWorkers.length > 0 || enemyCities.length > 0 || enemyCapitals.length > 0;

				if (hasEnemies && G.activeCivCard[ctx.currentPlayer]?.civType === 'usa') {
					player.gold += 4;
				}

				if (hasEnemies) {
					const defenderIds = new Set<string>();
					for (const ew of enemyWorkers) defenderIds.add(ew.owner);
					for (const ec of enemyCities) defenderIds.add(ec.owner);
					for (const cap of enemyCapitals) defenderIds.add(cap.owner);

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
					for (const defenderId of defenderIds) {
						const defender = G.players[defenderId];
						if (defender && hasGovernment(defender, 'democracy')) defender.score += 4;
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

					// Relocate displaced enemy capitals and their workers to an adjacent cell
					const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
					for (const cap of enemyCapitals) {
						for (const [dr, dc] of dirs) {
							const nr = cap.row + dr;
							const nc = cap.col + dc;
							if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
							const srcRow = cap.row;
							const srcCol = cap.col;
							cap.row = nr;
							cap.col = nc;
							for (const piece of G.pieces) {
								if (piece.type === 'worker' && piece.owner === cap.owner && piece.row === srcRow && piece.col === srcCol) {
									piece.row = nr;
									piece.col = nc;
								}
							}
							break;
						}
					}

					player.invasionTrackPos++;

					const isChina = G.activeCivCard[ctx.currentPlayer]?.civType === 'china';
					const isFeudalism = hasGovernment(player, 'feudalism');
					if (isChina && G.gloryTokenSupply.length >= 2) {
						const a = G.gloryTokenSupply.pop() ?? 0;
						const b = G.gloryTokenSupply.pop() ?? 0;
						const keep = Math.max(a, b);
						const returnToken = Math.min(a, b);
						player.gloryTokens.push(keep);
						G.gloryTokenSupply.unshift(returnToken);
						G.lastGloryDraw = { playerId: ctx.currentPlayer, vp: keep };
					} else if (isFeudalism && G.gloryTokenSupply.length >= 2) {
						const a = G.gloryTokenSupply.pop() ?? 0;
						const b = G.gloryTokenSupply.pop() ?? 0;
						const keep = Math.max(a, b);
						const returnToken = Math.min(a, b);
						player.gloryTokens.push(keep);
						G.gloryTokenSupply.unshift(returnToken);
						G.lastGloryDraw = { playerId: ctx.currentPlayer, vp: keep };
					} else if (G.gloryTokenSupply.length > 0) {
						const token = G.gloryTokenSupply.pop() ?? 0;
						player.gloryTokens.push(token);
						G.lastGloryDraw = { playerId: ctx.currentPlayer, vp: token };
					}

					if (G.activeCivCard[ctx.currentPlayer]?.civType === 'france') {
						player.gold += 4;
					}
					if (G.activeCivCard[ctx.currentPlayer]?.civType === 'songhai' && G.cultureBoard) {
						for (let r = 0; r < CULTURE_GRID_ROWS; r++) {
							if (advanceCultureRow(G, ctx.currentPlayer, r, true)) break;
						}
					}
				}

				worker.row = destRow;
				worker.col = destCol;
				worker.exhausted = true;
				if (G.activeCivCard[ctx.currentPlayer]?.civType === 'vikings' && hasEnemies) {
					worker.exhausted = false;
				}

				tryTakeControl(G, ctx.currentPlayer, destRow, destCol);

				if (foundCity) {
					const tile = getTileAt(G.tiles, destRow, destCol);
					if (!tile) return INVALID_MOVE;

					const hasCapitalOrCity =
						G.pieces.some((p) => p.type === 'capital' && p.row === destRow && p.col === destCol) ||
						G.cities.some((c) => c.row === destRow && c.col === destCol);
					if (hasCapitalOrCity) return INVALID_MOVE;

					const hasConstruction = player.researchedTechs[2][2];
					const cubeCost = hasConstruction ? 2 : 1;
					if (player.cubes < cubeCost) return INVALID_MOVE;

					player.cubes -= cubeCost;
					G.cities.push({ owner: ctx.currentPlayer, row: destRow, col: destCol, cubes: cubeCost });

					for (let i = 0; i < cubeCost; i++) {
						if (player.researchedTechs[3][3]) player.gold += 2;
						else if (player.researchedTechs[3][0]) player.gold += 1;
					}
					if (hasWonder(player, 'hagiaSophia')) player.gold += 2;
					if (G.activeCivCard[ctx.currentPlayer]?.civType === 'dutch') player.gold += 2;
				}

				if (G.cultureBoard && foundCity) {
					const hasCultTokens = (player.cultCards ?? []).some((c) => c.remainingTokens > 0);
					if (hasCultTokens) {
						const isTotalitarian = player.governmentCard?.id?.includes('totalitarianism');
						G.pendingCultSpread = {
							cityRow: destRow,
							cityCol: destCol,
							remaining: isTotalitarian ? 4 : 1,
							usedDestinations: [],
						};
					}
				}

				appendLog(G, ctx, foundCity ? 'Soldier (founded a city)' : 'Soldier');
			} else if (actionType === 'artist') {
				const workerId = argA as string;
				if (!workerId) return INVALID_MOVE;

				const worker = G.pieces.find((p) => p.id === workerId);
				if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
				if (worker.exhausted || worker.inAgora) return INVALID_MOVE;

				worker.inAgora = true;
				worker.exhausted = true;
				if (hasProgress(player, 'codeOfLaws')) player.gold += 2;
				if (hasProgress(player, 'justiceSystem')) player.gold += 2;

				const masterpieceIndex = argB as number | undefined;
				if (G.cultureBoard && masterpieceIndex !== undefined && masterpieceIndex >= 0) {
					const card = G.cultureBoard.masterpieceDeck[masterpieceIndex];
					if (!card) return INVALID_MOVE;
					G.cultureBoard.masterpieceDeck.splice(masterpieceIndex, 1);
					player.masterpieceCards.push(card);
					applyMasterpieceEffect(G, player, ctx.currentPlayer, card);
				} else {
					player.score += 3;
				}

				if (player.researchedTechs[2][4]) player.score += 2;
				if (G.activeCivCard[ctx.currentPlayer]?.civType === 'eu') player.gold += 4;
				appendLog(G, ctx, 'Artist');
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
					if (hasProgress(player, 'codeOfLaws')) player.gold += 2;
					if (hasProgress(player, 'justiceSystem')) player.gold += 2;
				}

				const cardIdx = G.availableBuildings.findIndex((c) => c.id === buildingCardId);
				if (cardIdx === -1) return INVALID_MOVE;

				const unlockedSlots = getUnlockedBuildingSlots(player);
				const targetSlot = unlockedSlots.findIndex((unlocked, i) => unlocked && player.builtBuildings[i] === null);
				if (targetSlot === -1) return INVALID_MOVE;

				const [card] = G.availableBuildings.splice(cardIdx, 1);
				player.builtBuildings[targetSlot] = card;
				if (card.buildingType === 'militaryBase' && G.gloryTokenSupply.length > 0) {
					const token = G.gloryTokenSupply.pop() ?? 0;
					player.gloryTokens.push(token);
					G.lastGloryDraw = { playerId: ctx.currentPlayer, vp: token };
				}
				appendLog(G, ctx, 'Builder');
			} else if (actionType === 'buildWonder') {
				G.lastGloryDraw = null;
				const wonderCardId = argA as string;
				if (!wonderCardId) return INVALID_MOVE;

				const wonderIdx = G.availableWonders.findIndex((c) => c.id === wonderCardId);
				if (wonderIdx === -1) return INVALID_MOVE;

				const wonderCard = G.availableWonders[wonderIdx];

				const isGreece = G.activeCivCard[ctx.currentPlayer]?.civType === 'greece';
				const useFreeGreece = isGreece && !player.usedGreeceWonder && (argD === true);

				let cost = wonderCard.wonderCost ?? 0;
				if (useFreeGreece) {
					cost = 0;
				} else {
					const activeCiv = G.activeCivCard[ctx.currentPlayer]?.civType;
					if (activeCiv && activeCiv === wonderCard.wonderDiscountCiv) {
						cost = wonderCard.wonderDiscountCost ?? cost;
					}
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

				const wonderOpts =
					wonderCard.wonderType === 'christTheRedeemer'
						? { cubesToRemove: (argB as number) ?? 5 }
						: undefined;
				applyWonderInstantEffect(G, player, card, ctx.currentPlayer, wonderOpts);
				appendLog(G, ctx, 'Built a Wonder');
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

					const era = wCard.era ?? 'I';
					const def =
						WONDER_DEFS[era]?.find((d) => d.type === wCard.wonderType) ??
						EXPANSION_WONDER_DEFS[era]?.find((d) => d.type === wCard.wonderType);
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
					} else if (wCard.wonderType === 'alhambra') {
						if (!G.cultureBoard) return INVALID_MOVE;
						const row = argB as number;
						if (row === undefined || row < 0 || row >= CULTURE_GRID_ROWS) return INVALID_MOVE;
						advanceCultureRow(G, ctx.currentPlayer, row, true);
					} else if (wCard.wonderType === 'tajMahal') {
						const targetIdx = argB as number;
						if (targetIdx === undefined) return INVALID_MOVE;
						if (targetIdx >= 100) {
							const wonderIdx = targetIdx - 100;
							if (wonderIdx >= 0 && wonderIdx < player.activatedWonders.length) {
								player.activatedWonders[wonderIdx] = false;
							}
						} else if (targetIdx >= 0 && targetIdx < player.activatedBuildings.length) {
							player.activatedBuildings[targetIdx] = false;
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
					} else if (card.buildingType === 'library' || card.buildingType === 'university' || card.buildingType === 'observatory' || card.buildingType === 'laboratory' || card.buildingType === 'cultureLibrary') {
						const discounts: Record<string, number> = { library: 2, university: 3, observatory: 5, laboratory: 99, cultureLibrary: 2 };
						const discount = discounts[card.buildingType] ?? 0;
						const techRow = argB as number;
						const techCol = argC as unknown as number;
						if (techRow === undefined || techCol === undefined) return INVALID_MOVE;
						if (techRow < 0 || techRow >= TECH_TREE.length || techCol < 1 || techCol >= TECH_TREE[0].length) return INVALID_MOVE;
						if (player.researchedTechs[techRow][techCol]) return INVALID_MOVE;
						if (!player.researchedTechs[techRow][techCol - 1]) return INVALID_MOVE;
						let cost = Math.max(0, TECH_COSTS[techCol] - discount);
						if (hasWonder(player, 'stonehenge')) {
							const anyoneElseHas = Object.entries(G.players).some(
								([pid, p]) => pid !== ctx.currentPlayer && p.researchedTechs[techRow][techCol],
							);
							if (anyoneElseHas) cost = Math.max(0, cost - 1);
						}
						if (player.gold < cost) return INVALID_MOVE;
						player.gold -= cost;
						player.researchedTechs[techRow][techCol] = true;
						const cubeKey: `${number},${number}` = `${techRow + 1},${techCol + 1}`;
						if (player.boardCubes[cubeKey]) {
							player.cubes += player.boardCubes[cubeKey];
							delete player.boardCubes[cubeKey];
						}
						const cnTowerMirror = techCol === 4 && hasWonder(player, 'cnTower') && typeof argE === 'string' && G.players[argE] && argE !== ctx.currentPlayer ? argE : undefined;
						applyImmediateTechEffects(G, player, techRow, techCol, cnTowerMirror);
					} else if (card.buildingType === 'factory' || card.buildingType === 'cultureFactory') {
						const workerId = argB as unknown as string;
						if (!workerId) return INVALID_MOVE;
						const worker = G.pieces.find((p) => p.id === workerId);
						if (!worker || worker.type !== 'worker' || worker.owner !== ctx.currentPlayer) return INVALID_MOVE;
						if (!worker.exhausted || worker.inAgora) return INVALID_MOVE;
						worker.exhausted = false;
					} else if (card.buildingType === 'temple') {
						if (!G.cultureBoard) return INVALID_MOVE;
						const row1 = argB as number;
						if (row1 !== undefined && row1 >= 0 && row1 < CULTURE_GRID_ROWS) {
							advanceCultureRow(G, ctx.currentPlayer, row1, false);
						}
						const row2 = argC as unknown as number;
						if (row2 !== undefined && row2 >= 0 && row2 < CULTURE_GRID_ROWS) {
							advanceCultureRow(G, ctx.currentPlayer, row2, false);
						}
					} else if (card.buildingType === 'barracks' || card.buildingType === 'cultureBarrack') {
						if (G.gloryTokenSupply.length < 2) return INVALID_MOVE;
						const replaceIdx = argB as number;
						const keepIdx = argC as unknown as number;
						if (replaceIdx === undefined || keepIdx === undefined || replaceIdx < 0 || replaceIdx >= player.gloryTokens.length || keepIdx < 0 || keepIdx > 1) return INVALID_MOVE;
						const drawn = [G.gloryTokenSupply.pop() ?? 0, G.gloryTokenSupply.pop() ?? 0];
						const kept = drawn[keepIdx];
						const returnedDrawn = drawn[1 - keepIdx];
						const oldToken = player.gloryTokens[replaceIdx];
						player.gloryTokens[replaceIdx] = kept;
						G.gloryTokenSupply.push(returnedDrawn);
						G.gloryTokenSupply.push(oldToken);
						G.lastGloryDraw = { playerId: ctx.currentPlayer, vp: kept };
					} else if (card.buildingType === 'cathedral') {
						if (!G.cultureBoard) return INVALID_MOVE;
						const row = argB as number;
						if (row === undefined || row < 0 || row >= CULTURE_GRID_ROWS) return INVALID_MOVE;
						advanceCultureRow(G, ctx.currentPlayer, row, true);
					} else if (card.buildingType === 'movieTheater') {
						const workersInAgora = G.pieces.filter((p) => p.type === 'worker' && p.inAgora).length;
						player.score += workersInAgora * 2;
					} else if (card.buildingType === 'central') {
						const myCities = G.cities.filter((c) => c.owner === ctx.currentPlayer).length;
						const hasCapital = G.pieces.some((p) => p.type === 'capital' && p.owner === ctx.currentPlayer);
						player.gold += (myCities + (hasCapital ? 1 : 0)) * 2;
					} else if (card.buildingType === 'wall') {
						return INVALID_MOVE;
					} else if (card.buildingType === 'militaryBase' || card.buildingType === 'cultureMilitaryBase') {
						// Immediate only (glory token taken when built/placed), no activation
						return INVALID_MOVE;
					}
				}
				appendLog(G, ctx, 'Activated building or wonder');
			} else if (actionType === 'culture') {
				if (!G.cultureBoard) return INVALID_MOVE;
				const row = argA as number;
				if (typeof row !== 'number' || row < 0 || row >= CULTURE_GRID_ROWS) return INVALID_MOVE;
				if (!advanceCultureRow(G, ctx.currentPlayer, row, false)) return INVALID_MOVE;
				appendLog(G, ctx, 'Culture (advanced on culture row)');
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
					G.lastHistoryCardPickPlayerId = ctx.currentPlayer;
				}

				player.passedThisEra = true;

				if (G.currentEra === 'IV' && isFirstThisEra) {
					G.eraIVRemainingTurns = Object.keys(G.players).length;
				}
				appendLog(G, ctx, 'Started Golden Age');
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

					let cost = Math.max(0, TECH_COSTS[col] - discount);
					if (hasWonder(player, 'stonehenge')) {
						const anyoneElseHas = Object.entries(G.players).some(
							([pid, p]) => pid !== ctx.currentPlayer && p.researchedTechs[row][col],
						);
						if (anyoneElseHas) cost = Math.max(0, cost - 1);
					}
					if (player.gold < cost) return INVALID_MOVE;

					player.gold -= cost;
					player.researchedTechs[row][col] = true;

					const cubeKey: BoardCubeKey = `${row + 1},${col + 1}`;
					if (player.boardCubes[cubeKey]) {
						player.cubes += player.boardCubes[cubeKey];
						delete player.boardCubes[cubeKey];
					}

					const cnTowerMirror = col === 4 && hasWonder(player, 'cnTower') && typeof argE === 'string' && G.players[argE] && argE !== ctx.currentPlayer ? argE : undefined;
					applyImmediateTechEffects(G, player, row, col, cnTowerMirror);
				}
				appendLog(G, ctx, 'Developed technology');
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
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (G.phase !== 'actions') return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player || !player.passedThisEra) return INVALID_MOVE;

			if (G.pendingCulturePicks > 0 || G.pendingCultFill || G.pendingCultSpread) return INVALID_MOVE;

			player.gold += GOLDEN_AGE_INCOME;
			if (hasGovernment(player, 'monarchy')) player.gold += 1;
			if (hasGovernment(player, 'republic')) player.score += 2;
			appendLog(G, ctx, 'Collected 2 gold (Golden Age)');

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

		pickCultureCard: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			cardIndex: number,
		) => {
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (!G.cultureBoard || G.pendingCulturePicks <= 0) return INVALID_MOVE;

			const card = G.cultureBoard.cultureDisplay[cardIndex];
			if (!card) return INVALID_MOVE;

			G.cultureBoard.cultureDisplay.splice(cardIndex, 1);
			receiveCultureCard(G, ctx.currentPlayer, card);
			refillCultureDisplay(G);

			G.pendingCulturePicks--;
			appendLog(G, ctx, `picked culture card: ${card.name}`);
		},

		placeCultureBuilding: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			slotIndex: number,
			handCardIndex: number,
		) => {
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (!G.cultureBoard) return INVALID_MOVE;

			if (G.pendingCulturePicks > 0 || G.pendingCultFill || G.pendingCultSpread) return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player) return INVALID_MOVE;

			if (slotIndex < 0 || slotIndex >= 3) return INVALID_MOVE;
			if (handCardIndex < 0 || handCardIndex >= player.hand.length) return INVALID_MOVE;

			const card = player.hand[handCardIndex];
			if (card.cultureSubtype !== 'building' || !card.buildingType) return INVALID_MOVE;

			const unlockedSlots = getUnlockedBuildingSlots(player);
			if (!unlockedSlots[slotIndex] || player.builtBuildings[slotIndex] !== null) return INVALID_MOVE;

			player.hand.splice(handCardIndex, 1);
			player.builtBuildings[slotIndex] = card;

			if ((card.buildingType === 'militaryBase' || card.buildingType === 'cultureMilitaryBase') && G.gloryTokenSupply.length > 0) {
				const token = G.gloryTokenSupply.pop() ?? 0;
				player.gloryTokens.push(token);
				G.lastGloryDraw = { playerId: ctx.currentPlayer, vp: token };
			}

			appendLog(G, ctx, `placed culture building: ${card.name}`);
		},

		setPlayerColor: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			color: PlayerColor,
		) => {
			if (!PLAYER_COLORS.includes(color)) return INVALID_MOVE;
			const player = G.players[ctx.currentPlayer];
			if (!player) return INVALID_MOVE;
			if (player.color === color) return; // already this color
			// If another player has this color, swap: they get our current color
			const other = Object.entries(G.players).find(([, p]) => p?.color === color);
			if (other) {
				const [, otherPlayer] = other;
				if (otherPlayer) otherPlayer.color = player.color;
			}
			player.color = color;
		},

		acknowledgeGloryDraw: ({ G, ctx }: { G: GoldenAgesState; ctx: Ctx }) => {
			if (!G.lastGloryDraw || G.lastGloryDraw.playerId !== ctx.currentPlayer) return;
			G.lastGloryDraw = null;
		},

		fillCultCard: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			tokenTypes: number[],
		) => {
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (!G.pendingCultFill) return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player) return INVALID_MOVE;

			const cultCard = (player.cultCards ?? [])[G.pendingCultFill.cardIndex];
			if (!cultCard) return INVALID_MOVE;

			const spots = cultCard.card.cultSpots ?? 0;
			if (tokenTypes.length !== spots) return INVALID_MOVE;
			if (tokenTypes.some((t) => t < 0 || t > 5)) return INVALID_MOVE;
			if (!G.cultureBoard) return INVALID_MOVE;

			const supplyCopy = [...G.cultureBoard.cultTokenSupply];
			for (const t of tokenTypes) {
				if (supplyCopy[t] <= 0) return INVALID_MOVE;
				supplyCopy[t]--;
			}
			G.cultureBoard.cultTokenSupply = supplyCopy;

			cultCard.tokenTypes = tokenTypes;
			G.pendingCultFill = null;
			appendLog(G, ctx, `filled cult card: ${cultCard.card.name}`);
		},

		spreadCultToken: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
			cultCardIndex: number,
			tokenType: number,
			destRow: number,
			destCol: number,
		) => {
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (!G.pendingCultSpread || !G.cultureBoard) return INVALID_MOVE;

			const player = G.players[ctx.currentPlayer];
			if (!player) return INVALID_MOVE;

			const cultCard = (player.cultCards ?? [])[cultCardIndex];
			if (!cultCard || !cultCard.tokenTypes) return INVALID_MOVE;

			const typeIdx = cultCard.tokenTypes.indexOf(tokenType);
			if (typeIdx === -1) return INVALID_MOVE;

			const { cityRow, cityCol } = G.pendingCultSpread;
			if (Math.abs(destRow - cityRow) + Math.abs(destCol - cityCol) !== 1) return INVALID_MOVE;

			const hasCityOrCapital =
				G.cities.some((c) => c.row === destRow && c.col === destCol) ||
				G.pieces.some((p) => p.type === 'capital' && p.row === destRow && p.col === destCol);
			if (!hasCityOrCapital) return INVALID_MOVE;

			const destKey = `${destRow},${destCol}`;
			if (G.pendingCultSpread.usedDestinations.includes(destKey)) return INVALID_MOVE;

			const existing = G.cultureBoard.cultTokensOnBoard[destKey] ?? [];
			if (existing.includes(tokenType)) return INVALID_MOVE;

			cultCard.tokenTypes.splice(typeIdx, 1);
			cultCard.remainingTokens--;

			if (!G.cultureBoard.cultTokensOnBoard[destKey]) {
				G.cultureBoard.cultTokensOnBoard[destKey] = [];
			}
			G.cultureBoard.cultTokensOnBoard[destKey].push(tokenType);
			G.pendingCultSpread.usedDestinations.push(destKey);

			if (player.governmentCard?.id?.includes('theocracy')) {
				player.gold += 2;
			}

			G.pendingCultSpread.remaining--;
			if (G.pendingCultSpread.remaining <= 0) {
				G.pendingCultSpread = null;
			}

			appendLog(G, ctx, 'spread cult token');
		},

		skipCultSpread: (
			{ G, ctx }: { G: GoldenAgesState; ctx: Ctx },
		) => {
			if (G.lastGloryDraw && G.lastGloryDraw.playerId === ctx.currentPlayer) return INVALID_MOVE;
			if (!G.pendingCultSpread) return INVALID_MOVE;
			G.pendingCultSpread = null;
		},
	},

	endIf: ({ G }: { G: GoldenAgesState }) => {
		const gameOver =
			G.eraIVRemainingTurns === 0 ||
			(G.currentEra === 'IV' && Object.values(G.players).every((p) => p.passedThisEra));
		if (!gameOver) return undefined;
		// Return winner or draw so the UI shows "You win!" / "You lose." / "It's a draw." correctly
		return getGameOverResult(G) ?? { isDraw: true };
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
	maxPlayers: 5,
	setupOptions: [
		{
			type: 'boolean',
			id: 'expansion',
			label: 'Cults & Culture',
			description: 'Include the Cults & Culture expansion.',
			default: false,
		},
	],
});
