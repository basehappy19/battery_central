import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device, BatteryLog } from '@prisma/client';
import { verifyApiKey } from '@/lib/security';

async function sendNotification(message: string): Promise<void> {
  console.log(`[ALERT NOTIFICATION]: ${message}`);
  try {
    const tokenSetting = await prisma.setting.findUnique({ where: { key: 'telegram_bot_token' } });
    const chatIdSetting = await prisma.setting.findUnique({ where: { key: 'telegram_chat_id' } });
    
    const botToken = tokenSetting?.value || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = chatIdSetting?.value || process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

function formatTelegramAlert(
  title: string,
  deviceName: string,
  statusText: string,
  extraLabel?: string,
  extraValue?: string,
  nowDate?: Date
): string {
  const d = nowDate || new Date();
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' น.';
  const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timestampStr = `${dateStr} | ${timeStr}`;

  let msg = `<b>[แจ้งเตือน: ${title}]</b>\n`;
  msg += `----------------------------------------\n`;
  msg += `<b>อุปกรณ์:</b> <code>${deviceName}</code>\n`;
  msg += `<b>สถานะ:</b> ${statusText}\n`;
  if (extraLabel && extraValue !== undefined) {
    msg += `<b>${extraLabel}:</b> <b>${extraValue}</b>\n`;
  }
  msg += `----------------------------------------\n`;
  msg += `<i>เวลา: ${timestampStr}</i>`;
  return msg;
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

/**
 * Advanced BMS Analytics Engine for Battery Estimation
 * Incorporates 7-day Historical Profiling (Median Outlier Rejection),
 * Time-Decayed EWMA, Bayesian Prior Blending, and CC/CV Lithium Tapering.
 */
function calculateAdvancedTimeRemaining(
  currentBattery: number,
  currentIsCharging: boolean,
  now: Date,
  logs: BatteryLog[],
  platform?: string
): number | null {
  if (currentBattery <= 0 && !currentIsCharging) return 0;
  if (currentBattery >= 100 && currentIsCharging) return 0;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recentLogs = logs.filter(
    (l) => now.getTime() - new Date(l.createdAt).getTime() <= sevenDaysMs
  );

  // 1. Calculate 7-Day Historical Median Rate for current state (charging vs discharging)
  const historicalRates: number[] = [];
  for (let i = 0; i < recentLogs.length - 1; i++) {
    const l1 = recentLogs[i];
    const l2 = recentLogs[i + 1];
    if (l1.isCharging === currentIsCharging && l2.isCharging === currentIsCharging) {
      const diffBat = Math.abs(l1.batteryLevel - l2.batteryLevel);
      const diffHours = (new Date(l1.createdAt).getTime() - new Date(l2.createdAt).getTime()) / (1000 * 60 * 60);
      if (diffBat > 0 && diffHours >= (5 / 60) && diffHours <= 6) {
        const r = diffBat / diffHours;
        if (currentIsCharging && r >= 1.0 && r <= 300) historicalRates.push(r);
        else if (!currentIsCharging && r >= 0.1 && r <= 200) historicalRates.push(r);
      }
    }
  }

  let historicalRate: number;
  if (historicalRates.length > 0) {
    historicalRates.sort((a, b) => a - b);
    const mid = Math.floor(historicalRates.length / 2);
    historicalRate = historicalRates.length % 2 !== 0
      ? historicalRates[mid]
      : (historicalRates[mid - 1] + historicalRates[mid]) / 2;
  } else {
    // Platform-specific smart defaults (% per hour)
    const p = (platform || '').toLowerCase();
    if (p.includes('esp32') || p.includes('iot') || p.includes('sensor')) {
      historicalRate = currentIsCharging ? 20 : 0.2;
    } else if (p.includes('ios') || p.includes('android') || p.includes('phone') || p.includes('mobile')) {
      historicalRate = currentIsCharging ? 50 : 10;
    } else if (p.includes('win') || p.includes('mac') || p.includes('pc') || p.includes('laptop')) {
      historicalRate = currentIsCharging ? 40 : 20;
    } else {
      historicalRate = currentIsCharging ? 40 : 15;
    }
  }

  // 2. Collect current continuous session points (prepend current point)
  const sessionPoints = [{ batteryLevel: currentBattery, createdAt: now }];
  for (const log of recentLogs) {
    if (log.isCharging !== currentIsCharging) break;
    sessionPoints.push({ batteryLevel: log.batteryLevel, createdAt: new Date(log.createdAt) });
  }

  // 3. Calculate Current Session Rate (EWMA + Overall Linear Slope)
  let sessionRate: number | null = null;
  let sessionDurationHours = 0;

  if (sessionPoints.length >= 2) {
    const oldestPoint = sessionPoints[sessionPoints.length - 1];
    sessionDurationHours = (now.getTime() - oldestPoint.createdAt.getTime()) / (1000 * 60 * 60);
    const totalDiff = Math.abs(currentBattery - oldestPoint.batteryLevel);

    if (totalDiff > 0 && sessionDurationHours >= (0.5 / 60)) {
      const overallRate = totalDiff / sessionDurationHours;

      // Calculate Time-Decayed EWMA across session segments
      let weightedSum = 0;
      let weightTotal = 0;
      for (let i = 0; i < sessionPoints.length - 1; i++) {
        const p1 = sessionPoints[i];
        const p2 = sessionPoints[i + 1];
        const segBat = Math.abs(p1.batteryLevel - p2.batteryLevel);
        const segHours = (p1.createdAt.getTime() - p2.createdAt.getTime()) / (1000 * 60 * 60);
        if (segBat > 0 && segHours > 0) {
          const segRate = segBat / segHours;
          const ageHours = (now.getTime() - ((p1.createdAt.getTime() + p2.createdAt.getTime()) / 2)) / (1000 * 60 * 60);
          const weight = Math.exp(-0.46 * ageHours) * segHours;
          weightedSum += segRate * weight;
          weightTotal += weight;
        }
      }

      const ewmaRate = weightTotal > 0 ? weightedSum / weightTotal : overallRate;
      sessionRate = 0.6 * ewmaRate + 0.4 * overallRate;
    }
  }

  // 4. Bayesian Blending of Session Rate and Historical Rate based on session maturity
  const alpha = sessionRate !== null ? Math.min(1.0, sessionDurationHours / 1.0) : 0;
  const effectiveRate = sessionRate !== null
    ? alpha * sessionRate + (1 - alpha) * historicalRate
    : historicalRate;

  // 5. CC/CV Lithium Tapering Compensation & Time Calculation
  let hoursRemaining: number;
  if (currentIsCharging) {
    if (currentBattery < 80) {
      hoursRemaining = (80 - currentBattery + 20 * 1.6) / effectiveRate;
    } else {
      hoursRemaining = ((100 - currentBattery) * 1.6) / effectiveRate;
    }
  } else {
    hoursRemaining = currentBattery / effectiveRate;
  }

  const minutesRemaining = Math.round(hoursRemaining * 60);
  return Math.max(1, Math.min(100000, minutesRemaining));
}

export async function POST(request: Request) {
  try {
    let body: UpdatePayload;
    try {
      body = (await request.json()) as UpdatePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON syntax' }, { status: 400 });
    }

    const deviceId = body?.deviceId || body?.device_id || body?.id;
    const batteryLevel = body?.batteryLevel !== undefined ? body.batteryLevel : (body?.battery_level !== undefined ? body.battery_level : (body?.level !== undefined ? body.level : body?.battery));
    const isCharging = body?.isCharging !== undefined ? body.isCharging : (body?.is_charging !== undefined ? body.is_charging : (body?.charging !== undefined ? body.charging : body?.plugged));
    const name = body?.name;
    const platform = body?.platform;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }
    if (batteryLevel === undefined || batteryLevel === null) {
      return NextResponse.json({ error: 'Missing batteryLevel' }, { status: 400 });
    }
    if (isCharging === undefined || isCharging === null) {
      return NextResponse.json({ error: 'Missing isCharging' }, { status: 400 });
    }

    const isValidApiKey = await verifyApiKey(request, body as Record<string, unknown>);
    if (!isValidApiKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const cleanDeviceId = String(deviceId).trim();
    const cleanName = name !== undefined ? String(name).trim() : undefined;
    const cleanPlatform = platform !== undefined ? String(platform).trim() : undefined;

    const rawBatteryStr = String(batteryLevel).trim();
    const rawChargingStr = String(isCharging).trim();

    if (rawBatteryStr.includes('[') || rawChargingStr.includes('[')) {
      return NextResponse.json(
        { error: 'Invalid values: raw magic text received' },
        { status: 400 }
      );
    }

    const cleanedBatteryStr = rawBatteryStr.replace(/[^0-9.]/g, '');
    const currentBattery = Math.max(0, Math.min(100, Number(cleanedBatteryStr)));
    if (isNaN(currentBattery) || cleanedBatteryStr === '') {
      return NextResponse.json({ error: 'Invalid batteryLevel value (0-100)' }, { status: 400 });
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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const existingDevice = await prisma.device.findFirst({
      where: { id: cleanDeviceId },
      include: {
        logs: {
          where: {
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        },
      },
    });

    if (!existingDevice) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    if (existingDevice.acceptingUpdates === false) {
      return NextResponse.json(
        { error: 'Device updates disabled' },
        { status: 403 }
      );
    }

    let timeRemaining: number | null = null;
    let prevBattery: number | null = existingDevice.prevBattery ?? existingDevice.batteryLevel;
    let prevUpdatedAt: Date | null = existingDevice.prevUpdatedAt ?? existingDevice.updatedAt;
    let eventType: string | null = null;

    const timeDiffMinutes = (now.getTime() - new Date(existingDevice.updatedAt).getTime()) / (1000 * 60);

    if (timeDiffMinutes > 15) {
      eventType = 'RECONNECTED';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      await sendNotification(formatTelegramAlert('กลับมาเชื่อมต่อระบบ', deviceName, 'กลับมาออนไลน์', 'ขาดการติดต่อไป', `ประมาณ ${Math.round(timeDiffMinutes)} นาที`, now));
    } else if (existingDevice.isCharging !== currentIsCharging) {
      eventType = currentIsCharging ? 'PLUGGED_IN' : 'UNPLUGGED';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      if (currentIsCharging) {
        await sendNotification(formatTelegramAlert('เสียบสายชาร์จ', deviceName, 'เริ่มเสียบสายชาร์จแล้ว', 'ระดับแบตเตอรี่', `${currentBattery}%`, now));
      } else {
        await sendNotification(formatTelegramAlert('ถอดสายชาร์จ', deviceName, 'ถอดสายชาร์จแล้ว', 'ระดับแบตเตอรี่', `${currentBattery}%`, now));
      }
    } else if (currentIsCharging && existingDevice.batteryLevel < currentBattery) {
      const chargeThresholds = [80, 90, 95, 100];
      const crossedThreshold = chargeThresholds.find(
        (t) => currentBattery >= t && existingDevice.batteryLevel < t
      );
      if (crossedThreshold !== undefined) {
        eventType = crossedThreshold === 100 ? 'FULL_CHARGE' : 'NEAR_FULL';
        const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
        if (crossedThreshold === 100) {
          await sendNotification(formatTelegramAlert('แบตเตอรี่ชาร์จเต็ม', deviceName, 'ชาร์จเต็ม 100% เรียบร้อยแล้ว', 'ระดับแบตเตอรี่', '100%', now));
        } else {
          await sendNotification(formatTelegramAlert('แบตเตอรี่ใกล้เต็ม', deviceName, `ชาร์จถึงระดับแจ้งเตือน (${crossedThreshold}%)`, 'ระดับปัจจุบัน', `${currentBattery}%`, now));
        }
      } else {
        eventType = 'LEVEL_UPDATE';
      }
    } else if (!currentIsCharging && existingDevice.batteryLevel > currentBattery) {
      const drainThresholds = [20, 15, 10, 5, 0];
      const crossedThreshold = drainThresholds.find(
        (t) => currentBattery <= t && existingDevice.batteryLevel > t
      );
      if (crossedThreshold !== undefined) {
        eventType = crossedThreshold === 0 ? 'BATTERY_EMPTY' : 'LOW_BATTERY';
        const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
        if (crossedThreshold === 0) {
          await sendNotification(formatTelegramAlert('แบตเตอรี่หมดวิกฤต', deviceName, 'แบตเตอรี่เหลือ 0%', 'คำแนะนำ', 'อุปกรณ์อาจดับหรือหยุดทำงาน', now));
        } else {
          await sendNotification(formatTelegramAlert('แบตเตอรี่ต่ำ', deviceName, `ลดต่ำกว่าจุดแจ้งเตือน (${crossedThreshold}%)`, 'เหลือแบตเตอรี่', `${currentBattery}%`, now));
        }
      } else {
        eventType = 'LEVEL_UPDATE';
      }
    } else if (existingDevice.batteryLevel !== currentBattery) {
      eventType = 'LEVEL_UPDATE';
    }

    if (existingDevice.isCharging !== currentIsCharging || existingDevice.batteryLevel !== currentBattery) {
      timeRemaining = calculateAdvancedTimeRemaining(
        currentBattery,
        currentIsCharging,
        now,
        existingDevice.logs || [],
        existingDevice.platform
      );
      prevBattery = currentBattery;
      prevUpdatedAt = now;
    } else {
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

    await prisma.batteryLog.deleteMany({
      where: {
        deviceId: cleanDeviceId,
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

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
