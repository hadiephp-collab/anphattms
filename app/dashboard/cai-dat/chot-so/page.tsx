'use client';

import { useEffect, useState, useCallback } from 'react';
import { kyKeToanApi, KyKeToan, ChecklistItem, KyKeToanAudit, SnapshotData } from '@/lib/ky-ke-toan';

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// ─── Checklist icon ─────────────────────────────────────────────────────────

function CkIcon({ item }: { item: ChecklistItem }) {
  if (item.passed) return <span className="text-green-500 font-bold">✓</span>;
  if (item.type === 'block') return <span className="text-red-500 font-bold">✗</span>;
  return <span className="text-amber-500 font-bold">⚠</span>;
}

// ─── Snapshot viewer ─────────────────────────────────────────────────────────

function SnapshotModal({ snap, onClose }: { snap: SnapshotData; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Doanh thu bán hàng', fmtVND(snap.doanhThuBanHang.doanhThu)],
    ['Số đơn bán (không huỷ)', snap.doanhThuBanHang.soDon.toString()],
    ['Đã thu tiền', fmtVND(snap.doanhThuBanHang.daThu)],
    ['---', '---'],
    ['Tổng thu (phiếu thu)', fmtVND(snap.thuChi.tongThu)],
    ['Tổng chi (phiếu chi)', fmtVND(snap.thuChi.tongChi)],
    ['Chênh lệch thu-chi', fmtVND(snap.thuChi.chenh)],
    ['---', '---'],
    ['VAT đầu ra', fmtVND(snap.vat.vatDauRa)],
    ['VAT đầu vào', fmtVND(snap.vat.vatDauVao)],
    ['VAT phải nộp', fmtVND(snap.vat.vatPhaiNop)],
    ['---', '---'],
    ['Tổng nhập hàng', fmtVND(snap.nhapHang.tongNhap)],
    ['---', '---'],
    ['Công nợ phải thu (tại thời điểm khóa)', fmtVND(snap.congNo.phaiThu)],
    ['Công nợ phải trả (tại thời điểm khóa)', fmtVND(snap.congNo.phaiTra)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Snapshot kỳ {snap.period.thang}/{snap.period.nam}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <p className="text-xs text-gray-400 mb-4">
            Chụp lúc: {fmtDate(snap.generatedAt)}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, value], i) =>
                label === '---' ? (
                  <tr key={i}><td colSpan={2} className="py-1"><hr /></td></tr>
                ) : (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-600">{label}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{value}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Audit log modal ─────────────────────────────────────────────────────────

function AuditModal({ maKy, onClose }: { maKy: string; onClose: () => void }) {
  const [logs, setLogs] = useState<KyKeToanAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kyKeToanApi.getAuditLog(maKy)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [maKy]);

  const actionLabel = (a: string) => ({
    TaoKy: 'Tạo kỳ', KhoaKy: 'Khóa kỳ', MoLaiKy: 'Mở lại',
    ChecklistRun: 'Kiểm tra', OverrideWarning: 'Bỏ qua cảnh báo',
  }[a] ?? a);

  const actionColor = (a: string) => ({
    TaoKy: 'bg-blue-100 text-blue-700',
    KhoaKy: 'bg-red-100 text-red-700',
    MoLaiKy: 'bg-amber-100 text-amber-700',
    ChecklistRun: 'bg-gray-100 text-gray-600',
  }[a] ?? 'bg-gray-100 text-gray-600');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Lịch sử kỳ {maKy}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <p className="text-center text-gray-400 py-8">Đang tải...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Chưa có lịch sử</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Thời gian</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Hành động</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-gray-500">{fmtDate(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(log.action)}`}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{log.username ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lock wizard modal ────────────────────────────────────────────────────────

function LockWizard({
  ky, onClose, onLocked,
}: {
  ky: KyKeToan;
  onClose: () => void;
  onLocked: (updated: KyKeToan) => void;
}) {
  const [step, setStep] = useState<'running' | 'results'>('running');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [overrideNote, setOverrideNote] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    kyKeToanApi.runChecklist(ky.maKy)
      .then(items => { setChecklist(items); setStep('results'); })
      .catch(e => { setError(String(e?.message ?? e)); setStep('results'); });
  }, [ky.maKy]);

  const hasBlocks = checklist.some(c => c.type === 'block' && !c.passed);
  const warnings = checklist.filter(c => c.type === 'warning' && !c.passed);
  const needsOverride = warnings.length > 0;
  const canProceed = !hasBlocks && (!needsOverride || overrideNote.trim().length >= 5);

  const handleLock = async () => {
    setLocking(true);
    setError('');
    try {
      const updated = await kyKeToanApi.lock(ky.maKy, {
        overrideNote: needsOverride ? overrideNote.trim() : undefined,
      });
      onLocked(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      setLocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Khóa kỳ {String(ky.thang).padStart(2, '0')}/{ky.nam}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {step === 'running' && (
            <div className="flex flex-col items-center py-10 gap-3 text-gray-500">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p>Đang kiểm tra checklist...</p>
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-3">
              {checklist.map(item => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    item.passed
                      ? 'border-green-100 bg-green-50'
                      : item.type === 'block'
                      ? 'border-red-100 bg-red-50'
                      : 'border-amber-100 bg-amber-50'
                  }`}
                >
                  <div className="text-lg mt-0.5"><CkIcon item={item} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    {!item.passed && (
                      <p className="text-xs mt-0.5 text-gray-600">
                        {item.count} mục{item.type === 'block'
                          ? ' — Bắt buộc xử lý trước khi khóa'
                          : ' — Có thể bỏ qua (cần ghi chú)'}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{item.id}</span>
                </div>
              ))}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {hasBlocks && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
                  Không thể khóa kỳ vì còn mục bắt buộc (✗) chưa hoàn thành.
                </div>
              )}

              {!hasBlocks && needsOverride && !confirmStep && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ghi chú bỏ qua cảnh báo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    placeholder="Lý do chấp nhận bỏ qua các cảnh báo trên (ít nhất 5 ký tự)..."
                    value={overrideNote}
                    onChange={e => setOverrideNote(e.target.value)}
                  />
                </div>
              )}

              {!hasBlocks && confirmStep && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Xác nhận khóa kỳ?</p>
                  <p className="text-xs text-amber-700">
                    Sau khi khóa, dữ liệu kỳ này sẽ được snapshot lại.
                    Bạn vẫn có thể mở lại nếu cần (phải ghi rõ lý do).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Hủy
          </button>

          {step === 'results' && !hasBlocks && !confirmStep && (
            <button
              onClick={() => setConfirmStep(true)}
              disabled={!canProceed}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              {needsOverride ? 'Tiếp tục với cảnh báo →' : 'Tiếp tục →'}
            </button>
          )}

          {step === 'results' && !hasBlocks && confirmStep && (
            <button
              onClick={handleLock}
              disabled={locking}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
            >
              {locking ? 'Đang khóa...' : '🔒 Xác nhận khóa kỳ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reopen modal ─────────────────────────────────────────────────────────────

function ReopenModal({
  ky, onClose, onReopened,
}: {
  ky: KyKeToan;
  onClose: () => void;
  onReopened: (updated: KyKeToan) => void;
}) {
  const [lyDo, setLyDo] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReopen = async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await kyKeToanApi.reopen(ky.maKy, { lyDo });
      onReopened(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Mở lại kỳ {String(ky.thang).padStart(2, '0')}/{ky.nam}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-5">
          {step === 1 && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Việc mở lại kỳ đã khóa có thể ảnh hưởng đến tính chính xác của báo cáo kế toán.
                Vui lòng ghi rõ lý do.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lý do mở lại <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">({lyDo.length}/20 ký tự tối thiểu)</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                rows={4}
                placeholder="Mô tả lý do cần mở lại kỳ này..."
                value={lyDo}
                onChange={e => setLyDo(e.target.value)}
              />
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800">⚠ Bạn có chắc chắn muốn mở lại?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Kỳ {String(ky.thang).padStart(2, '0')}/{ky.nam}
                  {ky.nguoiKhoa ? ` đã được khóa bởi ${ky.nguoiKhoa}` : ''}
                  {ky.ngayKhoa ? ` lúc ${fmtDate(ky.ngayKhoa)}` : ''}.
                  Hành động này sẽ được ghi vào nhật ký.
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <strong>Lý do:</strong> {lyDo}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Hủy
          </button>
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={lyDo.trim().length < 20}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              Tiếp tục →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleReopen}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
            >
              {loading ? 'Đang mở lại...' : 'Xác nhận mở lại'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (ky: KyKeToan) => void;
}) {
  const now = new Date();
  const [thang, setThang] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [nam, setNam] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const ky = await kyKeToanApi.create({ thang: +thang, nam: +nam });
      onCreate(ky);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Tạo kỳ kế toán mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tháng</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={thang}
                onChange={e => setThang(e.target.value)}
              >
                {MONTHS.map(m => <option key={m} value={m}>Tháng {m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Năm</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={nam}
                onChange={e => setNam(e.target.value)}
              >
                {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            Mã kỳ sẽ là: <strong>KY-{nam}{thang}</strong>
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
          >
            {loading ? 'Đang tạo...' : '+ Tạo kỳ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Modal =
  | { type: 'create' }
  | { type: 'lock'; ky: KyKeToan }
  | { type: 'reopen'; ky: KyKeToan }
  | { type: 'snapshot'; snap: SnapshotData }
  | { type: 'audit'; maKy: string };

export default function ChotSoPage() {
  const [kyList, setKyList] = useState<KyKeToan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await kyKeToanApi.getAll();
      setKyList(data);
    } catch {
      showToast('Không thể tải danh sách kỳ kế toán', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => setModal(null);

  const handleCreated = (ky: KyKeToan) => {
    setKyList(prev => [ky, ...prev]);
    closeModal();
    showToast(`Đã tạo kỳ ${ky.maKy}`);
  };

  const handleLocked = (updated: KyKeToan) => {
    setKyList(prev => prev.map(k => k.maKy === updated.maKy ? updated : k));
    closeModal();
    showToast(`Đã khóa kỳ ${updated.maKy} thành công`);
  };

  const handleReopened = (updated: KyKeToan) => {
    setKyList(prev => prev.map(k => k.maKy === updated.maKy ? updated : k));
    closeModal();
    showToast(`Đã mở lại kỳ ${updated.maKy}`);
  };

  const total = kyList.length;
  const dangMo = kyList.filter(k => k.trangThai === 'DangMo').length;
  const daKhoa = kyList.filter(k => k.trangThai === 'DaKhoa').length;
  const latestKy = kyList[0];

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chốt Sổ & Khóa Kỳ</h1>
            <p className="text-sm text-gray-500 mt-1">Quản lý các kỳ kế toán và khóa sổ theo tháng</p>
          </div>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span>+</span> Tạo kỳ mới
          </button>
        </div>

        {/* KPI bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">Tổng kỳ kế toán</p>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 shadow-sm p-4">
            <p className="text-xs text-blue-600 mb-1">Đang mở</p>
            <p className="text-2xl font-bold text-blue-700">{dangMo}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-white rounded-xl border border-green-100 shadow-sm p-4">
            <p className="text-xs text-green-600 mb-1">Đã khóa</p>
            <p className="text-2xl font-bold text-green-700">{daKhoa}</p>
          </div>
          <div className={`bg-white rounded-xl border shadow-sm p-4 ${
            !latestKy
              ? 'border-gray-100'
              : latestKy.trangThai === 'DaKhoa'
              ? 'bg-gradient-to-br from-green-50 to-white border-green-100'
              : 'bg-gradient-to-br from-amber-50 to-white border-amber-100'
          }`}>
            <p className={`text-xs mb-1 ${
              !latestKy ? 'text-gray-500'
              : latestKy.trangThai === 'DaKhoa' ? 'text-green-600' : 'text-amber-600'
            }`}>Kỳ mới nhất</p>
            <p className={`text-xl font-bold font-mono ${
              !latestKy ? 'text-gray-400'
              : latestKy.trangThai === 'DaKhoa' ? 'text-green-700' : 'text-amber-700'
            }`}>
              {latestKy ? latestKy.maKy : '—'}
            </p>
            {latestKy && (
              <p className="text-xs text-gray-400 mt-0.5">
                {latestKy.trangThai === 'DaKhoa' ? '🔒 Đã khóa' : '🔓 Đang mở'}
              </p>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Danh sách kỳ kế toán</h2>
            <span className="text-xs text-gray-400">{total} kỳ</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
              Đang tải...
            </div>
          ) : kyList.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">Chưa có kỳ kế toán nào</p>
              <p className="text-sm mt-1">Tạo kỳ đầu tiên để bắt đầu</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Mã kỳ</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Tháng/Năm</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Trạng thái</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày khóa</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Người khóa</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Snapshot</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {kyList.map(ky => (
                    <tr key={ky.maKy} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-gray-900">{ky.maKy}</span>
                          {ky.isReopened && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">mở lại</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {String(ky.thang).padStart(2, '0')}/{ky.nam}
                      </td>
                      <td className="px-4 py-3">
                        {ky.trangThai === 'DaKhoa' ? (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            🔒 Đã khóa
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            🔓 Đang mở
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {fmtDate(ky.ngayKhoa)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {ky.nguoiKhoa ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {ky.snapshotJSON ? (
                          <button
                            onClick={() => setModal({ type: 'snapshot', snap: ky.snapshotJSON as SnapshotData })}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Xem v{ky.snapshotVersion}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-1">
                          {ky.trangThai === 'DangMo' && (
                            <button
                              onClick={() => setModal({ type: 'lock', ky })}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium"
                            >
                              Khóa kỳ
                            </button>
                          )}
                          {ky.trangThai === 'DaKhoa' && (
                            <button
                              onClick={() => setModal({ type: 'reopen', ky })}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium"
                            >
                              Mở lại
                            </button>
                          )}
                          <button
                            onClick={() => setModal({ type: 'audit', maKy: ky.maKy })}
                            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium"
                          >
                            Lịch sử
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
          <strong>Lưu ý:</strong> Khóa kỳ là hành động có thể hoàn tác (mở lại) nhưng cần ghi rõ lý do tối thiểu 20 ký tự.
          Kỳ trước phải được khóa trước khi khóa kỳ tiếp theo. Mọi thao tác đều được ghi vào nhật ký.
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateModal onClose={closeModal} onCreate={handleCreated} />
      )}
      {modal?.type === 'lock' && (
        <LockWizard ky={modal.ky} onClose={closeModal} onLocked={handleLocked} />
      )}
      {modal?.type === 'reopen' && (
        <ReopenModal ky={modal.ky} onClose={closeModal} onReopened={handleReopened} />
      )}
      {modal?.type === 'snapshot' && (
        <SnapshotModal snap={modal.snap} onClose={closeModal} />
      )}
      {modal?.type === 'audit' && (
        <AuditModal maKy={modal.maKy} onClose={closeModal} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
