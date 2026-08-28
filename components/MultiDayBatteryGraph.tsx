"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// Feature 2: 7/30-day battery history graph. Fetches from
// /api/devices/[id]/history?days=N on demand (only while the device card is
// expanded and a multi-day range is selected — the 1-day view keeps using
// the already-fetched todayStats data via RechartsBatteryGraph, no extra
// request needed).

interface HistoryPoint {
  time: string;
  level: number;
  isCharging: boolean;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; level: number; isCharging: boolean } }[] }) {
  if (!active || !payload || !payload.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700 shadow-xl text-xs text-white">
      <p className="text-slate-300 text-[10px] mb-1">{pt.label}</p>
      <p className="font-black text-sm">{pt.level}%</p>
      <p className={`text-[10px] font-semibold ${pt.isCharging ? "text-emerald-400" : "text-blue-300"}`}>
        {pt.isCharging ? "กำลังชาร์จ" : "ใช้งานปกติ"}
      </p>
    </div>
  );
}

export default function MultiDayBatteryGraph({ deviceId, dashboardToken, days }: { deviceId: string; dashboardToken: string; days: 7 | 30 }) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // NOTE: see the matching comment in DeviceAnalysisPanel.tsx — this rule
  // flags fetch-on-mount/dep-change effects even when the setState calls are
  // moved into a wrapped useCallback, and the same pattern already exists
  // unfixed elsewhere in this app. Kept as the plain, idiomatic form.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/devices/${deviceId}/history?days=${days}`, { headers: { "x-dashboard-token": dashboardToken } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "โหลดข้อมูลกราฟไม่สำเร็จ");
        if (!cancelled) setPoints(data.points || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, dashboardToken, days]);

  const chartData = useMemo(() => {
    if (!points) return [];
    return points.map((pt, idx) => {
      const d = new Date(pt.time);
      const label = d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const nextPt = idx < points.length - 1 ? points[idx + 1] : null;
      const isCharging = pt.isCharging;
      const isNextCharging = nextPt ? nextPt.isCharging : isCharging;
      let dischargingLevel: number | null = null;
      let chargingLevel: number | null = null;
      if (isCharging) {
        chargingLevel = pt.level;
        if (!isNextCharging) dischargingLevel = pt.level;
      } else {
        dischargingLevel = pt.level;
        if (isNextCharging) chargingLevel = pt.level;
      }
      return { label, level: pt.level, isCharging: pt.isCharging, dischargingLevel, chargingLevel };
    });
  }, [points]);

  if (loading) {
    return <p className="text-xs text-slate-400 text-center py-8">กำลังโหลดข้อมูลย้อนหลัง {days} วัน...</p>;
  }
  if (error) {
    return <p className="text-xs text-rose-500 text-center py-8">{error}</p>;
  }
  if (chartData.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-8">ไม่มีข้อมูลย้อนหลัง {days} วัน</p>;
  }

  return (
    <div className="bg-slate-50/90 p-3 sm:p-4 rounded-xl border border-slate-200/60 w-full">
      <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        กราฟแบตเตอรี่ย้อนหลัง {days} วัน
      </p>
      <div className="w-full h-52 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDischargeMulti" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorChargeMulti" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#64748b" }}
              stroke="#cbd5e1"
              interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" unit="%" />
            <Tooltip content={<CustomTooltip />} offset={24} wrapperStyle={{ outline: "none", zIndex: 100, pointerEvents: "none" }} />
            <Area type="monotone" dataKey="dischargingLevel" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDischargeMulti)" dot={false} />
            <Area type="monotone" dataKey="chargingLevel" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorChargeMulti)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
