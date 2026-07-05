import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Device, BatteryLog } from '@prisma/client';
import { verifyApiKey } from '@/lib/security';
import { getSystemSettings, formatTemplateMessage } from '@/lib/settings';

async function sendNotification(message: string): Promise<void> {
  console.log(`[ALERT NOTIFICATION]: ${message}`);
  try {
    const sysSettings = await getSystemSettings();
    if (sysSettings.telegram_enabled === 'false') return;

    const botToken = sysSettings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = sysSettings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

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

function getChargingSummary(
  currentBattery: number,
  now: Date,
  logs: BatteryLog[]
): {
  startTimeStr: string;
  startLevel: number;
  durationStr: string;
  gainedStr: string;
} | null {
  if (!logs || logs.length === 0) return null;

  let startLog: BatteryLog | null = null;
  for (let j = 0; j < logs.length; j++) {
    const l = logs[j];
    if (l.eventType === 'FULL_CHARGE') {
      // เมื่อสรุปการชาร์จตอนชาร์จเต็มไปแล้ว ในเซสชันนี้ไม่ต้องสรุปซ้ำอีกตอนถอด
      return null;
    }
    if (l.eventType === 'PLUGGED_IN') {
      startLog = l;
      break;
    } else if (!l.isCharging) {
      if (j > 0) startLog = logs[j - 1];
      break;
    }
  }
  if (!startLog && logs.length > 0 && logs[logs.length - 1].isCharging) {
    startLog = logs[logs.length - 1];
  }

  if (!startLog) return null;
  if (currentBattery === 100 && startLog.batteryLevel === 100) return null;

  const startLevel = startLog.batteryLevel;
  const chargeGained = currentBattery - startLevel;
  const diffMs = now.getTime() - new Date(startLog.createdAt).getTime();
  const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let durationStr = `${mins} นาที`;
  if (hours > 0 && mins > 0) durationStr = `${hours} ชม. ${mins} นาที`;
  else if (hours > 0 && mins === 0) durationStr = `${hours} ชม.`;

  const startTimeStr = new Date(startLog.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const gainedStr = chargeGained > 0 ? `+${chargeGained}%` : `${chargeGained}%`;

  return {
    startTimeStr,
    startLevel,
    durationStr,
    gainedStr,
  };
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

    const sysSettings = await getSystemSettings();
    const offlineThreshold = Number(sysSettings.offline_threshold_minutes) || 60;
    const nearFullLevels = (sysSettings.alert_near_full_levels || '80, 90, 95').split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
    const lowBatteryLevels = (sysSettings.alert_low_battery_levels || '20, 15, 10, 5, 0').split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
    const nowTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const nowDateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const nowDateTimeStr = `${nowDateStr} | ${nowTimeStr}`;

    const timeDiffMinutes = (now.getTime() - new Date(existingDevice.updatedAt).getTime()) / (1000 * 60);

    if (timeDiffMinutes > offlineThreshold) {
      eventType = 'RECONNECTED';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      const totalMins = Math.round(timeDiffMinutes);
      const hrs = Math.floor(totalMins / 60);
      const mns = totalMins % 60;
      let durText = `${totalMins} นาที`;
      if (hrs > 0 && mns > 0) durText = `${hrs} ชม. ${mns} นาที`;
      else if (hrs > 0 && mns === 0) durText = `${hrs} ชม.`;
      const msg = formatTemplateMessage(sysSettings.msg_template_reconnected, {
        device: deviceName,
        battery: currentBattery,
        time: nowTimeStr,
        date: nowDateStr,
        datetime: nowDateTimeStr,
        duration: durText,
      });
      if (sysSettings.enable_msg_reconnected !== 'false') await sendNotification(msg);
    } else if (existingDevice.isCharging !== currentIsCharging) {
      eventType = currentIsCharging ? 'PLUGGED_IN' : 'UNPLUGGED';
      const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
      if (currentIsCharging) {
        const msg = formatTemplateMessage(sysSettings.msg_template_plugged_in, {
          device: deviceName,
          battery: currentBattery,
          time: nowTimeStr,
          date: nowDateStr,
          datetime: nowDateTimeStr,
        });
        if (sysSettings.enable_msg_plugged_in !== 'false') await sendNotification(msg);
      } else {
        const summary = getChargingSummary(currentBattery, now, existingDevice.logs || []);
        const msg = formatTemplateMessage(sysSettings.msg_template_unplugged, {
          device: deviceName,
          battery: currentBattery,
          time: nowTimeStr,
          date: nowDateStr,
          datetime: nowDateTimeStr,
          start_time: summary ? summary.startTimeStr : '-',
          start_battery: summary ? summary.startLevel : '-',
          gained: summary ? summary.gainedStr : '-',
          duration: summary ? summary.durationStr : '-',
        });
        if (sysSettings.enable_msg_unplugged !== 'false') await sendNotification(msg);
      }
    } else if (currentIsCharging && existingDevice.batteryLevel < currentBattery) {
      const chargeThresholds = [...nearFullLevels, 100].sort((a, b) => a - b);
      const crossedThreshold = chargeThresholds.find(
        (t) => currentBattery >= t && existingDevice.batteryLevel < t
      );
      if (crossedThreshold !== undefined) {
        eventType = crossedThreshold === 100 ? 'FULL_CHARGE' : 'NEAR_FULL';
        const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
        if (crossedThreshold === 100) {
          const summary = getChargingSummary(currentBattery, now, existingDevice.logs || []);
          const msg = formatTemplateMessage(sysSettings.msg_template_full_charge, {
            device: deviceName,
            battery: currentBattery,
            time: nowTimeStr,
            date: nowDateStr,
            datetime: nowDateTimeStr,
            start_time: summary ? summary.startTimeStr : '-',
            start_battery: summary ? summary.startLevel : '-',
            gained: summary ? summary.gainedStr : '-',
            duration: summary ? summary.durationStr : '-',
          });
          if (sysSettings.enable_msg_full_charge !== 'false') await sendNotification(msg);
        } else {
          const msg = formatTemplateMessage(sysSettings.msg_template_near_full, {
            device: deviceName,
            battery: currentBattery,
            time: nowTimeStr,
            date: nowDateStr,
            datetime: nowDateTimeStr,
          });
          if (sysSettings.enable_msg_near_full !== 'false') await sendNotification(msg);
        }
      } else {
        eventType = 'LEVEL_UPDATE';
      }
    } else if (!currentIsCharging && existingDevice.batteryLevel > currentBattery) {
      const drainThresholds = lowBatteryLevels.sort((a, b) => b - a);
      const crossedThreshold = drainThresholds.find(
        (t) => currentBattery <= t && existingDevice.batteryLevel > t
      );
      if (crossedThreshold !== undefined) {
        eventType = crossedThreshold === 0 ? 'BATTERY_EMPTY' : 'LOW_BATTERY';
        const deviceName = existingDevice.name || `Device (${cleanDeviceId.slice(0, 6)})`;
        if (crossedThreshold === 0) {
          const msg = formatTemplateMessage(sysSettings.msg_template_battery_empty, {
            device: deviceName,
            battery: currentBattery,
            time: nowTimeStr,
            date: nowDateStr,
            datetime: nowDateTimeStr,
          });
          if (sysSettings.enable_msg_battery_empty !== 'false') await sendNotification(msg);
        } else {
          const msg = formatTemplateMessage(sysSettings.msg_template_low_battery, {
            device: deviceName,
            battery: currentBattery,
            time: nowTimeStr,
            date: nowDateStr,
            datetime: nowDateTimeStr,
          });
          if (sysSettings.enable_msg_low_battery !== 'false') await sendNotification(msg);
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
