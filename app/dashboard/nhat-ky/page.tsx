'use client';

import { useEffect, useState, useCallback } from 'react';
import { systemLogsApi, LogRow } from '@/lib/system-logs';
import { localDateStr } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODULE_COLOR: Record<string, string> = {
  'Chốt Sổ':        'bg-indigo-100 text-indigo-700',
  'Vai Trò':         'bg-violet-100 text-violet-700',
  'Hỗ Trợ KT Thuế': 'bg-teal-100 text-teal-700',
};
const DEFAULT_MODULE_COLOR = 'bg-gray-100 text-gray-600';

const ACTION_COLOR: Record<string, string> = {
  CREATE:        'bg-green-100 text-green-700',
  UPDATE:        'bg-blue-100 text-blue-700',
  DELETE:        'bg-red-100 text-red-700',
  STATUS_CHANGE: 'bg-orange-100 text-orange-700',
  PAYMENT:       'bg-emerald-100 text-emerald-700',
  LOCK:          'bg-yellow-100 text-yellow-700',
  UNLOCK:        'bg-yellow-50 text-yellow-600',
  REVIEW:        'bg-purple-100 text-purple-700',
  CANCEL:        'bg-red-50 text-red-500',
  REOPEN:        'bg-amber-100 text-amber-700',
};

function ModuleBadge({ module }: { module: string }) {
  const color = MODULE_COLOR[module] ?? DEFAULT_MODULE_COLOR;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{module}</span>;
}

function ActionBadge({ action }: { action: string }) {
  const key = action.toUpperCase().replace(/ /g, '_');
  const color = ACTION_COLOR[key] ?? DEFAULT_MODULE_COLOR;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>{action}</span>;
}

function DetailsPanel({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-gray-400 text-xs">—</span>;
  try {
    const parsed = JSON.parse(raw);
    return (
      <pre className="text-xs bg-gray-800 text-green-300 rounded-lg p-3 overflow-x-auto max-h-48 font-mono whitespace-pre-wrap">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    return <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">{raw}</p>;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NhatKyPage() {
  const [data, setData] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modules, setModules] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(localDateStr());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (q) params.q = q;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      if (actorFilter) params.actorName = actorFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await systemLogsApi.getAll(params);
      setData(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message ?? 'Không thể tải nhật ký hệ thống');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, q, moduleFilter, actionFilter, actorFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { systemLogsApi.getModules().then(setModules).catch(() => {}); }, []);

  const totalPages = Math.ceil(total / limit);
  const hasFilter = !!(q || moduleFilter || actionFilter || actorFilter || fromDate);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nhật Ký Hệ Thống</h1>
        <p className="text-sm text-gray-500 mt-0.5">Audit log tập trung — ai làm gì, lúc nào, trên module nào</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm mã record, người thực hiện..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select
          value={moduleFilter}
          onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả module</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Action..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
        />
        <input
          type="text"
          value={actorFilter}
          onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
          placeholder="Người thực hiện..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <span className="text-gray-400 text-sm">—</span>
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        {hasFilter && (
          <button
            onClick={() => { setQ(''); setModuleFilter(''); setActionFilter(''); setActorFilter(''); setFromDate(''); setToDate(localDateStr()); setPage(1); }}
            className="text-sm text-gray-500 hover:text-red-600 transition"
          >
            Xóa filter
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">{total.toLocaleString('vi-VN')} bản ghi</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-red-500 text-sm font-medium">Lỗi tải dữ liệu</p>
            <p className="text-gray-400 text-xs mt-1">{error}</p>
            <button onClick={load} className="mt-3 text-xs text-blue-500 hover:text-blue-700 underline">Thử lại</button>
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">Chưa có nhật ký nào trong khoảng thời gian này</p>
            <p className="text-gray-300 text-xs mt-1">Thử mở rộng khoảng ngày hoặc xóa filter</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-44">Thời gian</th>
                <th className="text-left px-4 py-3 w-36">Module</th>
                <th className="text-left px-4 py-3 w-36">Action</th>
                <th className="text-left px-4 py-3">Mã / Record</th>
                <th className="text-left px-4 py-3 w-36">Người thực hiện</th>
                <th className="text-left px-4 py-3 w-20">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const rowKey = row.id + '-' + row.source;
                const isExpanded = expandedId === rowKey;
                return (
                  <>
                    <tr
                      key={rowKey}
                      onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                      className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition text-sm ${isExpanded ? 'bg-blue-50/60' : ''}`}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3"><ModuleBadge module={row.module} /></td>
                      <td className="px-4 py-3"><ActionBadge action={row.action} /></td>
                      <td className="px-4 py-3">
                        {row.entityCode
                          ? <span className="font-mono text-blue-600 text-xs font-medium">{row.entityCode}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{row.actorName ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        {row.details
                          ? <span className="text-blue-500 text-xs hover:text-blue-700 font-medium">{isExpanded ? '▲' : '▼'}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={rowKey + '-detail'} className="bg-gray-900/5 border-b border-gray-100">
                        <td colSpan={6} className="px-6 py-3">
                          <DetailsPanel raw={row.details} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>Trang {page}/{totalPages} — {total.toLocaleString('vi-VN')} bản ghi</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 text-xs">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Trước</button>
              <span className="px-3 py-1 text-xs text-gray-400">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">Sau</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 text-xs">»</button>
            </div>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-600">
        <span className="font-medium">Nguồn dữ liệu hiện tại:</span> Chốt Sổ · Vai Trò · Hỗ Trợ KT Thuế.
        Các module khác (Đơn Hàng, Thu Chi, Đối Tác...) sẽ được tích hợp dần vào <code className="bg-blue-100 px-1 rounded">system_logs</code>.
      </div>
    </div>
  );
}
