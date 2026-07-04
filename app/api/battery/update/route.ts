import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Placeholder notification service
async function sendNotification(message: string) {
  console.log(`[ALERT NOTIFICATION]: ${message}`);
  // In production: integrate with Webhooks, Push Notifications, Telegram, or Email
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    // 1. Fetch existing device to compare states
    const existingDevice = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    let timeRemaining: number | null = null;
    let prevBattery: number | null = null;
    let prevUpdatedAt: Date | null = null;

    if (existingDevice) {
      prevBattery = existingDevice.batteryLevel;
      prevUpdatedAt = existingDevice.updatedAt;

      // 2. Alert Logic: Check for charging state transitions
      if (existingDevice.isCharging !== currentIsCharging) {
        const deviceName = existingDevice.name || `Device (${deviceId.slice(0, 6)})`;
        if (currentIsCharging) {
          await sendNotification(`⚡ ${deviceName} has been plugged in (Battery: ${currentBattery}%).`);
        } else {
          await sendNotification(`🔌 ${deviceName} has been unplugged (Battery: ${currentBattery}%).`);
        }
      }

      // 3. Time Estimation Logic
      // Only calculate rate if battery level changed and we stayed in the same charging state
      if (
        existingDevice.isCharging === currentIsCharging &&
        prevBattery !== currentBattery &&
        prevUpdatedAt
      ) {
        const timeDiffMinutes = (now.getTime() - new Date(prevUpdatedAt).getTime()) / (1000 * 60);

        if (timeDiffMinutes > 0) {
          if (currentIsCharging && currentBattery > prevBattery) {
            // Charging rate (% per minute)
            const chargeRatePerMin = (currentBattery - prevBattery) / timeDiffMinutes;
            if (chargeRatePerMin > 0) {
              const percentToFull = 100 - currentBattery;
              timeRemaining = Math.round(percentToFull / chargeRatePerMin);
            }
          } else if (!currentIsCharging && currentBattery < prevBattery) {
            // Discharging rate (% per minute)
            const dischargeRatePerMin = (prevBattery - currentBattery) / timeDiffMinutes;
            if (dischargeRatePerMin > 0) {
              timeRemaining = Math.round(currentBattery / dischargeRatePerMin);
            }
          }
        }
      } else if (existingDevice.isCharging === currentIsCharging) {
        // Keep previous time remaining if battery level hasn't changed yet in this cycle
        timeRemaining = existingDevice.timeRemaining;
      }
    }

    // 4. Upsert device record with updated telemetry and estimation
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

    return NextResponse.json({ success: true, device }, { status: 200 });
  } catch (error) {
    console.error('Failed to update battery status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
