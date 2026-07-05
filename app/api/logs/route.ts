import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit')) || 20));
    const skip = (page - 1) * limit;

    const method = searchParams.get('method') || '';
    const statusFilter = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    const where: Prisma.ApiLogWhereInput = {};

    if (method && method !== 'ALL') {
      where.method = method;
    }

    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'SUCCESS') {
        where.status = { gte: 200, lt: 400 };
      } else if (statusFilter === 'ERROR') {
        where.status = { gte: 400 };
      } else {
        const num = Number(statusFilter);
        if (!isNaN(num)) where.status = num;
      }
    }

    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { path: { contains: q, mode: 'insensitive' } },
        { ip: { contains: q, mode: 'insensitive' } },
        { userAgent: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.apiLog.count({ where }),
      prisma.apiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to fetch API logs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const deleted = await prisma.apiLog.deleteMany();
    return NextResponse.json({
      success: true,
      message: `Cleared ${deleted.count} API log entries`,
      count: deleted.count,
    });
  } catch (error) {
    console.error('Failed to delete API logs:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
