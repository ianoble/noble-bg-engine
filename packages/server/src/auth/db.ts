import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

export async function initAuthTables(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS player_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS player_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
      game_name TEXT NOT NULL,
      match_id TEXT NOT NULL,
      player_seat_id TEXT NOT NULL,
      credentials TEXT NOT NULL,
      player_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(player_id, game_name, match_id)
    )
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS abandon_votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_name TEXT NOT NULL,
      match_id TEXT NOT NULL,
      player_id UUID NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(game_name, match_id, player_id)
    )
  `);
}

export interface PlayerAccount {
  id: string;
  name: string;
  pin_hash: string;
}

export async function createAccount(name: string, pinHash: string): Promise<PlayerAccount> {
  const p = getPool();
  const result = await p.query(
    'INSERT INTO player_accounts (name, pin_hash) VALUES ($1, $2) RETURNING id, name, pin_hash',
    [name, pinHash],
  );
  return result.rows[0];
}

export async function findAccountByName(name: string): Promise<PlayerAccount | undefined> {
  const p = getPool();
  const result = await p.query(
    'SELECT id, name, pin_hash FROM player_accounts WHERE name = $1',
    [name],
  );
  return result.rows[0];
}

export interface PlayerSession {
  gameName: string;
  matchID: string;
  playerSeatID: string;
  credentials: string;
  playerName: string;
}

export async function findSessionsByPlayer(playerId: string): Promise<PlayerSession[]> {
  const p = getPool();
  const result = await p.query(
    `SELECT game_name AS "gameName", match_id AS "matchID",
            player_seat_id AS "playerSeatID", credentials, player_name AS "playerName"
     FROM player_sessions WHERE player_id = $1 ORDER BY created_at DESC`,
    [playerId],
  );
  return result.rows;
}

export async function upsertSession(
  playerId: string,
  gameName: string,
  matchID: string,
  playerSeatID: string,
  credentials: string,
  playerName: string,
): Promise<void> {
  const p = getPool();
  await p.query(
    `INSERT INTO player_sessions (player_id, game_name, match_id, player_seat_id, credentials, player_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (player_id, game_name, match_id)
     DO UPDATE SET credentials = EXCLUDED.credentials, player_name = EXCLUDED.player_name,
                   player_seat_id = EXCLUDED.player_seat_id`,
    [playerId, gameName, matchID, playerSeatID, credentials, playerName],
  );
}

export async function deleteSession(
  playerId: string,
  gameName: string,
  matchID: string,
): Promise<void> {
  const p = getPool();
  await p.query(
    'DELETE FROM player_sessions WHERE player_id = $1 AND game_name = $2 AND match_id = $3',
    [playerId, gameName, matchID],
  );
  await p.query(
    'DELETE FROM abandon_votes WHERE player_id = $1 AND game_name = $2 AND match_id = $3',
    [playerId, gameName, matchID],
  );
}

export async function upsertAbandonVote(
  playerId: string,
  gameName: string,
  matchID: string,
): Promise<void> {
  const p = getPool();
  await p.query(
    `INSERT INTO abandon_votes (game_name, match_id, player_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (game_name, match_id, player_id) DO NOTHING`,
    [gameName, matchID, playerId],
  );
}

export interface AbandonVoteStatus {
  voters: string[];
  totalHumans: number;
  allAgreed: boolean;
}

export async function getAbandonVoteStatus(
  gameName: string,
  matchID: string,
): Promise<AbandonVoteStatus> {
  const p = getPool();
  const votersResult = await p.query(
    `SELECT pa.name
     FROM abandon_votes av
     JOIN player_accounts pa ON pa.id = av.player_id
     WHERE av.game_name = $1 AND av.match_id = $2
     ORDER BY av.created_at`,
    [gameName, matchID],
  );
  const voters = votersResult.rows.map((r: any) => r.name);

  const humansResult = await p.query(
    `SELECT COUNT(DISTINCT player_id) AS total
     FROM player_sessions
     WHERE game_name = $1 AND match_id = $2`,
    [gameName, matchID],
  );
  const totalHumans = parseInt(humansResult.rows[0]?.total ?? '0', 10);

  return {
    voters,
    totalHumans,
    allAgreed: totalHumans > 0 && voters.length >= totalHumans,
  };
}

export async function deleteAbandonVote(
  playerId: string,
  gameName: string,
  matchID: string,
): Promise<void> {
  const p = getPool();
  await p.query(
    'DELETE FROM abandon_votes WHERE player_id = $1 AND game_name = $2 AND match_id = $3',
    [playerId, gameName, matchID],
  );
}
