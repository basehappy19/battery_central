import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const devices = await prisma.device.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        logs: {
          where: {
            createdAt: {
              gte: startOfToday,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    const devicesWithStats = devices.map((device) => {
      const logs = device.logs || [];
      const pluggedCount = logs.filter((l) => l.eventType === 'PLUGGED_IN' || (l.eventType === 'INITIAL' && l.isCharging)).length + (logs.length === 0 && device.isCharging ? 1 : 0);
      const unpluggedCount = logs.filter((l) => l.eventType === 'UNPLUGGED' || (l.eventType === 'INITIAL' && !l.isCharging)).length + (logs.length === 0 && !device.isCharging ? 1 : 0);
      
      const allLevels = [device.batteryLevel, ...logs.map((l) => l.batteryLevel)];
      const maxBattery = Math.max(...allLevels);
      const minBattery = Math.min(...allLevels);

      const relevantLogs = logs.filter(
        (l) => l.eventType === 'PLUGGED_IN' || l.eventType === 'UNPLUGGED' || l.eventType === 'FULL_CHARGE'
      );

      return {
        id: device.id,
        name: device.name,
        platform: device.platform,
        batteryLevel: device.batteryLevel,
        isCharging: device.isCharging,
        timeRemaining: device.timeRemaining,
        updatedAt: device.updatedAt,
        todayStats: {
          pluggedCount,
          unpluggedCount,
          maxBattery,
          minBattery,
          history: relevantLogs.slice(0, 10).map((l) => ({
            id: l.id,
            batteryLevel: l.batteryLevel,
            isCharging: l.isCharging,
            eventType: l.eventType,
            createdAt: l.createdAt,
          })),
        },
      };
    });

    return NextResponse.json({ devices: devicesWithStats }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch devices:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
