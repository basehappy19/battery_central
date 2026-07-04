import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device } from '@prisma/client';
import { checkRateLimit, getClientIp, verifyApiKey, sanitizeString } from '@/lib/security';

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
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`update_battery_${ip}`, 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too Many Requests: Rate limit exceeded' }, { status: 429 });
    }

    const body = (await request.json()) as UpdatePayload;
    const { deviceId, name, platform, batteryLevel, isCharging } = body;

    if (!deviceId || batteryLevel === undefined || isCharging === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, batteryLevel, isCharging' },
        { status: 400 }
      );
    }

    const isValidApiKey = await verifyApiKey(request, body as Record<string, unknown>);
    if (!isValidApiKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const cleanDeviceId = sanitizeString(deviceId, 50);
    const cleanName = name ? sanitizeString(name, 50) : undefined;
    const cleanPlatform = platform ? sanitizeString(platform, 30) : undefined;

    const currentBattery = Math.max(0, Math.min(100, Number(batteryLevel)));
    if (isNaN(currentBattery)) {
      return NextResponse.json({ error: 'Invalid batteryLevel value' }, { status: 400 });
    }
    const currentIsCharging = Boolean(isCharging);
    const now = new Date();

    const existingDevice: Device | null = await prisma.device.findUnique({
      where: { id: cleanDeviceId },
    });

    if (existingDevice && existingDevice.acceptingUpdates === false) {
      return NextResponse.json(
        { error: 'Device updates are currently disabled by user' },
        { status: 403 }
      );
    }

    let timeRemaining: number | null = null;
    let prevBattery: number | null = null;
    let prevUpdatedAt: Date | null = null;
    let eventType: string | null = null;

    if (!existingDevice) {
      if (currentIsCharging && currentBattery === 100) {
        eventType = 'FULL_CHARGE';
      } else if (currentIsCharging) {
        eventType = 'PLUGGED_IN';
      } else {
        eventType = 'INITIAL';
      }
    } else {
      prevBattery = existingDevice.batteryLevel;
      prevUpdatedAt = existingDevice.updatedAt;
      const timeDiffMinutes = (now.getTime() - new Date(existingDevice.updatedAt).getTime()) / (1000 * 60);

      // Check if device was offline (> 15 minutes without update) and just came back!
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
    }

    const device = await prisma.device.upsert({
      where: { id: cleanDeviceId },
      update: {
        batteryLevel: currentBattery,
        isCharging: currentIsCharging,
        prevBattery: existingDevice ? existingDevice.batteryLevel : null,
        prevUpdatedAt: existingDevice ? existingDevice.updatedAt : null,
        timeRemaining: timeRemaining,
        ...(cleanName && { name: cleanName }),
        ...(cleanPlatform && { platform: cleanPlatform }),
      },
      create: {
        id: cleanDeviceId,
        name: cleanName || `Device (${cleanDeviceId.slice(0, 6)})`,
        platform: cleanPlatform || 'Unknown',
        batteryLevel: currentBattery,
        isCharging: currentIsCharging,
        prevBattery: null,
        prevUpdatedAt: null,
        timeRemaining: null,
        acceptingUpdates: true,
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

    return NextResponse.json({ success: true, device }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to update battery status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
