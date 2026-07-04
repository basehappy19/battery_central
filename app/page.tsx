"use client";

import { useEffect, useState, useCallback } from "react";

interface Device {
  id: string;
  name: string;
  platform: string;
  batteryLevel: number;
  isCharging: boolean;
  timeRemaining?: number | null;
  updatedAt: string;
}

export default function BatteryDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDevices(data.devices || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error polling devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    // Poll every 60 seconds
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const getBatteryColor = (level: number) => {
    if (level > 50) return "bg-emerald-500 shadow-emerald-500/50";
    if (level >= 20) return "bg-amber-500 shadow-amber-500/50";
    return "bg-rose-500 shadow-rose-500/50";
  };

  const formatTimeRemaining = (minutes: number | null | undefined, isCharging: boolean) => {
    if (minutes === null || minutes === undefined || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    let timeStr = "";
    if (hours > 0 && mins > 0) {
      timeStr = `${hours} hr${hours > 1 ? "s" : ""} ${mins} min${mins > 1 ? "s" : ""}`;
    } else if (hours > 0) {
      timeStr = `${hours} hr${hours > 1 ? "s" : ""}`;
    } else {
      timeStr = `${mins} min${mins > 1 ? "s" : ""}`;
    }

    return isCharging ? `Estimated time to full: ${timeStr}` : `Estimated time remaining: ${timeStr}`;
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("win")) {
      return (
        <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.8" />
        </svg>
      );
    }
    if (p.includes("ios") || p.includes("ipad") || p.includes("apple") || p.includes("mac")) {
      return (
        <svg className="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.64-.78 1.08-1.86.96-2.95-.93.04-2.06.62-2.72 1.39-.58.67-.92 1.77-.78 2.84 1.05.08 2.11-.53 2.54-1.28" />
        </svg>
      );
    }
    if (p.includes("android")) {
      return (
        <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
      );
    }
    if (p.includes("esp") || p.includes("iot")) {
      return (
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Battery Central
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time telemetry across desktop, mobile, and IoT hardware
            </p>
          </div>
          <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800 shadow-inner">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Updated: {lastRefreshed.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchDevices}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors pl-2 border-l border-slate-700 cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-900/50 rounded-2xl border border-slate-800/60" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
            <p className="text-slate-400 font-medium">No devices connected yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Send a POST request to <code className="text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded">/api/battery/update</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <div
                key={device.id}
                className="group relative bg-gradient-to-b from-slate-900/90 to-slate-900/50 backdrop-blur-md rounded-2xl p-6 border border-slate-800/80 hover:border-slate-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
              >
                {/* Top Row: Icon, Name, Platform Badge */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 shadow-inner group-hover:scale-105 transition-transform">
                        {getPlatformIcon(device.platform)}
                      </div>
                      <div>
                        <h2 className="font-bold text-lg text-slate-100 tracking-wide line-clamp-1">
                          {device.name}
                        </h2>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {device.platform}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Battery Level Display */}
                  <div className="flex items-baseline justify-between mt-6 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-extrabold tracking-tight font-mono text-slate-100">
                        {device.batteryLevel}%
                      </span>
                      {device.isCharging && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          Charging
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-700/50 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${getBatteryColor(device.batteryLevel)}`}
                      style={{ width: `${device.batteryLevel}%` }}
                    />
                  </div>

                  {/* Time Estimation Display */}
                  {device.timeRemaining ? (
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-800/70 px-3 py-2 rounded-xl border border-slate-700/60 shadow-inner">
                      <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="tracking-wide">{formatTimeRemaining(device.timeRemaining, device.isCharging)}</span>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-900/40 px-3 py-2 rounded-xl border border-slate-800/80">
                      <svg className="w-4 h-4 text-slate-600 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Calculating time estimate...</span>
                    </div>
                  )}
                </div>

                {/* Footer: Timestamp */}
                <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>ID: {device.id.slice(0, 8)}...</span>
                  <span>
                    Last seen: {new Date(device.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
