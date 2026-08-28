// Battery health score + charging profile analysis (Features 5 & 12)
//
// These are pure functions over an array of BatteryLog rows so they can be
// unit tested / reused without depending on Prisma directly. The API route
// that calls these is responsible for querying the right time window.

export interface AnalysisLogEntry {
  batteryLevel: number;
  isCharging: boolean;
  eventType: string;
  createdAt: Date | string;
}

export interface HealthScoreResult {
  score: number; // 0-100, higher = healthier
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  windowDays: number;
  factors: {
    chargeCycles: number;
    cyclesPerDay: number;
    deepDischarges: number; // times battery crossed below the low-battery threshold before recharging
    deepDischargesPerDay: number;
    overchargeEvents: number; // samples recorded sitting at 100% while still plugged in
    overchargeEventsPerDay: number;
  };
  notes: string[];
}

export interface ChargingProfileResult {
  windowDays: number;
  totalSessions: number;
  avgDurationMinutes: number | null;
  avgGainedPercent: number | null;
  fullChargeRate: number | null; // % of sessions that reached 100%
  overnightSessions: number;
  overnightRate: number | null; // % of sessions started between 22:00-06:00
  startHourDistribution: { morning: number; afternoon: number; evening: number; night: number };
  summary: string[];
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/**
 * Compute a 0-100 "battery health" score from recent charge/discharge
 * behaviour. This is a heuristic, not a hardware-measured wear estimate:
 * it penalizes patterns known to stress lithium-ion cells (frequent deep
 * discharges, sitting fully charged for long periods, excessive partial
 * charge-cycle churn).
 */
export function computeHealthScore(
  logs: AnalysisLogEntry[],
  windowDays: number,
  lowBatteryThreshold = 20
): HealthScoreResult {
  const sorted = [...logs].sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
  );

  let chargeCycles = 0;
  let deepDischarges = 0;
  let overchargeEvents = 0;

  for (let i = 0; i < sorted.length; i++) {
    const l = sorted[i];
    if (l.eventType === 'PLUGGED_IN') chargeCycles++;
    if (l.eventType === 'LOW_BATTERY' || l.eventType === 'BATTERY_EMPTY') deepDischarges++;
    if (
      l.isCharging &&
      l.batteryLevel === 100 &&
      i > 0 &&
      sorted[i - 1].isCharging &&
      sorted[i - 1].batteryLevel === 100
    ) {
      overchargeEvents++;
    } else if (
      // fall back for threshold set below 20: also count explicit low-battery
      lowBatteryThreshold !== 20 &&
      !l.isCharging &&
      l.eventType === 'LEVEL_UPDATE' &&
      l.batteryLevel <= lowBatteryThreshold &&
      (i === 0 || sorted[i - 1].batteryLevel > lowBatteryThreshold)
    ) {
      deepDischarges++;
    }
  }

  const days = Math.max(1, windowDays);
  const cyclesPerDay = chargeCycles / days;
  const deepDischargesPerDay = deepDischarges / days;
  const overchargeEventsPerDay = overchargeEvents / days;

  let score = 100;
  score -= Math.min(35, deepDischargesPerDay * 18);
  score -= Math.min(25, overchargeEventsPerDay * 6);
  score -= Math.min(15, cyclesPerDay > 3 ? (cyclesPerDay - 3) * 3 : 0);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: HealthScoreResult['grade'] =
    score >= 85 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'fair' : 'poor';

  const notes: string[] = [];
  if (deepDischargesPerDay > 0.5) notes.push('แบตเตอรี่ถูกใช้จนต่ำกว่าเกณฑ์บ่อย ควรชาร์จให้ถี่ขึ้นเพื่อลดการ deep discharge');
  if (overchargeEventsPerDay > 1) notes.push('อุปกรณ์เสียบชาร์จค้างไว้ที่ 100% เป็นเวลานานบ่อยครั้ง อาจเร่งการเสื่อมของแบตเตอรี่');
  if (cyclesPerDay > 4) notes.push('มีรอบการเสียบ/ถอดสายชาร์จถี่ผิดปกติ อาจเกิดจากสายชาร์จหลวมหรือ contact ไม่แน่น');
  if (notes.length === 0) notes.push('พฤติกรรมการชาร์จอยู่ในเกณฑ์ปกติ ไม่พบสัญญาณที่เร่งการเสื่อมของแบตเตอรี่');

  return {
    score,
    grade,
    windowDays,
    factors: {
      chargeCycles,
      cyclesPerDay: Math.round(cyclesPerDay * 100) / 100,
      deepDischarges,
      deepDischargesPerDay: Math.round(deepDischargesPerDay * 100) / 100,
      overchargeEvents,
      overchargeEventsPerDay: Math.round(overchargeEventsPerDay * 100) / 100,
    },
    notes,
  };
}

/**
 * Summarize charging habits: session length, energy gained per session,
 * how often the device is charged overnight, and how often it reaches 100%.
 */
export function computeChargingProfile(
  logs: AnalysisLogEntry[],
  windowDays: number
): ChargingProfileResult {
  const sorted = [...logs].sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
  );

  interface Session {
    start: Date;
    end: Date | null;
    startLevel: number;
    endLevel: number | null;
    reachedFull: boolean;
  }

  const sessions: Session[] = [];
  let current: Session | null = null;

  for (const l of sorted) {
    const isStart = l.eventType === 'PLUGGED_IN';
    const isEnd = l.eventType === 'UNPLUGGED' || l.eventType === 'FULL_CHARGE';

    if (isStart) {
      if (current) sessions.push(current); // unterminated session, close it out
      current = { start: toDate(l.createdAt), end: null, startLevel: l.batteryLevel, endLevel: null, reachedFull: false };
    } else if (current) {
      if (l.batteryLevel === 100) current.reachedFull = true;
      if (isEnd) {
        current.end = toDate(l.createdAt);
        current.endLevel = l.batteryLevel;
        sessions.push(current);
        current = null;
      }
    }
  }
  if (current) sessions.push(current);

  const completed = sessions.filter((s) => s.end !== null);
  const totalSessions = sessions.length;

  const durations = completed.map((s) => (s.end!.getTime() - s.start.getTime()) / 60000);
  const gains = completed.map((s) => (s.endLevel ?? s.startLevel) - s.startLevel);

  const avgDurationMinutes = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;
  const avgGainedPercent = gains.length
    ? Math.round((gains.reduce((a, b) => a + b, 0) / gains.length) * 10) / 10
    : null;

  const fullChargeCount = sessions.filter((s) => s.reachedFull).length;
  const fullChargeRate = totalSessions ? Math.round((fullChargeCount / totalSessions) * 1000) / 10 : null;

  const startHourDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  let overnightSessions = 0;
  for (const s of sessions) {
    const hour = s.start.getHours();
    if (hour >= 22 || hour < 6) {
      startHourDistribution.night++;
      overnightSessions++;
    } else if (hour >= 6 && hour < 12) {
      startHourDistribution.morning++;
    } else if (hour >= 12 && hour < 18) {
      startHourDistribution.afternoon++;
    } else {
      startHourDistribution.evening++;
    }
  }
  const overnightRate = totalSessions ? Math.round((overnightSessions / totalSessions) * 1000) / 10 : null;

  const summary: string[] = [];
  if (totalSessions === 0) {
    summary.push('ยังไม่มีข้อมูลรอบการชาร์จเพียงพอสำหรับวิเคราะห์ในช่วงเวลานี้');
  } else {
    if (overnightRate !== null && overnightRate >= 50) {
      summary.push(`ชาร์จตอนกลางคืนเป็นหลัก (${overnightRate}% ของรอบทั้งหมด)`);
    }
    if (fullChargeRate !== null && fullChargeRate >= 70) {
      summary.push(`ชาร์จจนเต็ม 100% เกือบทุกครั้ง (${fullChargeRate}%)`);
    } else if (fullChargeRate !== null && fullChargeRate <= 30) {
      summary.push(`ส่วนใหญ่เป็นการชาร์จแบบบางส่วน (partial charge) ไม่ค่อยถึง 100%`);
    }
    if (avgDurationMinutes !== null) {
      summary.push(`ใช้เวลาชาร์จเฉลี่ยประมาณ ${avgDurationMinutes} นาทีต่อรอบ`);
    }
  }

  return {
    windowDays,
    totalSessions,
    avgDurationMinutes,
    avgGainedPercent,
    fullChargeRate,
    overnightSessions,
    overnightRate,
    startHourDistribution,
    summary,
  };
}
