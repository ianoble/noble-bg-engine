/**
 * ZIA — sandbox space game. Server-side game definition (same pattern as the-golden-ages).
 * Client app at c:\code\ZIA has its own game-logic.ts and hex.ts.
 */
import { defineGame, INVALID_MOVE, } from '@noble/bg-engine';
function axialKey(coord) {
    return `${coord.q},${coord.r}`;
}
function axialDistance(a, b) {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    return Math.max(dq, dr, dq + dr);
}
function axialAdjacent(a, b) {
    return axialDistance(a, b) === 1;
}
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export const FAME_TO_WIN = 20;
export const STARTING_CREDITS = 10;
export const STARTING_SECTOR = '0,0';
export const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'];
// ---------------------------------------------------------------------------
// Initial map & helpers
// ---------------------------------------------------------------------------
const INITIAL_HEXES = [
    { q: 0, r: 0, name: 'Nexus', goodType: 'tech', buyPrice: 4, sellPrice: 6 },
    { q: 1, r: 0, name: 'Rust', goodType: 'ore', buyPrice: 2, sellPrice: 4 },
    { q: 1, r: -1, name: 'Amber', goodType: 'grain', buyPrice: 3, sellPrice: 5 },
    { q: 0, r: -1, name: 'Drift', goodType: 'luxury', buyPrice: 6, sellPrice: 8 },
    { q: -1, r: 0, name: 'Void', goodType: 'ore', buyPrice: 2, sellPrice: 4 },
    { q: -1, r: 1, name: 'Haven', goodType: 'grain', buyPrice: 3, sellPrice: 5 },
    { q: 0, r: 1, name: 'Spire', goodType: 'tech', buyPrice: 4, sellPrice: 7 },
];
function createInitialSectors() {
    const out = {};
    for (const h of INITIAL_HEXES) {
        const id = axialKey({ q: h.q, r: h.r });
        out[id] = {
            id,
            q: h.q,
            r: h.r,
            name: h.name,
            goodType: h.goodType,
            buyPrice: h.buyPrice,
            sellPrice: h.sellPrice,
            explored: false,
        };
    }
    return out;
}
function createShip(sectorId, shipClass) {
    const stats = {
        explorer: { engine: 3, weapons: 1, hull: 2, cargoCapacity: 2 },
        merchant: { engine: 2, weapons: 1, hull: 2, cargoCapacity: 4 },
        fighter: { engine: 2, weapons: 3, hull: 3, cargoCapacity: 1 },
    };
    const s = stats[shipClass];
    return {
        sectorId,
        shipClass,
        engine: s.engine,
        weapons: s.weapons,
        hull: s.hull,
        cargoCapacity: s.cargoCapacity,
        cargo: [],
    };
}
// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
const ZiaGame = {
    name: 'zia',
    setup: (context) => {
        const { ctx } = context;
        const sectors = createInitialSectors();
        const players = {};
        const ships = {};
        const numPlayers = typeof ctx.numPlayers === 'number' ? ctx.numPlayers : 2;
        for (let i = 0; i < numPlayers; i++) {
            const pid = String(i);
            players[pid] = {
                color: PLAYER_COLORS[i % PLAYER_COLORS.length],
                credits: STARTING_CREDITS,
                fame: 0,
            };
            ships[pid] = createShip(STARTING_SECTOR, 'merchant');
        }
        const missions = {
            m1: { id: 'm1', type: 'deliver', targetSectorId: '0,-1', targetGood: 'grain', rewardFame: 3, rewardCredits: 2 },
            m2: { id: 'm2', type: 'deliver', targetSectorId: '1,0', targetGood: 'ore', rewardFame: 2, rewardCredits: 3 },
            m3: { id: 'm3', type: 'explore', targetSectorId: '1,-1', rewardFame: 3, rewardCredits: 0 },
            m4: { id: 'm4', type: 'bounty', targetPlayerId: '1', rewardFame: 4, rewardCredits: 5 },
        };
        const missionDeck = ['m1', 'm2', 'm3', 'm4'];
        return {
            sectors,
            ships,
            players,
            movementPointsRemaining: 0,
            endGameScoreBreakdown: {},
            missions,
            missionDeck,
            history: [],
        };
    },
    moves: {
        setPlayerColor: ({ G, ctx }, color) => {
            if (!PLAYER_COLORS.includes(color))
                return INVALID_MOVE;
            const pid = ctx.currentPlayer;
            if (pid && G.players[pid])
                G.players[pid].color = color;
        },
        pass: () => { },
        rollMovement: ({ G, ctx }) => {
            const pid = ctx.currentPlayer;
            const ship = pid ? G.ships[pid] : undefined;
            if (!ship)
                return INVALID_MOVE;
            const random = ctx.random;
            const roll = typeof random?.D6 === 'function' ? random.D6() : Math.floor(Math.random() * 6) + 1;
            G.movementPointsRemaining = roll + ship.engine;
        },
        moveShip: ({ G, ctx }, sectorId) => {
            const pid = ctx.currentPlayer;
            const ship = pid ? G.ships[pid] : undefined;
            if (!ship || typeof sectorId !== 'string')
                return INVALID_MOVE;
            if (G.movementPointsRemaining <= 0)
                return INVALID_MOVE;
            const targetSector = G.sectors[sectorId];
            if (!targetSector)
                return INVALID_MOVE;
            const currentSector = G.sectors[ship.sectorId];
            if (!currentSector)
                return INVALID_MOVE;
            if (!axialAdjacent({ q: currentSector.q, r: currentSector.r }, { q: targetSector.q, r: targetSector.r }))
                return INVALID_MOVE;
            ship.sectorId = sectorId;
            G.movementPointsRemaining -= 1;
        },
        buyGoods: ({ G, ctx }, sectorId, goodType, quantity) => {
            const pid = ctx.currentPlayer;
            const ship = pid ? G.ships[pid] : undefined;
            const player = pid ? G.players[pid] : undefined;
            if (!ship || !player || typeof sectorId !== 'string' || quantity < 1)
                return INVALID_MOVE;
            if (ship.sectorId !== sectorId)
                return INVALID_MOVE;
            const sector = G.sectors[sectorId];
            if (!sector || sector.goodType !== goodType)
                return INVALID_MOVE;
            const cost = sector.buyPrice * quantity;
            if (player.credits < cost)
                return INVALID_MOVE;
            const usedCargo = ship.cargo.reduce((sum, s) => sum + s.quantity, 0);
            if (usedCargo + quantity > ship.cargoCapacity)
                return INVALID_MOVE;
            player.credits -= cost;
            const slot = ship.cargo.find((s) => s.goodType === goodType);
            if (slot)
                slot.quantity += quantity;
            else
                ship.cargo.push({ goodType, quantity });
        },
        sellGoods: ({ G, ctx }, sectorId, goodType, quantity) => {
            const pid = ctx.currentPlayer;
            const ship = pid ? G.ships[pid] : undefined;
            const player = pid ? G.players[pid] : undefined;
            if (!ship || !player || typeof sectorId !== 'string' || quantity < 1)
                return INVALID_MOVE;
            if (ship.sectorId !== sectorId)
                return INVALID_MOVE;
            const sector = G.sectors[sectorId];
            if (!sector || sector.goodType !== goodType)
                return INVALID_MOVE;
            const slot = ship.cargo.find((s) => s.goodType === goodType);
            if (!slot || slot.quantity < quantity)
                return INVALID_MOVE;
            player.credits += sector.sellPrice * quantity;
            slot.quantity -= quantity;
            if (slot.quantity <= 0) {
                const i = ship.cargo.indexOf(slot);
                if (i !== -1)
                    ship.cargo.splice(i, 1);
            }
            player.fame += 1;
        },
        attack: ({ G, ctx }, targetPlayerId) => {
            const pid = ctx.currentPlayer;
            const attacker = pid ? G.ships[pid] : undefined;
            const defender = G.ships[targetPlayerId];
            if (!attacker || !defender || pid === targetPlayerId)
                return INVALID_MOVE;
            if (attacker.sectorId !== defender.sectorId)
                return INVALID_MOVE;
            const random = ctx.random;
            const roll = () => typeof random?.D6 === 'function' ? random.D6() : Math.floor(Math.random() * 6) + 1;
            const attackScore = roll() + attacker.weapons;
            const defendScore = roll() + defender.weapons;
            const attackerPlayer = pid ? G.players[pid] : undefined;
            const defenderPlayer = G.players[targetPlayerId];
            if (!attackerPlayer || !defenderPlayer)
                return INVALID_MOVE;
            if (attackScore > defendScore) {
                defender.hull -= 1;
                attackerPlayer.fame += 2;
                if (defender.hull <= 0) {
                    defender.sectorId = STARTING_SECTOR;
                    defender.hull = 1;
                    defender.cargo = [];
                    defenderPlayer.credits = Math.max(0, defenderPlayer.credits - 2);
                    defenderPlayer.fame = Math.max(0, defenderPlayer.fame - 1);
                }
            }
            else {
                attacker.hull -= 1;
                defenderPlayer.fame += 2;
                if (attacker.hull <= 0) {
                    attacker.sectorId = STARTING_SECTOR;
                    attacker.hull = 1;
                    attacker.cargo = [];
                    attackerPlayer.credits = Math.max(0, attackerPlayer.credits - 2);
                    attackerPlayer.fame = Math.max(0, attackerPlayer.fame - 1);
                }
            }
        },
        explore: ({ G, ctx }, sectorId) => {
            const pid = ctx.currentPlayer;
            const ship = pid ? G.ships[pid] : undefined;
            const player = pid ? G.players[pid] : undefined;
            if (!ship || !player || typeof sectorId !== 'string')
                return INVALID_MOVE;
            if (ship.sectorId !== sectorId)
                return INVALID_MOVE;
            const sector = G.sectors[sectorId];
            if (!sector || sector.explored)
                return INVALID_MOVE;
            sector.explored = true;
            player.fame += 2;
        },
        completeMission: ({ G, ctx }, missionId) => {
            const pid = ctx.currentPlayer;
            const ship = pid ? G.ships[pid] : undefined;
            const player = pid ? G.players[pid] : undefined;
            if (!ship || !player || !G.missionDeck.includes(missionId))
                return INVALID_MOVE;
            const mission = G.missions[missionId];
            if (!mission)
                return INVALID_MOVE;
            if (mission.type === 'deliver') {
                if (mission.targetSectorId === undefined || mission.targetGood === undefined)
                    return INVALID_MOVE;
                if (ship.sectorId !== mission.targetSectorId)
                    return INVALID_MOVE;
                const slot = ship.cargo.find((s) => s.goodType === mission.targetGood);
                if (!slot || slot.quantity < 1)
                    return INVALID_MOVE;
                slot.quantity -= 1;
                if (slot.quantity <= 0) {
                    const i = ship.cargo.indexOf(slot);
                    if (i !== -1)
                        ship.cargo.splice(i, 1);
                }
            }
            else if (mission.type === 'explore') {
                if (mission.targetSectorId === undefined)
                    return INVALID_MOVE;
                const sector = G.sectors[mission.targetSectorId];
                if (!sector || !sector.explored)
                    return INVALID_MOVE;
            }
            else if (mission.type === 'bounty') {
                if (mission.targetPlayerId === undefined)
                    return INVALID_MOVE;
                const targetShip = G.ships[mission.targetPlayerId];
                if (!targetShip || targetShip.hull > 0)
                    return INVALID_MOVE;
            }
            player.fame += mission.rewardFame;
            player.credits += mission.rewardCredits;
            G.missionDeck = G.missionDeck.filter((id) => id !== missionId);
        },
    },
    endIf: ({ G }) => {
        for (const pid of Object.keys(G.players)) {
            if (G.players[pid].fame >= FAME_TO_WIN)
                return { winner: pid };
        }
        return undefined;
    },
    turn: { minMoves: 1, maxMoves: 10 },
};
// ---------------------------------------------------------------------------
// Definition (export for server registration)
// ---------------------------------------------------------------------------
export const gameDef = defineGame({
    game: ZiaGame,
    id: 'zia',
    displayName: 'ZIA: Become a Legend',
    description: 'A sandbox space game: trade, fight, explore, complete missions, and earn fame to become a legend.',
    minPlayers: 2,
    maxPlayers: 4,
    validateMove({ G, playerID, currentPlayer }, moveName, ...args) {
        if (playerID !== currentPlayer && moveName !== 'setPlayerColor')
            return 'Not your turn';
        if (moveName === 'setPlayerColor') {
            const color = args[0];
            if (!PLAYER_COLORS.includes(color))
                return 'Invalid color';
            return true;
        }
        if (moveName === 'pass' || moveName === 'rollMovement')
            return true;
        if (moveName === 'moveShip')
            return typeof args[0] === 'string' ? true : 'Invalid sector';
        if (moveName === 'buyGoods' || moveName === 'sellGoods') {
            const [sectorId, _gt, quantity] = args;
            if (typeof sectorId !== 'string' || typeof quantity !== 'number' || quantity < 1)
                return 'Invalid args';
            return true;
        }
        if (moveName === 'attack')
            return typeof args[0] === 'string' ? true : 'Invalid target';
        if (moveName === 'explore')
            return typeof args[0] === 'string' ? true : 'Invalid sector';
        if (moveName === 'completeMission')
            return typeof args[0] === 'string' ? true : 'Invalid mission';
        return true;
    },
});
//# sourceMappingURL=zia.js.map