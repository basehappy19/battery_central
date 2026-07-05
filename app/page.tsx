"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

interface HistoryEvent {
  id: string;
  batteryLevel: number;
  isCharging: boolean;
  eventType: string;
  createdAt: string;
  chargeGained?: number;
  durationMinutes?: number;
  offlineDurationMinutes?: number;
  offlineSince?: string;
  startChargeTime?: string;
  startChargeLevel?: number;
}

interface GraphPoint {
  time: string;
  level: number;
  isCharging: boolean;
}

interface TodayStats {
  pluggedCount: number;
  unpluggedCount: number;
  maxBattery: number;
  minBattery: number;
  history: HistoryEvent[];
  graphData: GraphPoint[];
}

interface Device {
  id: string;
  name: string;
  platform: string;
  batteryLevel: number;
  isCharging: boolean;
  timeRemaining?: number | null;
  acceptingUpdates: boolean;
  updatedAt: string;
  isOffline?: boolean;
  offlineDurationMinutes?: number;
  offlineSince?: string;
  todayStats?: TodayStats;
}

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
  isClosing?: boolean;
}

const getBatteryColor = (level: number, isOffline?: boolean): string => {
  if (isOffline) return "bg-slate-400 shadow-sm shadow-slate-400/20";
  if (level > 50) return "bg-emerald-500 shadow-sm shadow-emerald-500/20";
  if (level >= 20) return "bg-amber-500 shadow-sm shadow-amber-500/20";
  return "bg-rose-500 shadow-sm shadow-rose-500/20";
};

const formatTimeRemaining = (minutes: number | null | undefined, isCharging: boolean, isOffline?: boolean): string | null => {
  if (isOffline) return null;
  if (minutes === null || minutes === undefined || minutes <= 0) return null;
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  
  let timeStr = "";
  if (days > 0) {
    if (hours > 0) {
      timeStr = `${days} วัน ${hours} ชม.`;
    } else {
      timeStr = `${days} วัน`;
    }
  } else if (hours > 0 && mins > 0) {
    timeStr = `${hours} ชม. ${mins} นาที`;
  } else if (hours > 0) {
    timeStr = `${hours} ชม.`;
  } else {
    timeStr = `${mins} นาที`;
  }

  const targetTime = new Date(Date.now() + minutes * 60 * 1000);
  const clockStr = targetTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return isCharging ? `ชาร์จเต็มในอีกประมาณ ${timeStr} (เวลา ${clockStr})` : `เหลือเวลาใช้งานอีก ${timeStr} (เวลา ${clockStr})`;
};

const formatDuration = (totalMinutes: number): string => {
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days} วัน ${hours} ชม.` : `${days} วัน`;
  }
  if (hours > 0 && mins > 0) return `${hours} ชม. ${mins} นาที`;
  if (hours > 0) return `${hours} ชม.`;
  return `${mins} นาที`;
};

const formatEventType = (evt: HistoryEvent): string => {
  const level = evt.batteryLevel;
  switch (evt.eventType) {
    case 'PLUGGED_IN':
      return `เริ่มเสียบสายชาร์จ (${level}%)`;
    case 'NEAR_FULL':
      return `แบตใกล้เต็ม (${level}%)`;
    case 'LOW_BATTERY':
      return `แบตเตอรี่ต่ำ (${level}%)`;
    case 'BATTERY_EMPTY':
      return `แบตเตอรี่หมด (${level}%)`;
    case 'UNPLUGGED':
    case 'FULL_CHARGE': {
      const title = evt.eventType === 'FULL_CHARGE' ? `ชาร์จแบตเตอรี่เต็ม (100%)` : `ถอดสายชาร์จ (${level}%)`;
      if (
        evt.startChargeTime &&
        evt.startChargeLevel !== undefined &&
        evt.chargeGained !== undefined &&
        evt.durationMinutes !== undefined
      ) {
        const startTimeStr = new Date(evt.startChargeTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const endTimeStr = new Date(evt.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const durStr = formatDuration(evt.durationMinutes);
        const gainedStr = evt.chargeGained > 0 ? `+${evt.chargeGained}%` : `${evt.chargeGained}%`;
        return `${title} [ชาร์จตั้งแต่ ${startTimeStr} (${evt.startChargeLevel}%) ถึง ${endTimeStr} (${level}%) ได้มา ${gainedStr} ใช้เวลา ${durStr}]`;
      }
      return title;
    }
    case 'RECONNECTED': {
      let base = `กลับมาเชื่อมต่อระบบ (${level}%)`;
      if (evt.offlineDurationMinutes !== undefined && evt.offlineSince) {
        const sinceTime = new Date(evt.offlineSince).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const timeStr = formatDuration(evt.offlineDurationMinutes);
        base += ` [ขาดการติดต่อตั้งแต่ ${sinceTime} เป็นเวลา ${timeStr}]`;
      }
      return base;
    }
    default:
      return `บันทึกสถานะ (${level}%)`;
  }
};

const getPlatformStyle = (platform: string, isOffline?: boolean): { bg: string; icon: React.ReactNode } => {
  if (isOffline) {
    return {
      bg: "bg-slate-100 border-slate-300 text-slate-500",
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    };
  }
  const p = platform.toLowerCase();
  if (p.includes("win")) {
    return {
      bg: "bg-sky-50 border-sky-100 text-sky-600",
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.8" />
        </svg>
      ),
    };
  }
  if (p.includes("ios") || p.includes("ipad") || p.includes("apple") || p.includes("mac")) {
    return {
      bg: "bg-slate-100 border-slate-200 text-slate-700",
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.64-.78 1.08-1.86.96-2.95-.93.04-2.06.62-2.72 1.39-.58.67-.92 1.77-.78 2.84 1.05.08 2.11-.53 2.54-1.28" />
        </svg>
      ),
    };
  }
  if (p.includes("android")) {
    return {
      bg: "bg-emerald-50 border-emerald-100 text-emerald-600",
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9997c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
      ),
    };
  }
  if (p.includes("esp") || p.includes("iot")) {
    return {
      bg: "bg-amber-50 border-amber-100 text-amber-600",
      icon: (
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
    };
  }
  return {
    bg: "bg-indigo-50 border-indigo-100 text-indigo-600",
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  };
};

const getTooltipTheme = (pt: any) => {
  const { isCharging, eventType, level } = pt;

  if (eventType === 'BATTERY_EMPTY' || eventType === 'LOW_BATTERY' || (level <= 15 && !isCharging)) {
    return {
      bg: "bg-rose-950/95 border-rose-600/80 shadow-rose-950/60 text-rose-50",
      subText: "text-rose-200",
      border: "border-rose-800/80",
      levelText: "text-rose-300",
      badge: "bg-rose-900/90 text-rose-100 border border-rose-700",
      bulletText: "text-rose-300 font-bold",
      diffPos: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
      diffNeg: "bg-rose-500/30 text-rose-200 border border-rose-500/50",
      dot: "bg-rose-400 animate-pulse",
    };
  }

  if (eventType === 'UNPLUGGED') {
    return {
      bg: "bg-amber-950/95 border-amber-600/80 shadow-amber-950/60 text-amber-50",
      subText: "text-amber-200",
      border: "border-amber-800/80",
      levelText: "text-amber-300",
      badge: "bg-amber-900/90 text-amber-100 border border-amber-700",
      bulletText: "text-amber-300 font-bold",
      diffPos: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
      diffNeg: "bg-rose-500/30 text-rose-200 border border-rose-500/50",
      dot: "bg-amber-400",
    };
  }

  if (eventType === 'FULL') {
    return {
      bg: "bg-cyan-950/95 border-cyan-600/80 shadow-cyan-950/60 text-cyan-50",
      subText: "text-cyan-200",
      border: "border-cyan-800/80",
      levelText: "text-cyan-300",
      badge: "bg-cyan-900/90 text-cyan-100 border border-cyan-700",
      bulletText: "text-cyan-300 font-bold",
      diffPos: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
      diffNeg: "bg-rose-500/30 text-rose-200 border border-rose-500/50",
      dot: "bg-cyan-400",
    };
  }

  if (eventType === 'NEAR_FULL') {
    return {
      bg: "bg-indigo-950/95 border-indigo-600/80 shadow-indigo-950/60 text-indigo-50",
      subText: "text-indigo-200",
      border: "border-indigo-800/80",
      levelText: "text-indigo-300",
      badge: "bg-indigo-900/90 text-indigo-100 border border-indigo-700",
      bulletText: "text-indigo-300 font-bold",
      diffPos: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
      diffNeg: "bg-rose-500/30 text-rose-200 border border-rose-500/50",
      dot: "bg-indigo-400",
    };
  }

  if (isCharging || eventType === 'PLUGGED_IN') {
    return {
      bg: "bg-emerald-950/95 border-emerald-600/80 shadow-emerald-950/60 text-emerald-50",
      subText: "text-emerald-200",
      border: "border-emerald-800/80",
      levelText: "text-emerald-300",
      badge: "bg-emerald-900/90 text-emerald-100 border border-emerald-700",
      bulletText: "text-emerald-300 font-bold",
      diffPos: "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50",
      diffNeg: "bg-rose-500/30 text-rose-200 border border-rose-500/50",
      dot: "bg-emerald-400 animate-pulse",
    };
  }

  return {
    bg: "bg-blue-950/95 border-blue-600/80 shadow-blue-950/60 text-blue-50",
    subText: "text-blue-200",
    border: "border-blue-800/80",
    levelText: "text-blue-300",
    badge: "bg-blue-900/90 text-blue-100 border border-blue-700",
    bulletText: "text-blue-300 font-bold",
    diffPos: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    diffNeg: "bg-rose-500/30 text-rose-200 border border-rose-500/50",
    dot: "bg-blue-400",
  };
};

const CustomGraphTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const pt = payload[0].payload;
  const isCharging = pt.isCharging;
  const theme = getTooltipTheme(pt);

  return (
    <div className={`${theme.bg} backdrop-blur-md px-3.5 py-2.5 rounded-xl border shadow-2xl text-xs min-w-[160px] animate-in fade-in zoom-in-95 duration-150 pointer-events-none z-50 transition-colors`}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className={`text-[11px] font-medium ${theme.subText}`}>{pt.time}</span>
        {pt.diff !== 0 && pt.diff !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            pt.diff > 0 ? theme.diffPos : theme.diffNeg
          }`}>
            {pt.diff > 0 ? `+${pt.diff}%` : `${pt.diff}%`}
          </span>
        )}
      </div>
      
      <div className={`flex items-center justify-between gap-4 py-1.5 border-t ${theme.border}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
          <span className={`text-base font-black ${theme.levelText}`}>
            {pt.level}%
          </span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${theme.badge}`}>
          {isCharging ? "ชาร์จไฟ" : "ใช้งาน"}
        </span>
      </div>

      {pt.eventType && (
        <div className={`mt-1 pt-1.5 border-t ${theme.border} text-[10px] flex items-center gap-1.5 ${theme.bulletText}`}>
          <span>•</span>
          <span>
            {pt.eventType === 'PLUGGED_IN' && 'เริ่มเสียบสายชาร์จ'}
            {pt.eventType === 'UNPLUGGED' && 'ถอดสายชาร์จแล้ว'}
            {pt.eventType === 'FULL' && 'ชาร์จเต็ม 100%'}
            {pt.eventType === 'NEAR_FULL' && `แบตใกล้เต็ม (${pt.level}%)`}
            {pt.eventType === 'LOW_BATTERY' && `แบตเตอรี่ต่ำ (${pt.level}%)`}
            {pt.eventType === 'BATTERY_EMPTY' && `แบตเตอรี่หมด (0%)`}
          </span>
        </div>
      )}
    </div>
  );
};

const RechartsBatteryGraph = React.memo(({ data }: { data: GraphPoint[] }) => {
  const { chartData, chargingSpans } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], chargingSpans: [] };
    
    const formatted = data.map((pt, idx) => {
      const d = new Date(pt.time);
      const prevPt = idx > 0 ? data[idx - 1] : null;
      const nextPt = idx < data.length - 1 ? data[idx + 1] : null;
      const diff = prevPt ? pt.level - prevPt.level : 0;
      let eventType: string | null = null;
      if (prevPt && pt.isCharging && !prevPt.isCharging) {
        eventType = 'PLUGGED_IN';
      } else if (prevPt && !pt.isCharging && prevPt.isCharging) {
        eventType = 'UNPLUGGED';
      } else if (pt.isCharging && pt.level === 100 && (!prevPt || prevPt.level < 100)) {
        eventType = 'FULL';
      } else if (pt.isCharging && [80, 90, 95].includes(pt.level) && (!prevPt || prevPt.level < pt.level)) {
        eventType = 'NEAR_FULL';
      } else if (!pt.isCharging && [20, 15, 10, 5, 0].includes(pt.level) && (!prevPt || prevPt.level > pt.level)) {
        eventType = pt.level === 0 ? 'BATTERY_EMPTY' : 'LOW_BATTERY';
      }

      const isCharging = pt.isCharging;
      const isNextCharging = nextPt ? nextPt.isCharging : isCharging;

      let dischargingLevel: number | null = null;
      let chargingLevel: number | null = null;

      if (isCharging) {
        chargingLevel = pt.level;
        if (!isNextCharging) {
          dischargingLevel = pt.level;
        }
      } else {
        dischargingLevel = pt.level;
        if (isNextCharging) {
          chargingLevel = pt.level;
        }
      }

      return {
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        rawTime: pt.time,
        level: pt.level,
        isCharging: pt.isCharging,
        dischargingLevel,
        chargingLevel,
        diff,
        eventType,
      };
    });

    const spans: { start: string; end: string }[] = [];
    let curStart: string | null = null;
    for (let i = 0; i < formatted.length; i++) {
      const pt = formatted[i];
      if (pt.isCharging && !curStart) {
        curStart = pt.time;
      } else if (!pt.isCharging && curStart) {
        spans.push({ start: curStart, end: pt.time });
        curStart = null;
      }
    }
    if (curStart && formatted.length > 0) {
      spans.push({ start: curStart, end: formatted[formatted.length - 1].time });
    }

    return { chartData: formatted, chargingSpans: spans };
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-8">ไม่มีข้อมูลกราฟแบตเตอรี่ในวันนี้</p>;
  }

  return (
    <div className="bg-slate-50/90 p-3 sm:p-4 rounded-xl border border-slate-200/60 mt-3 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
          กราฟแบตเตอรี่ตลอดทั้งวัน (00:00 AM - 11:59 PM)
        </p>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-medium">
          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50/90 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-sm shadow-emerald-500/10 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ช่วงชาร์จไฟ
          </span>
          <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50/90 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-sm shadow-blue-500/10 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            ใช้งานปกติ
          </span>
        </div>
      </div>
      <div className="w-full h-52 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDischarge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorCharge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#64748b" }}
              stroke="#cbd5e1"
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              stroke="#cbd5e1"
              unit="%"
            />
            
            {chargingSpans.map((span, idx) => (
              <ReferenceArea
                key={`span-${idx}`}
                x1={span.start}
                x2={span.end}
                fill="#10b981"
                fillOpacity={0.15}
                stroke="#059669"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
              />
            ))}

            {chartData.map((pt, idx) => {
              if (pt.eventType === 'PLUGGED_IN') {
                return (
                  <ReferenceLine
                    key={`ref-${idx}`}
                    x={pt.time}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{ value: 'เริ่มชาร์จ', fill: '#047857', fontSize: 10, fontWeight: 700, position: 'top' }}
                  />
                );
              }
              if (pt.eventType === 'UNPLUGGED') {
                return (
                  <ReferenceLine
                    key={`ref-${idx}`}
                    x={pt.time}
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: 'ถอดสาย', fill: '#d97706', fontSize: 10, fontWeight: 700, position: 'top' }}
                  />
                );
              }
              if (pt.eventType === 'FULL') {
                return (
                  <ReferenceLine
                    key={`ref-${idx}`}
                    x={pt.time}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    label={{ value: 'เต็ม 100%', fill: '#1d4ed8', fontSize: 10, fontWeight: 700, position: 'top' }}
                  />
                );
              }
              if (pt.eventType === 'NEAR_FULL') {
                return (
                  <ReferenceLine
                    key={`ref-${idx}`}
                    x={pt.time}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: `ใกล้เต็ม ${pt.level}%`, fill: '#4338ca', fontSize: 10, fontWeight: 700, position: 'top' }}
                  />
                );
              }
              if (pt.eventType === 'LOW_BATTERY' || pt.eventType === 'BATTERY_EMPTY') {
                return (
                  <ReferenceLine
                    key={`ref-${idx}`}
                    x={pt.time}
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    label={{ value: pt.level === 0 ? 'แบตหมด 0%' : `ต่ำ ${pt.level}%`, fill: '#b91c1c', fontSize: 10, fontWeight: 700, position: 'top' }}
                  />
                );
              }
              return null;
            })}

            <Tooltip content={<CustomGraphTooltip />} offset={24} wrapperStyle={{ outline: 'none', zIndex: 100, pointerEvents: 'none' }} />
            <Area
              type="monotone"
              dataKey="dischargingLevel"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorDischarge)"
              dot={false}
              activeDot={{ r: 6, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="chargingLevel"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorCharge)"
              dot={false}
              activeDot={{ r: 6, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

RechartsBatteryGraph.displayName = "RechartsBatteryGraph";

interface DeviceCardProps {
  device: Device;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onPromptRename: (id: string, name: string) => void;
  onToggleAccept: (id: string, currentStatus: boolean) => Promise<void>;
  onPromptDelete: (id: string, name: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DeviceCard = React.memo(({ device, isExpanded, onToggleExpand, onPromptRename, onToggleAccept, onPromptDelete, onToast }: DeviceCardProps) => {
  const style = useMemo(() => getPlatformStyle(device.platform, device.isOffline), [device.platform, device.isOffline]);
  const timeFormatted = useMemo(() => formatTimeRemaining(device.timeRemaining, device.isCharging, device.isOffline), [device.timeRemaining, device.isCharging, device.isOffline]);
  const batteryColor = useMemo(() => getBatteryColor(device.batteryLevel, device.isOffline), [device.batteryLevel, device.isOffline]);
  const stats = device.todayStats;

  return (
    <div className={`bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-7 border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between h-full ${!device.acceptingUpdates ? "opacity-75 border-slate-300 bg-slate-50/50" : device.isOffline ? "border-amber-300/80 bg-amber-50/20" : "border-slate-200/80 hover:border-slate-300"}`}>
      <div>
        <div className="flex items-center gap-3 sm:gap-4 mb-6">
          <div className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border ${style.bg} shrink-0`}>
            {style.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 group">
              <h2 className="font-bold text-base sm:text-lg text-slate-900 break-words">
                {device.name}
              </h2>
              <button
                onClick={() => onPromptRename(device.id, device.name)}
                className="text-slate-400 hover:text-slate-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
                title="คลิกเพื่อเปลี่ยนชื่ออุปกรณ์"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                {device.platform}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-3 sm:mb-4">
          <span className={`text-4xl sm:text-5xl font-black tracking-tight font-mono ${device.isOffline ? "text-slate-400" : "text-slate-900"}`}>
            {device.batteryLevel}%
          </span>
          {device.isCharging && !device.isOffline && (
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              กำลังชาร์จ
            </span>
          )}
          {device.isOffline && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              ออฟไลน์
            </span>
          )}
        </div>

        <div className="w-full bg-slate-100 h-3 sm:h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${batteryColor} ${device.isCharging && !device.isOffline ? "animate-charging" : ""}`}
            style={{ width: `${device.batteryLevel}%` }}
          />
        </div>

        {device.isOffline ? (
          <div className="mt-4 sm:mt-5 flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-900 bg-amber-50/90 px-4 py-2.5 rounded-xl border border-amber-200">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              ขาดการติดต่อตั้งแต่: {device.offlineSince ? new Date(device.offlineSince).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : "-"}
            </span>
          </div>
        ) : timeFormatted ? (
          <div className="mt-4 sm:mt-5 flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 bg-slate-50/80 px-4 py-2.5 rounded-xl border border-slate-200/60">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{timeFormatted}</span>
          </div>
        ) : (
          <div className="mt-4 sm:mt-5 flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-400 bg-slate-50/50 px-4 py-2.5 rounded-xl border border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span>ไม่มีข้อมูลเวลาประเมิน</span>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100">
          <button
            onClick={() => onToggleExpand(device.id)}
            className="w-full flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-4 py-3 rounded-xl sm:rounded-2xl border border-slate-200/80 transition-colors cursor-pointer"
          >
            <span>สถิติและกราฟตลอดทั้งวัน (1 วัน)</span>
            <svg
              className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isExpanded && stats && (
            <div className="mt-4 space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/60">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block">เสียบชาร์จ</span>
                  <span className="text-sm sm:text-base font-bold text-slate-800 font-mono mt-0.5 block">{stats.pluggedCount} ครั้ง</span>
                </div>
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/60">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block">ถอดชาร์จ</span>
                  <span className="text-sm sm:text-base font-bold text-slate-800 font-mono mt-0.5 block">{stats.unpluggedCount} ครั้ง</span>
                </div>
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/60">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block">แบตสูงสุด</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 font-mono mt-0.5 block">{stats.maxBattery}%</span>
                </div>
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/60">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block">แบตต่ำสุด</span>
                  <span className="text-sm sm:text-base font-bold text-rose-600 font-mono mt-0.5 block">{stats.minBattery}%</span>
                </div>
              </div>

              <RechartsBatteryGraph data={stats.graphData || []} />

              <div className="bg-slate-50/70 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 max-h-48 overflow-y-auto space-y-2">
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ประวัติเหตุการณ์วันนี้</p>
                {stats.history && stats.history.length > 0 ? (
                  stats.history.map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between text-xs sm:text-sm text-slate-600 py-1.5 border-b border-slate-200/40 last:border-0">
                      <span className="font-medium">{formatEventType(evt)}</span>
                      <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
                        {new Date(evt.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">ไม่มีประวัติเหตุการณ์เพิ่มเติมในวันนี้</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onToggleAccept(device.id, device.acceptingUpdates);
              onToast(device.acceptingUpdates ? 'ปิดรับข้อมูลอัปเดตแล้ว' : 'เปิดรับข้อมูลอัปเดตแล้ว', 'info');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${device.acceptingUpdates ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"}`}
            title="กดเพื่อเปิด/ปิดรับข้อมูลอัปเดตจากอุปกรณ์นี้"
          >
            <span className={`w-2 h-2 rounded-full ${device.acceptingUpdates ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
            <span>{device.acceptingUpdates ? "รับข้อมูล" : "ปิดรับข้อมูล"}</span>
          </button>
          <button
            onClick={() => onPromptDelete(device.id, device.name)}
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            title="ลบอุปกรณ์นี้ออกจากระบบ"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>ลบ</span>
          </button>
        </div>
        <span className="font-mono text-right shrink-0">
          <span className="font-sans font-semibold">อัปเดต:</span> {new Date(device.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </span>
      </div>
    </div>
  );
});

DeviceCard.displayName = "DeviceCard";

export default function BatteryDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [systemApiKey, setSystemApiKey] = useState<string>("secret_batt_2026");
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(false);

  // Add Device Modal State & Animation
  const [showAddModal, setShowAddModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDevicePlatform, setNewDevicePlatform] = useState("Android");
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ id: string; name: string; apiKey: string } | null>(null);

  // Reorder Modal State
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [isClosingReorderModal, setIsClosingReorderModal] = useState(false);
  const [reorderList, setReorderList] = useState<Device[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Rename Device Modal State
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isClosingRenameModal, setIsClosingRenameModal] = useState(false);
  const [renamingDevice, setRenamingDevice] = useState(false);

  // Delete Device Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isClosingDeleteModal, setIsClosingDeleteModal] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState(false);

  // Change Password State
  const [oldPasswordInput, setOldPasswordInput] = useState<string>("");
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>("");
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [isClosingSettingsModal, setIsClosingSettingsModal] = useState<boolean>(false);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState<boolean>(false);
  const [settingsUnlockPassword, setSettingsUnlockPassword] = useState<string>("");
  const [unlockingSettings, setUnlockingSettings] = useState<boolean>(false);
  const [settingsUnlockError, setSettingsUnlockError] = useState<string>("");
  const [customNearFullInput, setCustomNearFullInput] = useState<string>("");
  const [customLowBattInput, setCustomLowBattInput] = useState<string>("");
  const [settingsTab, setSettingsTab] = useState<'telegram' | 'logic' | 'templates' | 'security'>('telegram');
  const [settingsData, setSettingsData] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [testingTelegram, setTestingTelegram] = useState<boolean>(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isClosing: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 3000);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("dashboard_auth");
    if (token) {
      setAuthenticated(true);
    }
    setAuthChecking(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setVerifying(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { success?: boolean; token?: string; error?: string };
      if (res.ok && data.success && data.token) {
        localStorage.setItem("dashboard_auth", data.token);
        setAuthenticated(true);
        showToast("เข้าสู่ระบบเรียบร้อยแล้ว", "success");
      } else {
        setAuthError(data.error || "รหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setAuthError("เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน");
    } finally {
      setVerifying(false);
    }
  };

  const fetchDevices = useCallback(async (isInitial = false): Promise<void> => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch(`/api/devices?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { devices: Device[]; systemApiKey?: string };
      setDevices(data.devices || []);
      if (data.systemApiKey) setSystemApiKey(data.systemApiKey);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      console.error("Error polling devices:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchDevices(true);
    const interval = setInterval(() => {
      fetchDevices(false);
    }, 1000);

    const handleFocus = () => fetchDevices(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDevices(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authenticated, fetchDevices]);

  const handleToggleExpand = useCallback((id: string): void => {
    setExpandedDevice((prev) => (prev === id ? null : id));
  }, []);

  const handleOpenReorderModal = () => {
    setReorderList([...devices]);
    setIsClosingReorderModal(false);
    setShowReorderModal(true);
  };

  const handleCloseReorderModal = () => {
    setIsClosingReorderModal(true);
    setTimeout(() => {
      setShowReorderModal(false);
      setIsClosingReorderModal(false);
    }, 150);
  };

  const handleMoveDevice = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= reorderList.length) return;
    const newList = [...reorderList];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setReorderList(newList);
  };

  const handleQuickSort = (type: 'battery_desc' | 'battery_asc' | 'name') => {
    const sorted = [...reorderList];
    if (type === 'battery_desc') {
      sorted.sort((a, b) => b.batteryLevel - a.batteryLevel);
    } else if (type === 'battery_asc') {
      sorted.sort((a, b) => a.batteryLevel - b.batteryLevel);
    } else if (type === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    }
    setReorderList(sorted);
  };

  const handleSaveOrder = async () => {
    if (reorderList.length === 0) {
      handleCloseReorderModal();
      return;
    }
    setSavingOrder(true);
    try {
      const token = localStorage.getItem("dashboard_auth") || "";
      const orderIds = reorderList.map((d) => d.id);
      const res = await fetch("/api/devices", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-token": token,
        },
        body: JSON.stringify({ order: orderIds }),
      });
      if (res.ok) {
        setDevices(reorderList);
        showToast("บันทึกตำแหน่งการจัดเรียงอุปกรณ์เรียบร้อยแล้ว", "success");
        handleCloseReorderModal();
        fetchDevices(false);
      } else {
        showToast("ไม่สามารถบันทึกตำแหน่งได้ กรุณาลองใหม่", "error");
      }
    } catch (err) {
      console.error("Failed to save device order:", err);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    } finally {
      setSavingOrder(false);
    }
  };

  const handlePromptRename = useCallback((id: string, currentName: string) => {
    setRenameTarget({ id, name: currentName });
    setRenameInput(currentName);
    setIsClosingRenameModal(false);
  }, []);

  const handleCloseRenameModal = () => {
    setIsClosingRenameModal(true);
    setTimeout(() => {
      setRenameTarget(null);
      setIsClosingRenameModal(false);
    }, 150);
  };

  const handleConfirmRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTarget || !renameInput.trim() || renameInput === renameTarget.name) {
      handleCloseRenameModal();
      return;
    }
    const { id } = renameTarget;
    const newName = renameInput.trim();
    setRenamingDevice(true);
    try {
      const token = localStorage.getItem("dashboard_auth") || "";
      const res = await fetch("/api/devices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-token": token,
        },
        body: JSON.stringify({ id, name: newName }),
      });
      if (res.ok) {
        setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, name: newName } : d)));
        showToast(`เปลี่ยนชื่ออุปกรณ์เป็น "${newName}" เรียบร้อยแล้ว`, "success");
        handleCloseRenameModal();
        fetchDevices(false);
      } else {
        const data = (await res.json()) as { error?: string };
        showToast(data.error || "ไม่สามารถเปลี่ยนชื่ออุปกรณ์ได้", "error");
        fetchDevices(false);
      }
    } catch (err) {
      console.error("Failed to rename device:", err);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    } finally {
      setRenamingDevice(false);
    }
  };

  const handleToggleAccept = useCallback(async (id: string, currentStatus: boolean): Promise<void> => {
    try {
      const token = localStorage.getItem("dashboard_auth") || "";
      const res = await fetch("/api/devices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-token": token,
        },
        body: JSON.stringify({ id, acceptingUpdates: !currentStatus }),
      });
      if (res.ok) {
        setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, acceptingUpdates: !currentStatus } : d)));
        fetchDevices(false);
      } else {
        const data = (await res.json()) as { error?: string };
        showToast(data.error || "ไม่สามารถอัปเดตสถานะได้", "error");
        fetchDevices(false);
      }
    } catch (err) {
      console.error("Failed to toggle accepting updates:", err);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    }
  }, [showToast, fetchDevices]);

  const handlePromptDelete = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
    setIsClosingDeleteModal(false);
  }, []);

  const handleCloseDeleteModal = () => {
    setIsClosingDeleteModal(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setIsClosingDeleteModal(false);
    }, 150);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeletingDevice(true);
    try {
      const token = localStorage.getItem("dashboard_auth") || "";
      const res = await fetch(`/api/devices?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-dashboard-token": token },
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
        showToast(`ลบอุปกรณ์ "${name}" ออกจากระบบแล้ว`, "info");
        handleCloseDeleteModal();
        fetchDevices(false);
      } else {
        const data = (await res.json()) as { error?: string };
        showToast(data.error || "ไม่สามารถลบอุปกรณ์ได้ กรุณาลองใหม่", "error");
        fetchDevices(false);
      }
    } catch (err) {
      console.error("Failed to delete device:", err);
      showToast("เกิดข้อผิดพลาดในการลบอุปกรณ์", "error");
    } finally {
      setDeletingDevice(false);
    }
  };

  const handleConfirmChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!oldPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      showToast("กรุณากรอกข้อมูลให้ครบทุกช่อง", "error");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showToast("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง", "error");
      return;
    }
    if (newPasswordInput.trim().length < 4) {
      showToast("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร", "error");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: oldPasswordInput,
          newPassword: newPasswordInput,
          confirmPassword: confirmPasswordInput,
        }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        showToast("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่", "success");
        handleCloseSettingsModal();
        setOldPasswordInput("");
        setNewPasswordInput("");
        setConfirmPasswordInput("");
        setTimeout(() => {
          localStorage.removeItem("dashboard_auth");
          setAuthenticated(false);
          setPassword("");
        }, 1000);
      } else {
        showToast(data.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้", "error");
      }
    } catch (err) {
      console.error("Failed to change password:", err);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleOpenModal = () => {
    setCreatedResult(null);
    setIsClosingModal(false);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowAddModal(false);
      setIsClosingModal(false);
    }, 150);
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    setCreatingDevice(true);
    setCreatedResult(null);

    try {
      const token = localStorage.getItem("dashboard_auth") || "";
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dashboard-token": token,
        },
        body: JSON.stringify({ name: newDeviceName, platform: newDevicePlatform }),
      });
      const data = (await res.json()) as { success?: boolean; device?: Device; apiKey?: string; error?: string };
      if (res.ok && data.success && data.device) {
        setDevices((prev) => [data.device!, ...prev]);
        setCreatedResult({
          id: data.device.id,
          name: data.device.name,
          apiKey: data.apiKey || systemApiKey,
        });
        setNewDeviceName("");
        showToast(`ลงทะเบียนอุปกรณ์ "${data.device.name}" สำเร็จ`, "success");
      } else {
        showToast(data.error || "ไม่สามารถลงทะเบียนอุปกรณ์ได้", "error");
      }
    } catch (err) {
      console.error("Failed to create device:", err);
      showToast("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
    } finally {
      setCreatingDevice(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`คัดลอก ${label} แล้ว`, "success");
  };

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettingsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      showToast('ไม่สามารถโหลดข้อมูลตั้งค่าได้', 'error');
    } finally {
      setLoadingSettings(false);
    }
  }, [showToast]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData),
      });
      if (res.ok) {
        showToast('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว', 'success');
        handleCloseSettingsModal();
        fetchDevices(true);
      } else {
        const err = await res.json();
        showToast(err?.error || 'ไม่สามารถบันทึกการตั้งค่าได้', 'error');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!settingsData.telegram_bot_token || !settingsData.telegram_chat_id) {
      showToast('กรุณาระบุ Bot Token และ Chat ID ก่อนทดสอบ', 'error');
      return;
    }
    setTestingTelegram(true);
    try {
      const res = await fetch('/api/settings/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settingsData.telegram_bot_token,
          chatId: settingsData.telegram_chat_id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'ส่งข้อความทดสอบสำเร็จแล้ว!', 'success');
      } else {
        showToast(data?.error || 'ส่งข้อความไม่สำเร็จ', 'error');
      }
    } catch (err) {
      console.error('Failed test telegram:', err);
      showToast('เกิดข้อผิดพลาดในการส่งข้อความทดสอบ', 'error');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleCloseSettingsModal = () => {
    setIsClosingSettingsModal(true);
    setTimeout(() => {
      setShowSettingsModal(false);
      setIsClosingSettingsModal(false);
      setIsSettingsUnlocked(false);
      setSettingsUnlockPassword("");
      setSettingsUnlockError("");
      setOldPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
    }, 200);
  };

  if (authChecking) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-slate-400 font-medium">กำลังโหลด...</div>;
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 border border-slate-200/80 shadow-md">
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3.5 border border-emerald-200 shadow-sm">
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">ระบบติดตามแบตเตอรี่</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">กรุณาระบุรหัสผ่านเพื่อเข้าสู่ระบบแดชบอร์ด</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="ระบุรหัสผ่าน..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-medium bg-slate-50 focus:bg-white transition-colors"
                autoFocus
              />
              {authError && <p className="text-xs font-semibold text-rose-500 mt-2 text-center">{authError}</p>}
            </div>
            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {verifying ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-4 sm:p-6 md:p-10 lg:p-12 pb-24 font-sans selection:bg-slate-200">
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[9999] flex flex-col gap-2.5 sm:max-w-sm sm:w-full pointer-events-none items-center sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-xs sm:text-sm font-semibold w-full sm:w-auto max-w-full transition-all ${
              toast.isClosing ? "animate-toast-out" : "animate-toast-in"
            } ${
              toast.type === "success"
                ? "bg-slate-900/95 text-white border-slate-700 shadow-slate-900/20"
                : toast.type === "error"
                ? "bg-rose-900/95 text-white border-rose-700 shadow-rose-900/20"
                : "bg-slate-800/95 text-slate-100 border-slate-600 shadow-slate-800/20"
            }`}
          >
            {toast.type === "success" && (
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === "error" && (
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === "info" && (
              <svg className="w-5 h-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-slate-200">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                ระบบติดตามแบตเตอรี่
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                รายงานสถานะแบตเตอรี่ ประเมินเวลา และสถิติประจำวันแบบเรียลไทม์
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleOpenReorderModal}
                disabled={devices.length <= 1}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm px-5 py-2.5 rounded-2xl border border-slate-300 shadow-sm transition-all hover:shadow cursor-pointer disabled:opacity-50"
                title="จัดเรียงหรือสลับตำแหน่งอุปกรณ์บนหน้าแรก"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span>จัดเรียงตำแหน่ง</span>
              </button>
              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow-sm transition-all hover:shadow cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>เพิ่มอุปกรณ์ใหม่</span>
              </button>
              <button
                onClick={() => {
                  setShowSettingsModal(true);
                  setIsClosingSettingsModal(false);
                  setIsSettingsUnlocked(false);
                  setSettingsUnlockPassword("");
                  setSettingsUnlockError("");
                  fetchSettings();
                }}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-2.5 rounded-2xl shadow-sm transition-all hover:shadow cursor-pointer"
                title="ตั้งค่าระบบครบวงจร (Telegram Bot, ตรรกะแจ้งเตือน, ข้อความบอต, เปลี่ยนรหัสผ่าน)"
              >
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>ตั้งค่าระบบ</span>
              </button>
              <a
                href="/logs"
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm px-5 py-2.5 rounded-2xl shadow-sm transition-all hover:shadow cursor-pointer"
                title="ดูประวัติคำขอ API และบันทึก Log การทำงานของระบบ"
              >
                <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>ประวัติ API</span>
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-end">
            <button
              onClick={() => fetchDevices(false)}
              title="คลิกเพื่อรีเฟรชข้อมูลทันที"
              className="flex items-center gap-2.5 bg-white hover:bg-slate-50 transition-colors px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-sm cursor-pointer"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-semibold text-slate-600">
                อัปเดตเมื่อ: {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </button>
          </div>
        </header>

        {showReorderModal && (
          <div
            onClick={handleCloseReorderModal}
            className={`fixed inset-0 w-screen h-screen bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto ${
              isClosingReorderModal ? "animate-fade-out" : "animate-fade-in"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-3xl max-w-xl md:max-w-2xl w-full p-6 sm:p-8 md:p-10 border border-slate-200 shadow-2xl relative my-auto ${
                isClosingReorderModal ? "animate-modal-out" : "animate-modal-in"
              }`}
            >
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">จัดเรียงตำแหน่งอุปกรณ์</h3>
                  <p className="text-xs text-slate-500 mt-0.5">เลือกอุปกรณ์เพื่อเลื่อนขึ้นหรือลง หรือจัดเรียงด่วนตามเงื่อนไข</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-4 border-b border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">จัดเรียงด่วน:</span>
                <button
                  type="button"
                  onClick={() => handleQuickSort('battery_desc')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  แบตเตอรี่ (มาก ➔ น้อย)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSort('battery_asc')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  แบตเตอรี่ (น้อย ➔ มาก)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSort('name')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  ตามชื่อ (ก-ฮ)
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 mb-6">
                {reorderList.map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 transition-all hover:border-slate-300">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-7 h-7 bg-white text-slate-700 font-bold font-mono text-xs rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 break-words">{d.name}</h4>
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">{d.platform} • แบต {d.batteryLevel}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleMoveDevice(i, -1)}
                        disabled={i === 0 || savingOrder}
                        className="p-2 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
                        title="เลื่อนขึ้น"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDevice(i, 1)}
                        disabled={i === reorderList.length - 1 || savingOrder}
                        className="p-2 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-slate-700 rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
                        title="เลื่อนลง"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseReorderModal}
                  disabled={savingOrder}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrder}
                  disabled={savingOrder}
                  className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {savingOrder ? (
                    <span>กำลังบันทึก...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>บันทึกตำแหน่ง</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {renameTarget && (
          <div
            onClick={handleCloseRenameModal}
            className={`fixed inset-0 w-screen h-screen bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto ${
              isClosingRenameModal ? "animate-fade-out" : "animate-fade-in"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-3xl max-w-lg sm:max-w-xl w-full p-6 sm:p-8 md:p-10 border border-slate-200 shadow-2xl relative my-auto ${
                isClosingRenameModal ? "animate-modal-out" : "animate-modal-in"
              }`}
            >
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-indigo-200 shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">เปลี่ยนชื่ออุปกรณ์</h3>
                  <p className="text-xs text-slate-500 mt-0.5">ระบุชื่อใหม่ที่ต้องการสำหรับอุปกรณ์นี้</p>
                </div>
              </div>

              <form onSubmit={handleConfirmRename} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ชื่ออุปกรณ์ใหม่
                  </label>
                  <input
                    type="text"
                    required
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    disabled={renamingDevice}
                    placeholder="ระบุชื่ออุปกรณ์..."
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-300 focus:outline-none focus:border-indigo-500 text-sm sm:text-base font-bold text-slate-900 bg-slate-50 focus:bg-white transition-colors shadow-inner"
                    autoFocus
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseRenameModal}
                    disabled={renamingDevice}
                    className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={renamingDevice}
                    className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {renamingDevice ? (
                      <span>กำลังบันทึก...</span>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>บันทึกชื่อใหม่</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div
            onClick={handleCloseDeleteModal}
            className={`fixed inset-0 w-screen h-screen bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto ${
              isClosingDeleteModal ? "animate-fade-out" : "animate-fade-in"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-3xl max-w-lg sm:max-w-xl w-full p-6 sm:p-8 md:p-10 border border-slate-200 shadow-2xl relative my-auto ${
                isClosingDeleteModal ? "animate-modal-out" : "animate-modal-in"
              }`}
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-200 shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">ยืนยันการลบอุปกรณ์</h3>
                  <p className="text-xs text-slate-500 mt-0.5">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 mb-6 text-xs sm:text-sm text-slate-600 space-y-1.5">
                <p>ต้องการลบอุปกรณ์ <span className="font-bold text-slate-900">&quot;{deleteTarget.name}&quot;</span> ออกจากระบบหรือไม่?</p>
                <p className="text-xs text-rose-600 font-medium">ประวัติสถานะแบตเตอรี่และกราฟทั้งหมดของอุปกรณ์นี้จะถูกลบถาวร</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={deletingDevice}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingDevice}
                  className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {deletingDevice ? (
                    <span>กำลังลบ...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>ยืนยันลบอุปกรณ์</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}


        {showSettingsModal && (
          <div
            onClick={handleCloseSettingsModal}
            className={`fixed inset-0 w-screen h-screen bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto ${
              isClosingSettingsModal ? "animate-fade-out" : "animate-fade-in"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 md:p-10 border border-slate-200 shadow-2xl relative my-auto transition-all duration-300 max-h-[90vh] flex flex-col ${
                isClosingSettingsModal ? "animate-modal-out" : "animate-modal-in"
              }`}
            >
              <button
                onClick={handleCloseSettingsModal}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 font-bold text-lg p-1 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {isSettingsUnlocked && (
                <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-slate-100 shrink-0">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">ตั้งค่าระบบแบบครบวงจร</h3>
                    <p className="text-xs text-slate-500 mt-0.5">ปรับแต่งการแจ้งเตือน ตรรกะเวลา และข้อความบอต Telegram</p>
                  </div>
                </div>
              )}

              {!isSettingsUnlocked ? (
                <div className="py-16 px-6 text-center max-w-md mx-auto animate-fadeIn flex-1 flex flex-col justify-center">
                  <div className="w-20 h-20 bg-slate-900 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">ยืนยันรหัสผ่านเพื่อเข้าสู่การตั้งค่า</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mb-8">เพื่อความปลอดภัย กรุณากรอกรหัสผ่านแดชบอร์ดของคุณก่อนเข้าปรับแต่งระบบ</p>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!settingsUnlockPassword.trim()) {
                        setSettingsUnlockError("กรุณากรอกรหัสผ่าน");
                        return;
                      }
                      setUnlockingSettings(true);
                      setSettingsUnlockError("");
                      try {
                        const res = await fetch("/api/auth/verify", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ password: settingsUnlockPassword }),
                        });
                        const data = (await res.json()) as { success?: boolean };
                        if (res.ok && data.success) {
                          setIsSettingsUnlocked(true);
                          setSettingsUnlockError("");
                          setSettingsUnlockPassword("");
                        } else {
                          setSettingsUnlockError("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
                        }
                      } catch (err) {
                        setSettingsUnlockError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
                      } finally {
                        setUnlockingSettings(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <input
                        type="password"
                        value={settingsUnlockPassword}
                        onChange={(e) => {
                          setSettingsUnlockPassword(e.target.value);
                          setSettingsUnlockError("");
                        }}
                        placeholder="กรอกรหัสผ่านแดชบอร์ด..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-center text-sm bg-slate-50 focus:bg-white transition-all shadow-inner font-semibold"
                        autoFocus
                      />
                      {settingsUnlockError && (
                        <p className="text-rose-500 text-xs font-bold mt-2 animate-bounce">{settingsUnlockError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleCloseSettingsModal}
                        className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={unlockingSettings}
                        className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {unlockingSettings ? <span>กำลังตรวจสอบ...</span> : <span>ปลดล็อกการตั้งค่า</span>}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSettingsTab('telegram')}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        settingsTab === 'telegram'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                      }`}
                    >
                      <span>Telegram Bot</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab('logic')}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        settingsTab === 'logic'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                      }`}
                    >
                      <span>ตรรกะระบบ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab('templates')}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        settingsTab === 'templates'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                      }`}
                    >
                      <span>รูปแบบข้อความ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab('security')}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        settingsTab === 'security'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                      }`}
                    >
                      <span>ความปลอดภัย</span>
                    </button>
                  </div>

                  {loadingSettings ? (
                    <div className="py-20 text-center text-slate-400 font-medium">กำลังโหลดข้อมูลตั้งค่า...</div>
                  ) : (
                    <form onSubmit={handleSaveSettings} className="space-y-6 overflow-y-auto pr-1 flex-1">
                      {settingsTab === 'telegram' && (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                            <div>
                              <label className="block text-sm font-bold text-slate-800">
                                สถานะการแจ้งเตือน Telegram
                              </label>
                              <p className="text-xs text-slate-500 mt-0.5">เปิดหรือปิดการส่งข้อความแจ้งเตือนทั้งหมดไปยัง Telegram</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSettingsData((prev) => ({ ...prev, telegram_enabled: prev.telegram_enabled === 'false' ? 'true' : 'false' }))}
                              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                settingsData.telegram_enabled !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  settingsData.telegram_enabled !== 'false' ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                              Telegram Bot Token
                            </label>
                            <input
                              type="text"
                              value={settingsData.telegram_bot_token || ''}
                              onChange={(e) => setSettingsData((prev) => ({ ...prev, telegram_bot_token: e.target.value }))}
                              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-mono bg-slate-50 focus:bg-white transition-colors"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                              Telegram Chat ID
                            </label>
                            <input
                              type="text"
                              value={settingsData.telegram_chat_id || ''}
                              onChange={(e) => setSettingsData((prev) => ({ ...prev, telegram_chat_id: e.target.value }))}
                              placeholder="เช่น 12345678 หรือ -100123456789"
                              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-mono bg-slate-50 focus:bg-white transition-colors"
                            />
                          </div>

                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={handleTestTelegram}
                              disabled={testingTelegram}
                              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer border border-slate-300 shadow-2xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {testingTelegram ? (
                                <span>กำลังส่งข้อความทดสอบ...</span>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                  </svg>
                                  <span>ทดสอบส่งข้อความแจ้งเตือน (Test Notification)</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'logic' && (
                        <div className="space-y-6 animate-fadeIn">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                              เกณฑ์เวลาขาดการติดต่อ (นาที)
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="1440"
                              value={settingsData.offline_threshold_minutes || '60'}
                              onChange={(e) => setSettingsData((prev) => ({ ...prev, offline_threshold_minutes: e.target.value }))}
                              placeholder="60"
                              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-mono bg-slate-50 focus:bg-white transition-colors"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">หากไม่มีข้อมูลส่งมานานกว่ากำหนด ระบบจะแสดงสถานะ &quot;ขาดการติดต่อ&quot; และแจ้งเตือนเมื่อกลับมาออนไลน์</p>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                              เกณฑ์แจ้งเตือนแบตเตอรี่ใกล้เต็ม (%)
                            </label>
                            <p className="text-[11px] text-slate-500">คลิกที่ตัวเลขเพื่อเลือกหรือยกเลิกเกณฑ์ที่ต้องการแจ้งเตือนเมื่อชาร์จถึง</p>
                            
                            <div className="flex flex-wrap gap-2 pt-1">
                              {(() => {
                                const currentList = (settingsData.alert_near_full_levels || '')
                                  .split(',')
                                  .map((s) => parseInt(s.trim(), 10))
                                  .filter((n) => !isNaN(n) && n >= 1 && n <= 100)
                                  .sort((a, b) => a - b);

                                return (
                                  <>
                                    {currentList.length === 0 && (
                                      <span className="text-xs text-slate-400 italic py-1">ยังไม่ได้เลือกเกณฑ์แจ้งเตือน</span>
                                    )}
                                    {currentList.map((num) => (
                                      <span
                                        key={num}
                                        className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs"
                                      >
                                        <span>{num}%</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = currentList.filter((n) => n !== num);
                                            setSettingsData((prev) => ({ ...prev, alert_near_full_levels: updated.join(', ') }));
                                          }}
                                          className="hover:bg-emerald-200 text-emerald-700 rounded-full p-0.5 transition-colors cursor-pointer"
                                          title="ลบเกณฑ์นี้"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </span>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                placeholder="ระบุเลขเอง (1-100)"
                                value={customNearFullInput}
                                onChange={(e) => setCustomNearFullInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = parseInt(customNearFullInput, 10);
                                    if (!isNaN(val) && val >= 1 && val <= 100) {
                                      const currentList = (settingsData.alert_near_full_levels || '')
                                        .split(',')
                                        .map((s) => parseInt(s.trim(), 10))
                                        .filter((n) => !isNaN(n));
                                      if (!currentList.includes(val)) {
                                        const updated = [...currentList, val].sort((a, b) => a - b);
                                        setSettingsData((prev) => ({ ...prev, alert_near_full_levels: updated.join(', ') }));
                                      }
                                      setCustomNearFullInput("");
                                    }
                                  }
                                }}
                                className="w-36 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = parseInt(customNearFullInput, 10);
                                  if (isNaN(val) || val < 1 || val > 100) {
                                    showToast("กรุณาระบุตัวเลขระหว่าง 1 - 100", "error");
                                    return;
                                  }
                                  const currentList = (settingsData.alert_near_full_levels || '')
                                    .split(',')
                                    .map((s) => parseInt(s.trim(), 10))
                                    .filter((n) => !isNaN(n));
                                  if (!currentList.includes(val)) {
                                    const updated = [...currentList, val].sort((a, b) => a - b);
                                    setSettingsData((prev) => ({ ...prev, alert_near_full_levels: updated.join(', ') }));
                                  }
                                  setCustomNearFullInput("");
                                }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                + เพิ่มเกณฑ์
                              </button>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                              เกณฑ์แจ้งเตือนแบตเตอรี่ต่ำ (%)
                            </label>
                            <p className="text-[11px] text-slate-500">คลิกที่ตัวเลขเพื่อเลือกหรือยกเลิกเกณฑ์ที่ต้องการแจ้งเตือนเมื่อแบตลดถึง</p>
                            
                            <div className="flex flex-wrap gap-2 pt-1">
                              {(() => {
                                const currentList = (settingsData.alert_low_battery_levels || '')
                                  .split(',')
                                  .map((s) => parseInt(s.trim(), 10))
                                  .filter((n) => !isNaN(n) && n >= 0 && n <= 100)
                                  .sort((a, b) => b - a);

                                return (
                                  <>
                                    {currentList.length === 0 && (
                                      <span className="text-xs text-slate-400 italic py-1">ยังไม่ได้เลือกเกณฑ์แจ้งเตือน</span>
                                    )}
                                    {currentList.map((num) => (
                                      <span
                                        key={num}
                                        className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-rose-300 shadow-2xs"
                                      >
                                        <span>{num}%</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = currentList.filter((n) => n !== num);
                                            setSettingsData((prev) => ({ ...prev, alert_low_battery_levels: updated.join(', ') }));
                                          }}
                                          className="hover:bg-rose-200 text-rose-700 rounded-full p-0.5 transition-colors cursor-pointer"
                                          title="ลบเกณฑ์นี้"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </span>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="ระบุเลขเอง (0-100)"
                                value={customLowBattInput}
                                onChange={(e) => setCustomLowBattInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = parseInt(customLowBattInput, 10);
                                    if (!isNaN(val) && val >= 0 && val <= 100) {
                                      const currentList = (settingsData.alert_low_battery_levels || '')
                                        .split(',')
                                        .map((s) => parseInt(s.trim(), 10))
                                        .filter((n) => !isNaN(n));
                                      if (!currentList.includes(val)) {
                                        const updated = [...currentList, val].sort((a, b) => b - a);
                                        setSettingsData((prev) => ({ ...prev, alert_low_battery_levels: updated.join(', ') }));
                                      }
                                      setCustomLowBattInput("");
                                    }
                                  }
                                }}
                                className="w-36 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = parseInt(customLowBattInput, 10);
                                  if (isNaN(val) || val < 0 || val > 100) {
                                    showToast("กรุณาระบุตัวเลขระหว่าง 0 - 100", "error");
                                    return;
                                  }
                                  const currentList = (settingsData.alert_low_battery_levels || '')
                                    .split(',')
                                    .map((s) => parseInt(s.trim(), 10))
                                    .filter((n) => !isNaN(n));
                                  if (!currentList.includes(val)) {
                                    const updated = [...currentList, val].sort((a, b) => b - a);
                                    setSettingsData((prev) => ({ ...prev, alert_low_battery_levels: updated.join(', ') }));
                                  }
                                  setCustomLowBattInput("");
                                }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                              >
                                + เพิ่มเกณฑ์
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'templates' && (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-100 text-xs text-sky-800 leading-relaxed">
                            <p className="font-bold mb-1">คำแนะนำตัวแปรที่ใช้ได้ในข้อความ (Variables):</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5">
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{device}"}</code> = ชื่ออุปกรณ์</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{battery}"}</code> = ระดับแบตเตอรี่ (%)</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{datetime}"}</code> = วันที่และเวลาปัจจุบัน</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{duration}"}</code> = ระยะเวลาชาร์จ / ขาดการติดต่อ</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{start_time}"}</code> = เวลาเริ่มชาร์จ</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{start_battery}"}</code> = แบตตอนเริ่มชาร์จ (%)</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{gained}"}</code> = แบตที่เพิ่มขึ้น (+X%)</div>
                              <div><code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{"{time}"}</code> = เวลา (เฉพาะชั่วโมง:นาที)</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  1. เริ่มเสียบสายชาร์จ
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_plugged_in !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_plugged_in: prev.enable_msg_plugged_in === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_plugged_in !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_plugged_in !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_plugged_in === 'false'}
                                value={settingsData.msg_template_plugged_in || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_plugged_in: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_plugged_in === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  2. ถอดสายชาร์จ
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_unplugged !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_unplugged: prev.enable_msg_unplugged === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_unplugged !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_unplugged !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_unplugged === 'false'}
                                value={settingsData.msg_template_unplugged || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_unplugged: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_unplugged === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  3. ชาร์จเต็ม 100%
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_full_charge !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_full_charge: prev.enable_msg_full_charge === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_full_charge !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_full_charge !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_full_charge === 'false'}
                                value={settingsData.msg_template_full_charge || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_full_charge: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_full_charge === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  4. แบตเตอรี่ใกล้เต็ม (80-95%)
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_near_full !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_near_full: prev.enable_msg_near_full === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_near_full !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_near_full !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_near_full === 'false'}
                                value={settingsData.msg_template_near_full || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_near_full: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_near_full === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  5. แบตเตอรี่ต่ำ (5-20%)
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_low_battery !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_low_battery: prev.enable_msg_low_battery === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_low_battery !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_low_battery !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_low_battery === 'false'}
                                value={settingsData.msg_template_low_battery || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_low_battery: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_low_battery === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>

                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  6. แบตเตอรี่หมดวิกฤต (0%)
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_battery_empty !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_battery_empty: prev.enable_msg_battery_empty === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_battery_empty !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_battery_empty !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_battery_empty === 'false'}
                                value={settingsData.msg_template_battery_empty || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_battery_empty: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_battery_empty === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>

                            <div className="md:col-span-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                  7. กลับมาเชื่อมต่อระบบ (หลังขาดการติดต่อ)
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {settingsData.enable_msg_reconnected !== 'false' ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือน'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSettingsData((prev) => ({ ...prev, enable_msg_reconnected: prev.enable_msg_reconnected === 'false' ? 'true' : 'false' }))}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                      settingsData.enable_msg_reconnected !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        settingsData.enable_msg_reconnected !== 'false' ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                rows={6}
                                disabled={settingsData.enable_msg_reconnected === 'false'}
                                value={settingsData.msg_template_reconnected || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, msg_template_reconnected: e.target.value }))}
                                className={`w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono transition-colors focus:outline-none focus:border-emerald-500 ${
                                  settingsData.enable_msg_reconnected === 'false' ? 'bg-slate-100 text-slate-400 opacity-60' : 'bg-white'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'security' && (
                        <div className="space-y-6 animate-fadeIn">
                          {/* ส่วนเปลี่ยนรหัสผ่านเข้าแดชบอร์ด */}
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              <span>เปลี่ยนรหัสผ่านเข้าสู่ระบบแดชบอร์ด</span>
                            </div>
                            <p className="text-xs text-slate-500">เมื่อเปลี่ยนรหัสผ่านสำเร็จ ระบบจะให้ออกจากระบบทันทีเพื่อเข้าสู่ระบบใหม่ด้วยรหัสใหม่</p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">รหัสผ่านปัจจุบัน <span className="text-rose-500">*</span></label>
                                <input
                                  type="password"
                                  value={oldPasswordInput}
                                  onChange={(e) => setOldPasswordInput(e.target.value)}
                                  placeholder="รหัสผ่านเดิม"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">รหัสผ่านใหม่ (&gt;= 4 ตัว) <span className="text-rose-500">*</span></label>
                                <input
                                  type="password"
                                  value={newPasswordInput}
                                  onChange={(e) => setNewPasswordInput(e.target.value)}
                                  placeholder="รหัสผ่านใหม่"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">ยืนยันรหัสผ่านใหม่ <span className="text-rose-500">*</span></label>
                                <input
                                  type="password"
                                  value={confirmPasswordInput}
                                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                                  placeholder="พิมพ์ใหม่อีกครั้ง"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-emerald-500 font-semibold"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-2">
                              <button
                                type="button"
                                onClick={handleConfirmChangePassword}
                                disabled={changingPassword || !oldPasswordInput || !newPasswordInput || !confirmPasswordInput}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {changingPassword ? (
                                  <span>กำลังเปลี่ยนรหัสผ่าน...</span>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>ยืนยันเปลี่ยนรหัสผ่าน</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 my-4"></div>

                          {/* ส่วน API Secret Key */}
                          <div className="space-y-3">
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
                              <p className="font-bold mb-1">คำเตือนความปลอดภัย:</p>
                              หากเปลี่ยน <b>API Secret Key</b> อุปกรณ์ทั้งหมดที่เชื่อมต่ออยู่ (MacroDroid / Tasker) ต้องอัปเดตรหัสคีย์ใหม่ในสคริปต์ มิฉะนั้นจะไม่สามารถส่งข้อมูลเข้ามาได้
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                API Secret Key (สำหรับส่งข้อมูลจาก MacroDroid / IoT)
                              </label>
                              <input
                                type="text"
                                value={settingsData.api_secret_key || ''}
                                onChange={(e) => setSettingsData((prev) => ({ ...prev, api_secret_key: e.target.value }))}
                                placeholder="secret_batt_2026"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-mono bg-slate-50 focus:bg-white transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-4 border-t border-slate-100 flex items-center gap-3 mt-6 shrink-0">
                        <button
                          type="button"
                          onClick={handleCloseSettingsModal}
                          disabled={savingSettings}
                          className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          disabled={savingSettings}
                          className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {savingSettings ? (
                            <span>กำลังบันทึกข้อมูล...</span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>บันทึกการตั้งค่าระบบ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {showAddModal && (
          <div
            onClick={handleCloseModal}
            className={`fixed inset-0 w-screen h-screen bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto ${
              isClosingModal ? "animate-fade-out" : "animate-fade-in"
            }`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white rounded-3xl ${createdResult ? "max-w-3xl" : "max-w-xl md:max-w-2xl"} w-full p-6 sm:p-8 md:p-10 border border-slate-200 shadow-2xl relative my-auto transition-all duration-300 ${
                isClosingModal ? "animate-modal-out" : "animate-modal-in"
              }`}
            >
              <button
                onClick={handleCloseModal}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 font-bold text-lg p-1 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {createdResult ? (
                <div className="space-y-6 animate-fadeIn">
                  <div className="text-center pb-5 border-b border-slate-200 flex flex-col items-center">
                    <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-3.5 shadow-md">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-slate-900 text-xl sm:text-2xl">ลงทะเบียนอุปกรณ์ &quot;{createdResult.name}&quot; เสร็จสมบูรณ์</h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">นำค่าด้านล่างไปตั้งค่าใน MacroDroid หรือแอปพลิเคชันของคุณ</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-500 block text-xs uppercase font-sans font-bold tracking-wider">รหัสเครื่อง</span>
                        <span className="font-mono font-bold text-slate-900 text-base sm:text-lg mt-1 block break-all">{createdResult.id}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdResult.id, "รหัสเครื่อง")}
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold font-sans text-xs sm:text-sm cursor-pointer transition-colors shadow-sm shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>คัดลอก</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-500 block text-xs uppercase font-sans font-bold tracking-wider">รหัสลับ API</span>
                        <span className="font-mono font-bold text-slate-900 text-base sm:text-lg mt-1 block break-all">{createdResult.apiKey}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdResult.apiKey, "รหัสลับ API")}
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold font-sans text-xs sm:text-sm cursor-pointer transition-colors shadow-sm shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>คัดลอก</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-slate-200 p-4 sm:p-5 rounded-2xl text-xs sm:text-sm font-mono space-y-2 shadow-inner">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-slate-400 block text-xs font-sans font-bold uppercase tracking-wider">ตัวอย่าง JSON สำหรับ MACRODROID / POST BODY</span>
                      <button
                        onClick={() => copyToClipboard(`{"deviceId":"${createdResult.id}","apiKey":"${createdResult.apiKey}","batteryLevel":[battery],"isCharging":true/false}`, "ตัวอย่าง JSON")}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer border border-slate-700 shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>คัดลอก JSON</span>
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-emerald-400 font-semibold pt-2 text-xs sm:text-sm leading-relaxed">
{`{
  "deviceId": "${createdResult.id}",
  "apiKey": "${createdResult.apiKey}",
  "batteryLevel": [battery],
  "isCharging": true/false
}`}
                    </pre>
                  </div>

                  <button
                    onClick={handleCloseModal}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-4 rounded-2xl text-sm sm:text-base transition-colors cursor-pointer mt-2 border border-slate-300 shadow-sm"
                  >
                    ปิดหน้าต่างและกลับสู่แดชบอร์ด
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">ลงทะเบียนอุปกรณ์ใหม่</h2>
                  </div>

                  <form onSubmit={handleCreateDevice} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        ชื่ออุปกรณ์
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ระบุชื่ออุปกรณ์..."
                        value={newDeviceName}
                        onChange={(e) => setNewDeviceName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-medium bg-slate-50 focus:bg-white"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        แพลตฟอร์ม / ระบบปฏิบัติการ
                      </label>
                      <select
                        value={newDevicePlatform}
                        onChange={(e) => setNewDevicePlatform(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 text-sm font-medium bg-slate-50 focus:bg-white"
                      >
                        <option value="Android">Android (MacroDroid / Tasker)</option>
                        <option value="Windows">Windows (PC / Laptop)</option>
                        <option value="iOS">iOS (iPhone / iPad)</option>
                        <option value="macOS">macOS (MacBook)</option>
                        <option value="ESP32">ESP32 / IoT Sensor</option>
                        <option value="Other">อื่นๆ</option>
                      </select>
                    </div>

                    <div className="pt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={creatingDevice}
                        className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {creatingDevice ? (
                          <span>กำลังสร้างรหัส...</span>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>สร้างและรับรหัส ID</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-72 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 shadow-sm p-6">
            <p className="text-slate-600 font-semibold text-base sm:text-lg">ยังไม่มีอุปกรณ์เชื่อมต่อในระบบ</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
              กดปุ่ม <span className="text-emerald-600 font-bold">&quot;เพิ่มอุปกรณ์ใหม่&quot;</span> ด้านบนเพื่อสร้างรหัส ID สำหรับเชื่อมต่อ MacroDroid
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isExpanded={expandedDevice === device.id}
                onToggleExpand={handleToggleExpand}
                onPromptRename={handlePromptRename}
                onToggleAccept={handleToggleAccept}
                onPromptDelete={handlePromptDelete}
                onToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
