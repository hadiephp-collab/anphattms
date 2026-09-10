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

// ── Account Card ──────────────────────────────────────────────────────────
function AccountCard({ ba, onEdit, onToggle, onDelete, onSetDefault }: {
  ba: BankAccount; onEdit: () => void; onToggle: () => void; onDelete: () => void; onSetDefault: () => void;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
  const isTM = ba.loaiTaiKhoan === 'TIEN_MAT';
  const balance = Number(ba.soDuHienTai ?? 0);
  return (
    <div className={`bg-white border rounded-xl p-4 transition-all hover:shadow-md ${!ba.isActive ? 'opacity-60' : ''} ${ba.isDefault ? 'ring-2 ring-blue-400' : ''} border-l-4 ${isTM ? 'border-l-green-400' : 'border-l-blue-400'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${isTM ? 'bg-green-50' : 'bg-blue-50'}`}>
          {isTM ? '💵' : '🏦'}
        </div>
        <div className="flex items-center gap-1">
          {ba.isDefault && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">Mặc định</span>}
          <button onClick={onSetDefault} title="Đặt mặc định" className="text-gray-300 hover:text-yellow-400 text-lg transition-colors">
            {ba.isDefault ? '★' : '☆'}
          </button>
        </div>
      </div>
      <p className={`text-xs uppercase tracking-wide mb-0.5 font-semibold ${isTM ? 'text-green-600' : 'text-blue-600'}`}>
        {isTM ? 'Tiền mặt' : (ba.bankName ?? 'Ngân hàng')}
      </p>
      <p className="text-sm font-bold text-gray-800 truncate">{displayName(ba)}</p>
      {ba.accountNumber && <p className="text-xs text-gray-400 font-mono mt-0.5">{ba.accountNumber}</p>}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">Số dư hiện tại</p>
        <p className={`text-lg font-extrabold mt-0.5 ${balance < 0 ? 'text-red-500' : isTM ? 'text-green-600' : 'text-blue-700'}`}>
          {fmt(balance)}đ
        </p>
        {Number(ba.soDuDauKy) > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">Đầu kỳ: {fmt(Number(ba.soDuDauKy))}đ</p>
        )}
      </div>
      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400 font-mono flex-1">{ba.code}</span>
        <button onClick={onEdit} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">Sửa</button>
        <button onClick={onToggle} className={`text-xs px-2 py-1 rounded ${ba.isActive ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}>
          {ba.isActive ? 'Tắt' : 'Bật'}
        </button>
        {!ba.isActive && (
          <button onClick={onDelete} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">Xóa</button>
        )}
      </div>
    </div>
  );
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

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tài Khoản</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý quỹ tiền mặt &amp; tài khoản ngân hàng</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 bg-white rounded-lg hover:bg-gray-50 font-medium">
            ⇄ Chuyển khoản nội bộ
          </button>
          <button onClick={() => { setEditingAcc(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Total bar */}
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
              <p className="text-sm font-bold">{stats.active}</p>
            </div>
          </div>
        </div>
      )}

      {stats && stats.active > 0 && !stats.defaultAccount && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm">
          ⚠️ Chưa có tài khoản mặc định — click ☆ để đặt
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : (
        <>
          {tienMat.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">💵 Quỹ tiền mặt</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tienMat.map((ba) => (
                  <AccountCard key={ba.id} ba={ba}
                    onEdit={() => { setEditingAcc(ba); setShowModal(true); }}
                    onToggle={() => handleToggleActive(ba)}
                    onDelete={() => setConfirmDelete(ba)}
                    onSetDefault={() => handleSetDefault(ba)} />
                ))}
              </div>
            </div>
          )}

          {nganHang.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🏦 Tài khoản ngân hàng</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nganHang.map((ba) => (
                  <AccountCard key={ba.id} ba={ba}
                    onEdit={() => { setEditingAcc(ba); setShowModal(true); }}
                    onToggle={() => handleToggleActive(ba)}
                    onDelete={() => setConfirmDelete(ba)}
                    onSetDefault={() => handleSetDefault(ba)} />
                ))}
              </div>
            </div>
          )}

          {active.length === 0 && (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-4xl mb-2">🏦</p>
              <p className="font-medium text-gray-500">Chưa có tài khoản nào</p>
              <button onClick={() => { setEditingAcc(null); setShowModal(true); }}
                className="mt-3 text-blue-600 text-sm hover:underline">+ Thêm tài khoản đầu tiên</button>
            </div>
          )}

          {inactive.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setShowInactive(!showInactive)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-500 hover:bg-gray-50">
                <span className="flex items-center gap-2">
                  <span>👁 Tài khoản ngừng sử dụng</span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{inactive.length}</span>
                </span>
                <span>{showInactive ? '▲' : '▼'}</span>
              </button>
              {showInactive && (
                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t pt-3">
                  {inactive.map((ba) => (
                    <AccountCard key={ba.id} ba={ba}
                      onEdit={() => { setEditingAcc(ba); setShowModal(true); }}
                      onToggle={() => handleToggleActive(ba)}
                      onDelete={() => setConfirmDelete(ba)}
                      onSetDefault={() => handleSetDefault(ba)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {transfers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">⇄ Chuyển khoản nội bộ gần nhất</span>
                <button onClick={() => setShowTransferModal(true)} className="text-xs text-blue-600 hover:underline">+ Thêm</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Ngày</th>
                      <th className="px-4 py-2 text-left font-semibold">Mã CK</th>
                      <th className="px-4 py-2 text-left font-semibold">TK Nguồn</th>
                      <th className="px-4 py-2 text-left font-semibold">TK Đích</th>
                      <th className="px-4 py-2 text-right font-semibold">Số tiền</th>
                      <th className="px-4 py-2 text-left font-semibold">Diễn giải</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t) => (
                      <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{t.ngay ?? t.createdAt.slice(0, 10)}</td>
                        <td className="px-4 py-2 font-mono text-indigo-600">{t.code}</td>
                        <td className="px-4 py-2 text-gray-700">{t.fromAccountName}</td>
                        <td className="px-4 py-2 text-gray-700">{t.toAccountName}</td>
                        <td className="px-4 py-2 text-right font-bold text-indigo-600">{fmt(Number(t.amount))}đ</td>
                        <td className="px-4 py-2 text-gray-500">{t.dienGiai ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

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
