"use client";

import { useCallback, useEffect, useState } from "react";

// Feature 14: create/manage public share links + iframe embed widgets.

interface DeviceOption {
  id: string;
  name: string;
}

interface ShareTokenRow {
  id: string;
  token: string;
  deviceIds: string[];
  expiresAt: string | null;
  createdAt: string;
  // Computed once when fetched (not during render — Date.now() can't be
  // called from a component's render body), so it's a plain stored field.
  expired: boolean;
}

interface ShareModalProps {
  devices: DeviceOption[];
  dashboardToken: string;
  onClose: () => void;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
  preselectedDeviceId?: string;
}

export default function ShareModal({ devices, dashboardToken, onClose, onToast, preselectedDeviceId }: ShareModalProps) {
  const [closing, setClosing] = useState(false);
  const [selected, setSelected] = useState<string[]>(preselectedDeviceId ? [preselectedDeviceId] : []);
  const [expiresInHours, setExpiresInHours] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [tokens, setTokens] = useState<ShareTokenRow[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  // ShareModal only ever mounts client-side (opened from a button click well
  // after hydration), so reading window here in a lazy initializer is safe
  // and avoids a throwaway extra render just to pick up the origin.
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch("/api/share", { headers: { "x-dashboard-token": dashboardToken } });
      const data = await res.json();
      if (res.ok) {
        const now = Date.now();
        const rows: ShareTokenRow[] = (data.tokens || []).map((t: Omit<ShareTokenRow, "expired">) => ({
          ...t,
          expired: t.expiresAt ? new Date(t.expiresAt).getTime() < now : false,
        }));
        setTokens(rows);
      }
    } catch {
      // silent — list is a convenience, not critical
    } finally {
      setLoadingTokens(false);
    }
  }, [dashboardToken]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const toggleDevice = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (selected.length === 0) {
      onToast("กรุณาเลือกอย่างน้อย 1 อุปกรณ์", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dashboard-token": dashboardToken },
        body: JSON.stringify({
          deviceIds: selected,
          expiresInHours: expiresInHours ? Number(expiresInHours) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || "สร้างลิงก์แชร์ไม่สำเร็จ", "error");
        return;
      }
      onToast("สร้างลิงก์แชร์เรียบร้อยแล้ว", "success");
      fetchTokens();
    } catch {
      onToast("เกิดข้อผิดพลาดในการสร้างลิงก์แชร์", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: string) => {
    try {
      const res = await fetch(`/api/share?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
        headers: { "x-dashboard-token": dashboardToken },
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || "ยกเลิกลิงก์ไม่สำเร็จ", "error");
        return;
      }
      onToast("ยกเลิกลิงก์แชร์แล้ว", "info");
      fetchTokens();
    } catch {
      onToast("เกิดข้อผิดพลาดในการยกเลิกลิงก์", "error");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast("คัดลอกลิงก์แล้ว", "success");
    } catch {
      onToast("ไม่สามารถคัดลอกได้ กรุณาคัดลอกด้วยตนเอง", "error");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-150 ${closing ? "opacity-0" : "opacity-100"}`}
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl p-6 sm:p-7 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-900">แชร์ / ฝัง Widget สถานะแบตเตอรี่</h3>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5 font-medium">
          สร้างลิงก์สาธารณะ (ไม่ต้องเข้าสู่ระบบ) สำหรับแสดงสถานะแบตเตอรี่ของอุปกรณ์ที่เลือก
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">เลือกอุปกรณ์</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {devices.map((d) => (
                <label
                  key={d.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm font-semibold transition-colors ${
                    selected.includes(d.id) ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggleDevice(d.id)} className="accent-emerald-600" />
                  <span className="truncate">{d.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">อายุลิงก์ (ชั่วโมง, เว้นว่าง = ไม่หมดอายุ)</label>
            <input
              type="number"
              min={1}
              placeholder="เช่น 24"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-bold text-slate-900 bg-slate-50/80 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {creating ? "กำลังสร้างลิงก์..." : "สร้างลิงก์แชร์ใหม่"}
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ลิงก์ที่สร้างไว้</p>
          {loadingTokens ? (
            <p className="text-xs text-slate-400 py-3">กำลังโหลด...</p>
          ) : tokens.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">ยังไม่มีลิงก์แชร์</p>
          ) : (
            <div className="space-y-2.5">
              {tokens.map((t) => {
                const shareUrl = `${origin}/share/${t.token}`;
                const embedCode = `<iframe src="${shareUrl}" width="360" height="220" style="border:0;border-radius:16px;"></iframe>`;
                return (
                  <div key={t.id} className={`p-3 rounded-xl border ${t.expired ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-slate-50/60"}`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-mono text-slate-500 truncate">{shareUrl}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => copyToClipboard(shareUrl)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer">
                          คัดลอกลิงก์
                        </button>
                        <button onClick={() => copyToClipboard(embedCode)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer">
                          คัดลอก Embed
                        </button>
                        <button onClick={() => handleRevoke(t.token)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer">
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <span>{t.deviceIds.length} อุปกรณ์</span>
                      <span>•</span>
                      <span>{t.expired ? "หมดอายุแล้ว" : t.expiresAt ? `หมดอายุ ${new Date(t.expiresAt).toLocaleString("th-TH")}` : "ไม่หมดอายุ"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
