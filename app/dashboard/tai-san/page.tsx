'use client';

import { useState, useEffect, useCallback } from 'react';
import { assetsApi, Asset, AssetDetail, AssetKpi, DepreciationLog, RunDepreciationResult } from '@/lib/assets';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function fmtMoneyShort(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString('vi-VN');
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const TYPE_MAP: Record<string, { label: string; cls: string }> = {
  TSCD:     { label: 'TSCĐ',         cls: 'bg-blue-100 text-blue-700' },
  TSCD_OTO: { label: 'TSCĐ - Ô Tô', cls: 'bg-indigo-100 text-indigo-700' },
  CCDC:     { label: 'CCDC',         cls: 'bg-teal-100 text-teal-700' },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active:       { label: 'Đang dùng',   cls: 'bg-green-100 text-green-700' },
  expiringSoon: { label: 'Sắp hết KH',  cls: 'bg-amber-100 text-amber-700' },
  expired_kh:   { label: 'Đã KH đủ',   cls: 'bg-slate-100 text-slate-600' },
  disposed:     { label: 'Đã thanh lý', cls: 'bg-red-100 text-red-700' },
};

function assetRuntimeStatus(a: Asset): string {
  if (a.status === 'disposed') return 'disposed';
  if (a.monthsDepreciated >= a.depreciationMonths) return 'expired_kh';
  if (a.monthsLeft <= 2 && a.monthsLeft > 0) return 'expiringSoon';
  return 'active';
}

type Tab = 'tai-san' | 'lich-su-kh';
type ToastType = 'success' | 'error';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaiSanPage() {
  const [tab, setTab] = useState<Tab>('tai-san');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');

  // Asset list
  const [assets, setAssets] = useState<Asset[]>([]);
  const [kpi, setKpi] = useState<AssetKpi | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const LIMIT = 20;

  // Log list
  const [logs, setLogs] = useState<DepreciationLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logLoading, setLogLoading] = useState(false);
  const [logTotalAmount, setLogTotalAmount] = useState(0);
  const [logFromMonth, setLogFromMonth] = useState('');
  const [logToMonth, setLogToMonth] = useState('');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [detailAsset, setDetailAsset] = useState<AssetDetail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState<Asset | null>(null);
  const [runKhOpen, setRunKhOpen] = useState(false);

  function showToast(msg: string, type: ToastType = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 3500);
  }

  const loadAssets = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await assetsApi.getAll({ q: q || undefined, type: filterType || undefined, status: filterStatus || undefined, page: p, limit: LIMIT });
      setAssets(res.data); setTotal(res.total); setKpi(res.kpi); setPage(p);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [q, filterType, filterStatus]);

  useEffect(() => { loadAssets(1); }, [loadAssets]);

  const loadLogs = useCallback(async (p = 1) => {
    setLogLoading(true);
    try {
      const res = await assetsApi.getLogs({ fromMonth: logFromMonth || undefined, toMonth: logToMonth || undefined, page: p, limit: 50 });
      setLogs(res.data); setLogTotal(res.total); setLogTotalAmount(res.totalAmount); setLogPage(p);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLogLoading(false); }
  }, [logFromMonth, logToMonth]);

  useEffect(() => { if (tab === 'lich-su-kh') loadLogs(1); }, [tab, loadLogs]);

  async function openDetail(id: number) {
    try {
      const d = await assetsApi.getOne(id);
      setDetailAsset(d); setEditMode(false);
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const logTotalPages = Math.ceil(logTotal / 50);

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toastType === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tài Sản & CCDC</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý tài sản cố định và công cụ dụng cụ, theo dõi khấu hao</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRunKhOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Chạy Khấu Hao
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm Tài Sản
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="text-xs font-medium opacity-80 mb-1">TSCĐ đang dùng</div>
            <div className="text-2xl font-bold">{kpi.tscdCount}</div>
            <div className="text-xs opacity-70 mt-1">Nguyên giá: {fmtMoneyShort(kpi.tscdTotalCost)}đ</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
            <div className="text-xs font-medium opacity-80 mb-1">KH/tháng (TSCĐ)</div>
            <div className="text-xl font-bold">{fmtMoneyShort(kpi.tscdMonthlyKH)}đ</div>
            <div className="text-xs opacity-70 mt-1">Đã KH đủ: {kpi.tscdExpiredKH} tài sản</div>
          </div>
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
            <div className="text-xs font-medium opacity-80 mb-1">CCDC đang dùng</div>
            <div className="text-2xl font-bold">{kpi.ccdcCount}</div>
            <div className="text-xs opacity-70 mt-1">Nguyên giá: {fmtMoneyShort(kpi.ccdcTotalCost)}đ</div>
          </div>
          <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 text-white">
            <div className="text-xs font-medium opacity-80 mb-1">KH/tháng (CCDC)</div>
            <div className="text-xl font-bold">{fmtMoneyShort(kpi.ccdcMonthlyKH)}đ</div>
            <div className="text-xs opacity-70 mt-1">Đã KH đủ: {kpi.ccdcExpiredKH} CCDC</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['tai-san', 'Danh Sách Tài Sản'], ['lich-su-kh', 'Lịch Sử Khấu Hao']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Danh sách ── */}
      {tab === 'tai-san' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Tìm mã, tên, số HĐ..."
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Tất cả loại</option>
              <option value="TSCD">TSCĐ</option>
              <option value="TSCD_OTO">TSCĐ - Ô Tô</option>
              <option value="CCDC">CCDC</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang dùng</option>
              <option value="expiringSoon">Sắp hết KH (≤2 tháng)</option>
              <option value="expired_kh">Đã KH đủ</option>
              <option value="disposed">Đã thanh lý</option>
            </select>
            {(q || filterType || filterStatus) && (
              <button onClick={() => { setQ(''); setFilterType(''); setFilterStatus(''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">
                Xóa filter
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs font-medium">
                  <th className="text-left px-4 py-3">Mã</th>
                  <th className="text-left px-4 py-3">Tên tài sản</th>
                  <th className="text-left px-4 py-3">Loại</th>
                  <th className="text-right px-4 py-3">Nguyên giá</th>
                  <th className="text-right px-4 py-3">Còn lại</th>
                  <th className="text-center px-4 py-3">Tiến độ KH</th>
                  <th className="text-left px-4 py-3">Bắt đầu KH</th>
                  <th className="text-center px-4 py-3">Trạng thái</th>
                  <th className="text-center px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12"><div className="flex justify-center"><Spinner /></div></td></tr>
                ) : assets.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Chưa có tài sản nào</td></tr>
                ) : assets.map(a => {
                  const rs = assetRuntimeStatus(a);
                  const sm = STATUS_MAP[rs] ?? STATUS_MAP.active;
                  const tm = TYPE_MAP[a.type] ?? TYPE_MAP.TSCD;
                  return (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => openDetail(a.id)}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{a.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 max-w-[180px] truncate">{a.name}</div>
                        {a.department && <div className="text-xs text-gray-400">{a.department}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${tm.cls}`}>{tm.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{fmtMoneyShort(Number(a.originalCost))}đ</td>
                      <td className="px-4 py-3 text-right">
                        {a.status === 'disposed'
                          ? <span className="text-xs text-gray-400">Đã TL</span>
                          : <span className="font-medium text-gray-700">{fmtMoneyShort(a.remainingCost)}đ</span>}
                      </td>
                      <td className="px-4 py-3">
                        {a.status !== 'disposed' && (
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${a.progressPercent}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-7 text-right">{a.progressPercent}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(a.depreciationStartDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {a.status !== 'disposed' && (
                          <button onClick={() => setDisposeOpen(a)}
                            className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                            Thanh lý
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Tổng {total} tài sản</span>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => loadAssets(page - 1)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-40">‹</button>
                  <span className="px-3 py-1.5 text-xs text-gray-600">{page}/{totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => loadAssets(page + 1)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-40">›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Lịch sử KH ── */}
      {tab === 'lich-su-kh' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Từ tháng:</label>
              <input type="month" value={logFromMonth} onChange={e => setLogFromMonth(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Đến tháng:</label>
              <input type="month" value={logToMonth} onChange={e => setLogToMonth(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            {logTotalAmount > 0 && (
              <div className="ml-auto text-sm font-medium text-gray-700">
                Tổng KH: <span className="text-blue-600 font-bold">{fmtMoney(logTotalAmount)}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs font-medium">
                  <th className="text-left px-4 py-3">Mã KH</th>
                  <th className="text-left px-4 py-3">Tài sản</th>
                  <th className="text-center px-4 py-3">Kỳ</th>
                  <th className="text-right px-4 py-3">Số tiền KH</th>
                  <th className="text-left px-4 py-3">Người chạy</th>
                  <th className="text-left px-4 py-3">Ngày ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {logLoading ? (
                  <tr><td colSpan={6} className="text-center py-12"><div className="flex justify-center"><Spinner /></div></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Chưa có bản ghi khấu hao</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-medium">{l.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{l.assetName}</div>
                      <div className="text-xs text-gray-400 font-mono">{l.assetCode}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">T{l.month}/{l.year}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtMoney(l.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{l.runByName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(l.createdAt).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Tổng {logTotal} bản ghi</span>
                <div className="flex items-center gap-1">
                  <button disabled={logPage <= 1} onClick={() => loadLogs(logPage - 1)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-40">‹</button>
                  <span className="px-3 py-1.5 text-xs text-gray-600">{logPage}/{logTotalPages}</span>
                  <button disabled={logPage >= logTotalPages} onClick={() => loadLogs(logPage + 1)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-40">›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {createOpen && (
        <CreateAssetModal onClose={() => setCreateOpen(false)}
          onDone={(msg) => { showToast(msg); loadAssets(1); }} />
      )}
      {detailAsset && (
        <DetailAssetModal asset={detailAsset} editMode={editMode}
          onToggleEdit={() => setEditMode(e => !e)}
          onClose={() => { setDetailAsset(null); setEditMode(false); }}
          onDone={(msg, type) => { showToast(msg, type); loadAssets(page); openDetail(detailAsset.id); }} />
      )}
      {disposeOpen && (
        <DisposeModal asset={disposeOpen} onClose={() => setDisposeOpen(null)}
          onDone={(msg) => { showToast(msg); loadAssets(1); setDisposeOpen(null); }} />
      )}
      {runKhOpen && (
        <RunDepreciationModal onClose={() => setRunKhOpen(false)}
          onDone={(msg) => { showToast(msg); loadAssets(1); if (tab === 'lich-su-kh') loadLogs(1); }} />
      )}
    </div>
  );
}

// ─── Modal: Tạo tài sản ──────────────────────────────────────────────────────

function CreateAssetModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'TSCD', originalCost: '', purchaseDate: '',
    depreciationMonths: '', depreciationStartDate: '',
    sourceInvoiceCode: '', category: '', department: '', notes: '',
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const cost = Number(form.originalCost);
  const months = Number(form.depreciationMonths);
  const depreciableCost = form.type === 'TSCD_OTO' && cost > 1_600_000_000 ? 1_600_000_000 : cost;
  const monthlyKh = cost && months ? Math.round(depreciableCost / months) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    setSaving(true);
    try {
      const res = await assetsApi.create({
        name: form.name, type: form.type,
        originalCost: cost, purchaseDate: form.purchaseDate,
        depreciationMonths: months,
        depreciationStartDate: form.depreciationStartDate,
        sourceInvoiceCode: form.sourceInvoiceCode || undefined,
        category: form.category || undefined,
        department: form.department || undefined,
        notes: form.notes || undefined,
      });
      onDone(`Đã tạo tài sản ${res.asset.code}${res.warning ? ' — ' + res.warning : ''}`);
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">Thêm Tài Sản / CCDC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-xl">{err}</div>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loại tài sản <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {[['TSCD', 'TSCĐ'], ['TSCD_OTO', 'TSCĐ - Ô Tô'], ['CCDC', 'CCDC']].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => set('type', val)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${form.type === val ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên tài sản <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required
              placeholder="Máy tính Dell Latitude, Xe Toyota Fortuner..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nguyên giá (₫) <span className="text-red-500">*</span></label>
              <input type="number" value={form.originalCost} onChange={e => set('originalCost', e.target.value)} required min={1}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              {form.type === 'TSCD_OTO' && cost > 1_600_000_000 && (
                <div className="text-xs text-amber-600 mt-1">Ô tô: KH tính trên 1,6 tỷ</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Số tháng KH <span className="text-red-500">*</span></label>
              <input type="number" value={form.depreciationMonths} onChange={e => set('depreciationMonths', e.target.value)} required min={1} max={600}
                placeholder="36, 60, 96..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {monthlyKh > 0 && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
              KH hàng tháng dự kiến: <span className="font-bold">{new Intl.NumberFormat('vi-VN').format(monthlyKh)}₫</span>
              {depreciableCost !== cost && ` (tính trên ${new Intl.NumberFormat('vi-VN').format(depreciableCost)}₫)`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ngày mua <span className="text-red-500">*</span></label>
              <input type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bắt đầu KH <span className="text-red-500">*</span></label>
              <input type="date" value={form.depreciationStartDate} onChange={e => set('depreciationStartDate', e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="text-xs text-gray-400 mt-1">Phải là ngày 01 của tháng</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phòng ban</label>
              <input value={form.department} onChange={e => set('department', e.target.value)}
                placeholder="Kế toán, Kho, Văn phòng..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục</label>
              <input value={form.category} onChange={e => set('category', e.target.value)}
                placeholder="Máy tính, Xe cộ, Thiết bị..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Số HĐ mua</label>
            <input value={form.sourceInvoiceCode} onChange={e => set('sourceInvoiceCode', e.target.value)}
              placeholder="HĐ-001..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {saving && <Spinner />}
              Thêm tài sản
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Chi tiết / Sửa ───────────────────────────────────────────────────

function DetailAssetModal({ asset, editMode, onToggleEdit, onClose, onDone }: {
  asset: AssetDetail;
  editMode: boolean;
  onToggleEdit: () => void;
  onClose: () => void;
  onDone: (msg: string, type?: ToastType) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: asset.name,
    category: asset.category ?? '',
    department: asset.department ?? '',
    notes: asset.notes ?? '',
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      await assetsApi.update(asset.id, {
        name: form.name,
        category: form.category || undefined,
        department: form.department || undefined,
        notes: form.notes || undefined,
      });
      onDone('Đã cập nhật tài sản');
    } catch (e: any) { onDone(e.message, 'error'); }
    finally { setSaving(false); }
  }

  const rs = asset.status === 'disposed' ? 'disposed'
    : asset.monthsDepreciated >= asset.depreciationMonths ? 'expired_kh'
    : asset.monthsLeft <= 2 ? 'expiringSoon'
    : 'active';
  const sm = STATUS_MAP[rs] ?? STATUS_MAP.active;
  const tm = TYPE_MAP[asset.type] ?? TYPE_MAP.TSCD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-sm font-bold text-blue-600 flex-shrink-0">{asset.code}</span>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${tm.cls}`}>{tm.label}</span>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium flex-shrink-0 ${sm.cls}`}>{sm.label}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {asset.status !== 'disposed' && (
              <button onClick={onToggleEdit}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${editMode ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                {editMode ? 'Hủy sửa' : 'Sửa'}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Edit form */}
          {editMode ? (
            <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tên tài sản</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phòng ban</label>
                  <input value={form.department} onChange={e => set('department', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục</label>
                  <input value={form.category} onChange={e => set('category', e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Spinner />}
                Lưu thay đổi
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Tên tài sản" value={asset.name} />
              <InfoRow label="Loại" value={tm.label} />
              <InfoRow label="Ngày mua" value={fmtDate(asset.purchaseDate)} />
              <InfoRow label="Số HĐ mua" value={asset.sourceInvoiceCode} />
              <InfoRow label="Phòng ban" value={asset.department} />
              <InfoRow label="Danh mục" value={asset.category} />
              {asset.notes && <div className="col-span-2"><InfoRow label="Ghi chú" value={asset.notes} /></div>}
              {asset.status === 'disposed' && (
                <>
                  <InfoRow label="Ngày thanh lý" value={fmtDate(asset.disposedDate)} />
                  <InfoRow label="Lý do TL" value={asset.disposedNote} />
                </>
              )}
            </div>
          )}

          {/* KH Info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông Tin Khấu Hao</div>
            <div className="grid grid-cols-3 gap-3">
              <KpiMini label="Nguyên giá" value={fmtMoney(Number(asset.originalCost))} />
              <KpiMini label="Giá KH" value={fmtMoney(Number(asset.depreciableCost))} />
              <KpiMini label="KH / tháng" value={fmtMoney(Number(asset.monthlyDepreciation))} />
              <KpiMini label="Đã KH" value={`${asset.monthsDepreciated}/${asset.depreciationMonths} tháng`} />
              <KpiMini label="Giá trị còn lại" value={asset.status === 'disposed' ? 'Đã thanh lý' : fmtMoney(asset.remainingCost)} />
              <KpiMini label="Bắt đầu KH" value={fmtDate(asset.depreciationStartDate)} />
            </div>
            {asset.status !== 'disposed' && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Tiến độ khấu hao</span>
                  <span>{asset.progressPercent}% · còn {asset.monthsLeft} tháng</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${asset.progressPercent}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Log history */}
          {asset.depreciationLogs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Lịch Sử Khấu Hao ({asset.depreciationLogs.length} kỳ)
              </div>
              <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Mã KH</th>
                      <th className="text-center px-3 py-2 text-gray-400 font-medium">Kỳ</th>
                      <th className="text-right px-3 py-2 text-gray-400 font-medium">Số tiền</th>
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Ngày</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.depreciationLogs.map(l => (
                      <tr key={l.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 font-mono text-indigo-600">{l.code}</td>
                        <td className="px-3 py-2 text-center font-medium text-gray-700">T{l.month}/{l.year}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">{fmtMoney(l.amount)}</td>
                        <td className="px-3 py-2 text-gray-400">{new Date(l.createdAt).toLocaleDateString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Thanh lý ──────────────────────────────────────────────────────────

function DisposeModal({ asset, onClose, onDone }: { asset: Asset; onClose: () => void; onDone: (msg: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [disposedDate, setDisposedDate] = useState(localDateStr());
  const [disposedNote, setDisposedNote] = useState('');

  async function handleDispose() {
    setSaving(true);
    try {
      await assetsApi.dispose(asset.id, { disposedDate, disposedNote: disposedNote || undefined });
      onDone(`Đã thanh lý tài sản ${asset.code}`);
    } catch (e: any) { onDone('Lỗi: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Thanh Lý Tài Sản</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
            Xác nhận thanh lý <strong>{asset.code} — {asset.name}</strong>? Không thể hoàn tác.
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ngày thanh lý</label>
            <input type="date" value={disposedDate} onChange={e => setDisposedDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lý do / ghi chú</label>
            <textarea value={disposedNote} onChange={e => setDisposedNote(e.target.value)} rows={2}
              placeholder="Hỏng hóc, thanh lý thu hồi vốn..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
            <button onClick={handleDispose} disabled={saving}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {saving && <Spinner />}
              Xác nhận thanh lý
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Chạy Khấu Hao ────────────────────────────────────────────────────

function RunDepreciationModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunDepreciationResult | null>(null);
  const [err, setErr] = useState('');

  async function handleRun() {
    setRunning(true); setErr(''); setResult(null);
    try {
      const r = await assetsApi.runDepreciation({ month, year });
      setResult(r);
      onDone(`KH T${month}/${year}: ${r.processed} tài sản, tổng ${new Intl.NumberFormat('vi-VN').format(r.totalAmount)}đ`);
    } catch (e: any) { setErr(e.message); }
    finally { setRunning(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => !running && e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Chạy Khấu Hao Tháng</h2>
          {!running && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-gray-600">
                Chọn kỳ khấu hao. Hệ thống sẽ xử lý tất cả tài sản đang hoạt động trong kỳ KH, tự động tạo phiếu chi liên kết.
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tháng</label>
                  <select value={month} onChange={e => setMonth(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Năm</label>
                  <select value={year} onChange={e => setYear(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-xl">{err}</div>}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                Mỗi tháng chỉ chạy 1 lần. Chạy lại cùng kỳ sẽ bỏ qua tài sản đã xử lý (idempotent).
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
                <button onClick={handleRun} disabled={running}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                  {running ? <><Spinner /><span>Đang chạy...</span></> : `Chạy KH T${month}/${year}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="text-sm font-semibold text-green-700 mb-2">✓ Hoàn thành KH T{month}/{year}</div>
                <div className="grid grid-cols-3 gap-2 text-xs text-green-600 mb-2">
                  <div>Đã xử lý: <strong>{result.processed}</strong></div>
                  <div>Bỏ qua: <strong>{result.skipped}</strong></div>
                  <div>Lỗi: <strong className={result.errors.length > 0 ? 'text-red-600' : ''}>{result.errors.length}</strong></div>
                </div>
                <div className="text-sm font-bold text-green-800">
                  Tổng KH: {fmtMoney(result.totalAmount)}
                </div>
              </div>
              {result.details.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {result.details.map(d => (
                    <div key={d.assetId} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-mono text-blue-600 flex-shrink-0">{d.code}</span>
                      <span className="text-gray-600 truncate flex-1">{d.name}</span>
                      <span className="font-bold text-gray-800 flex-shrink-0">{new Intl.NumberFormat('vi-VN').format(d.amount)}đ</span>
                    </div>
                  ))}
                </div>
              )}
              {result.skippedList.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                  <strong>Bỏ qua:</strong> {result.skippedList.map(s => `${s.code} (${s.reason})`).join(' · ')}
                </div>
              )}
              <button onClick={onClose} className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium">Đóng</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 font-medium">{value || '—'}</div>
    </div>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl px-3 py-2 border border-gray-100">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-xs font-bold text-gray-800">{value}</div>
    </div>
  );
}
