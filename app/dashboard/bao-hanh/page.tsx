'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  warrantiesApi, warrantyRequestsApi,
  Warranty, WarrantyKpi,
  WarrantyRequest, WarrantyRequestKpi,
} from '@/lib/warranties';
import { productsApi } from '@/lib/products';

type ToastType = 'success' | 'error';
type Tab = 'phieu' | 'yeu-cau';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function daysLeftCalc(endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WARRANTY_STATUS: Record<string, { label: string; cls: string }> = {
  active:       { label: 'Đang BH',  cls: 'bg-green-100 text-green-700' },
  expiringSoon: { label: 'Sắp hết',  cls: 'bg-amber-100 text-amber-700' },
  expired:      { label: 'Hết hạn',  cls: 'bg-red-100 text-red-700' },
  used:         { label: 'Đã dùng',  cls: 'bg-gray-100 text-gray-600' },
};

const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Chờ xử lý',    cls: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'Đang xử lý',   cls: 'bg-blue-100 text-blue-700' },
  done:        { label: 'Hoàn thành',   cls: 'bg-green-100 text-green-700' },
  returned:    { label: 'Đã trả KH',    cls: 'bg-slate-100 text-slate-600' },
  rejected:    { label: 'Từ chối BH',   cls: 'bg-red-100 text-red-700' },
};

const RESOLUTION_LABELS: Record<string, string> = {
  repaired:  'Đã sửa xong',
  replaced:  'Đổi sản phẩm mới',
  rejected:  'Từ chối bảo hành',
  other:     'Khác',
};

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BaoHanhPage() {
  const [tab, setTab] = useState<Tab>('phieu');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');

  function showToast(msg: string, type: ToastType = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Bảo Hành</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý phiếu bảo hành và yêu cầu bảo hành từ khách hàng</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'phieu',    label: 'Phiếu Bảo Hành' },
          { id: 'yeu-cau',  label: 'Yêu Cầu BH' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'phieu'   && <PhieuTab   showToast={showToast} />}
      {tab === 'yeu-cau' && <YeuCauTab  showToast={showToast} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastType === 'success'
            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Tab 1: Phiếu Bảo Hành ───────────────────────────────────────────────────

function PhieuTab({ showToast }: { showToast: (m: string, t?: ToastType) => void }) {
  const [data, setData] = useState<Warranty[]>([]);
  const [kpi, setKpi] = useState<WarrantyKpi>({ total: 0, active: 0, expiringSoon: 0, expired: 0, used: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [selected, setSelected] = useState<Warranty | null>(null);
  const [extendTarget, setExtendTarget] = useState<Warranty | null>(null);
  const [extendMonths, setExtendMonths] = useState('6');
  const [extending, setExtending] = useState(false);
  const [editSerial, setEditSerial] = useState<{ id: number; serial: string; notes: string } | null>(null);
  const [savingSerial, setSavingSerial] = useState(false);
  const [checkQuery, setCheckQuery] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (p = page, q = search, s = statusFilter) => {
    setLoading(true); setError('');
    try {
      const res = await warrantiesApi.getAll({ q: q || undefined, status: s === 'all' ? undefined : s, page: p, limit });
      setData(res.data); setKpi(res.kpi); setTotal(res.total);
    } catch {
      setError('Không thể tải danh sách bảo hành');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, []);

  function handleSearch(q: string) { setSearch(q); setPage(1); load(1, q, statusFilter); }
  function handleStatus(s: string) { setStatusFilter(s); setPage(1); load(1, search, s); }
  function handlePage(p: number) { setPage(p); load(p, search, statusFilter); }

  async function handleExtend() {
    if (!extendTarget || extending) return;
    const m = Number(extendMonths);
    if (!m || m < 1 || m > 120) { showToast('Số tháng không hợp lệ (1–120)', 'error'); return; }
    setExtending(true);
    try {
      const res = await warrantiesApi.extend(extendTarget.id, m);
      showToast(res.message || 'Đã gia hạn');
      setExtendTarget(null); load();
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi gia hạn', 'error');
    } finally { setExtending(false); }
  }

  async function handleSaveSerial() {
    if (!editSerial || savingSerial) return;
    setSavingSerial(true);
    try {
      await warrantiesApi.update(editSerial.id, { serial: editSerial.serial, notes: editSerial.notes });
      showToast('Đã cập nhật serial/ghi chú');
      setEditSerial(null); load();
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi lưu', 'error');
    } finally { setSavingSerial(false); }
  }

  async function handleMarkUsed(w: Warranty) {
    try {
      await warrantiesApi.update(w.id, { status: 'used' });
      showToast('Đã đánh dấu đã sử dụng BH');
      load();
    } catch (e: any) { showToast(e.message || 'Lỗi', 'error'); }
  }

  async function handleCheckSerial() {
    if (!checkQuery.trim() || checking) return;
    setChecking(true); setCheckResult(null);
    try {
      const r = await warrantiesApi.checkSerial(checkQuery.trim());
      setCheckResult(r);
    } catch (e: any) {
      setCheckResult({ found: false, message: e.message });
    } finally { setChecking(false); }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Tổng phiếu',    value: kpi.total,        cls: 'bg-slate-600' },
          { label: 'Đang bảo hành', value: kpi.active,       cls: 'bg-green-500' },
          { label: 'Sắp hết hạn',   value: kpi.expiringSoon, cls: 'bg-amber-500' },
          { label: 'Hết hạn',       value: kpi.expired,      cls: 'bg-red-500' },
          { label: 'Đã sử dụng',    value: kpi.used,         cls: 'bg-gray-500' },
        ].map(k => (
          <div key={k.label} className={`${k.cls} text-white rounded-xl p-4`}>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-white/70 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Check serial panel */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2">Tra cứu Serial / IMEI</p>
        <div className="flex gap-2">
          <input value={checkQuery} onChange={e => setCheckQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheckSerial()}
            placeholder="Nhập mã serial/IMEI cần tra cứu..."
            className="flex-1 h-9 px-3 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:border-blue-400" />
          <button onClick={handleCheckSerial} disabled={checking || !checkQuery.trim()}
            className="h-9 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {checking ? 'Đang tra...' : 'Tra cứu'}
          </button>
        </div>
        {checkResult && (
          <div className={`mt-2 px-3 py-2 rounded-lg text-sm ${checkResult.found && checkResult.active ? 'bg-green-100 text-green-800' : checkResult.found ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
            {checkResult.found ? (
              <>
                <strong>{checkResult.warranty?.productName}</strong> — {checkResult.message}
                {checkResult.daysLeft != null && <span className="ml-2 text-xs">({checkResult.daysLeft} ngày còn lại)</span>}
              </>
            ) : (
              checkResult.message || 'Không tìm thấy serial này trong hệ thống'
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Tìm theo mã BH, sản phẩm, serial, khách hàng..."
          className="flex-1 min-w-48 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white" />
        <select value={statusFilter} onChange={e => handleStatus(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400">
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang bảo hành</option>
          <option value="expiringSoon">Sắp hết hạn (30 ngày)</option>
          <option value="expired">Hết hạn</option>
          <option value="used">Đã sử dụng</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Đang tải...</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">
            {error} <button onClick={() => load()} className="ml-2 underline">Thử lại</button>
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Không có phiếu bảo hành nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã BH</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sản phẩm</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Serial</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Khách hàng</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Bắt đầu</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Hết hạn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Còn lại</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Trạng thái</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(w => {
                const dl = daysLeftCalc(w.endDate);
                const s = WARRANTY_STATUS[w.runtimeStatus] ?? WARRANTY_STATUS.active;
                return (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(w)} className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">
                        {w.code}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[180px]">{w.productName}</div>
                      <div className="text-xs text-gray-400 font-mono">{w.productCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      {w.serial
                        ? <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{w.serial}</span>
                        : <span className="text-gray-300 text-xs italic">Chưa nhập</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{w.customerName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{fmt(w.startDate)}</td>
                    <td className="px-4 py-3 text-center text-xs font-medium text-gray-700">{fmt(w.endDate)}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      {w.runtimeStatus === 'used' || w.runtimeStatus === 'expired'
                        ? <span className="text-gray-400">—</span>
                        : <span className={dl <= 30 ? 'text-red-600 font-semibold' : dl <= 90 ? 'text-amber-600' : 'text-green-600'}>
                            {dl > 0 ? `${dl}n` : 'HH'}
                          </span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditSerial({ id: w.id, serial: w.serial ?? '', notes: w.notes ?? '' })} title="Nhập serial / ghi chú"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {(w.runtimeStatus === 'active' || w.runtimeStatus === 'expiringSoon' || w.runtimeStatus === 'expired') && (
                          <button onClick={() => { setExtendTarget(w); setExtendMonths('6'); }} title="Gia hạn"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </button>
                        )}
                        {w.status === 'active' && (
                          <button onClick={() => handleMarkUsed(w)} title="Đánh dấu đã dùng BH"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} phiếu · trang {page}/{totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">‹</button>
            <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">›</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Chi tiết bảo hành</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selected.code}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              {[
                ['Sản phẩm', `${selected.productName} (${selected.productCode})`],
                ['Serial / IMEI', selected.serial ?? '—'],
                ['Khách hàng', selected.customerName ?? '—'],
                ['Đơn hàng', selected.orderCode ?? '—'],
                ['Ngày bắt đầu', fmt(selected.startDate)],
                ['Ngày hết hạn', fmt(selected.endDate)],
                ['Thời hạn gốc', `${selected.warrantyMonths} tháng`],
                ['Tổng thời hạn', `${selected.totalMonths} tháng`],
                ['Ghi chú', selected.notes ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="w-32 text-gray-500 flex-shrink-0">{k}</span>
                  <span className="text-gray-900 font-medium">{v}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <span className="w-32 text-gray-500 flex-shrink-0">Trạng thái</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${WARRANTY_STATUS[selected.runtimeStatus]?.cls}`}>
                  {WARRANTY_STATUS[selected.runtimeStatus]?.label}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => { setExtendTarget(selected); setExtendMonths('6'); setSelected(null); }}
                className="px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                Gia hạn
              </button>
              <button onClick={() => { setEditSerial({ id: selected.id, serial: selected.serial ?? '', notes: selected.notes ?? '' }); setSelected(null); }}
                className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                Sửa serial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Serial Modal */}
      {editSerial && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Cập nhật Serial / Ghi chú</h2>
              <button onClick={() => setEditSerial(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Serial / IMEI</label>
                <input value={editSerial.serial} onChange={e => setEditSerial(s => s && { ...s, serial: e.target.value })}
                  placeholder="Nhập mã serial hoặc IMEI"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea value={editSerial.notes} onChange={e => setEditSerial(s => s && { ...s, notes: e.target.value })}
                  rows={3} placeholder="Ghi chú về tình trạng bảo hành..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditSerial(null)} disabled={savingSerial}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Hủy</button>
              <button onClick={handleSaveSerial} disabled={savingSerial}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {savingSerial && <Spinner />}{savingSerial ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {extendTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Gia hạn bảo hành</h2>
            <p className="text-sm text-gray-600">
              <strong>{extendTarget.productName}</strong><br />
              Hết hạn hiện tại: <strong>{fmt(extendTarget.endDate)}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Số tháng gia hạn thêm</label>
              <input type="number" min={1} max={120} value={extendMonths} onChange={e => setExtendMonths(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExtendTarget(null)} disabled={extending}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Hủy</button>
              <button onClick={handleExtend} disabled={extending}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {extending && <Spinner />}{extending ? 'Đang gia hạn...' : 'Gia hạn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Yêu Cầu Bảo Hành ─────────────────────────────────────────────────

function YeuCauTab({ showToast }: { showToast: (m: string, t?: ToastType) => void }) {
  const [data, setData] = useState<WarrantyRequest[]>([]);
  const [kpi, setKpi] = useState<WarrantyRequestKpi>({ total: 0, pending: 0, inProgress: 0, done: 0, returned: 0, rejected: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Product search dropdown
  const [productQuery, setProductQuery] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [showProductDrop, setShowProductDrop] = useState(false);
  const productSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchProducts(q: string) {
    setProductQuery(q);
    setCreateForm(f => ({ ...f, productName: q, productCode: '', productId: undefined }));
    setShowProductDrop(true);
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    if (!q.trim()) { setProductSuggestions([]); return; }
    productSearchTimer.current = setTimeout(async () => {
      try {
        const res = await productsApi.getAll({ search: q, isActive: 'true', limit: '10' });
        setProductSuggestions((res as any).data ?? res);
      } catch { setProductSuggestions([]); }
    }, 300);
  }

  function selectProduct(p: any) {
    setProductQuery(p.name);
    setCreateForm(f => ({ ...f, productName: p.name, productCode: p.code, productId: p.id }));
    setProductSuggestions([]);
    setShowProductDrop(false);
  }

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{
    customerName: string; productName: string; productCode: string; productId?: number;
    serial: string; issueDescription: string; receivedDate: string;
    estimatedReturnDate: string; notes: string;
  }>({
    customerName: '', productName: '', productCode: '', serial: '',
    issueDescription: '', receivedDate: localDateStr(), estimatedReturnDate: '', notes: '',
  });

  // Detail / update modal
  const [selected, setSelected] = useState<WarrantyRequest | null>(null);
  const [updateForm, setUpdateForm] = useState<{
    status: string; resolution: string; resolutionNote: string;
    estimatedReturnDate: string; actualReturnDate: string; notes: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = page, q = search, s = statusFilter) => {
    setLoading(true); setError('');
    try {
      const res = await warrantyRequestsApi.getAll({ q: q || undefined, status: s === 'all' ? undefined : s, page: p, limit });
      setData(res.data); setKpi(res.kpi); setTotal(res.total);
    } catch {
      setError('Không thể tải danh sách yêu cầu bảo hành');
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, []);

  function handleSearch(q: string) { setSearch(q); setPage(1); load(1, q, statusFilter); }
  function handleStatus(s: string) { setStatusFilter(s); setPage(1); load(1, search, s); }
  function handlePage(p: number) { setPage(p); load(p, search, statusFilter); }

  function openCreate() {
    setCreateForm({ customerName: '', productName: '', productCode: '', serial: '', issueDescription: '', receivedDate: localDateStr(), estimatedReturnDate: '', notes: '' });
    setProductQuery(''); setProductSuggestions([]); setShowProductDrop(false);
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!createForm.issueDescription.trim()) { showToast('Vui lòng nhập mô tả lỗi', 'error'); return; }
    if (!createForm.receivedDate) { showToast('Vui lòng chọn ngày tiếp nhận', 'error'); return; }
    setCreating(true);
    try {
      await warrantyRequestsApi.create({
        customerName: createForm.customerName || undefined,
        productId: createForm.productId,
        productName: createForm.productName || undefined,
        productCode: createForm.productCode || undefined,
        serial: createForm.serial || undefined,
        issueDescription: createForm.issueDescription,
        receivedDate: createForm.receivedDate,
        estimatedReturnDate: createForm.estimatedReturnDate || undefined,
        notes: createForm.notes || undefined,
      });
      showToast('Đã tạo yêu cầu bảo hành');
      setShowCreate(false); load();
    } catch (e: any) { showToast(e.message || 'Lỗi khi tạo', 'error'); }
    finally { setCreating(false); }
  }

  function openUpdate(r: WarrantyRequest) {
    setSelected(r);
    setUpdateForm({
      status: r.status,
      resolution: r.resolution ?? '',
      resolutionNote: r.resolutionNote ?? '',
      estimatedReturnDate: r.estimatedReturnDate ?? '',
      actualReturnDate: r.actualReturnDate ?? '',
      notes: r.notes ?? '',
    });
  }

  async function handleUpdate() {
    if (!selected || !updateForm || saving) return;
    setSaving(true);
    try {
      await warrantyRequestsApi.update(selected.id, {
        status: updateForm.status,
        resolution: updateForm.resolution || undefined,
        resolutionNote: updateForm.resolutionNote || undefined,
        estimatedReturnDate: updateForm.estimatedReturnDate || undefined,
        actualReturnDate: updateForm.actualReturnDate || undefined,
        notes: updateForm.notes || undefined,
      });
      showToast('Đã cập nhật yêu cầu bảo hành');
      setSelected(null); setUpdateForm(null); load();
    } catch (e: any) { showToast(e.message || 'Lỗi khi cập nhật', 'error'); }
    finally { setSaving(false); }
  }

  const totalPages = Math.ceil(total / limit);
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400';
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Tổng',         value: kpi.total,      cls: 'bg-slate-600' },
          { label: 'Chờ xử lý',    value: kpi.pending,    cls: 'bg-amber-500' },
          { label: 'Đang xử lý',   value: kpi.inProgress, cls: 'bg-blue-500' },
          { label: 'Hoàn thành',   value: kpi.done,       cls: 'bg-green-500' },
          { label: 'Đã trả KH',    value: kpi.returned,   cls: 'bg-teal-500' },
          { label: 'Từ chối',      value: kpi.rejected,   cls: 'bg-red-500' },
        ].map(k => (
          <div key={k.label} className={`${k.cls} text-white rounded-xl p-4`}>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-white/70 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Tìm theo mã YBH, khách hàng, sản phẩm, serial..."
          className="flex-1 min-w-48 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white" />
        <select value={statusFilter} onChange={e => handleStatus(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400">
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ xử lý</option>
          <option value="in_progress">Đang xử lý</option>
          <option value="done">Hoàn thành</option>
          <option value="returned">Đã trả KH</option>
          <option value="rejected">Từ chối BH</option>
        </select>
        <button onClick={openCreate}
          className="h-9 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tiếp nhận mới
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Đang tải...</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">
            {error} <button onClick={() => load()} className="ml-2 underline">Thử lại</button>
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Không có yêu cầu bảo hành nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã YBH</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sản phẩm / Serial</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Khách hàng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mô tả lỗi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Ngày tiếp nhận</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Trạng thái</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(r => {
                const s = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.pending;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => openUpdate(r)} className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors">
                        {r.code}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[160px]">{r.productName ?? <span className="text-gray-400 italic text-xs">Chưa nhập</span>}</div>
                      {r.serial && <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.serial}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{r.customerName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <div className="truncate" title={r.issueDescription}>{r.issueDescription}</div>
                      {r.resolution && <div className="text-xs text-gray-400 mt-0.5">{RESOLUTION_LABELS[r.resolution] ?? r.resolution}</div>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{fmt(r.receivedDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openUpdate(r)} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        Cập nhật
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} yêu cầu · trang {page}/{totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">‹</button>
            <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">›</button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Tiếp nhận yêu cầu bảo hành</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Khách hàng</label>
                  <input value={createForm.customerName} onChange={e => setCreateForm(f => ({ ...f, customerName: e.target.value }))}
                    placeholder="Tên khách hàng" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Serial / IMEI</label>
                  <input value={createForm.serial} onChange={e => setCreateForm(f => ({ ...f, serial: e.target.value }))}
                    placeholder="Mã serial hoặc IMEI" className={`${inputCls} font-mono`} />
                </div>
              </div>
              {/* Product search */}
              <div>
                <label className={labelCls}>Sản phẩm</label>
                <div className="relative">
                  <input
                    value={productQuery}
                    onChange={e => searchProducts(e.target.value)}
                    onFocus={() => productQuery && setShowProductDrop(true)}
                    onBlur={() => setTimeout(() => setShowProductDrop(false), 150)}
                    placeholder="Tìm tên hoặc mã sản phẩm..."
                    className={inputCls}
                  />
                  {createForm.productCode && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {createForm.productCode}
                    </span>
                  )}
                  {showProductDrop && productSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {productSuggestions.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => selectProduct(p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900 truncate">{p.name}</span>
                          <span className="font-mono text-xs text-gray-400 flex-shrink-0">{p.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showProductDrop && productQuery && productSuggestions.length === 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm text-gray-400">
                      Không tìm thấy sản phẩm
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Mô tả lỗi <span className="text-red-500">*</span></label>
                <textarea value={createForm.issueDescription} onChange={e => setCreateForm(f => ({ ...f, issueDescription: e.target.value }))}
                  rows={3} placeholder="Mô tả triệu chứng / lỗi khách hàng phản ánh..."
                  className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ngày tiếp nhận <span className="text-red-500">*</span></label>
                  <input type="date" value={createForm.receivedDate} onChange={e => setCreateForm(f => ({ ...f, receivedDate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ngày dự kiến trả</label>
                  <input type="date" value={createForm.estimatedReturnDate} onChange={e => setCreateForm(f => ({ ...f, estimatedReturnDate: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Ghi chú nội bộ</label>
                <input value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ghi chú thêm..." className={inputCls} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} disabled={creating}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Hủy</button>
              <button onClick={handleCreate} disabled={creating}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {creating && <Spinner />}{creating ? 'Đang tạo...' : 'Tạo yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {selected && updateForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Cập nhật yêu cầu bảo hành</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selected.code}</p>
              </div>
              <button onClick={() => { setSelected(null); setUpdateForm(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Info summary */}
            <div className="px-6 pt-4 pb-2 bg-gray-50 border-b border-gray-100 text-sm space-y-1 text-gray-600">
              <div><strong>SP:</strong> {selected.productName ?? '—'} {selected.serial && <span className="font-mono text-xs bg-gray-200 px-1 rounded">{selected.serial}</span>}</div>
              <div><strong>KH:</strong> {selected.customerName ?? '—'}</div>
              <div><strong>Lỗi:</strong> {selected.issueDescription}</div>
              <div><strong>Tiếp nhận:</strong> {fmt(selected.receivedDate)} {selected.receivedByName && `· ${selected.receivedByName}`}</div>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
              <div>
                <label className={labelCls}>Trạng thái</label>
                <select value={updateForm.status} onChange={e => setUpdateForm(f => f && { ...f, status: e.target.value })} className={inputCls}>
                  <option value="pending">Chờ xử lý</option>
                  <option value="in_progress">Đang xử lý</option>
                  <option value="done">Hoàn thành</option>
                  <option value="returned">Đã trả KH</option>
                  <option value="rejected">Từ chối BH</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Kết quả xử lý</label>
                <select value={updateForm.resolution} onChange={e => setUpdateForm(f => f && { ...f, resolution: e.target.value })} className={inputCls}>
                  <option value="">— Chưa chọn —</option>
                  <option value="repaired">Đã sửa xong</option>
                  <option value="replaced">Đổi sản phẩm mới</option>
                  <option value="rejected">Từ chối bảo hành</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ghi chú kết quả</label>
                <textarea value={updateForm.resolutionNote} onChange={e => setUpdateForm(f => f && { ...f, resolutionNote: e.target.value })}
                  rows={2} placeholder="Chi tiết kết quả xử lý..." className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ngày dự kiến trả</label>
                  <input type="date" value={updateForm.estimatedReturnDate} onChange={e => setUpdateForm(f => f && { ...f, estimatedReturnDate: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ngày trả thực tế</label>
                  <input type="date" value={updateForm.actualReturnDate} onChange={e => setUpdateForm(f => f && { ...f, actualReturnDate: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Ghi chú nội bộ</label>
                <input value={updateForm.notes} onChange={e => setUpdateForm(f => f && { ...f, notes: e.target.value })}
                  placeholder="Ghi chú thêm..." className={inputCls} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setSelected(null); setUpdateForm(null); }} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Hủy</button>
              <button onClick={handleUpdate} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Spinner />}{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
