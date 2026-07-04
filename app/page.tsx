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
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  let timeStr = "";
  if (hours > 0 && mins > 0) {
    timeStr = `${hours} ชม. ${mins} นาที`;
  } else if (hours > 0) {
    timeStr = `${hours} ชม.`;
  } else {
    timeStr = `${mins} นาที`;
  }

  return isCharging ? `ชาร์จเต็มในอีกประมาณ ~${timeStr}` : `เหลือเวลาใช้งานอีก ~${timeStr}`;
};

const formatDuration = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ชม. ${mins} นาที`;
  if (hours > 0) return `${hours} ชม.`;
  return `${mins} นาที`;
};

const formatEventType = (evt: HistoryEvent): string => {
  const level = evt.batteryLevel;
  switch (evt.eventType) {
    case 'PLUGGED_IN':
      return `เสียบสายชาร์จ (${level}%)`;
    case 'UNPLUGGED': {
      let base = `ถอดสายชาร์จ (${level}%)`;
      if (evt.chargeGained !== undefined && evt.durationMinutes !== undefined) {
        const sign = evt.chargeGained > 0 ? `+${evt.chargeGained}` : `${evt.chargeGained}`;
        const timeStr = formatDuration(evt.durationMinutes);
        base += ` [ชาร์จเพิ่ม ${sign}% ใช้เวลา ${timeStr}]`;
      }
      return base;
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
    case 'FULL_CHARGE':
      return `ชาร์จแบตเตอรี่เต็ม (100%)`;
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

const RechartsBatteryGraph = React.memo(({ data }: { data: GraphPoint[] }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((pt) => {
      const d = new Date(pt.time);
      return {
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        level: pt.level,
        isCharging: pt.isCharging,
      };
    });
  }, [data]);

  if (!chartData || chartData.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-8">ไม่มีข้อมูลกราฟแบตเตอรี่ในวันนี้</p>;
  }

  return (
    <div className="bg-slate-50/90 p-3 sm:p-4 rounded-xl border border-slate-200/60 mt-3 w-full">
      <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        กราฟแบตเตอรี่ตลอดทั้งวัน (00:00 AM - 11:59 PM)
      </p>
      <div className="w-full h-40 sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
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
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                fontSize: "12px",
              }}
              formatter={(val: unknown) => [`${Number(val)}%`, "ระดับแบตเตอรี่"]}
              labelFormatter={(label) => `เวลา: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="level"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorLevel)"
              activeDot={{ r: 5, fill: "#059669", stroke: "#ffffff", strokeWidth: 2 }}
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
    }, 10000);
    return () => clearInterval(interval);
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
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md text-xs sm:text-sm font-semibold transition-all ${
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
            <div className="flex items-center gap-3 pt-1">
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
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-end">
            <div className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono text-slate-500">
                อัปเดตเมื่อ: {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
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
                        <span className="text-slate-500 block text-xs uppercase font-sans font-bold tracking-wider">รหัสเครื่อง (DEVICE ID)</span>
                        <span className="font-mono font-bold text-slate-900 text-base sm:text-lg mt-1 block break-all">{createdResult.id}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdResult.id, "รหัสเครื่อง (Device ID)")}
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
                        <span className="text-slate-500 block text-xs uppercase font-sans font-bold tracking-wider">รหัสลับ API (SECRET KEY)</span>
                        <span className="font-mono font-bold text-slate-900 text-base sm:text-lg mt-1 block break-all">{createdResult.apiKey}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdResult.apiKey, "รหัสลับ API (Secret Key)")}
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
                    <span className="text-slate-400 block text-xs font-sans font-bold uppercase tracking-wider">ตัวอย่าง JSON สำหรับ MACRODROID / POST BODY</span>
                    <pre className="overflow-x-auto text-emerald-400 font-semibold pt-1">
{`{
  "deviceId": "${createdResult.id}",
  "apiKey": "${createdResult.apiKey}",
  "batteryLevel": "[battery_level]",
  "isCharging": [is_charging]
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
                        <option value="Other">อื่นๆ (Other)</option>
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
