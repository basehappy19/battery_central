"use client";

// Feature 14: public, unauthenticated status widget — meant to be opened
// directly or embedded via <iframe> using the code generated in ShareModal.
// No login, no navigation chrome, just the battery cards so it stays small
// enough to sit inside another page.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PublicDevice {
  id: string;
  name: string;
  platform: string;
  batteryLevel: number;
  isCharging: boolean;
  updatedAt: string;
  isOffline: boolean;
}

function batteryColor(level: number, isOffline: boolean) {
  if (isOffline) return "bg-slate-400";
  if (level > 50) return "bg-emerald-500";
  if (level >= 20) return "bg-amber-500";
  return "bg-rose-500";
}

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [devices, setDevices] = useState<PublicDevice[] | null>(null);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = () => {
      fetch(`/api/share/${token}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "ไม่สามารถโหลดข้อมูลได้");
          if (!cancelled) {
            setDevices(data.devices || []);
            setExpiresAt(data.expiresAt);
            setError("");
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || "เกิดข้อผิดพลาด");
        });
    };

    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
        <p className="text-sm font-semibold text-rose-500 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-3">
        {devices === null ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">ไม่มีอุปกรณ์ในลิงก์แชร์นี้</p>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{d.name}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{d.platform}</p>
                </div>
                {d.isOffline ? (
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full border border-slate-200 shrink-0">ออฟไลน์</span>
                ) : d.isCharging ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 shrink-0">กำลังชาร์จ</span>
                ) : null}
              </div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className={`text-2xl font-black font-mono ${d.isOffline ? "text-slate-400" : "text-slate-900"}`}>{d.batteryLevel}%</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(d.updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${batteryColor(d.batteryLevel, d.isOffline)}`} style={{ width: `${d.batteryLevel}%` }} />
              </div>
            </div>
          ))
        )}
        {expiresAt && (
          <p className="text-[10px] text-slate-400 text-center pt-1">
            ลิงก์นี้จะหมดอายุ {new Date(expiresAt).toLocaleString("th-TH")}
          </p>
        )}
        <p className="text-[10px] text-slate-300 text-center pt-1">Battery Central</p>
      </div>
    </div>
  );
}
