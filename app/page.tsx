"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";

interface HistoryEvent {
  id: string;
  batteryLevel: number;
  isCharging: boolean;
  eventType: string;
  createdAt: string;
}

interface TodayStats {
  pluggedCount: number;
  unpluggedCount: number;
  maxBattery: number;
  minBattery: number;
  history: HistoryEvent[];
}

interface Device {
  id: string;
  name: string;
  platform: string;
  batteryLevel: number;
  isCharging: boolean;
  timeRemaining?: number | null;
  updatedAt: string;
  todayStats?: TodayStats;
}

const getBatteryColor = (level: number): string => {
  if (level > 50) return "bg-emerald-500 shadow-sm shadow-emerald-500/20";
  if (level >= 20) return "bg-amber-500 shadow-sm shadow-amber-500/20";
  return "bg-rose-500 shadow-sm shadow-rose-500/20";
};

const formatTimeRemaining = (minutes: number | null | undefined, isCharging: boolean): string | null => {
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

const formatEventType = (type: string, level: number): string => {
  switch (type) {
    case 'PLUGGED_IN':
      return `เสียบสายชาร์จ (${level}%)`;
    case 'UNPLUGGED':
      return `ถอดสายชาร์จ (${level}%)`;
    case 'FULL_CHARGE':
      return `ชาร์จเต็ม 100%`;
    default:
      return `บันทึกสถานะ (${level}%)`;
  }
};

const getPlatformStyle = (platform: string): { bg: string; icon: React.ReactNode } => {
  const p = platform.toLowerCase();
  if (p.includes("win")) {
    return {
      bg: "bg-sky-50 border-sky-100 text-sky-600",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.8" />
        </svg>
      ),
    };
  }
  if (p.includes("ios") || p.includes("ipad") || p.includes("apple") || p.includes("mac")) {
    return {
      bg: "bg-slate-100 border-slate-200 text-slate-700",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.64-.78 1.08-1.86.96-2.95-.93.04-2.06.62-2.72 1.39-.58.67-.92 1.77-.78 2.84 1.05.08 2.11-.53 2.54-1.28" />
        </svg>
      ),
    };
  }
  if (p.includes("android")) {
    return {
      bg: "bg-emerald-50 border-emerald-100 text-emerald-600",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
      ),
    };
  }
  if (p.includes("esp") || p.includes("iot")) {
    return {
      bg: "bg-amber-50 border-amber-100 text-amber-600",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
    };
  }
  return {
    bg: "bg-indigo-50 border-indigo-100 text-indigo-600",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  };
};

interface DeviceCardProps {
  device: Device;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

const DeviceCard = React.memo(({ device, isExpanded, onToggleExpand }: DeviceCardProps) => {
  const style = useMemo(() => getPlatformStyle(device.platform), [device.platform]);
  const timeFormatted = useMemo(() => formatTimeRemaining(device.timeRemaining, device.isCharging), [device.timeRemaining, device.isCharging]);
  const batteryColor = useMemo(() => getBatteryColor(device.batteryLevel), [device.batteryLevel]);
  const stats = device.todayStats;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3.5 mb-6">
          <div className={`p-3 rounded-xl border ${style.bg} shrink-0`}>
            {style.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base text-slate-900 truncate">
              {device.name}
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {device.platform}
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <span className="text-4xl font-black tracking-tight font-mono text-slate-900">
            {device.batteryLevel}%
          </span>
          {device.isCharging && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              กำลังชาร์จ
            </span>
          )}
        </div>

        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${batteryColor} ${device.isCharging ? "animate-charging" : ""}`}
            style={{ width: `${device.batteryLevel}%` }}
          />
        </div>

        {timeFormatted ? (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50/80 px-3.5 py-2 rounded-xl border border-slate-200/60">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{timeFormatted}</span>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50/50 px-3.5 py-2 rounded-xl border border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span>ไม่มีข้อมูลเวลาประเมิน</span>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={() => onToggleExpand(device.id)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
          >
            <span>สถิติและประวัติวันนี้ (1 วัน)</span>
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
            <div className="mt-3 space-y-3 animate-fadeIn">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-semibold text-slate-400 block">เสียบชาร์จ</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{stats.pluggedCount} ครั้ง</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-semibold text-slate-400 block">ถอดชาร์จ</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{stats.unpluggedCount} ครั้ง</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-semibold text-slate-400 block">แบตสูงสุด</span>
                  <span className="text-sm font-bold text-emerald-600 font-mono">{stats.maxBattery}%</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[10px] font-semibold text-slate-400 block">แบตต่ำสุด</span>
                  <span className="text-sm font-bold text-rose-600 font-mono">{stats.minBattery}%</span>
                </div>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 max-h-44 overflow-y-auto space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ประวัติเหตุการณ์วันนี้</p>
                {stats.history && stats.history.length > 0 ? (
                  stats.history.map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between text-xs text-slate-600 py-1 border-b border-slate-200/40 last:border-0">
                      <span className="font-medium">{formatEventType(evt.eventType, evt.batteryLevel)}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(evt.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">ไม่มีประวัติเหตุการณ์เพิ่มเติมในวันนี้</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-mono">
        <span>รหัส: {device.id.slice(0, 8)}</span>
        <span>
          ใช้งานล่าสุด: {new Date(device.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
        </span>
      </div>
    </div>
  );
});

DeviceCard.displayName = "DeviceCard";

export default function BatteryDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const fetchDevices = useCallback(async (isInitial = false): Promise<void> => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch("/api/devices");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { devices: Device[] };
      setDevices(data.devices || []);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      console.error("Error polling devices:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices(true);
    const interval = setInterval(() => {
      fetchDevices(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleToggleExpand = useCallback((id: string): void => {
    setExpandedDevice((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 md:p-12 font-sans selection:bg-slate-200">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              ระบบติดตามแบตเตอรี่
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              รายงานสถานะแบตเตอรี่ ประเมินเวลา และสถิติประจำวันแบบเรียลไทม์
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200/80 shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-slate-500">
              อัปเดตเมื่อ: {lastRefreshed.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.
            </span>
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-white rounded-2xl border border-slate-200 shadow-sm" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
            <p className="text-slate-600 font-semibold text-base">ยังไม่มีอุปกรณ์เชื่อมต่อในระบบ</p>
            <p className="text-xs text-slate-400 mt-1">
              ส่งคำขอ POST ไปที่ <code className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono">/api/battery/update</code> เพื่อบันทึกข้อมูล
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isExpanded={expandedDevice === device.id}
                onToggleExpand={handleToggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
