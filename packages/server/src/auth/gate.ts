import type { Middleware } from 'koa';
import { resolveToken, extractBearerToken } from './tokens.js';

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

interface RateEntry {
  count: number;
  windowStart: number;
}

const rateLimits = new Map<string, RateEntry>();

const CREATE_PATTERN = /^\/games\/[^/]+\/create$/;

export function createGate(hasDb: boolean, allowedOrigins: (string | RegExp)[]): Middleware {
  return async (ctx, next) => {
    if (ctx.method !== 'POST' || !CREATE_PATTERN.test(ctx.path)) {
      return next();
    }

    if (!hasDb) return next();

    const token = extractBearerToken(ctx.get('authorization'));
    if (!token) {
      setCorsHeaders(ctx, allowedOrigins);
      ctx.status = 403;
      ctx.body = { error: 'Authentication required to create games' };
      return;
    }

    const playerId = resolveToken(token);
    if (!playerId) {
      setCorsHeaders(ctx, allowedOrigins);
      ctx.status = 403;
      ctx.body = { error: 'Invalid or expired token' };
      return;
    }

    const now = Date.now();
    let entry = rateLimits.get(token);
    if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
      entry = { count: 0, windowStart: now };
      rateLimits.set(token, entry);
    }

    if (entry.count >= RATE_MAX) {
      setCorsHeaders(ctx, allowedOrigins);
      ctx.status = 429;
      ctx.body = { error: 'Rate limit exceeded. Max 5 game creates per 10 minutes.' };
      return;
    }

    entry.count++;
    return next();
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
