"use client";

import { useEffect, useState } from "react";

// Features 5 (Battery Health Score) & 12 (Charging Profile Analysis).
// Lazily fetches /api/devices/[id]/analysis only while visible (the parent
// only mounts this when a device card is expanded), so the expensive
// multi-week log scan never runs on the 5-second dashboard poll.

interface HealthScore {
  score: number;
  grade: "excellent" | "good" | "fair" | "poor";
  windowDays: number;
  factors: {
    chargeCycles: number;
    cyclesPerDay: number;
    deepDischarges: number;
    deepDischargesPerDay: number;
    overchargeEvents: number;
    overchargeEventsPerDay: number;
  };
  notes: string[];
}

interface ChargingProfile {
  totalSessions: number;
  avgDurationMinutes: number | null;
  avgGainedPercent: number | null;
  fullChargeRate: number | null;
  overnightRate: number | null;
  summary: string[];
}

const GRADE_STYLE: Record<HealthScore["grade"], { bg: string; text: string; ring: string; label: string }> = {
  excellent: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "stroke-emerald-500", label: "ดีเยี่ยม" },
  good: { bg: "bg-sky-50", text: "text-sky-700", ring: "stroke-sky-500", label: "ดี" },
  fair: { bg: "bg-amber-50", text: "text-amber-700", ring: "stroke-amber-500", label: "พอใช้" },
  poor: { bg: "bg-rose-50", text: "text-rose-700", ring: "stroke-rose-500", label: "ควรระวัง" },
};

export default function DeviceAnalysisPanel({ deviceId, dashboardToken }: { deviceId: string; dashboardToken: string }) {
  const [days, setDays] = useState(30);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [profile, setProfile] = useState<ChargingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // NOTE: this fetch-on-mount/dep-change effect calls setLoading/setError
  // synchronously, which trips this project's react-hooks/set-state-in-effect
  // lint rule. Wrapping the body in a useCallback and calling that from the
  // effect (tried during this change) does NOT satisfy the rule — it traces
  // into the called function regardless of indirection — and the app's own
  // pre-existing data-fetching effects (app/page.tsx's auth-check and
  // fetchDevices effects, app/logs/page.tsx's fetchLogs effect) hit the same
  // rule already, unfixed. Kept as the plain, idiomatic pattern to match
  // that existing baseline rather than adding one-off complexity here.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/devices/${deviceId}/analysis?days=${days}`, { headers: { "x-dashboard-token": dashboardToken } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        if (!cancelled) {
          setHealth(data.health);
          setProfile(data.chargingProfile);
        }
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

  const grade = health ? GRADE_STYLE[health.grade] : null;
  const circumference = 2 * Math.PI * 26;
  const dashOffset = health ? circumference - (health.score / 100) * circumference : circumference;

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/60 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
          สุขภาพแบตเตอรี่ &amp; พฤติกรรมการชาร์จ
        </p>
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                days === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {d} วัน
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-4">กำลังวิเคราะห์ข้อมูล...</p>
      ) : error ? (
        <p className="text-xs text-rose-500 text-center py-4">{error}</p>
      ) : (
        <>
          {health && grade && (
            <div className={`flex items-center gap-4 p-3 rounded-xl ${grade.bg}`}>
              <div className="relative w-16 h-16 shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6" className="stroke-slate-200" />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className={grade.ring}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-sm font-black ${grade.text}`}>{health.score}</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${grade.text}`}>{grade.label} ({health.score}/100)</p>
                <ul className="mt-1 space-y-0.5">
                  {health.notes.slice(0, 2).map((n, i) => (
                    <li key={i} className="text-[11px] text-slate-500 leading-snug">{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {health && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                <span className="text-[9px] font-semibold text-slate-400 block">รอบชาร์จ/วัน</span>
                <span className="text-xs font-bold text-slate-800 font-mono">{health.factors.cyclesPerDay}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                <span className="text-[9px] font-semibold text-slate-400 block">แบตต่ำ/วัน</span>
                <span className="text-xs font-bold text-amber-600 font-mono">{health.factors.deepDischargesPerDay}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                <span className="text-[9px] font-semibold text-slate-400 block">ค้าง 100%/วัน</span>
                <span className="text-xs font-bold text-sky-600 font-mono">{health.factors.overchargeEventsPerDay}</span>
              </div>
            </div>
          )}

          {profile && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">พฤติกรรมการชาร์จ</p>
              {profile.summary.length > 0 ? (
                <ul className="space-y-1">
                  {profile.summary.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                      <span className="text-slate-300 mt-0.5">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">ไม่มีข้อมูลเพียงพอ</p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60 text-center">
                  <span className="text-[9px] font-semibold text-slate-400 block">รอบชาร์จทั้งหมด</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">{profile.totalSessions}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60 text-center">
                  <span className="text-[9px] font-semibold text-slate-400 block">เวลาเฉลี่ย/รอบ</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {profile.avgDurationMinutes !== null ? `${profile.avgDurationMinutes} นาที` : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
