"use client";

// Feature 8: Battery Comparison View — pick multiple devices and see their
// battery history overlaid on one chart.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface DeviceSummary {
  id: string;
  name: string;
  platform: string;
  batteryLevel: number;
  isCharging: boolean;
}

interface HistoryPoint {
  time: string;
  level: number;
}

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function ComparePage() {
  // This page only ever renders client-side content behind a "logged in?"
  // check further down, so reading localStorage in a lazy initializer (runs
  // once, during the client's first render) is safe here.
  const [dashboardToken] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("dashboard_auth") || "" : ""));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [range, setRange] = useState<7 | 30>(7);
  const [seriesByDevice, setSeriesByDevice] = useState<Record<string, HistoryPoint[]>>({});
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!dashboardToken) return;
    fetch("/api/devices", { headers: { "x-dashboard-token": dashboardToken } })
      .then((res) => res.json())
      .then((data) => {
        const list: DeviceSummary[] = (data.devices || []).map((d: DeviceSummary) => ({
          id: d.id,
          name: d.name,
          platform: d.platform,
          batteryLevel: d.batteryLevel,
          isCharging: d.isCharging,
        }));
        setDevices(list);
        setSelected(list.slice(0, 2).map((d) => d.id));
      })
      .catch(() => {})
      .finally(() => setLoadingDevices(false));
  }, [dashboardToken]);

  const fetchHistoryFor = useCallback(
    async (deviceId: string) => {
      const res = await fetch(`/api/devices/${deviceId}/history?days=${range}`, {
        headers: { "x-dashboard-token": dashboardToken },
      });
      const data = await res.json();
      if (!res.ok) return [];
      return (data.points || []) as HistoryPoint[];
    },
    [dashboardToken, range]
  );

  useEffect(() => {
    // When nothing is selected, the render below already shows a "pick a
    // device" message based on selected.length directly — no need to reset
    // seriesByDevice here too.
    if (selected.length === 0 || !dashboardToken) return;
    let cancelled = false;
    setLoadingHistory(true);
    Promise.all(selected.map((id) => fetchHistoryFor(id).then((points) => [id, points] as const)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, HistoryPoint[]> = {};
        for (const [id, points] of results) map[id] = points;
        setSeriesByDevice(map);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, fetchHistoryFor, dashboardToken]);

  // Bucket every device's series into shared time buckets so they can be
  // overlaid on one chart (raw timestamps rarely line up between devices).
  const chartData = useMemo(() => {
    const bucketMs = range <= 7 ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000; // 1h or 6h buckets
    const buckets = new Map<number, Record<string, number[]>>();

    for (const deviceId of selected) {
      const points = seriesByDevice[deviceId] || [];
      for (const pt of points) {
        const t = new Date(pt.time).getTime();
        const bucketKey = Math.floor(t / bucketMs) * bucketMs;
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, {});
        const entry = buckets.get(bucketKey)!;
        if (!entry[deviceId]) entry[deviceId] = [];
        entry[deviceId].push(pt.level);
      }
    }

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    return sortedKeys.map((key) => {
      const entry = buckets.get(key)!;
      const row: Record<string, number | string> = {
        label: new Date(key).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: range <= 7 ? "2-digit" : undefined,
          hour12: true,
        }),
      };
      for (const deviceId of selected) {
        const values = entry[deviceId];
        if (values && values.length > 0) {
          row[deviceId] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
        }
      }
      return row;
    });
  }, [selected, seriesByDevice, range]);

  const toggleDevice = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  if (!dashboardToken) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center max-w-sm">
          <p className="text-slate-700 font-semibold mb-3">กรุณาเข้าสู่ระบบก่อนใช้งานหน้าเปรียบเทียบ</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 font-sans">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>หน้าหลัก</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5 truncate">
              <span className="p-1.5 sm:p-2 bg-indigo-500/10 text-indigo-600 rounded-xl shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2" />
                </svg>
              </span>
              <span className="truncate">เปรียบเทียบแบตเตอรี่</span>
            </h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  range === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {d} วัน
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">เลือกอุปกรณ์ที่ต้องการเปรียบเทียบ</p>
          {loadingDevices ? (
            <p className="text-sm text-slate-400">กำลังโหลด...</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีอุปกรณ์ในระบบ</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {devices.map((d) => {
                const isSelected = selected.includes(d.id);
                const color = PALETTE[selected.indexOf(d.id) % PALETTE.length];
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleDevice(d.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-semibold transition-colors cursor-pointer ${
                      isSelected ? "border-transparent text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                    style={isSelected ? { backgroundColor: color } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                    {d.name}
                    <span className="opacity-70 font-mono text-xs">{d.batteryLevel}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
          {selected.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">เลือกอย่างน้อย 1 อุปกรณ์เพื่อแสดงกราฟเปรียบเทียบ</p>
          ) : loadingHistory ? (
            <p className="text-sm text-slate-400 text-center py-16">กำลังโหลดข้อมูลกราฟ...</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">ไม่มีข้อมูลย้อนหลังสำหรับอุปกรณ์ที่เลือก</p>
          ) : (
            <div className="w-full h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" unit="%" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                  {selected.map((deviceId, idx) => (
                    <Line
                      key={deviceId}
                      type="monotone"
                      dataKey={deviceId}
                      // Explicit `name` so the Tooltip/Legend show the device's
                      // display name instead of its raw id (which is what
                      // dataKey is, and what Recharts falls back to without
                      // this prop).
                      name={devices.find((d) => d.id === deviceId)?.name || deviceId}
                      stroke={PALETTE[idx % PALETTE.length]}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
