import { randomUUID } from 'crypto';

const tokenMap = new Map<string, string>();

export function generateToken(playerId: string): string {
  const token = randomUUID();
  tokenMap.set(token, playerId);
  return token;
}

export function resolveToken(token: string): string | undefined {
  return tokenMap.get(token);
}

export function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}
