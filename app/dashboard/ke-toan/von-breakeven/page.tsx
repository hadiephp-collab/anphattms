'use client';

import { useEffect, useState, useCallback } from 'react';
import { capitalApi, breakEvenApi } from '@/lib/capital';
import type { CapitalDashboard, CapitalHistory, CapitalConfig, BreakEvenResult, BreakEvenDetail, HealthState } from '@/lib/capital';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function localNow() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

const HEALTH_CONFIG: Record<HealthState, { label: string; color: string; bg: string; border: string }> = {
  AN_TOAN:       { label: 'An Toàn ✓',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CANH_BAO:      { label: '⚠ Cảnh Báo',       color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  NGUY_HIEM:     { label: '🔴 Nguy Hiểm',      color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  CHUA_CAU_HINH: { label: 'Chưa Thiết Lập',    color: 'text-gray-500',    bg: 'bg-gray-50',    border: 'border-gray-200' },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? '✓' : '✕'} {msg}
    </div>
  );
}

// ─── Modal Cập nhật VĐL ───────────────────────────────────────────────────────

function UpdateCapitalModal({ current, onClose, onSaved }: {
  current: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rawAmount, setRawAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const newAmt = Number(rawAmount) || 0;
  const diff = newAmt - current;
  const changeType = current === 0 ? 'FIRST_TIME' : diff > 0 ? 'INCREASE' : diff < 0 ? 'DECREASE' : '';
  const needsReason = current > 0;

  async function handleSubmit() {
    setSaving(true); setError('');
    try {
      await capitalApi.updateCapital({ newAmount: newAmt, reason: reason || undefined });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message); setSaving(false); setStep('form');
    }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Cập Nhật Vốn Điều Lệ</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>}
          {step === 'form' ? (
            <>
              <div>
                <div className="text-xs text-gray-500 mb-1">Hiện tại</div>
                <div className="text-lg font-bold text-gray-800">{current > 0 ? fmt(current) : '— Chưa thiết lập'}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Vốn Điều Lệ mới (VND) <span className="text-red-500">*</span>
                </label>
                <input type="text" inputMode="numeric"
                  value={rawAmount ? Number(rawAmount).toLocaleString('vi-VN') : ''}
                  onChange={e => setRawAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Nhập số tiền..." className={inputCls} />
              </div>
              {newAmt > 0 && newAmt !== current && (
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm space-y-1">
                  <div>Chênh lệch: <span className={diff >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span></div>
                  {changeType && <div>Loại: <span className="font-semibold">{changeType === 'FIRST_TIME' ? 'Thiết lập lần đầu' : changeType === 'INCREASE' ? 'Tăng vốn' : 'Giảm vốn'}</span></div>}
                </div>
              )}
              {needsReason && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Lý do <span className="text-red-500">*</span>
                  </label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    placeholder="Ghi rõ lý do thay đổi (tối thiểu 10 ký tự)..."
                    className={`${inputCls} resize-none`} />
                  <div className={`text-xs mt-1 ${reason.length < 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                    {reason.length}/10 ký tự tối thiểu
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Hủy</button>
                <button disabled={!newAmt || newAmt === current || (needsReason && reason.trim().length < 10)}
                  onClick={() => setStep('confirm')}
                  className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                  Tiếp tục
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                Xác nhận cập nhật VĐL từ <strong>{fmt(current)}</strong> thành <strong>{fmt(newAmt)}</strong>?
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('form')} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Quay lại</button>
                <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal Cấu hình cảnh báo ──────────────────────────────────────────────────

function ConfigModal({ config, onClose, onSaved }: {
  config: CapitalConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [threshold, setThreshold] = useState(config.threshold);
  const [inApp, setInApp] = useState(config.inAppAlert);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await capitalApi.updateConfig({ threshold, inAppAlert: inApp, emailAlert: false });
      onSaved();
      onClose();
    } catch { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Cấu Hình Cảnh Báo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ngưỡng cảnh báo: <span className="text-blue-600">{threshold}%</span>
            </label>
            <input type="range" min={100} max={200} step={5} value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>100%</span><span>150%</span><span>200%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Cảnh báo khi Tài Sản Ròng ≤ {threshold}% × Vốn Điều Lệ</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={inApp} onChange={e => setInApp(e.target.checked)} className="w-4 h-4" />
            <div>
              <div className="text-sm font-medium text-gray-700">Hiển thị badge trên sidebar</div>
              <div className="text-xs text-gray-400">Badge đỏ khi Tài Sản Ròng ở mức Nguy Hiểm</div>
            </div>
          </label>
          {!inApp && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Tắt badge — bạn sẽ không thấy cảnh báo trực quan trên sidebar</p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Hủy</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Vốn Điều Lệ ──────────────────────────────────────────────────────

function TabVDL({ dashboard, onRefresh }: { dashboard: CapitalDashboard | null; onRefresh: () => void }) {
  const [historyData, setHistoryData] = useState<CapitalHistory[]>([]);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<CapitalConfig | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const reloadHistory = useCallback(() => {
    capitalApi.getHistory({ size: 20 }).then((r: any) => setHistoryData(r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    reloadHistory();
    capitalApi.getConfig().then(setConfig).catch(() => {});
  }, [reloadHistory]);

  const health = dashboard ? HEALTH_CONFIG[dashboard.healthState] : null;

  if (!dashboard) {
    return <div className="text-sm text-gray-400 py-8 text-center">Đang tải...</div>;
  }

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showUpdate && (
        <UpdateCapitalModal current={dashboard.capitalAmount} onClose={() => setShowUpdate(false)}
          onSaved={() => { onRefresh(); reloadHistory(); setToast({ msg: 'Đã cập nhật Vốn Điều Lệ', type: 'success' }); }} />
      )}
      {showConfig && config && (
        <ConfigModal config={config} onClose={() => setShowConfig(false)}
          onSaved={() => { capitalApi.getConfig().then(setConfig).catch(() => {}); setToast({ msg: 'Đã lưu cấu hình', type: 'success' }); }} />
      )}

      {/* Action bar */}
      <div className="flex justify-end gap-2">
        <button onClick={onRefresh} className="px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">↻ Làm mới</button>
        {config && <button onClick={() => setShowConfig(true)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">⚙ Cấu hình</button>}
        <button onClick={() => setShowUpdate(true)} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700">Cập nhật VĐL</button>
      </div>

      {/* Alert banner */}
      {(dashboard.healthState === 'NGUY_HIEM' || dashboard.healthState === 'CANH_BAO') && health && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${health.bg} ${health.border} ${health.color}`}>
          {dashboard.healthState === 'NGUY_HIEM'
            ? '⚠️ Tài Sản Ròng thấp hơn Vốn Điều Lệ — Cần xử lý ngay'
            : '⚠ Tài Sản Ròng đang tiếp cận ngưỡng Vốn Điều Lệ'}
        </div>
      )}

      {/* KPI row 1 — 3 card lớn */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Vốn Điều Lệ', value: fmt(dashboard.capitalAmount), bg: 'from-blue-600 to-blue-700' },
          {
            label: 'Tài Sản Ròng', value: fmt(dashboard.tasRong),
            bg: dashboard.healthState === 'AN_TOAN' ? 'from-emerald-600 to-emerald-700'
              : dashboard.healthState === 'NGUY_HIEM' ? 'from-red-600 to-red-700'
              : 'from-amber-500 to-amber-600',
          },
          {
            label: 'Chênh Lệch', value: (dashboard.diff >= 0 ? '+' : '') + fmt(dashboard.diff),
            bg: dashboard.diff >= 0 ? 'from-teal-600 to-teal-700' : 'from-red-500 to-red-600',
          },
        ].map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 text-white`}>
            <div className="text-xs font-medium opacity-80 mb-1">{c.label}</div>
            <div className="text-xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* KPI row 2 — 3 card nhỏ */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng Tài Sản', value: fmt(dashboard.totalAssets), bg: 'from-gray-600 to-gray-700' },
          { label: 'Tổng Nợ Phải Trả', value: fmt(dashboard.totalDebt), bg: 'from-orange-600 to-orange-700' },
          { label: `Ngưỡng CB (${dashboard.threshold}%)`, value: fmt(dashboard.threshold / 100 * dashboard.capitalAmount), bg: 'from-purple-600 to-purple-700' },
        ].map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-4 text-white`}>
            <div className="text-xs font-medium opacity-80 mb-1">{c.label}</div>
            <div className="text-base font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Health badge */}
      {health && (
        <div className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-semibold ${health.bg} ${health.border} ${health.color}`}>
          {health.label}
        </div>
      )}

      {/* Breakdown panels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 mb-4">Tài Sản</h4>
          <div className="space-y-4">
            {dashboard.breakdown.assets.map(a => (
              <div key={a.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-600">{a.label}</span>
                  <span className="font-semibold text-gray-800">{fmt(a.amount)}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${dashboard.totalAssets > 0 ? Math.min(100, a.amount / dashboard.totalAssets * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
              <span>Tổng</span><span className="text-emerald-600">{fmt(dashboard.totalAssets)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-bold text-gray-700 mb-4">Nợ Phải Trả</h4>
          <div className="space-y-4">
            {dashboard.breakdown.debts.map(d => (
              <div key={d.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-600">{d.label}</span>
                  <span className="font-semibold text-gray-800">{fmt(d.amount)}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full transition-all"
                    style={{ width: `${dashboard.totalDebt > 0 ? Math.min(100, d.amount / dashboard.totalDebt * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
              <span>Tổng</span><span className="text-red-600">{fmt(dashboard.totalDebt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lịch sử */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h4 className="text-sm font-bold text-gray-700 mb-3">Lịch Sử Thay Đổi VĐL</h4>
        {historyData.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có thay đổi nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Mã</th>
                  <th className="text-left pb-2 font-medium">Ngày</th>
                  <th className="text-right pb-2 font-medium">Từ</th>
                  <th className="text-right pb-2 font-medium">Thành</th>
                  <th className="text-left pb-2 font-medium pl-3">Loại</th>
                  <th className="text-left pb-2 font-medium">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map(h => (
                  <tr key={h.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-mono text-xs text-blue-600">{h.code}</td>
                    <td className="py-2 text-gray-500 text-xs">{new Date(h.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="py-2 text-right text-gray-600">{h.oldAmount > 0 ? fmt(h.oldAmount) : '—'}</td>
                    <td className="py-2 text-right font-semibold">{fmt(h.newAmount)}</td>
                    <td className="py-2 pl-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        h.changeType === 'FIRST_TIME' ? 'bg-blue-100 text-blue-700'
                        : h.changeType === 'INCREASE' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {h.changeType === 'FIRST_TIME' ? 'Lần đầu' : h.changeType === 'INCREASE' ? 'Tăng vốn' : 'Giảm vốn'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500 text-xs max-w-[180px] truncate">{h.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: BreakEven ─────────────────────────────────────────────────────────

function TabBreakEven() {
  const now = localNow();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const [result, setResult] = useState<BreakEvenResult | null>(null);
  const [detail, setDetail] = useState<BreakEvenDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [loading, setLoading] = useState(false);

  const doCalc = useCallback(async (m: number, y: number) => {
    setLoading(true); setDetail(null); setShowDetail(false);
    try {
      const r = await breakEvenApi.calc(m, y);
      setResult(r);
    } catch { setResult(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { doCalc(now.month, now.year); }, []); // eslint-disable-line

  async function loadDetail() {
    try {
      const d = await breakEvenApi.detail(month, year);
      setDetail(d);
      setShowDetail(true);
    } catch { /* ignore */ }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.year - i);

  return (
    <div className="space-y-5">
      {/* Kỳ selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Kỳ phân tích:</span>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>Tháng {m}</option>
          ))}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => doCalc(month, year)} disabled={loading}
          className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Đang tính...' : 'Tính'}
        </button>
      </div>

      {loading && <div className="text-sm text-gray-400 py-6 text-center">Đang tính toán điểm hoà vốn...</div>}

      {!loading && result && !result.ok && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h4 className="font-bold text-red-700 mb-2">Không thể tính điểm hoà vốn</h4>
          <p className="text-sm text-red-600 mb-3">{result.error}</p>
          {result.partialData && Object.keys(result.partialData).length > 0 && (
            <div className="text-sm text-red-700 space-y-1 border-t border-red-200 pt-3">
              {result.partialData.chiPhiCoDinh !== undefined && (
                <div>Chi phí cố định: <strong>{fmt(result.partialData.chiPhiCoDinh)}</strong></div>
              )}
              {result.partialData.doanhThuThangNay !== undefined && (
                <div>Doanh thu tháng này: <strong>{fmt(result.partialData.doanhThuThangNay)}</strong></div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && result && result.ok && (
        <>
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className={`px-4 py-2.5 rounded-xl text-sm flex items-start gap-2 ${
                  w.startsWith('W03') || w.startsWith('W04')
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-blue-50 border border-blue-100 text-blue-700'
                }`}>
                  <span className="shrink-0">{w.startsWith('W03') || w.startsWith('W04') ? '⚠' : 'ℹ'}</span>
                  <span>{w.replace(/^W\d+: /, '')}</span>
                </div>
              ))}
            </div>
          )}

          {/* State message */}
          <div className={`px-5 py-4 rounded-2xl border text-center font-semibold text-sm ${
            result.state === 'S2' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {result.state === 'S2'
              ? `✅ Đã vượt điểm hoà vốn tháng ${month}/${year}`
              : `📉 Cần bán thêm ${fmt(result.conThieu)} để hoà vốn tháng ${month}/${year}`}
          </div>

          {/* KPI 5 card */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Chi Phí Cố Định', value: fmt(result.chiPhiCoDinh), bg: 'from-gray-600 to-gray-700', hint: 'Xem chi tiết →', onClick: loadDetail },
              { label: `Biên LN Gộp (${result.n}T)`, value: fmtPct(result.bienLNGopPct), bg: 'from-blue-600 to-blue-700' },
              { label: 'Doanh Thu Hoà Vốn', value: fmt(result.breakEven), bg: 'from-orange-600 to-orange-700' },
              {
                label: 'Doanh Thu Tháng', value: fmt(result.doanhThuThangNay),
                bg: result.doanhThuThangNay >= result.breakEven ? 'from-emerald-600 to-emerald-700' : 'from-red-600 to-red-700',
              },
              {
                label: 'Còn Thiếu', value: result.conThieu > 0 ? fmt(result.conThieu) : '✓ Đã hoà vốn',
                bg: result.conThieu > 0 ? 'from-red-600 to-red-700' : 'from-emerald-600 to-emerald-700',
              },
            ].map(c => (
              <div key={c.label}
                className={`bg-gradient-to-br ${c.bg} rounded-2xl p-4 text-white ${(c as any).onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
                onClick={(c as any).onClick}>
                <div className="text-xs font-medium opacity-80 mb-1">{c.label}</div>
                <div className="text-sm font-bold leading-tight">{c.value}</div>
                {(c as any).hint && <div className="text-xs opacity-60 mt-1">{(c as any).hint}</div>}
              </div>
            ))}
          </div>

          {/* Drill-down CPCD */}
          {showDetail && detail && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700">Chi Tiết Chi Phí Cố Định — Tháng {month}/{year}</h4>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
              <div className="p-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Danh mục</th>
                      <th className="text-right pb-2 font-medium">Số tiền</th>
                      <th className="text-right pb-2 font-medium">Tỷ trọng</th>
                      <th className="text-left pb-2 font-medium pl-4">Nguồn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.chiTiet.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-gray-700">{r.category}</td>
                        <td className="py-2 text-right font-semibold">{fmt(r.amount)}</td>
                        <td className="py-2 text-right text-gray-500">
                          {detail.tongChiPhiCoDinh > 0 ? fmtPct(r.amount / detail.tongChiPhiCoDinh * 100) : '—'}
                        </td>
                        <td className="py-2 pl-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            r.source === 'Khấu Hao' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                          }`}>{r.source}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-sm border-t border-gray-200">
                      <td className="pt-3">Tổng</td>
                      <td className="pt-3 text-right">{fmt(detail.tongChiPhiCoDinh)}</td>
                      <td /><td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Cửa sổ biên LN */}
          {result.cuaSoThang.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h4 className="text-sm font-bold text-gray-700 mb-3">
                Cửa Sổ Biên Lợi Nhuận Gộp — {result.n} tháng trước tháng {month}/{year}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Tháng</th>
                      <th className="text-right pb-2 font-medium">Doanh Thu HĐ VAT</th>
                      <th className="text-right pb-2 font-medium">Giá Vốn BQ</th>
                      <th className="text-right pb-2 font-medium">Biên LN%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cuaSoThang.map((mo, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-gray-600">T{mo.month}/{mo.year}</td>
                        <td className="py-2 text-right">{fmt(mo.revenue)}</td>
                        <td className="py-2 text-right text-gray-500">{fmt(mo.cost)}</td>
                        <td className="py-2 text-right font-semibold text-blue-600">{fmtPct(mo.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold border-t border-gray-200">
                      <td className="pt-3 text-gray-700">Trung bình</td>
                      <td /><td />
                      <td className="pt-3 text-right text-blue-600">{fmtPct(result.bienLNGopPct)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VonBreakEvenPage() {
  const [tab, setTab] = useState<'vdl' | 'breakeven'>('vdl');
  const [dashboard, setDashboard] = useState<CapitalDashboard | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const d = await capitalApi.getDashboard();
      setDashboard(d); setLoadError('');
    } catch (e: any) {
      setLoadError(e.message || 'Không thể tải dữ liệu');
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const tabCls = (active: boolean) =>
    `px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${active ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Vốn Điều Lệ & Phân Tích Hoà Vốn</h1>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">Quản trị tài chính — Admin & Kế Toán</p>
        <div className="bg-gray-100 rounded-xl p-1 inline-flex gap-1">
          <button onClick={() => setTab('vdl')} className={tabCls(tab === 'vdl')}>Vốn Điều Lệ</button>
          <button onClick={() => setTab('breakeven')} className={tabCls(tab === 'breakeven')}>Phân Tích Hoà Vốn</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {loadError && tab === 'vdl' ? (
          <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
            {loadError} — <button onClick={loadDashboard} className="underline">Thử lại</button>
          </div>
        ) : tab === 'vdl' ? (
          <TabVDL dashboard={dashboard} onRefresh={loadDashboard} />
        ) : (
          <TabBreakEven />
        )}
      </div>
    </div>
  );
}
