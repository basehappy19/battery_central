import { prisma } from '@/lib/prisma';

// 1. In-Memory Rate Limiter (Anti-DDoS & Anti-Brute Force)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// 2. Input Sanitization (Anti-XSS & Anti-Injection)
export function sanitizeString(input: unknown, maxLen = 100): string {
  if (input === null || input === undefined) return '';
  const str = String(input).trim();
  // Strip HTML tags and dangerous scripts
  const sanitized = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/[<>"'/\\0]/g, '')
    .slice(0, maxLen);
  return sanitized;
}

// 3. Get Client IP Address
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

// 4. Verify API Key for Device Updates (MacroDroid / IoT)
export async function verifyApiKey(request: Request, body?: Record<string, unknown>): Promise<boolean> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'api_secret_key' } });
    const secretKey = setting?.value || process.env.API_SECRET_KEY;

    // If no secret key is configured in DB or ENV, allow requests by default
    if (!secretKey) return true;

    const headerKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const queryKey = new URL(request.url).searchParams.get('key');
    const bodyKey = body?.apiKey ? String(body.apiKey) : null;

    const providedKey = headerKey || queryKey || bodyKey;
    return providedKey === secretKey;
  } catch (error) {
    console.error('Error verifying API key:', error);
    return false;
  }
}

// 5. Verify Dashboard Authentication Token (for Admin Actions like Rename / Toggle)
export async function verifyDashboardAuth(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get('x-dashboard-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!authHeader) return false;

    const setting = await prisma.setting.findUnique({ where: { key: 'dashboard_password' } });
    const correctPassword = setting?.value || 'battery123';
    const expectedToken = 'auth_session_' + Buffer.from(correctPassword).toString('base64');

    // Support both new secure session token and legacy 'auth_ok' / direct password
    return authHeader === expectedToken || authHeader === 'auth_ok' || authHeader === correctPassword;
  } catch (error) {
    console.error('Error verifying dashboard auth:', error);
    return false;
  }
}
