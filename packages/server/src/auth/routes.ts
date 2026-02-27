import type { Middleware } from 'koa';
import bcrypt from 'bcryptjs';
import {
  createAccount,
  findAccountByName,
  findSessionsByPlayer,
  upsertSession,
  deleteSession,
} from './db.js';
import { generateToken, resolveToken, extractBearerToken } from './tokens.js';

const BCRYPT_ROUNDS = 10;

function parseJsonBody(ctx: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    ctx.req.on('data', (chunk: string) => { data += chunk; });
    ctx.req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    ctx.req.on('error', reject);
  });
}

function requireAuth(ctx: any): string | null {
  const token = extractBearerToken(ctx.get('authorization'));
  if (!token) {
    ctx.status = 401;
    ctx.body = { error: 'Missing Authorization header' };
    return null;
  }
  const playerId = resolveToken(token);
  if (!playerId) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid or expired token' };
    return null;
  }
  return playerId;
}

export function createAuthRoutes(hasDb: boolean, allowedOrigins: (string | RegExp)[]): Middleware {
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/auth/')) return next();

    setCorsHeaders(ctx, allowedOrigins);

    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
      return;
    }

    if (!hasDb) {
      ctx.status = 501;
      ctx.body = { error: 'Auth requires PostgreSQL' };
      return;
    }

    try {
      if (ctx.path === '/auth/register' && ctx.method === 'POST') {
        const body = await parseJsonBody(ctx);
        const { name, pin } = body;

        if (!name || typeof name !== 'string' || name.length < 1 || name.length > 24) {
          ctx.status = 400;
          ctx.body = { error: 'Name must be 1-24 characters' };
          return;
        }
        if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 8) {
          ctx.status = 400;
          ctx.body = { error: 'PIN must be 4-8 characters' };
          return;
        }

        const existing = await findAccountByName(name);
        if (existing) {
          ctx.status = 409;
          ctx.body = { error: 'Name already taken' };
          return;
        }

        const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
        const account = await createAccount(name, pinHash);
        const playerToken = generateToken(account.id);

        ctx.status = 200;
        ctx.body = { playerToken, playerName: account.name };
        return;
      }

      if (ctx.path === '/auth/login' && ctx.method === 'POST') {
        const body = await parseJsonBody(ctx);
        const { name, pin } = body;

        if (!name || !pin) {
          ctx.status = 400;
          ctx.body = { error: 'Name and PIN are required' };
          return;
        }

        const account = await findAccountByName(name);
        if (!account) {
          ctx.status = 401;
          ctx.body = { error: 'Invalid name or PIN' };
          return;
        }

        const valid = await bcrypt.compare(pin, account.pin_hash);
        if (!valid) {
          ctx.status = 401;
          ctx.body = { error: 'Invalid name or PIN' };
          return;
        }

        const playerToken = generateToken(account.id);
        ctx.status = 200;
        ctx.body = { playerToken, playerName: account.name };
        return;
      }

      if (ctx.path === '/auth/sessions' && ctx.method === 'GET') {
        const playerId = requireAuth(ctx);
        if (!playerId) return;

        const sessions = await findSessionsByPlayer(playerId);
        ctx.status = 200;
        ctx.body = { sessions };
        return;
      }

      if (ctx.path === '/auth/sessions' && ctx.method === 'POST') {
        const playerId = requireAuth(ctx);
        if (!playerId) return;

        const body = await parseJsonBody(ctx);
        const { gameName, matchID, playerSeatID, credentials, playerName } = body;

        if (!gameName || !matchID || !playerSeatID || !credentials || !playerName) {
          ctx.status = 400;
          ctx.body = { error: 'gameName, matchID, playerSeatID, credentials, and playerName are required' };
          return;
        }

        await upsertSession(playerId, gameName, matchID, playerSeatID, credentials, playerName);
        ctx.status = 200;
        ctx.body = { ok: true };
        return;
      }

      const deleteMatch = ctx.path.match(/^\/auth\/sessions\/([^/]+)\/([^/]+)$/);
      if (deleteMatch && ctx.method === 'DELETE') {
        const playerId = requireAuth(ctx);
        if (!playerId) return;

        const [, gameName, matchID] = deleteMatch;
        await deleteSession(playerId, decodeURIComponent(gameName), decodeURIComponent(matchID));
        ctx.status = 200;
        ctx.body = { ok: true };
        return;
      }

      ctx.status = 404;
      ctx.body = { error: 'Not found' };
    } catch (err: any) {
      if (err.message === 'Invalid JSON') {
        ctx.status = 400;
        ctx.body = { error: 'Invalid JSON body' };
      } else {
        console.error('[auth] error:', err);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error' };
      }
    }
  };
}

function setCorsHeaders(ctx: any, allowedOrigins: (string | RegExp)[]): void {
  const origin = ctx.get('Origin');
  if (!origin) return;

  const allowed = allowedOrigins.some((o) => {
    if (typeof o === 'string') return o === origin;
    if (o instanceof RegExp) return o.test(origin);
    return false;
  });

  if (allowed) {
    ctx.set('Access-Control-Allow-Origin', origin);
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    ctx.set('Access-Control-Allow-Credentials', 'true');
  }
}
