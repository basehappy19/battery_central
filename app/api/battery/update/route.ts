import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device } from '@prisma/client';
import { verifyApiKey } from '@/lib/security';

async function sendNotification(message: string): Promise<void> {
  console.log(`[ALERT NOTIFICATION]: ${message}`);
}

interface UpdatePayload {
  deviceId?: string;
  name?: string;
  platform?: string;
  batteryLevel?: number | string;
  isCharging?: boolean | string;
  apiKey?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdatePayload;
    const { deviceId, name, platform, batteryLevel, isCharging } = body || {};

    if (!deviceId || batteryLevel === undefined || isCharging === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, batteryLevel, isCharging' },
        { status: 400 }
      );
    }

    const isValidApiKey = await verifyApiKey(request, body as Record<string, unknown>);
    if (!isValidApiKey) {
      return NextResponse.json({ error: 'Unauthorized: API Key ไม่ถูกต้อง กรุณาตรวจสอบรหัสลับจากหน้าระบบ' }, { status: 401 });
    }

    const cleanDeviceId = String(deviceId).trim();
    const cleanName = name !== undefined ? String(name).trim() : undefined;
    const cleanPlatform = platform !== undefined ? String(platform).trim() : undefined;

    const currentBattery = Math.max(0, Math.min(100, Number(batteryLevel)));
    if (isNaN(currentBattery)) {
      return NextResponse.json({ error: 'Invalid batteryLevel value' }, { status: 400 });
    }
    const currentIsCharging = Boolean(isCharging);
    const now = new Date();

    // STRICT CHECK: Device MUST exist in the system (pre-registered in Dashboard)
    const existingDevice: Device | null = await prisma.device.findFirst({
      where: { id: cleanDeviceId },
    });

    if (!existingDevice) {
      return NextResponse.json(
        { error: 'ไม่พบรหัสอุปกรณ์นี้ในระบบ (Device ID Not Found) กรุณากดเพิ่มอุปกรณ์ใหม่จากหน้าเว็บแดชบอร์ดก่อนใช้งาน' },
        { status: 404 }
      );
    }

    if (existingDevice.acceptingUpdates === false) {
      return NextResponse.json(
        { error: 'Device updates are currently disabled by user' },
        { status: 403 }
      );
    }

    let timeRemaining: number | null = null;
    let prevBattery: number | null = null;
    let prevUpdatedAt: Date | null = null;
    let eventType: string | null = null;

    prevBattery = existingDevice.batteryLevel;
    prevUpdatedAt = existingDevice.updatedAt;
    const timeDiffMinutes = (now.getTime() - new Date(existingDevice.updatedAt).getTime()) / (1000 * 60);

    if (timeDiffMinutes > 15) {
      eventType = 'RECONNECTED';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      await sendNotification(`${deviceName} กลับมาเชื่อมต่อ (ขาดการติดต่อไป ~${Math.round(timeDiffMinutes)} นาที)`);
    } else if (existingDevice.isCharging !== currentIsCharging) {
      eventType = currentIsCharging ? 'PLUGGED_IN' : 'UNPLUGGED';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      if (currentIsCharging) {
        await sendNotification(`${deviceName} เริ่มเสียบชาร์จ (แบตเตอรี่: ${currentBattery}%)`);
      } else {
        await sendNotification(`${deviceName} ถอดสายชาร์จ (แบตเตอรี่: ${currentBattery}%)`);
      }
    } else if (currentIsCharging && currentBattery === 100 && existingDevice.batteryLevel < 100) {
      eventType = 'FULL_CHARGE';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      await sendNotification(`${deviceName} ชาร์จเต็ม 100%`);
    } else if (existingDevice.batteryLevel !== currentBattery) {
      eventType = 'LEVEL_UPDATE';
    }

    if (
      existingDevice.isCharging === currentIsCharging &&
      prevBattery !== null &&
      prevBattery !== currentBattery &&
      prevUpdatedAt
    ) {
      if (timeDiffMinutes > 0) {
        if (currentIsCharging && currentBattery > prevBattery) {
          const chargeRatePerMin = (currentBattery - prevBattery) / timeDiffMinutes;
          if (chargeRatePerMin > 0) {
            const percentToFull = 100 - currentBattery;
            timeRemaining = Math.round(percentToFull / chargeRatePerMin);
          }
        } else if (!currentIsCharging && currentBattery < prevBattery) {
          const dischargeRatePerMin = (prevBattery - currentBattery) / timeDiffMinutes;
          if (dischargeRatePerMin > 0) {
            timeRemaining = Math.round(currentBattery / dischargeRatePerMin);
          }
        }
      }
    } else if (existingDevice.isCharging === currentIsCharging) {
      timeRemaining = existingDevice.timeRemaining;
    }

    await prisma.device.updateMany({
      where: { id: cleanDeviceId },
      data: {
        batteryLevel: currentBattery,
        isCharging: currentIsCharging,
        prevBattery: existingDevice.batteryLevel,
        prevUpdatedAt: existingDevice.updatedAt,
        timeRemaining: timeRemaining,
        ...(cleanName && { name: cleanName }),
        ...(cleanPlatform && { platform: cleanPlatform }),
      },
    });

    if (eventType) {
      await prisma.batteryLog.create({
        data: {
          deviceId: cleanDeviceId,
          batteryLevel: currentBattery,
          isCharging: currentIsCharging,
          eventType: eventType,
        },
      });
    }

    const updatedDevice = await prisma.device.findFirst({ where: { id: cleanDeviceId } });
    return NextResponse.json({ success: true, device: updatedDevice }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to update battery status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
