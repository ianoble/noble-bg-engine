import { type BaseGameState, type SquareBoard, type GamePiece, type TileLayer, type TileRotation, type TileShape } from '@noble/bg-engine';
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow' | 'black';
export type Era = 'I' | 'II' | 'III' | 'IV';
export type CardType = 'civilisation' | 'wonder' | 'building' | 'futureTech' | 'historysJudgement' | 'culture';
export type BackColor = 'green' | 'purple' | 'orange' | 'blue' | 'gray' | 'teal';
export type CultureCardSubtype = 'progress' | 'cult' | 'government' | 'masterpiece' | 'building';
export type GamePhase = 'eraStart' | 'tilePlacement' | 'actions';
export type ResourceType = 'gem' | 'rock' | 'game' | 'wheat';
export type EdgeType = 'water' | 'land';
export type CellEdges = [EdgeType, EdgeType, EdgeType, EdgeType];
export type ActionType = 'explorer' | 'builder' | 'artist' | 'soldier' | 'culture' | 'buildWonder' | 'activateBuildingOrWonder' | 'developTechnology' | 'startGoldenAge';
export interface ActionMeta {
    type: ActionType;
    label: string;
    description: string;
    requiresWorker: boolean;
}
export declare const TECH_COSTS: number[];
export declare const TECH_TREE: {
    name: string;
    description: string;
    cost: number;
}[][];
export declare const ACTION_TYPES: ActionMeta[];
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
export declare const JUDGEMENT_DEFS: JudgementDef[];
export declare const EXPANSION_JUDGEMENT_DEFS: JudgementDef[];
export interface FutureTechDef {
    type: string;
    name: string;
    description: string;
}
export declare const FUTURE_TECH_DEFS: FutureTechDef[];
export declare const EXPANSION_FUTURE_TECH_DEFS: FutureTechDef[];
export interface WonderDef {
    type: string;
    name: string;
    description: string;
    cost: number;
    discountCiv?: string;
    discountCost?: number;
    activateDescription?: string;
}
export declare const WONDER_DEFS: Record<Era, WonderDef[]>;
export declare const EXPANSION_WONDER_DEFS: Record<Era, WonderDef[]>;
export interface BuildingDef {
    type: string;
    name: string;
    description: string;
}
export declare const BUILDING_DEFS: Record<Era, BuildingDef[]>;
export declare const EXPANSION_BUILDING_DEFS: Record<Era, BuildingDef[]>;
export interface CivDef {
    type: string;
    name: string;
    number: number;
    description: string;
}
export declare const CIV_DEFS: Record<Era, CivDef[]>;
export declare const EXPANSION_CIV_DEFS: Record<Era, CivDef[]>;
export declare const MASTERPIECE_DEFS: CultureCardDef[];
export declare const CULTURE_CARD_DEFS: Record<Era, CultureCardDef[]>;
export type EraDecks = Record<Era, GameCard[]>;
export interface CardDecks {
    wonder: EraDecks;
    building: EraDecks;
}
export type BoardCubeKey = `${number},${number}`;
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
export declare const INVASION_COSTS: number[];
export declare const CULTURE_GRID_ROWS: number;
export declare const CULTURE_GRID_COLS: number;
export declare const CULTURE_GRID: CultureGridCell[][];
export declare function checkCultureRequirement(requirement: string | null, player: GoldenAgesPlayerState, G: GoldenAgesState, playerId: string): boolean;
export declare function advanceCultureRow(G: GoldenAgesState, playerId: string, row: number, ignoreRequirements: boolean): boolean;
export declare const GLORY_TOKEN_POOL: number[];
export declare const EXPANSION_GLORY_TOKENS: number[];
export declare function getUnlockedBuildingSlots(player: GoldenAgesPlayerState): boolean[];
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
    endGameScoreBreakdown: Record<string, {
        label: string;
        vp: number;
    }[]>;
    boardEdges: Record<string, CellEdges>;
    gameLog: GameLogEntry[];
    setupOptions: {
        expansion: boolean;
    };
    cultureBoard: CultureBoardState | null;
    pendingCulturePicks: number;
    pendingCultFill: {
        cardIndex: number;
        spotsRemaining: number;
    } | null;
    pendingCultSpread: {
        cityRow: number;
        cityCol: number;
        remaining: number;
        usedDestinations: string[];
    } | null;
    /** Set when current player gains a glory token (for client to show a brief reveal animation). Cleared at start of next move. */
    lastGloryDraw: {
        playerId: string;
        vp: number;
    } | null;
    /** Set when first player this era picks a History's Judgement card (so other players can see which card was picked). Cleared at start of next move. */
    lastHistoryCardPickPlayerId: string | null;
}
export declare const PLAYER_COLORS: PlayerColor[];
/** The tile shape used during each era. */
export declare const ERA_TILE_SHAPES: Record<Era, TileShape>;
export declare const ROTATIONS: TileRotation[];
export interface TileTemplate {
    id: number;
    resources: ResourceType[][];
    edges: CellEdges[];
}
export declare const L_TILE_TEMPLATES: TileTemplate[];
export declare const DOMINO_TILE_TEMPLATES: TileTemplate[];
export declare const EXPANSION_1X1_TILE_TEMPLATES: TileTemplate[];
export declare const BOARD_RESOURCES: Record<string, ResourceType[]>;
/** Full placement check: in-bounds, no overlap, adjacent, and edges match. */
export declare function canPlaceGameTile(layer: TileLayer, board: SquareBoard, shape: TileShape, anchorRow: number, anchorCol: number, rotation: TileRotation, boardEdges?: Record<string, CellEdges>, tileEdges?: CellEdges[]): boolean;
export declare function getPlayerTileEdges(G: GoldenAgesState, playerId: string): CellEdges[] | undefined;
export declare function getAttackCost(G: GoldenAgesState, attackerId: string, defenderId: string): number;
export declare function getPlayerRankings(G: GoldenAgesState): {
    playerId: string;
    score: number;
    cities: number;
}[];
/** Compute end-game score breakdown from current state (read-only). Use when stored breakdown is missing (e.g. old saved games). */
export declare function computeEndGameBreakdown(G: GoldenAgesState): Record<string, {
    label: string;
    vp: number;
}[]>;
export declare function getMovementRange(player: GoldenAgesPlayerState): number;
export declare function getReachableCells(boardRows: number, boardCols: number, startRow: number, startCol: number, range: number): [number, number][];
export declare const gameDef: import("@noble/bg-engine").GameDefinition;
//# sourceMappingURL=the-golden-ages.d.ts.map