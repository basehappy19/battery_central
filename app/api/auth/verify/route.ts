import { NextResponse } from 'next/server';

interface AuthPayload {
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuthPayload;
    const { password } = body;

    const correctPassword = process.env.DASHBOARD_PASSWORD || "battery123";

    if (password === correctPassword) {
      return NextResponse.json({ success: true, token: "auth_ok" }, { status: 200 });
    }

    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  } catch (error: unknown) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
