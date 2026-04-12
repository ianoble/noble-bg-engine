/**
 * ZIA — sandbox space game. Server-side game definition (same pattern as the-golden-ages).
 * Client app at c:\code\ZIA has its own game-logic.ts and hex.ts.
 */
import { type BaseGameState } from '@noble/bg-engine';
export declare const FAME_TO_WIN = 20;
export declare const STARTING_CREDITS = 10;
export declare const STARTING_SECTOR = "0,0";
export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export declare const PLAYER_COLORS: PlayerColor[];
export type GoodType = 'ore' | 'grain' | 'tech' | 'luxury';
export type ShipClass = 'explorer' | 'merchant' | 'fighter';
export interface Sector {
    id: string;
    q: number;
    r: number;
    name: string;
    goodType: GoodType;
    buyPrice: number;
    sellPrice: number;
    explored: boolean;
}
export interface CargoSlot {
    goodType: GoodType;
    quantity: number;
}
export interface Ship {
    sectorId: string;
    shipClass: ShipClass;
    engine: number;
    weapons: number;
    hull: number;
    cargoCapacity: number;
    cargo: CargoSlot[];
}
export interface ZiaPlayer {
    color: PlayerColor;
    credits: number;
    fame: number;
}
export type MissionType = 'deliver' | 'bounty' | 'explore';
export interface Mission {
    id: string;
    type: MissionType;
    targetSectorId?: string;
    targetGood?: GoodType;
    targetPlayerId?: string;
    rewardFame: number;
    rewardCredits: number;
}
export interface ZiaState extends BaseGameState {
    sectors: Record<string, Sector>;
    ships: Record<string, Ship>;
    players: Record<string, ZiaPlayer>;
    movementPointsRemaining: number;
    endGameScoreBreakdown: Record<string, {
        label: string;
        vp: number;
    }[]>;
    missions: Record<string, Mission>;
    missionDeck: string[];
}
export declare const gameDef: import("@noble/bg-engine").GameDefinition;
//# sourceMappingURL=zia.d.ts.map