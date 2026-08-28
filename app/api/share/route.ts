import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifyDashboardAuth } from '@/lib/security';
import { logApiRequest } from '@/lib/api-logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Feature 14: public share links / iframe embed widgets.
// List existing share links (admin only).
export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const isAuthed = await verifyDashboardAuth(request);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tokens = await prisma.shareToken.findMany({ orderBy: { createdAt: 'desc' } });
    logApiRequest({ method: 'GET', path: '/api/share', status: 200, durationMs: Date.now() - startTime, req: request, requestBody: null, responseBody: { success: true, count: tokens.length } });
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Failed to list share tokens:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

interface CreateSharePayload {
  deviceIds?: string[];
  expiresInHours?: number | null;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let body: CreateSharePayload | null = null;
  try {
    const isAuthed = await verifyDashboardAuth(request);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    body = (await request.json()) as CreateSharePayload;
    const { deviceIds, expiresInHours } = body || {};

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return NextResponse.json({ error: 'ต้องเลือกอย่างน้อย 1 อุปกรณ์' }, { status: 400 });
    }

    const cleanIds = deviceIds.map((d) => String(d).trim()).filter(Boolean);
    const existingCount = await prisma.device.count({ where: { id: { in: cleanIds } } });
    if (existingCount !== cleanIds.length) {
      return NextResponse.json({ error: 'พบรหัสอุปกรณ์ที่ไม่ถูกต้อง' }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt =
      expiresInHours && Number(expiresInHours) > 0
        ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000)
        : null;

    const shareToken = await prisma.shareToken.create({
      data: { token, deviceIds: cleanIds, expiresAt },
    });

    const resBody = { success: true, shareToken };
    logApiRequest({ method: 'POST', path: '/api/share', status: 201, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: resBody });
    return NextResponse.json(resBody, { status: 201 });
  } catch (error) {
    console.error('Failed to create share token:', error);
    logApiRequest({ method: 'POST', path: '/api/share', status: 500, durationMs: Date.now() - startTime, req: request, requestBody: body, responseBody: { error: 'Internal Server Error' } });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const startTime = Date.now();
  try {
    const isAuthed = await verifyDashboardAuth(request);
    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }
    const deleted = await prisma.shareToken.deleteMany({ where: { token } });
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'ไม่พบลิงก์แชร์นี้' }, { status: 404 });
    }
    logApiRequest({ method: 'DELETE', path: '/api/share', status: 200, durationMs: Date.now() - startTime, req: request, requestBody: { token }, responseBody: { success: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete share token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
