import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface AuthPayload {
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthPayload;
    const { password } = body;

    const setting = await prisma.setting.findUnique({
      where: { key: 'dashboard_password' },
    });

    const correctPassword = setting?.value || "battery123";

    if (password === correctPassword) {
      const token = "auth_session_" + Buffer.from(correctPassword).toString('base64');
      return NextResponse.json({ success: true, token }, { status: 200 });
    }

    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  } catch (error: unknown) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
