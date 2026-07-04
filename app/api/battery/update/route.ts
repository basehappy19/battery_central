import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device } from '@prisma/client';

async function sendNotification(message: string): Promise<void> {
  console.log(`[ALERT NOTIFICATION]: ${message}`);
}

interface UpdatePayload {
  deviceId?: string;
  name?: string;
  platform?: string;
  batteryLevel?: number | string;
  isCharging?: boolean | string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdatePayload;
    const { deviceId, name, platform, batteryLevel, isCharging } = body;

    if (!deviceId || batteryLevel === undefined || isCharging === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: deviceId, batteryLevel, isCharging' },
        { status: 400 }
      );
    }

    const currentBattery = Math.max(0, Math.min(100, Number(batteryLevel)));
    const currentIsCharging = Boolean(isCharging);
    const now = new Date();

    const existingDevice: Device | null = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    let timeRemaining: number | null = null;
    let prevBattery: number | null = null;
    let prevUpdatedAt: Date | null = null;
    let eventType: string | null = null;

    if (!existingDevice) {
      if (currentIsCharging && currentBattery === 100) {
        eventType = 'FULL_CHARGE';
      } else if (currentIsCharging) {
        eventType = 'PLUGGED_IN';
      }
    } else {
      prevBattery = existingDevice.batteryLevel;
      prevUpdatedAt = existingDevice.updatedAt;

      if (existingDevice.isCharging !== currentIsCharging) {
        eventType = currentIsCharging ? 'PLUGGED_IN' : 'UNPLUGGED';
        const deviceName = existingDevice.name || `Device (${deviceId.slice(0, 6)})`;
        if (currentIsCharging) {
          await sendNotification(`${deviceName} เริ่มเสียบชาร์จ (แบตเตอรี่: ${currentBattery}%)`);
        } else {
          await sendNotification(`${deviceName} ถอดสายชาร์จ (แบตเตอรี่: ${currentBattery}%)`);
        }
      } else if (currentIsCharging && currentBattery === 100 && existingDevice.batteryLevel < 100) {
        eventType = 'FULL_CHARGE';
        const deviceName = existingDevice.name || `Device (${deviceId.slice(0, 6)})`;
        await sendNotification(`${deviceName} ชาร์จเต็ม 100%`);
      }

      if (
        existingDevice.isCharging === currentIsCharging &&
        prevBattery !== null &&
        prevBattery !== currentBattery &&
        prevUpdatedAt
      ) {
        const timeDiffMinutes = (now.getTime() - new Date(prevUpdatedAt).getTime()) / (1000 * 60);

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
      where: { id: deviceId },
      update: {
        batteryLevel: currentBattery,
        isCharging: currentIsCharging,
        prevBattery: existingDevice ? existingDevice.batteryLevel : null,
        prevUpdatedAt: existingDevice ? existingDevice.updatedAt : null,
        timeRemaining: timeRemaining,
        ...(name && { name: String(name) }),
        ...(platform && { platform: String(platform) }),
      },
      create: {
        id: deviceId,
        name: name ? String(name) : `Device (${deviceId.slice(0, 6)})`,
        platform: platform ? String(platform) : 'Unknown',
        batteryLevel: currentBattery,
        isCharging: currentIsCharging,
        prevBattery: null,
        prevUpdatedAt: null,
        timeRemaining: null,
      },
    });

    if (eventType) {
      await prisma.batteryLog.create({
        data: {
          deviceId: deviceId,
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
