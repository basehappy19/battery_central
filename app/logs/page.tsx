"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ApiLogItem {
  id: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
  userAgent: string;
  requestBody?: string | null;
  responseBody?: string | null;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ApiLogsPage() {
  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<ApiLogItem | null>(null);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Stats calculation
  const totalCount = pagination.total;
  const successCount = logs.filter((l) => l.status >= 200 && l.status < 400).length;
  const errorCount = logs.filter((l) => l.status >= 400).length;
  const avgDuration =
    logs.length > 0
      ? Math.round(logs.reduce((acc, curr) => acc + curr.durationMs, 0) / logs.length)
      : 0;

  const fetchLogs = useCallback(
    async (pageNum = pagination.page, limitNum = pagination.limit) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(limitNum),
          method: methodFilter,
          status: statusFilter,
          search: searchQuery,
        });
        const res = await fetch(`/api/logs?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setLogs(data.logs || []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setLoading(false);
      }
    },
    [methodFilter, statusFilter, searchQuery, pagination.page, pagination.limit]
  );

  useEffect(() => {
    fetchLogs(1, pagination.limit);
  }, [methodFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, pagination.limit);
  };

  const handleClearLogs = async () => {
    if (!confirm("คุณต้องการล้างประวัติการเรียกใช้งาน API ทั้งหมดใช่หรือไม่?")) {
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchLogs(1, pagination.limit);
      }
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setIsClearing(false);
    }
  };

  const getMethodBadgeStyle = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "POST":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "PATCH":
      case "PUT":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "DELETE":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  const getStatusBadgeStyle = (status: number) => {
    if (status >= 200 && status < 300) {
      return "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20";
    }
    if (status >= 300 && status < 400) {
      return "bg-blue-500 text-white shadow-sm shadow-blue-500/20";
    }
    if (status >= 400 && status < 500) {
      return "bg-amber-500 text-white shadow-sm shadow-amber-500/20";
    }
    return "bg-rose-500 text-white shadow-sm shadow-rose-500/20";
  };

  const formatJsonString = (str?: string | null) => {
    if (!str) return "- ไม่มีข้อมูล -";
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 font-sans">
      {/* Navbar / Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>หน้าหลัก</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span>ประวัติการเรียกใช้งาน API</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchLogs()}
              title="รีเฟรชข้อมูล"
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
            >
              <svg className={`w-4 h-4 text-slate-500 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>

            <button
              onClick={handleClearLogs}
              disabled={isClearing || logs.length === 0}
              className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-sm px-3.5 py-2 rounded-xl border border-rose-200/60 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>ล้างประวัติ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">คำขอทั้งหมด</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5">{totalCount.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">สำเร็จ (2xx)</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-0.5">{successCount.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">ข้อผิดพลาด (4xx/5xx)</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-0.5">{errorCount.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">เวลาเฉลี่ย (หน้านี้)</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5">{avgDuration} <span className="text-sm font-semibold text-slate-500">ms</span></p>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Method:</label>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">ทั้งหมด (All)</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="ALL">ทั้งหมด (All)</option>
                  <option value="SUCCESS">สำเร็จ (2xx)</option>
                  <option value="ERROR">ข้อผิดพลาด (4xx/5xx)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <input
                  type="text"
                  placeholder="ค้นหา Path, IP หรือ User-Agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                ค้นหา
              </button>
            </div>
          </form>
        </div>

        {/* Logs Table */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">สถานะ / Method</th>
                  <th className="py-3.5 px-4 sm:px-6">Path Endpoint</th>
                  <th className="py-3.5 px-4 sm:px-6">ระยะเวลา</th>
                  <th className="py-3.5 px-4 sm:px-6 hidden md:table-cell">IP Address</th>
                  <th className="py-3.5 px-4 sm:px-6 hidden lg:table-cell">วันเวลา</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <svg className="w-5 h-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>กำลังโหลดประวัติคำขอ API...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      ไม่พบประวัติการเรียกใช้งาน API ตามเงื่อนไขที่ระบุ
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold ${getStatusBadgeStyle(log.status)}`}>
                            {log.status}
                          </span>
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold border ${getMethodBadgeStyle(log.method)}`}>
                            {log.method}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 sm:px-6 font-mono text-xs sm:text-sm font-semibold text-slate-800 max-w-xs sm:max-w-md truncate">
                        {log.path}
                      </td>
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap text-slate-600 font-medium">
                        {log.durationMs} <span className="text-xs text-slate-400">ms</span>
                      </td>
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap text-slate-500 font-mono text-xs hidden md:table-cell">
                        {log.ip}
                      </td>
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap text-slate-500 text-xs hidden lg:table-cell">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-800 bg-indigo-50 group-hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors">
                          <span>ดู JSON</span>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-slate-50/80 px-4 sm:px-6 py-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>แสดงทั้งหมด</span>
              <span className="font-bold text-slate-900">{pagination.total.toLocaleString()}</span>
              <span>รายการ | หน้า</span>
              <span className="font-bold text-slate-900">{pagination.page}</span>
              <span>จาก</span>
              <span className="font-bold text-slate-900">{pagination.totalPages}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1, pagination.limit)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1, pagination.limit)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-sm font-bold border ${getMethodBadgeStyle(selectedLog.method)}`}>
                  {selectedLog.method}
                </span>
                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-sm font-bold ${getStatusBadgeStyle(selectedLog.status)}`}>
                  Status: {selectedLog.status}
                </span>
                <h3 className="font-mono font-bold text-slate-800 text-sm sm:text-base truncate max-w-xs sm:max-w-md">
                  {selectedLog.path}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm text-slate-700 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 font-medium block">IP Address:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedLog.ip}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">ระยะเวลาดำเนินการ (Duration):</span>
                  <span className="font-bold text-slate-800">{selectedLog.durationMs} ms</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-medium block">วันและเวลาที่บันทึก:</span>
                  <span className="font-bold text-slate-800">{formatDateTime(selectedLog.createdAt)}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 font-medium block">User-Agent:</span>
                  <span className="font-mono text-xs text-slate-600 break-all">{selectedLog.userAgent}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Request Body (ข้อมูลที่ส่งเข้ามา):</span>
                </h4>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 max-h-60">
                  {formatJsonString(selectedLog.requestBody)}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span>Response Body (ข้อมูลที่ตอบกลับ):</span>
                </h4>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800 max-h-60">
                  {formatJsonString(selectedLog.responseBody)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
