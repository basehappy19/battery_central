"use client";

import { useState } from "react";

// Feature 4: per-device alert threshold settings (low battery %, offline
// timeout, master alert on/off). Mirrors the visual style of the other
// modals in app/page.tsx (rounded-3xl white card over a blurred backdrop).
//
// The parent renders this with key={target.id} (see app/page.tsx), so React
// remounts it fresh whenever a different device is selected — that's what
// keeps the form fields in sync with `target` without a prop-syncing effect.

export interface ThresholdTarget {
  id: string;
  name: string;
  lowBatteryThreshold: number;
  offlineTimeoutMinutes: number;
  alertEnabled: boolean;
}

interface ThresholdModalProps {
  target: ThresholdTarget;
  dashboardToken: string;
  onClose: () => void;
  onSaved: (id: string, patch: Partial<ThresholdTarget>) => void;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function ThresholdModal({ target, dashboardToken, onClose, onSaved, onToast }: ThresholdModalProps) {
  const [lowBatteryThreshold, setLowBatteryThreshold] = useState(String(target.lowBatteryThreshold));
  const [offlineTimeoutMinutes, setOfflineTimeoutMinutes] = useState(String(target.offlineTimeoutMinutes));
  const [alertEnabled, setAlertEnabled] = useState(target.alertEnabled);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const handleSave = async () => {
    const low = Number(lowBatteryThreshold);
    const offline = Number(offlineTimeoutMinutes);
    if (isNaN(low) || low < 0 || low > 100) {
      onToast("ระดับแบตต่ำต้องเป็นตัวเลข 0-100", "error");
      return;
    }
    if (isNaN(offline) || offline < 1) {
      onToast("เวลาออฟไลน์ต้องเป็นตัวเลขมากกว่า 0", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-dashboard-token": dashboardToken },
        body: JSON.stringify({
          id: target.id,
          lowBatteryThreshold: low,
          offlineTimeoutMinutes: offline,
          alertEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || "บันทึกการตั้งค่าไม่สำเร็จ", "error");
        return;
      }
      onSaved(target.id, { lowBatteryThreshold: low, offlineTimeoutMinutes: offline, alertEnabled });
      onToast("บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว", "success");
      handleClose();
    } catch {
      onToast("เกิดข้อผิดพลาดในการบันทึกการตั้งค่า", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-150 ${closing ? "opacity-0" : "opacity-100"}`}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-900">ตั้งค่าแจ้งเตือนเฉพาะอุปกรณ์</h3>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5 font-medium">{target.name}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              แจ้งเตือนเมื่อแบตต่ำกว่า (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={lowBatteryThreshold}
              onChange={(e) => setLowBatteryThreshold(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-bold text-slate-900 bg-slate-50/80 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              ถือว่าออฟไลน์เมื่อไม่มีข้อมูลเกิน (นาที)
            </label>
            <input
              type="number"
              min={1}
              value={offlineTimeoutMinutes}
              onChange={(e) => setOfflineTimeoutMinutes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-bold text-slate-900 bg-slate-50/80 focus:bg-white transition-all"
            />
          </div>
          <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
            <span className="text-sm font-semibold text-slate-700">เปิดใช้งานการแจ้งเตือนสำหรับอุปกรณ์นี้</span>
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={(e) => setAlertEnabled(e.target.checked)}
              className="w-5 h-5 accent-emerald-600 cursor-pointer"
            />
          </label>
        </div>

        <div className="pt-6 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-sm transition-all cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
