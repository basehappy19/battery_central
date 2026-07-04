import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ChangePasswordPayload {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChangePasswordPayload;
    const { oldPassword, newPassword, confirmPassword } = body || {};

    if (!newPassword || !confirmPassword || newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง' },
        { status: 400 }
      );
    }

    if (newPassword.trim().length < 4) {
      return NextResponse.json(
        { error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' },
        { status: 400 }
      );
    }

    const setting = await prisma.setting.findUnique({
      where: { key: 'dashboard_password' },
    });

    const currentPassword = setting?.value || 'battery123';

    if (oldPassword !== currentPassword) {
      return NextResponse.json(
        { error: 'รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' },
        { status: 401 }
      );
    }

    const cleanNewPassword = newPassword.trim();

    await prisma.setting.upsert({
      where: { key: 'dashboard_password' },
      update: { value: cleanNewPassword },
      create: { key: 'dashboard_password', value: cleanNewPassword },
    });

    return NextResponse.json(
      { success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Failed to change password:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
