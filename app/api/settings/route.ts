import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSystemSettings } from '@/lib/settings';
import { logApiRequest } from '@/lib/api-logger';

export async function GET(req: Request) {
  const startTime = Date.now();
  try {
    const settings = await getSystemSettings();
    logApiRequest({ method: 'GET', path: '/api/settings', status: 200, durationMs: Date.now() - startTime, req, requestBody: null, responseBody: { success: true, keysCount: Object.keys(settings).length } });
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    logApiRequest({ method: 'GET', path: '/api/settings', status: 500, durationMs: Date.now() - startTime, req, requestBody: null, responseBody: { error: 'Failed to fetch settings' } });
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let body: Record<string, unknown> | null = null;
  try {
    body = await req.json();
    if (!body || typeof body !== 'object') {
      logApiRequest({ method: 'POST', path: '/api/settings', status: 400, durationMs: Date.now() - startTime, req, requestBody: body, responseBody: { error: 'Invalid payload' } });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
    }

    const resBody = { success: true, message: 'Settings saved successfully' };
    logApiRequest({ method: 'POST', path: '/api/settings', status: 200, durationMs: Date.now() - startTime, req, requestBody: body, responseBody: resBody });
    return NextResponse.json(resBody);
  } catch (error) {
    console.error('Failed to save settings:', error);
    logApiRequest({ method: 'POST', path: '/api/settings', status: 500, durationMs: Date.now() - startTime, req, requestBody: body, responseBody: { error: 'Failed to save settings' } });
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
