'use client';

import { useEffect, useState, useCallback } from 'react';
import { capitalApi, breakEvenApi } from '@/lib/capital';
import type { CapitalDashboard, CapitalHistory, CapitalConfig, BreakEvenResult, BreakEvenDetail, HealthState } from '@/lib/capital';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
function localNow() { const d = new Date(); return { month: d.getMonth() + 1, year: d.getFullYear() }; }

const HEALTH: Record<HealthState, { label: string; dot: string; text: string; bg: string; ring: string }> = {
  AN_TOAN:       { label: 'An Toàn',         dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  CANH_BAO:      { label: 'Cảnh Báo',         dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'ring-amber-200' },
  NGUY_HIEM:     { label: 'Nguy Hiểm',        dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      ring: 'ring-red-200' },
  CHUA_CAU_HINH: { label: 'Chưa thiết lập',   dot: 'bg-gray-400',    text: 'text-gray-500',    bg: 'bg-gray-50',     ring: 'ring-gray-200' },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2.5 ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${type === 'success' ? 'bg-white/20' : 'bg-white/20'}`}>{type === 'success' ? '✓' : '!'}</span>
      {msg}
    </div>
  );
}

// ─── Modal Cập nhật VĐL ───────────────────────────────────────────────────────
function UpdateCapitalModal({ current, onClose, onSaved }: { current: number; onClose: () => void; onSaved: () => void }) {
  const [rawAmount, setRawAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const newAmt = Number(rawAmount) || 0;
  const diff = newAmt - current;
  const changeType = current === 0 ? 'FIRST_TIME' : diff > 0 ? 'INCREASE' : 'DECREASE';
  const needsReason = current > 0;
  const canNext = !!newAmt && newAmt !== current && (!needsReason || reason.trim().length >= 10);

  async function handleSubmit() {
    setSaving(true); setError('');
    try { await capitalApi.updateCapital({ newAmount: newAmt, reason: reason || undefined }); onSaved(); onClose(); }
    catch (e: any) { setError(e.message); setSaving(false); setStep('form'); }
  }

  const inp = 'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-800">{current === 0 ? 'Thiết lập Vốn Điều Lệ' : 'Cập nhật Vốn Điều Lệ'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{current === 0 ? 'Lần đầu thiết lập — không cần lý do' : `Hiện tại: ${fmt(current)}`}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-2"><span className="mt-0.5 shrink-0">⚠</span>{error}</div>}

          {step === 'form' ? (<>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-widest">Vốn Điều Lệ mới (VND)</label>
              <input type="text" inputMode="numeric" className={inp}
                value={rawAmount ? Number(rawAmount).toLocaleString('vi-VN') : ''}
                onChange={e => setRawAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ví dụ: 500.000.000" autoFocus />
            </div>
            {newAmt > 0 && newAmt !== current && (
              <div className="flex items-center gap-3 px-3.5 py-3 bg-blue-50 rounded-xl text-sm">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${changeType === 'FIRST_TIME' ? 'bg-blue-100 text-blue-700' : changeType === 'INCREASE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {changeType === 'FIRST_TIME' ? 'Lần đầu' : changeType === 'INCREASE' ? '↑ Tăng vốn' : '↓ Giảm vốn'}
                </span>
                {changeType !== 'FIRST_TIME' && <span className={`font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>}
              </div>
            )}
            {needsReason && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-widest">Lý do thay đổi <span className="text-red-400">*</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  className={`${inp} resize-none`} placeholder="Ghi rõ lý do (tối thiểu 10 ký tự)..." />
                <div className={`text-xs mt-1.5 flex items-center gap-1 ${reason.length < 10 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${reason.length < 10 ? 'bg-amber-100' : 'bg-emerald-100'}`}>{reason.length < 10 ? '!' : '✓'}</span>
                  {reason.length}/10 ký tự tối thiểu
                </div>
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 font-medium">Hủy</button>
              <button disabled={!canNext} onClick={() => setStep('confirm')}
                className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Tiếp tục →
              </button>
            </div>
          </>) : (<>
            <div className="px-4 py-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800 font-medium mb-1">Xác nhận thay đổi</p>
              <p className="text-sm text-amber-700">
                {current > 0 ? `${fmt(current)} → ` : ''}<strong>{fmt(newAmt)}</strong>
              </p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setStep('form')} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 font-medium">← Quay lại</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Xác nhận'}
              </button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

// ─── Modal Config ─────────────────────────────────────────────────────────────
function ConfigModal({ config, onClose, onSaved }: { config: CapitalConfig; onClose: () => void; onSaved: () => void }) {
  const [threshold, setThreshold] = useState(config.threshold);
  const [inApp, setInApp] = useState(config.inAppAlert);
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    setSaving(true);
    try { await capitalApi.updateConfig({ threshold, inAppAlert: inApp, emailAlert: false }); onSaved(); onClose(); }
    catch { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Cấu Hình Cảnh Báo</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Ngưỡng cảnh báo</label>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{threshold}%</span>
            </div>
            <input type="range" min={100} max={200} step={5} value={threshold}
              onChange={e => setThreshold(Number(e.target.value))} className="w-full accent-blue-600 h-1.5" />
            <div className="flex justify-between text-xs text-gray-400 mt-2"><span>100%</span><span>150%</span><span>200%</span></div>
            <p className="text-xs text-gray-400 mt-2">Cảnh báo khi Tài Sản Ròng ≤ {threshold}% × Vốn Điều Lệ</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 border border-gray-100">
            <input type="checkbox" checked={inApp} onChange={e => setInApp(e.target.checked)} className="w-4 h-4 mt-0.5 accent-blue-600" />
            <div>
              <div className="text-sm font-medium text-gray-700">Badge cảnh báo trên sidebar</div>
              <div className="text-xs text-gray-400 mt-0.5">Chấm đỏ trên mục Kế Toán khi Tài Sản Ròng nguy hiểm</div>
            </div>
          </label>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 font-medium">Hủy</button>
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

  if (!dashboard) return <div className="flex items-center justify-center py-16 text-sm text-gray-400">Đang tải...</div>;

  const h = HEALTH[dashboard.healthState];
  const notSetup = dashboard.healthState === 'CHUA_CAU_HINH';
  const tasRatio = dashboard.capitalAmount > 0 ? Math.min(150, dashboard.tasRong / dashboard.capitalAmount * 100) : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showUpdate && <UpdateCapitalModal current={dashboard.capitalAmount} onClose={() => setShowUpdate(false)}
        onSaved={() => { onRefresh(); reloadHistory(); setToast({ msg: 'Đã cập nhật Vốn Điều Lệ', type: 'success' }); }} />}
      {showConfig && config && <ConfigModal config={config} onClose={() => setShowConfig(false)}
        onSaved={() => { capitalApi.getConfig().then(setConfig).catch(() => {}); setToast({ msg: 'Đã lưu cấu hình', type: 'success' }); }} />}

      {/* ── Empty-state khi chưa thiết lập ─────────────────────────────── */}
      {notSetup ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-5">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-xl flex-shrink-0">🏦</div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-800 mb-1">Chưa thiết lập Vốn Điều Lệ</h3>
            <p className="text-sm text-gray-500 mb-4">Nhập vốn điều lệ để hệ thống tính toán sức khoẻ tài chính và điểm hoà vốn chính xác hơn.</p>
            <button onClick={() => setShowUpdate(true)}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
              Thiết lập ngay →
            </button>
          </div>
          <div className="text-right flex-shrink-0">
            <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">↻ Làm mới</button>
          </div>
        </div>
      ) : (
        /* ── Header bar khi đã có VĐL ───────────────────────────────────── */
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 text-sm font-semibold ${h.bg} ${h.ring} ${h.text}`}>
            <span className={`w-2 h-2 rounded-full ${h.dot} ${dashboard.healthState === 'NGUY_HIEM' ? 'animate-pulse' : ''}`} />
            {h.label}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1.5">↻ Làm mới</button>
            {config && <button onClick={() => setShowConfig(true)} className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1.5">⚙ Cấu hình</button>}
            <button onClick={() => setShowUpdate(true)} className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700">Cập nhật VĐL</button>
          </div>
        </div>
      )}

      {/* ── Alert banner ─────────────────────────────────────────────────── */}
      {(dashboard.healthState === 'NGUY_HIEM' || dashboard.healthState === 'CANH_BAO') && (
        <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm ${h.bg} ring-1 ${h.ring}`}>
          <span className="text-base flex-shrink-0">{dashboard.healthState === 'NGUY_HIEM' ? '🔴' : '⚠️'}</span>
          <div>
            <p className={`font-semibold ${h.text}`}>
              {dashboard.healthState === 'NGUY_HIEM' ? 'Tài Sản Ròng thấp hơn Vốn Điều Lệ — cần xử lý ngay' : 'Tài Sản Ròng đang tiếp cận ngưỡng cảnh báo'}
            </p>
            <p className={`text-xs mt-0.5 opacity-80 ${h.text}`}>
              TAS: {fmt(dashboard.tasRong)} / VĐL: {fmt(dashboard.capitalAmount)} ({fmtPct(dashboard.tasRong / dashboard.capitalAmount * 100)})
            </p>
          </div>
        </div>
      )}

      {/* ── Main KPI ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Vốn Điều Lệ', value: fmt(dashboard.capitalAmount), sub: 'Vốn đăng ký', icon: '💰', color: 'bg-blue-600', light: 'bg-blue-50 text-blue-600' },
          { label: 'Tài Sản Ròng', value: fmt(dashboard.tasRong), sub: `${notSetup ? '—' : (dashboard.diff >= 0 ? '▲ ' : '▼ ') + fmt(Math.abs(dashboard.diff))}`, icon: '📊',
            color: dashboard.healthState === 'AN_TOAN' ? 'bg-emerald-600' : dashboard.healthState === 'NGUY_HIEM' ? 'bg-red-600' : 'bg-amber-500',
            light: dashboard.healthState === 'AN_TOAN' ? 'bg-emerald-50 text-emerald-600' : dashboard.healthState === 'NGUY_HIEM' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600' },
          { label: 'Tổng Tài Sản', value: fmt(dashboard.totalAssets), sub: '4 loại tài sản', icon: '🏗', color: 'bg-slate-600', light: 'bg-slate-50 text-slate-600' },
          { label: 'Tổng Nợ', value: fmt(dashboard.totalDebt), sub: 'Phải trả + vay nợ', icon: '📋', color: 'bg-orange-600', light: 'bg-orange-50 text-orange-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${c.light}`}>{c.icon}</div>
              <div className={`w-1 h-8 rounded-full ${c.color} opacity-20`} />
            </div>
            <div className="text-base font-bold text-gray-800 leading-tight">{c.value}</div>
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <span className={`font-medium ${c.light.split(' ')[1]}`}>{c.label}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar TAS vs VĐL ──────────────────────────────────────── */}
      {!notSetup && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Tài Sản Ròng so với Vốn Điều Lệ</span>
            <span className={`text-sm font-bold ${h.text}`}>{fmtPct(Math.max(0, dashboard.tasRong / dashboard.capitalAmount * 100))}</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
            {/* ngưỡng cảnh báo */}
            <div className="absolute top-0 h-full w-px bg-amber-400 z-10" style={{ left: `${Math.min(100, dashboard.threshold)}%` }} title={`Ngưỡng ${dashboard.threshold}%`} />
            {/* VĐL baseline */}
            <div className="absolute top-0 h-full w-px bg-blue-400 z-10" style={{ left: '66.67%' }} title="100% VĐL" />
            <div
              className={`h-full rounded-full transition-all ${dashboard.healthState === 'AN_TOAN' ? 'bg-emerald-500' : dashboard.healthState === 'NGUY_HIEM' ? 'bg-red-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, tasRatio / 1.5)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>0₫</span>
            <span className="text-amber-500">⚑ Ngưỡng CB {dashboard.threshold}%</span>
            <span className="text-blue-500">■ VĐL 100%</span>
            <span>{fmtPct(150)}</span>
          </div>
        </div>
      )}

      {/* ── Breakdown panels ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Assets */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Tài Sản</span>
            <span className="text-sm font-semibold text-emerald-600">{fmt(dashboard.totalAssets)}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {dashboard.breakdown.assets.map((a, i) => {
              const icons = ['💵', '📦', '🏭', '🤝'];
              const pct = dashboard.totalAssets > 0 ? a.amount / dashboard.totalAssets * 100 : 0;
              return (
                <div key={a.label} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{icons[i] || '•'}</span>{a.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{fmt(a.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Debts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">Nợ Phải Trả</span>
            <span className="text-sm font-semibold text-red-600">{fmt(dashboard.totalDebt)}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {dashboard.breakdown.debts.map((d, i) => {
              const icons = ['🏪', '🏦'];
              const pct = dashboard.totalDebt > 0 ? d.amount / dashboard.totalDebt * 100 : 0;
              return (
                <div key={d.label} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{icons[i] || '•'}</span>{d.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{fmt(d.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
            {/* Padding khi ít rows hơn bên trái */}
            {dashboard.breakdown.debts.length < dashboard.breakdown.assets.length && (
              Array.from({ length: dashboard.breakdown.assets.length - dashboard.breakdown.debts.length }).map((_, i) => (
                <div key={i} className="px-5 py-3 opacity-0 pointer-events-none"><div className="h-6" /></div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Lịch sử ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <span className="text-sm font-bold text-gray-700">Lịch Sử Thay Đổi VĐL</span>
        </div>
        {historyData.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Chưa có thay đổi nào</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {historyData.map(h => (
              <div key={h.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.changeType === 'FIRST_TIME' ? 'bg-blue-400' : h.changeType === 'INCREASE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="font-mono text-xs text-blue-600 w-36 flex-shrink-0">{h.code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${h.changeType === 'FIRST_TIME' ? 'bg-blue-50 text-blue-600' : h.changeType === 'INCREASE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {h.changeType === 'FIRST_TIME' ? 'Lần đầu' : h.changeType === 'INCREASE' ? '↑ Tăng' : '↓ Giảm'}
                </span>
                <span className="text-xs font-semibold text-gray-700 flex-shrink-0">{fmt(h.newAmount)}</span>
                <span className="text-xs text-gray-400 flex-1 truncate">{h.reason || <span className="italic">Không có lý do</span>}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{new Date(h.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Phân Tích Hoà Vốn ────────────────────────────────────────────────
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
    try { const r = await breakEvenApi.calc(m, y); setResult(r); }
    catch { setResult(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { doCalc(now.month, now.year); }, []); // eslint-disable-line

  async function loadDetail() {
    try { const d = await breakEvenApi.detail(month, year); setDetail(d); setShowDetail(true); }
    catch { /* ignore */ }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.year - i);
  const ok = result?.ok === true ? result : null;
  const err = result?.ok === false ? result : null;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Period selector ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-600">Kỳ phân tích:</span>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => doCalc(month, year)} disabled={loading}
          className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-all flex items-center gap-2">
          {loading ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang tính...</> : '⚡ Tính'}
        </button>
        {ok && (
          <span className={`ml-auto text-xs px-3 py-1.5 rounded-full font-semibold ${ok.state === 'S2' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {ok.state === 'S2' ? `✅ Tháng ${month}/${year}: Đã vượt hoà vốn` : `📉 Tháng ${month}/${year}: Chưa hoà vốn`}
          </span>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 flex items-center justify-center gap-3 text-sm text-gray-400">
          <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Đang tính toán điểm hoà vốn...
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {!loading && err && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">!</span>
            <div>
              <p className="text-sm font-bold text-red-700">Không thể tính điểm hoà vốn</p>
              <p className="text-xs text-red-500 mt-0.5">{err.error}</p>
            </div>
          </div>
          {Object.keys(err.partialData).length > 0 && (
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {err.partialData.chiPhiCoDinh !== undefined && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400">Chi phí cố định</div>
                  <div className="text-sm font-bold text-gray-700 mt-0.5">{fmt(err.partialData.chiPhiCoDinh)}</div>
                </div>
              )}
              {err.partialData.doanhThuThangNay !== undefined && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-400">Doanh thu tháng</div>
                  <div className="text-sm font-bold text-gray-700 mt-0.5">{fmt(err.partialData.doanhThuThangNay)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Success: KPI 5 card ───────────────────────────────────────── */}
      {!loading && ok && (<>
        {ok.warnings.length > 0 && (
          <div className="space-y-2">
            {ok.warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-2.5 rounded-xl text-sm border ${w.startsWith('W03') || w.startsWith('W04') ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                <span className="flex-shrink-0 mt-0.5">{w.startsWith('W03') || w.startsWith('W04') ? '⚠' : 'ℹ'}</span>
                <span>{w.replace(/^W\d+: /, '')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Chi Phí Cố Định', value: fmt(ok.chiPhiCoDinh), sub: 'Click để chi tiết', emoji: '🔧', color: 'border-gray-200', hdr: 'bg-gray-50 text-gray-600', clickable: true },
            { label: `Biên LN Gộp`, sub: `Avg ${ok.n} tháng`, value: fmtPct(ok.bienLNGopPct), emoji: '📈', color: 'border-blue-100', hdr: 'bg-blue-50 text-blue-600' },
            { label: 'Doanh Thu Hoà Vốn', value: fmt(ok.breakEven), sub: 'cần đạt', emoji: '🎯', color: 'border-orange-100', hdr: 'bg-orange-50 text-orange-600' },
            {
              label: 'Doanh Thu Tháng', value: fmt(ok.doanhThuThangNay), sub: `${ok.doanhThuThangNay >= ok.breakEven ? '✓ Đủ' : '✗ Chưa đủ'}`,
              emoji: ok.doanhThuThangNay >= ok.breakEven ? '✅' : '📉',
              color: ok.doanhThuThangNay >= ok.breakEven ? 'border-emerald-100' : 'border-red-100',
              hdr: ok.doanhThuThangNay >= ok.breakEven ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
            },
            {
              label: 'Còn Thiếu', value: ok.conThieu > 0 ? fmt(ok.conThieu) : '—', sub: ok.conThieu > 0 ? 'để hoà vốn' : '✓ Đã hoà vốn',
              emoji: ok.conThieu > 0 ? '⚡' : '🎉',
              color: ok.conThieu > 0 ? 'border-red-100' : 'border-emerald-100',
              hdr: ok.conThieu > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
            },
          ].map(c => (
            <div key={c.label}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${c.color} ${(c as any).clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              onClick={(c as any).clickable ? loadDetail : undefined}>
              <div className={`px-4 py-2 text-xs font-semibold flex items-center justify-between ${c.hdr}`}>
                <span>{c.label}</span><span className="text-base">{c.emoji}</span>
              </div>
              <div className="px-4 py-3">
                <div className="text-sm font-bold text-gray-800 leading-tight">{c.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Drill-down CPCD ───────────────────────────────────────────── */}
        {showDetail && detail && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <span className="text-sm font-bold text-gray-700">Chi Tiết Chi Phí Cố Định — T{month}/{year}</span>
              <button onClick={() => setShowDetail(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-sm">✕</button>
            </div>
            <div className="divide-y divide-gray-50">
              {detail.chiTiet.map((r, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${r.source === 'Khấu Hao' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{r.source}</span>
                  <span className="text-xs text-gray-600 flex-1">{r.category}</span>
                  <span className="text-xs font-semibold text-gray-800">{fmt(r.amount)}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{detail.tongChiPhiCoDinh > 0 ? fmtPct(r.amount / detail.tongChiPhiCoDinh * 100) : '—'}</span>
                </div>
              ))}
              <div className="px-5 py-3 flex items-center gap-3 bg-gray-50">
                <span className="text-xs font-bold text-gray-700 flex-1">Tổng</span>
                <span className="text-xs font-bold text-gray-800">{fmt(detail.tongChiPhiCoDinh)}</span>
                <span className="w-10" />
              </div>
            </div>
          </div>
        )}

        {/* ── Cửa sổ biên LN ────────────────────────────────────────────── */}
        {ok.cuaSoThang.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
              <span className="text-sm font-bold text-gray-700">Cửa Sổ Biên Lợi Nhuận Gộp</span>
              <span className="text-xs text-gray-400 ml-2">{ok.n} tháng trước T{month}/{year}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ok.cuaSoThang.map((mo, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm">
                  <span className="text-xs text-gray-400 w-14 flex-shrink-0 font-medium">T{mo.month}/{mo.year}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, mo.pct)}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">{fmt(mo.revenue)}</span>
                  <span className="text-xs font-semibold text-blue-600 w-12 text-right">{fmtPct(mo.pct)}</span>
                </div>
              ))}
              <div className="px-5 py-3 flex items-center gap-4 bg-blue-50">
                <span className="text-xs font-bold text-gray-700 w-14">TB</span>
                <div className="flex-1" />
                <span className="text-xs text-gray-500 w-20 text-right" />
                <span className="text-xs font-bold text-blue-600 w-12 text-right">{fmtPct(ok.bienLNGopPct)}</span>
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VonBreakEvenPage() {
  const [tab, setTab] = useState<'vdl' | 'breakeven'>('vdl');
  const [dashboard, setDashboard] = useState<CapitalDashboard | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadDashboard = useCallback(async () => {
    try { const d = await capitalApi.getDashboard(); setDashboard(d); setLoadError(''); }
    catch (e: any) { setLoadError(e.message || 'Không thể tải dữ liệu'); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const tabCls = (active: boolean) =>
    `px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${active ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-100 shrink-0">
        <h1 className="text-base font-bold text-gray-800">Vốn Điều Lệ & Phân Tích Hoà Vốn</h1>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">Quản trị tài chính — Admin & Kế Toán</p>
        <div className="bg-gray-100 rounded-xl p-1 inline-flex gap-1">
          <button onClick={() => setTab('vdl')} className={tabCls(tab === 'vdl')}>📊 Vốn Điều Lệ</button>
          <button onClick={() => setTab('breakeven')} className={tabCls(tab === 'breakeven')}>⚡ Phân Tích Hoà Vốn</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        {loadError && tab === 'vdl' ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-600">
            <span>⚠</span><span>{loadError}</span>
            <button onClick={loadDashboard} className="ml-auto underline text-red-500 hover:text-red-700">Thử lại</button>
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
