import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device } from '@prisma/client';
import { verifyApiKey } from '@/lib/security';

async function sendNotification(message: string): Promise<void> {
  console.log(`[ALERT NOTIFICATION]: ${message}`);
}

interface UpdatePayload {
  deviceId?: string;
  device_id?: string;
  id?: string;
  name?: string;
  platform?: string;
  batteryLevel?: number | string;
  battery_level?: number | string;
  level?: number | string;
  battery?: number | string;
  isCharging?: boolean | string;
  is_charging?: boolean | string;
  charging?: boolean | string;
  plugged?: boolean | string;
  apiKey?: string;
  api_key?: string;
  key?: string;
}

export async function POST(request: Request) {
  try {
    let body: UpdatePayload;
    try {
      body = (await request.json()) as UpdatePayload;
    } catch {
      return NextResponse.json({ error: 'รูปแบบ JSON ไม่ถูกต้อง (Invalid JSON Syntax) กรุณาตรวจสอบเครื่องหมายปีกกา ฟันหนู และลูกน้ำ' }, { status: 400 });
    }

    const deviceId = body?.deviceId || body?.device_id || body?.id;
    const batteryLevel = body?.batteryLevel !== undefined ? body.batteryLevel : (body?.battery_level !== undefined ? body.battery_level : (body?.level !== undefined ? body.level : body?.battery));
    const isCharging = body?.isCharging !== undefined ? body.isCharging : (body?.is_charging !== undefined ? body.is_charging : (body?.charging !== undefined ? body.charging : body?.plugged));
    const name = body?.name;
    const platform = body?.platform;

    if (!deviceId) {
      return NextResponse.json({ error: 'ขาดข้อมูลสำคัญ: deviceId (ไม่พบรหัสอุปกรณ์ใน JSON ที่ส่งมา)' }, { status: 400 });
    }
    if (batteryLevel === undefined || batteryLevel === null) {
      return NextResponse.json({ error: 'ขาดข้อมูลสำคัญ: batteryLevel (ไม่พบระดับแบตเตอรี่ใน JSON ที่ส่งมา)' }, { status: 400 });
    }
    if (isCharging === undefined || isCharging === null) {
      return NextResponse.json({ error: 'ขาดข้อมูลสำคัญ: isCharging (ไม่พบสถานะการชาร์จใน JSON ที่ส่งมา)' }, { status: 400 });
    }

    const isValidApiKey = await verifyApiKey(request, body as Record<string, unknown>);
    if (!isValidApiKey) {
      return NextResponse.json({ error: 'Unauthorized: API Key ไม่ถูกต้อง กรุณาตรวจสอบรหัสลับจากหน้าระบบ' }, { status: 401 });
    }

    const cleanDeviceId = String(deviceId).trim();
    const cleanName = name !== undefined ? String(name).trim() : undefined;
    const cleanPlatform = platform !== undefined ? String(platform).trim() : undefined;

    const rawBatteryStr = String(batteryLevel).trim();
    const rawChargingStr = String(isCharging).trim();

    if (rawBatteryStr.includes('[') || rawChargingStr.includes('[')) {
      return NextResponse.json(
        { error: `ข้อผิดพลาด (400): ค่าที่ส่งมายังเป็นตัวปรข้อความดิบ (batteryLevel="${rawBatteryStr}", isCharging="${rawChargingStr}") กรุณาแทนที่ด้วยตัวเลขระดับแบตเตอรี่และสถานะ true/false จริงก่อนยิงข้อมูล` },
        { status: 400 }
      );
    }

    const cleanedBatteryStr = rawBatteryStr.replace(/[^0-9.]/g, '');
    const currentBattery = Math.max(0, Math.min(100, Number(cleanedBatteryStr)));
    if (isNaN(currentBattery) || cleanedBatteryStr === '') {
      return NextResponse.json({ error: `ระดับแบตเตอรี่ไม่ถูกต้อง (batteryLevel="${rawBatteryStr}"): กรุณาระบุเป็นตัวเลข 0 - 100` }, { status: 400 });
    }

    let currentIsCharging = false;
    if (typeof isCharging === 'boolean') {
      currentIsCharging = isCharging;
    } else if (typeof isCharging === 'string') {
      const val = rawChargingStr.toLowerCase();
      currentIsCharging = val === 'true' || val === '1' || val === 'yes' || val === 'charging' || val === 'plugged' || val === 'on';
    } else if (typeof isCharging === 'number') {
      currentIsCharging = isCharging === 1;
    }

    const now = new Date();

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
      const timeDiffHours = (now.getTime() - new Date(prevUpdatedAt).getTime()) / (1000 * 60 * 60);
      const batteryDiff = Math.abs(currentBattery - prevBattery);

      if (batteryDiff > 0 && timeDiffHours > 0) {
        const ratePerHour = batteryDiff / timeDiffHours;
        if (currentIsCharging && currentBattery < 100) {
          timeRemaining = Math.round((100 - currentBattery) / ratePerHour);
        } else if (!currentIsCharging && currentBattery > 0) {
          timeRemaining = Math.round(currentBattery / ratePerHour);
        }
      }
    } else if (existingDevice.isCharging === currentIsCharging) {
      timeRemaining = existingDevice.timeRemaining;
    }

    await prisma.device.update({
      where: { id: cleanDeviceId },
      data: {
        batteryLevel: currentBattery,
        isCharging: currentIsCharging,
        updatedAt: now,
        prevBattery: prevBattery,
        prevUpdatedAt: prevUpdatedAt,
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
