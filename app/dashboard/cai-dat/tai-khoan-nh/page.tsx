'use client';
import { useState, useEffect, useCallback } from 'react';
import { bankAccountsApi, BankAccount, InternalTransfer, BankAccountStats, COMMON_BANKS, displayName, fmtVnd } from '@/lib/bank-accounts';
import { localDateStr } from '@/lib/utils';

// ── Toast ──────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

// ── Modal Tài khoản ───────────────────────────────────────────────────────
function AccountModal({ editing, onClose, onSaved }: {
  editing: BankAccount | null; onClose: () => void; onSaved: () => void;
}) {
  const [loai, setLoai] = useState<'TIEN_MAT' | 'NGAN_HANG'>(editing?.loaiTaiKhoan ?? 'NGAN_HANG');
  const [tenTaiKhoan, setTenTaiKhoan] = useState(editing?.tenTaiKhoan ?? '');
  const [bankName, setBankName] = useState(editing?.bankName ?? '');
  const [bankCustom, setBankCustom] = useState('');
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber ?? '');
  const [accountHolder, setAccountHolder] = useState(editing?.accountHolder ?? '');
  const [branch, setBranch] = useState(editing?.branch ?? '');
  const [soDuDauKy, setSoDuDauKy] = useState(String(editing?.soDuDauKy ?? 0));
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? false);
  const [laCaNhan, setLaCaNhan] = useState(editing?.laCaNhan ?? false);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const resolvedBank = bankName === 'Khác' ? bankCustom : bankName;

  const handleSave = async () => {
    if (loai === 'NGAN_HANG' && !resolvedBank.trim()) { setErr('Chọn ngân hàng'); return; }
    if (loai === 'NGAN_HANG' && !accountNumber.trim()) { setErr('Nhập số tài khoản'); return; }
    setLoading(true); setErr('');
    try {
      const base = {
        loaiTaiKhoan: loai,
        tenTaiKhoan: tenTaiKhoan.trim() || undefined,
        soDuDauKy: parseFloat(soDuDauKy) || 0,
        notes: notes.trim() || undefined,
        isDefault,
        laCaNhan,
        ...(loai === 'NGAN_HANG' ? {
          bankName: resolvedBank.trim(),
          accountNumber: accountNumber.trim(),
          accountHolder: accountHolder.trim() || undefined,
          branch: branch.trim() || undefined,
        } : {}),
      };
      if (editing) { await bankAccountsApi.update(editing.id, { ...base, isActive }); }
      else { await bankAccountsApi.create(base); }
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-800">{editing ? 'Sửa tài khoản' : 'Thêm tài khoản mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Loại tài khoản <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {(['TIEN_MAT', 'NGAN_HANG'] as const).map((t) => (
                <button key={t} onClick={() => setLoai(t)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${loai === t ? (t === 'TIEN_MAT' ? 'bg-green-50 border-green-400 text-green-700' : 'bg-blue-50 border-blue-400 text-blue-700') : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {t === 'TIEN_MAT' ? '💵 Tiền mặt' : '🏦 Ngân hàng'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tên tài khoản</label>
            <input value={tenTaiKhoan} onChange={(e) => setTenTaiKhoan(e.target.value)}
              placeholder={loai === 'TIEN_MAT' ? 'VD: Quỹ tiền mặt HN' : 'VD: VCB HN – 1234 (tự điền nếu để trống)'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {loai === 'NGAN_HANG' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-bold text-blue-700">Thông tin ngân hàng</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ngân hàng <span className="text-red-500">*</span></label>
                  <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">-- Chọn --</option>
                    {COMMON_BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                  {bankName === 'Khác' && (
                    <input value={bankCustom} onChange={(e) => setBankCustom(e.target.value)} placeholder="Nhập tên ngân hàng"
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Số tài khoản <span className="text-red-500">*</span></label>
                  <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Số TK"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chủ tài khoản</label>
                  <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Tên chủ TK"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chi nhánh NH</label>
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="VD: CN Hà Nội"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Số dư đầu kỳ (đ)</label>
              <input type="number" min={0} value={soDuDauKy} onChange={(e) => setSoDuDauKy(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-xs text-gray-400 mt-0.5">Số dư khi bắt đầu dùng hệ thống</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ghi chú</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú nội bộ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-gray-700 font-medium">Tài khoản mặc định</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" title="VD tài khoản riêng của chủ dùng trả NCC nước ngoài — báo cáo quỹ công ty tách riêng">
              <input type="checkbox" checked={laCaNhan} onChange={(e) => setLaCaNhan(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-gray-700 font-medium">Tài khoản cá nhân</span>
            </label>
            {editing && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-gray-700 font-medium">Đang sử dụng</span>
              </label>
            )}
          </div>
          {err && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Hủy</button>
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Chuyển khoản nội bộ ─────────────────────────────────────────────
function TransferModal({ accounts, onClose, onSaved }: {
  accounts: BankAccount[]; onClose: () => void; onSaved: () => void;
}) {
  const active = accounts.filter((a) => a.isActive);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [ngay, setNgay] = useState(localDateStr());
  const [dienGiai, setDienGiai] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const fromAcc = active.find((a) => a.id === Number(fromId));
  const toAcc = active.find((a) => a.id === Number(toId));
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

  const handleSave = async () => {
    if (!fromId || !toId) { setErr('Chọn tài khoản nguồn và đích'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('Nhập số tiền hợp lệ'); return; }
    setLoading(true); setErr('');
    try {
      await bankAccountsApi.createTransfer({ fromAccountId: Number(fromId), toAccountId: Number(toId), amount: amt, ngay: ngay || undefined, dienGiai: dienGiai.trim() || undefined });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-800">⇄ Chuyển khoản nội bộ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-[1fr_28px_1fr] gap-2 items-center bg-gray-50 rounded-lg p-3">
            <div className="bg-white border rounded-lg p-2.5">
              <p className="text-xs text-gray-400 mb-1">Từ tài khoản</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{fromAcc ? displayName(fromAcc) : '—'}</p>
              {fromAcc && <p className="text-xs text-green-600 font-bold mt-0.5">{fmt(Number(fromAcc.soDuHienTai))}đ</p>}
            </div>
            <div className="text-center text-gray-400 text-xl font-bold">→</div>
            <div className="bg-white border rounded-lg p-2.5">
              <p className="text-xs text-gray-400 mb-1">Đến tài khoản</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{toAcc ? displayName(toAcc) : '—'}</p>
              {toAcc && <p className="text-xs text-blue-600 font-bold mt-0.5">{fmt(Number(toAcc.soDuHienTai))}đ</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">TK nguồn <span className="text-red-500">*</span></label>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">-- Chọn --</option>
                {active.map((a) => (
                  <option key={a.id} value={a.id} disabled={String(a.id) === toId}>
                    {displayName(a)} ({fmt(Number(a.soDuHienTai))}đ)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">TK đích <span className="text-red-500">*</span></label>
              <select value={toId} onChange={(e) => setToId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">-- Chọn --</option>
                {active.map((a) => (
                  <option key={a.id} value={a.id} disabled={String(a.id) === fromId}>
                    {displayName(a)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Số tiền <span className="text-red-500">*</span></label>
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày</label>
              <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Diễn giải</label>
            <input value={dienGiai} onChange={(e) => setDienGiai(e.target.value)} placeholder="VD: Rút tiền mặt nộp ngân hàng"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          {err && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Hủy</button>
          <button onClick={handleSave} disabled={loading}
            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Chuyển khoản'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function TaiKhoanNHPage() {
  const { toast, show: showToast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [stats, setStats] = useState<BankAccountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<BankAccount | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BankAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accs, trx, st] = await Promise.all([
        bankAccountsApi.getAll(),
        bankAccountsApi.getTransfers(10),
        bankAccountsApi.getStats(),
      ]);
      setAccounts(accs);
      setTransfers(trx);
      setStats(st);
    } catch (e: any) {
      showToast(e.message || 'Lỗi tải dữ liệu', false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (ba: BankAccount) => {
    try {
      await bankAccountsApi.delete(ba.id);
      showToast(`Đã xóa ${displayName(ba)}`); setConfirmDelete(null); load();
    } catch (e: any) { showToast(e.message, false); setConfirmDelete(null); }
  };

  const handleToggleActive = async (ba: BankAccount) => {
    try {
      await bankAccountsApi.update(ba.id, { isActive: !ba.isActive });
      showToast(ba.isActive ? `Đã tắt ${displayName(ba)}` : `Đã bật ${displayName(ba)}`);
      load();
    } catch (e: any) { showToast(e.message, false); }
  };

  const handleSetDefault = async (ba: BankAccount) => {
    try {
      await bankAccountsApi.setDefault(ba.id);
      showToast(`${displayName(ba)} là tài khoản mặc định`); load();
    } catch (e: any) { showToast(e.message, false); }
  };

  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);
  const tienMat = active.filter((a) => a.loaiTaiKhoan === 'TIEN_MAT');
  const nganHang = active.filter((a) => a.loaiTaiKhoan === 'NGAN_HANG');
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
  const fmtDelta = (ba: BankAccount) => {
    const delta = Number(ba.soDuHienTai) - Number(ba.soDuDauKy);
    if (delta === 0) return <span className="text-gray-400">—</span>;
    return <span className={delta > 0 ? 'text-emerald-600' : 'text-red-500'}>{delta > 0 ? '+' : ''}{fmt(delta)}</span>;
  };

  const displayedAccounts = showInactive ? accounts : active;

  const thCls = 'px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap';
  const tdCls = 'px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap';

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ngân Hàng</h1>
          <p className="text-xs text-gray-400 mt-0.5">Quản lý quỹ tiền mặt &amp; tài khoản ngân hàng</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg hover:bg-gray-50 font-medium text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Chuyển khoản nội bộ
          </button>
          <button onClick={() => { setEditingAcc(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm tài khoản
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {/* Stats bar */}
        {stats && (
          <div className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-xl p-5 flex items-center justify-between text-white">
            <div>
              <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Tổng số dư</p>
              <p className="text-3xl font-extrabold">{fmt(stats.totalBalance)}đ</p>
            </div>
            <div className="flex gap-8 items-center">
              <div className="text-right">
                <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Tiền mặt</p>
                <p className="text-sm font-bold text-green-300">{fmt(stats.totalTienMat)}đ</p>
                <p className="text-xs text-blue-300">{tienMat.length} quỹ</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-right">
                <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Ngân hàng</p>
                <p className="text-sm font-bold text-blue-200">{fmt(stats.totalNganHang)}đ</p>
                <p className="text-xs text-blue-300">{nganHang.length} tài khoản</p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-right">
                <p className="text-xs text-blue-200 uppercase tracking-wide mb-1">Đang hoạt động</p>
                <p className="text-2xl font-extrabold">{stats.active}</p>
              </div>
            </div>
          </div>
        )}

        {stats && stats.active > 0 && !stats.defaultAccount && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm">
            ⚠️ Chưa có tài khoản mặc định — click ☆ để đặt
          </div>
        )}

        {/* Main table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs font-semibold text-gray-500">
              {accounts.length} tài khoản
              {inactive.length > 0 && ` (${inactive.length} ngừng hoạt động)`}
            </span>
            {inactive.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-3.5 h-3.5 rounded" />
                Hiện TK ngừng sử dụng
              </label>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
          ) : accounts.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-3xl mb-2">🏦</p>
              <p className="font-medium text-gray-500">Chưa có tài khoản nào</p>
              <button onClick={() => { setEditingAcc(null); setShowModal(true); }}
                className="mt-3 text-blue-600 text-sm hover:underline">+ Thêm tài khoản đầu tiên</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className={thCls}>Loại</th>
                    <th className={thCls}>Mã</th>
                    <th className={thCls}>Tên tài khoản</th>
                    <th className={thCls}>Ngân hàng</th>
                    <th className={thCls}>Số tài khoản</th>
                    <th className={thCls}>Chủ tài khoản</th>
                    <th className={`${thCls} text-right`}>Dư đầu kỳ</th>
                    <th className={`${thCls} text-right`}>Chênh lệch</th>
                    <th className={`${thCls} text-right`}>Số dư hiện tại</th>
                    <th className={thCls}>Trạng thái</th>
                    <th className={thCls}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAccounts.map((ba) => {
                    const isTM = ba.loaiTaiKhoan === 'TIEN_MAT';
                    const balance = Number(ba.soDuHienTai ?? 0);
                    const isInactive = !ba.isActive;
                    return (
                      <tr key={ba.id}
                        className={`border-t border-gray-100 transition-colors ${isInactive ? 'opacity-50 bg-gray-50/50' : 'hover:bg-blue-50/30'}`}>
                        {/* Loại */}
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isTM ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {isTM ? '💵 TM' : '🏦 NH'}
                            </span>
                          </div>
                        </td>
                        {/* Mã */}
                        <td className={tdCls}>
                          <span className="font-mono text-xs text-gray-500">{ba.code}</span>
                        </td>
                        {/* Tên */}
                        <td className={tdCls}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-800">{displayName(ba)}</span>
                            {ba.isDefault && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">Mặc định</span>
                            )}
                            {ba.laCaNhan && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">Cá nhân</span>}
                          </div>
                          {ba.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{ba.notes}</p>}
                        </td>
                        {/* Ngân hàng */}
                        <td className={tdCls}>
                          {isTM ? <span className="text-gray-400">—</span> : (ba.bankName ?? <span className="text-gray-400">—</span>)}
                          {ba.branch && <p className="text-xs text-gray-400">{ba.branch}</p>}
                        </td>
                        {/* Số TK */}
                        <td className={tdCls}>
                          {ba.accountNumber
                            ? <span className="font-mono text-gray-700 tracking-wide">{ba.accountNumber}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        {/* Chủ TK */}
                        <td className={tdCls}>
                          {ba.accountHolder ?? <span className="text-gray-300">—</span>}
                        </td>
                        {/* Dư đầu kỳ */}
                        <td className={`${tdCls} text-right font-mono text-gray-500`}>
                          {fmt(Number(ba.soDuDauKy))}
                        </td>
                        {/* Chênh lệch */}
                        <td className={`${tdCls} text-right font-mono font-semibold`}>
                          {fmtDelta(ba)}
                        </td>
                        {/* Số dư HT */}
                        <td className={`${tdCls} text-right`}>
                          <span className={`font-extrabold font-mono text-base ${balance < 0 ? 'text-red-500' : isTM ? 'text-emerald-600' : 'text-blue-700'}`}>
                            {fmt(balance)}
                          </span>
                        </td>
                        {/* Trạng thái */}
                        <td className={tdCls}>
                          {ba.isActive
                            ? <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Hoạt động</span>
                            : <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Ngừng</span>}
                        </td>
                        {/* Hành động */}
                        <td className={`${tdCls} text-right`}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => handleSetDefault(ba)} title={ba.isDefault ? 'Đang mặc định' : 'Đặt mặc định'}
                              className={`p-1.5 rounded hover:bg-gray-100 transition-colors text-base leading-none ${ba.isDefault ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}>
                              {ba.isDefault ? '★' : '☆'}
                            </button>
                            <button onClick={() => { setEditingAcc(ba); setShowModal(true); }}
                              title="Chỉnh sửa"
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleToggleActive(ba)}
                              title={ba.isActive ? 'Tắt' : 'Bật'}
                              className={`p-1.5 rounded transition-colors ${ba.isActive ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {ba.isActive
                                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                              </svg>
                            </button>
                            {!ba.isActive && (
                              <button onClick={() => setConfirmDelete(ba)} title="Xóa"
                                className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer: tổng dư theo loại */}
                {active.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={6} className="px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Tổng cộng</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-bold text-gray-600">
                        {fmt(active.reduce((s, a) => s + Number(a.soDuDauKy), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm font-bold">
                        {(() => {
                          const delta = active.reduce((s, a) => s + Number(a.soDuHienTai) - Number(a.soDuDauKy), 0);
                          if (delta === 0) return <span className="text-gray-400">—</span>;
                          return <span className={delta > 0 ? 'text-emerald-600' : 'text-red-500'}>{delta > 0 ? '+' : ''}{fmt(delta)}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-base font-extrabold text-blue-700">
                        {fmt(active.reduce((s, a) => s + Number(a.soDuHienTai), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Chuyển khoản nội bộ gần nhất */}
        {transfers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Chuyển khoản nội bộ gần nhất</span>
              <button onClick={() => setShowTransferModal(true)} className="text-xs text-blue-600 hover:underline font-medium">+ Thêm</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thCls}>Ngày</th>
                    <th className={thCls}>Mã CK</th>
                    <th className={thCls}>TK nguồn</th>
                    <th className={thCls}>TK đích</th>
                    <th className={`${thCls} text-right`}>Số tiền</th>
                    <th className={thCls}>Diễn giải</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className={`${tdCls} text-gray-500`}>{t.ngay ?? t.createdAt.slice(0, 10)}</td>
                      <td className={`${tdCls} font-mono text-indigo-600 font-semibold`}>{t.code}</td>
                      <td className={tdCls}>{t.fromAccountName}</td>
                      <td className={tdCls}>{t.toAccountName}</td>
                      <td className={`${tdCls} text-right font-bold font-mono text-indigo-600`}>{fmt(Number(t.amount))}</td>
                      <td className={`${tdCls} text-gray-500`}>{t.dienGiai ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <AccountModal editing={editingAcc} onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); showToast(editingAcc ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản'); load(); }} />
      )}
      {showTransferModal && (
        <TransferModal accounts={accounts} onClose={() => setShowTransferModal(false)}
          onSaved={() => { setShowTransferModal(false); showToast('Đã thực hiện chuyển khoản'); load(); }} />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl p-6">
            <p className="font-bold text-gray-800 mb-2">Xóa tài khoản?</p>
            <p className="text-sm text-gray-500 mb-4">Xóa <strong>{displayName(confirmDelete)}</strong>? Hành động này không thể hoàn tác.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Hủy</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm text-white font-medium ${toast.ok ? 'bg-green-600' : 'bg-red-500'}`}>
          <span>{toast.ok ? '✓' : '✕'}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}
