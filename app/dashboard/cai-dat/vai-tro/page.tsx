'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { rolesApi, VaiTro, RoleDetail, VaiTroAudit, ApiError } from '@/lib/roles';

// ─── Helpers ────────────────────────────────────────────────────────────────

const NHOM_QUYEN_OPTIONS = [
  { value: 'admin',   label: 'Quản Trị',    color: 'bg-rose-100 text-rose-700' },
  { value: 'ketoan',  label: 'Kế Toán',     color: 'bg-blue-100 text-blue-700' },
  { value: 'sale',    label: 'Kinh Doanh',  color: 'bg-green-100 text-green-700' },
  { value: 'viewer',  label: 'Chỉ Xem',     color: 'bg-gray-100 text-gray-600' },
];

function nhomQuyenBadge(nq: string) {
  const opt = NHOM_QUYEN_OPTIONS.find((o) => o.value === nq);
  return opt ?? { label: nq, color: 'bg-gray-100 text-gray-500' };
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return '—'; }
}
function fmtDateTime(s: string) {
  try { return new Date(s).toLocaleString('vi-VN'); } catch { return '—'; }
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  UPDATE_PERMISSION: 'Đổi nhóm quyền',
  DEACTIVATE: 'Vô hiệu hóa',
  REACTIVATE: 'Kích hoạt lại',
};

// ─── Types ───────────────────────────────────────────────────────────────────

type BlockUser = { id: number; username: string; fullName: string | null };

type Modal =
  | null
  | { type: 'create' }
  | { type: 'edit'; role: VaiTro }
  | { type: 'detail'; maVaiTro: string }
  | { type: 'deactivate'; role: VaiTro }
  | { type: 'deactivate-blocked'; role: VaiTro; blockReason: string; blockUsers: BlockUser[] }
  | { type: 'reactivate'; role: VaiTro };

interface Toast { id: number; msg: string; ok: boolean; }

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toast({ t }: { t: Toast }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${t.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
      {t.ok ? '✓' : '✗'} {t.msg}
    </div>
  );
}

function Badge({ nq }: { nq: string }) {
  const b = nhomQuyenBadge(nq);
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.color}`}>{b.label}</span>;
}

function SystemBadge() {
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">HT</span>;
}

// ─── Create / Edit Form ───────────────────────────────────────────────────────

function RoleForm({
  initial,
  isEdit,
  onClose,
  onSaved,
  onToast,
}: {
  initial?: VaiTro;
  isEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string, ok: boolean) => void;
}) {
  const [tenVaiTro, setTenVaiTro] = useState(initial?.tenVaiTro ?? '');
  const [nhomQuyen, setNhomQuyen] = useState<string>(initial?.nhomQuyen ?? 'sale');
  const [moTa, setMoTa] = useState(initial?.moTa ?? '');
  const [saving, setSaving] = useState(false);
  const [uniqueState, setUniqueState] = useState<'idle' | 'checking' | 'ok' | 'dup'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nhomQuyenChanged = isEdit && initial && nhomQuyen !== initial.nhomQuyen;
  const isSystemRole = initial?.isSystemRole ?? false;

  const checkUnique = useCallback((val: string) => {
    if (!val.trim() || (isEdit && val.trim() === initial?.tenVaiTro)) {
      setUniqueState('idle');
      return;
    }
    setUniqueState('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { isUnique } = await rolesApi.checkUnique(val.trim(), initial?.maVaiTro);
        setUniqueState(isUnique ? 'ok' : 'dup');
      } catch {
        setUniqueState('idle');
      }
    }, 400);
  }, [initial, isEdit]);

  useEffect(() => { checkUnique(tenVaiTro); }, [tenVaiTro, checkUnique]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenVaiTro.trim()) return;
    if (uniqueState === 'dup') return;
    setSaving(true);
    try {
      if (isEdit && initial) {
        await rolesApi.update(initial.maVaiTro, { tenVaiTro: tenVaiTro.trim(), nhomQuyen, moTa: moTa.trim() || undefined });
        onToast('Đã cập nhật vai trò', true);
      } else {
        await rolesApi.create({ tenVaiTro: tenVaiTro.trim(), nhomQuyen, moTa: moTa.trim() || undefined });
        onToast('Đã tạo vai trò mới', true);
      }
      onSaved();
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Lỗi server', false);
    } finally {
      setSaving(false);
    }
  }

  const uniqueHint =
    uniqueState === 'checking' ? <span className="text-xs text-gray-400">Đang kiểm tra...</span>
    : uniqueState === 'dup' ? <span className="text-xs text-red-500">Tên đã tồn tại</span>
    : uniqueState === 'ok' ? <span className="text-xs text-green-600">Tên hợp lệ</span>
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Sửa vai trò' : 'Tạo vai trò mới'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* tenVaiTro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên vai trò <span className="text-red-500">*</span></label>
            <input
              value={tenVaiTro}
              onChange={(e) => setTenVaiTro(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ví dụ: Nhân viên kho"
              maxLength={100}
              required
            />
            <div className="mt-1 h-4">{uniqueHint}</div>
          </div>

          {/* nhomQuyen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm quyền <span className="text-red-500">*</span></label>
            <select
              value={nhomQuyen}
              onChange={(e) => setNhomQuyen(e.target.value)}
              disabled={isSystemRole}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {NHOM_QUYEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {isSystemRole && <p className="text-xs text-amber-600 mt-1">Không thể thay đổi nhóm quyền của vai trò hệ thống</p>}
          </div>

          {/* nhomQuyen changed warning */}
          {nhomQuyenChanged && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-amber-700">
                Thay đổi nhóm quyền từ <strong>{nhomQuyenBadge(initial!.nhomQuyen).label}</strong> sang <strong>{nhomQuyenBadge(nhomQuyen).label}</strong> sẽ ảnh hưởng đến tất cả người dùng có vai trò này.
              </p>
            </div>
          )}

          {/* moTa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
            <textarea
              value={moTa}
              onChange={(e) => setMoTa(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Mô tả ngắn về vai trò này"
              maxLength={500}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Hủy</button>
          <button
            type="submit"
            disabled={saving || uniqueState === 'dup' || !tenVaiTro.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo vai trò'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ maVaiTro, onClose }: { maVaiTro: string; onClose: () => void }) {
  const [data, setData] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  useEffect(() => {
    rolesApi.getDetail(maVaiTro).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [maVaiTro]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{data?.tenVaiTro ?? maVaiTro}</h2>
            {data && <Badge nq={data.nhomQuyen} />}
            {data?.isSystemRole && <SystemBadge />}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12 text-gray-400 text-sm">Đang tải...</div>
        ) : data ? (
          <>
            {/* Info strip */}
            <div className="px-6 py-3 bg-gray-50 border-b flex-shrink-0 flex flex-wrap gap-4 text-sm text-gray-500">
              <span>Mã: <span className="font-mono text-gray-800">{data.maVaiTro}</span></span>
              <span>Tạo: {fmtDate(data.ngayTao)}</span>
              {data.nguoiTao && <span>Người tạo: {data.nguoiTao}</span>}
              <span className={`font-medium ${data.active ? 'text-green-700' : 'text-red-600'}`}>
                {data.active ? '● Đang hoạt động' : '● Không hoạt động'}
              </span>
            </div>
            {data.moTa && <div className="px-6 py-2 text-sm text-gray-600 border-b flex-shrink-0">{data.moTa}</div>}

            {/* Tabs */}
            <div className="flex border-b flex-shrink-0 px-6">
              {(['users', 'audit'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`py-2.5 px-1 mr-5 text-sm border-b-2 -mb-px ${activeTab === t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t === 'users' ? `Người dùng (${data.users.length})` : 'Nhật ký'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {activeTab === 'users' && (
                data.users.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-8">Chưa có người dùng nào được gán vai trò này</div>
                ) : (
                  <div className="space-y-2">
                    {data.users.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {(u.fullName || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.fullName || u.username}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
              {activeTab === 'audit' && (
                data.auditLog.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-8">Chưa có nhật ký</div>
                ) : (
                  <div className="space-y-2">
                    {data.auditLog.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">{ACTION_LABELS[log.action] ?? log.action}</span>
                          {log.actor && <span className="text-gray-500"> bởi {log.actor}</span>}
                          {log.chiTiet && <p className="text-xs text-amber-600 mt-0.5">{log.chiTiet}</p>}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{fmtDateTime(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12 text-red-500 text-sm">Không tìm thấy dữ liệu</div>
        )}
      </div>
    </div>
  );
}

// ─── Deactivate Modals ────────────────────────────────────────────────────────

function DeactivateConfirmModal({
  role,
  onClose,
  onConfirm,
  loading,
}: {
  role: VaiTro;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Vô hiệu hóa vai trò?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Vai trò <strong className="text-gray-700">{role.tenVaiTro}</strong> sẽ bị ẩn và không thể gán thêm cho người dùng mới.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Hủy</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Vô hiệu hóa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeactivateBlockedModal({
  role,
  blockReason,
  blockUsers,
  onClose,
}: {
  role: VaiTro;
  blockReason: string;
  blockUsers: BlockUser[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 text-base">⛔</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Không thể vô hiệu hóa</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {blockReason === 'SYSTEM_ROLE' && 'Đây là vai trò hệ thống, không thể chỉnh sửa.'}
                {blockReason === 'LAST_ADMIN' && 'Không thể vô hiệu hóa vai trò admin cuối cùng còn hoạt động.'}
                {blockReason === 'HAS_USERS' && `Còn ${blockUsers.length} người dùng đang sử dụng vai trò ${role.tenVaiTro}. Hãy chuyển họ sang vai trò khác trước.`}
              </p>
            </div>
          </div>

          {blockReason === 'HAS_USERS' && blockUsers.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
                Người dùng cần chuyển vai trò
              </div>
              <div className="max-h-44 overflow-y-auto divide-y">
                {blockUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {(u.fullName || u.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{u.fullName || u.username}</p>
                      <p className="text-xs text-gray-400">@{u.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg font-medium hover:bg-gray-700">
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

function ReactivateModal({ role, onClose, onConfirm, loading }: { role: VaiTro; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <h3 className="text-base font-semibold text-gray-900">Kích hoạt lại vai trò?</h3>
          <p className="text-sm text-gray-500 mt-2">
            Vai trò <strong className="text-gray-700">{role.tenVaiTro}</strong> sẽ được kích hoạt và có thể gán cho người dùng.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Hủy</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Kích hoạt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaiTroPage() {
  const [roles, setRoles] = useState<VaiTro[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, system: 0, inactive: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNhomQuyen, setFilterNhomQuyen] = useState('');

  const [modal, setModal] = useState<Modal>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  let toastId = useRef(0);

  function showToast(msg: string, ok: boolean) {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, ok }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  const loadData = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await rolesApi.getAll({ search, filterStatus, filterNhomQuyen, page: p, pageSize: 20 });
      setRoles(res.data);
      setStats(res.stats);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch {
      showToast('Không thể tải danh sách vai trò', false);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterNhomQuyen]);

  useEffect(() => { loadData(1); }, [loadData]);

  async function handleDeactivate(role: VaiTro) {
    setActionLoading(true);
    try {
      await rolesApi.deactivate(role.maVaiTro);
      showToast(`Đã vô hiệu hóa "${role.tenVaiTro}"`, true);
      setModal(null);
      loadData(page);
    } catch (err) {
      if (err instanceof ApiError) {
        const d = err.data;
        const blockReason = d.blockReason as string;
        if (blockReason === 'HAS_USERS') {
          setModal({ type: 'deactivate-blocked', role, blockReason, blockUsers: (d.blockUsers ?? []) as BlockUser[] });
        } else {
          setModal({ type: 'deactivate-blocked', role, blockReason, blockUsers: [] });
        }
      } else {
        showToast(err instanceof Error ? err.message : 'Lỗi server', false);
        setModal(null);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate(role: VaiTro) {
    setActionLoading(true);
    try {
      await rolesApi.reactivate(role.maVaiTro);
      showToast(`Đã kích hoạt "${role.tenVaiTro}"`, true);
      setModal(null);
      loadData(page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi server', false);
    } finally {
      setActionLoading(false);
    }
  }

  const kpiCards = [
    { label: 'Tổng vai trò', value: stats.total, color: 'from-blue-500 to-blue-600' },
    { label: 'Đang hoạt động', value: stats.active, color: 'from-green-500 to-green-600' },
    { label: 'Vai trò hệ thống', value: stats.system, color: 'from-amber-500 to-amber-600' },
    { label: 'Không hoạt động', value: stats.inactive, color: 'from-gray-500 to-gray-600' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Quản Lý Vai Trò</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý vai trò và nhóm quyền cho tài khoản người dùng trong hệ thống</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map((c) => (
          <div key={c.label} className={`bg-gradient-to-r ${c.color} rounded-xl p-4 text-white shadow-sm`}>
            <p className="text-white/75 text-xs font-medium">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên vai trò..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
        <select
          value={filterNhomQuyen}
          onChange={(e) => setFilterNhomQuyen(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả nhóm quyền</option>
          {NHOM_QUYEN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700"
        >
          <span className="text-lg leading-none">+</span> Thêm vai trò
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : roles.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Không có dữ liệu</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Mã', 'Tên vai trò', 'Nhóm quyền', 'Người dùng', 'Mô tả', 'Trạng thái', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {roles.map((r) => (
                <tr key={r.maVaiTro} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-500">{r.maVaiTro}</span>
                      {r.isSystemRole && <SystemBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.tenVaiTro}</td>
                  <td className="px-4 py-3"><Badge nq={r.nhomQuyen} /></td>
                  <td className="px-4 py-3 text-gray-600">{r.userCount ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{r.moTa ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.active
                      ? <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Hoạt động</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Tắt</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setModal({ type: 'detail', maVaiTro: r.maVaiTro })}
                        className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Chi tiết
                      </button>
                      <button
                        onClick={() => setModal({ type: 'edit', role: r })}
                        className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Sửa
                      </button>
                      {r.active ? (
                        <button
                          onClick={() => setModal({ type: 'deactivate', role: r })}
                          disabled={r.isSystemRole}
                          title={r.isSystemRole ? 'Không thể vô hiệu hóa vai trò hệ thống' : undefined}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Vô hiệu
                        </button>
                      ) : (
                        <button
                          onClick={() => setModal({ type: 'reactivate', role: r })}
                          className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50"
                        >
                          Kích hoạt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Hiển thị {roles.length} / {total} vai trò</span>
            <div className="flex gap-1">
              <button onClick={() => loadData(page - 1)} disabled={page <= 1} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">‹</button>
              <span className="px-3 py-1 font-medium text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => loadData(page + 1)} disabled={page >= totalPages} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">›</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <RoleForm
          isEdit={false}
          onClose={() => setModal(null)}
          onSaved={() => loadData(1)}
          onToast={showToast}
        />
      )}
      {modal?.type === 'edit' && (
        <RoleForm
          initial={modal.role}
          isEdit={true}
          onClose={() => setModal(null)}
          onSaved={() => loadData(page)}
          onToast={showToast}
        />
      )}
      {modal?.type === 'detail' && (
        <DetailModal maVaiTro={modal.maVaiTro} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'deactivate' && (
        <DeactivateConfirmModal
          role={modal.role}
          loading={actionLoading}
          onClose={() => setModal(null)}
          onConfirm={() => handleDeactivate(modal.role)}
        />
      )}
      {modal?.type === 'deactivate-blocked' && (
        <DeactivateBlockedModal
          role={modal.role}
          blockReason={modal.blockReason}
          blockUsers={modal.blockUsers}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'reactivate' && (
        <ReactivateModal
          role={modal.role}
          loading={actionLoading}
          onClose={() => setModal(null)}
          onConfirm={() => handleReactivate(modal.role)}
        />
      )}

      {/* Toast */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => <Toast key={t.id} t={t} />)}
      </div>
    </div>
  );
}
