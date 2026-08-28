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

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

// Custom tooltip: the chart always renders a <Line> for every device (see the
// comment above the Line map below for why), so Recharts' default tooltip
// would list every device on hover — including ones the user toggled off.
// This filters the payload down to only the currently-selected devices.
function CompareTooltip({
  active,
  payload,
  label,
  selected,
  devices,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  selected: string[];
  devices: DeviceSummary[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const visible = payload.filter((p) => selected.includes(p.dataKey));
  if (visible.length === 0) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md px-3 py-2.5 rounded-xl border border-slate-200 shadow-xl text-xs min-w-[140px]">
      <p className="text-slate-400 text-[10px] font-bold mb-1.5">{label}</p>
      <div className="space-y-1">
        {visible.map((p) => {
          const device = devices.find((d) => d.id === p.dataKey);
          return (
            <div key={p.dataKey} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-slate-600 font-semibold truncate">{device?.name || p.dataKey}</span>
              <span className="font-bold text-slate-900 ml-auto tabular-nums">{p.value}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComparePage() {
  // This page only ever renders client-side content behind a "logged in?"
  // check further down, so reading localStorage in a lazy initializer (runs
  // once, during the client's first render) is safe here.
  const [dashboardToken] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("dashboard_auth") || "" : ""));
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [range, setRange] = useState<1 | 7 | 30>(7);
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
        // Default to comparing every device, not just the first couple —
        // most installs only have a handful of devices, so showing all of
        // them up front is more useful than an arbitrary slice(0, 2).
        setSelected(list.map((d) => d.id));
      })
      .catch(() => {})
      .finally(() => setLoadingDevices(false));
  }, [dashboardToken]);

  // Color is keyed off each device's fixed position in the full device list
  // (fetched once — this order never changes afterward), NOT off its
  // position within `selected`. `selected` reorders every time a device is
  // toggled on/off (newly-checked ones get appended, unchecking one shifts
  // everyone after it), which is why colors used to jump around whenever you
  // clicked a checkbox.
  const colorByDeviceId = useMemo(() => {
    const map: Record<string, string> = {};
    devices.forEach((d, idx) => {
      map[d.id] = PALETTE[idx % PALETTE.length];
    });
    return map;
  }, [devices]);

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

  // Fetches history for EVERY device up front — not just the ones currently
  // checked — and this effect's dependency list deliberately does NOT
  // include `selected`. Toggling a checkbox only flips which already-loaded
  // line is visible (pure client-side, see chartData/Line below); it never
  // re-triggers a fetch or the loading state, so show/hide is instant with
  // no reload flash. This only re-runs when the device list loads or the
  // day range changes.
  useEffect(() => {
    if (devices.length === 0 || !dashboardToken) return;
    let cancelled = false;
    setLoadingHistory(true);
    Promise.all(devices.map((d) => fetchHistoryFor(d.id).then((points) => [d.id, points] as const)))
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
  }, [devices, fetchHistoryFor, dashboardToken]);

  // Bucket EVERY device's series (not just the selected ones) so the chart's
  // data/geometry never changes just because a line was toggled on/off —
  // only that line's opacity does (via CSS, in the render below). That's
  // what makes show/hide feel instant instead of the whole chart re-laying
  // itself out.
  const chartData = useMemo(() => {
    // 15-min buckets for the 1-day view (fine enough detail within a single
    // day), 1h for the week view, 6h for the month view.
    const bucketMs = range === 1 ? 15 * 60 * 1000 : range <= 7 ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
    const buckets = new Map<number, Record<string, number[]>>();

    for (const device of devices) {
      const points = seriesByDevice[device.id] || [];
      for (const pt of points) {
        const t = new Date(pt.time).getTime();
        const bucketKey = Math.floor(t / bucketMs) * bucketMs;
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, {});
        const entry = buckets.get(bucketKey)!;
        if (!entry[device.id]) entry[device.id] = [];
        entry[device.id].push(pt.level);
      }
    }

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    return sortedKeys.map((key) => {
      const entry = buckets.get(key)!;
      const row: Record<string, number | string> = {
        label: new Date(key).toLocaleString("en-US", {
          // A single-day view doesn't need the date repeated on every tick.
          month: range === 1 ? undefined : "short",
          day: range === 1 ? undefined : "numeric",
          hour: "2-digit",
          minute: range <= 7 ? "2-digit" : undefined,
          hour12: true,
        }),
      };
      for (const device of devices) {
        const values = entry[device.id];
        if (values && values.length > 0) {
          row[device.id] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
        }
      }
      return row;
    });
  }, [devices, seriesByDevice, range]);

  // Legend only lists the currently-selected devices — same reasoning as
  // CompareTooltip above (every device has a mounted <Line>, so Recharts'
  // auto-derived legend would otherwise include hidden ones too).
  const legendPayload = useMemo(
    () =>
      devices
        .filter((d) => selected.includes(d.id))
        .map((d) => ({ value: d.name, dataKey: d.id, color: colorByDeviceId[d.id] })),
    [devices, selected, colorByDeviceId]
  );

  const toggleDevice = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const hasAnyData = devices.length > 0 && chartData.length > 0;

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
            {([1, 7, 30] as const).map((d) => (
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
                const color = colorByDeviceId[d.id];
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
          {loadingDevices || (loadingHistory && !hasAnyData) ? (
            <p className="text-sm text-slate-400 text-center py-16">กำลังโหลดข้อมูลกราฟ...</p>
          ) : !hasAnyData ? (
            <p className="text-sm text-slate-400 text-center py-16">ไม่มีข้อมูลย้อนหลังของอุปกรณ์ในระบบ</p>
          ) : selected.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">เลือกอย่างน้อย 1 อุปกรณ์เพื่อแสดงกราฟเปรียบเทียบ</p>
          ) : (
            <div className="w-full h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" unit="%" />
                  <Tooltip content={<CompareTooltip selected={selected} devices={devices} />} />
                  {/*
                    Recharts 3's <Legend> no longer accepts a `payload` prop
                    directly (it derives one from the chart's series itself,
                    which here means every device since every device always
                    has a mounted <Line>). Rendering our own list here via
                    `content` sidesteps that entirely and shows only the
                    devices that are actually selected.
                  */}
                  <Legend
                    content={() => (
                      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 text-xs font-semibold">
                        {legendPayload.map((item) => (
                          <li key={item.dataKey} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-600">{item.value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                  {/*
                    Every device always gets a <Line>, regardless of `selected`
                    — only its CSS opacity toggles. Recharts' `hide` prop looks
                    tempting for this, but it makes the line return null
                    (unmount) rather than fade it, so switching a device off
                    and back on would just pop it away/back with no
                    transition. Keeping every Line mounted and animating
                    `className`'s opacity with a CSS transition is what
                    actually gives a smooth fade in both directions.
                  */}
                  {devices.map((device) => (
                    <Line
                      key={device.id}
                      type="monotone"
                      dataKey={device.id}
                      name={device.name}
                      stroke={colorByDeviceId[device.id]}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                      className={`transition-opacity duration-300 ease-in-out ${selected.includes(device.id) ? "opacity-100" : "opacity-0"}`}
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
