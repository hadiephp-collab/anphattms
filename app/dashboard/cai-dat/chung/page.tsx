'use client';

import { useEffect, useState, useCallback } from 'react';
import { settingsApi, StoreSetting, PaymentMethod } from '@/lib/settings';

// ─── Toast ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

// ─── Tab: Thông Tin Công Ty ─────────────────────────────────────────────────

function CompanyTab({ setting, onSaved }: { setting: StoreSetting; onSaved: (s: StoreSetting) => void }) {
  const { toast, show } = useToast();
  const [form, setForm] = useState({
    storeName: setting.storeName ?? '',
    storeAddress: setting.storeAddress ?? '',
    storePhone: setting.storePhone ?? '',
    storeEmail: setting.storeEmail ?? '',
    taxCode: setting.taxCode ?? '',
    website: setting.website ?? '',
    defaultVatRate: setting.defaultVatRate ?? '10',
    invoiceWarningDays: setting.invoiceWarningDays ?? '30',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await settingsApi.update(form);
      onSaved(updated as StoreSetting);
      show('Đã lưu cài đặt');
    } catch (err: any) {
      show(err.message ?? 'Lỗi khi lưu', false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Thông tin công ty */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Thông tin công ty</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên công ty</label>
            <input
              type="text" value={form.storeName} onChange={set('storeName')}
              placeholder="Công Ty TNHH An Phát"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <textarea
              value={form.storeAddress} onChange={set('storeAddress')} rows={2}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input
              type="text" value={form.storePhone} onChange={set('storePhone')}
              placeholder="0901 234 567"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={form.storeEmail} onChange={set('storeEmail')}
              placeholder="contact@anphat.vn"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế (MST)</label>
            <input
              type="text" value={form.taxCode} onChange={set('taxCode')}
              placeholder="0123456789"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="text" value={form.website} onChange={set('website')}
              placeholder="https://anphat.vn"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Cài đặt hệ thống */}
      <div className="border-t pt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Cài đặt hệ thống</h3>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thuế suất VAT mặc định (%)</label>
            <input
              type="number" min="0" max="100" value={form.defaultVatRate} onChange={set('defaultVatRate')}
              placeholder="10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Áp dụng khi tạo phiếu HĐ VAT</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cảnh báo HĐ quá hạn (ngày)</label>
            <input
              type="number" min="1" max="365" value={form.invoiceWarningDays} onChange={set('invoiceWarningDays')}
              placeholder="30"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">HĐ VAT nháp quá số ngày này sẽ hiện cảnh báo</p>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <button
          type="submit" disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}

// ─── Payment Method Modal ───────────────────────────────────────────────────

function PmModal({ pm, onClose, onSaved }: { pm?: PaymentMethod; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!pm;
  const [code, setCode] = useState(pm?.code ?? '');
  const [name, setName] = useState(pm?.name ?? '');
  const [isDefault, setIsDefault] = useState(pm?.isDefault ?? false);
  const [sortOrder, setSortOrder] = useState(String(pm?.sortOrder ?? 99));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Vui lòng nhập tên'); return; }
    if (!isEdit && !code.trim()) { setError('Vui lòng nhập mã'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await settingsApi.updatePaymentMethod(pm.id, { name: name.trim(), isDefault, sortOrder: Number(sortOrder) });
      } else {
        await settingsApi.createPaymentMethod({ code: code.trim(), name: name.trim(), isDefault, sortOrder: Number(sortOrder) });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Sửa PTTT' : 'Thêm PTTT mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã <span className="text-red-500">*</span></label>
              <input
                type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: BANKING, ZALO"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Tiền mặt, Chuyển khoản, ZaloPay..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thứ tự hiển thị</label>
            <input
              type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">Đặt làm mặc định</span>
          </label>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">Hủy</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Phương Thức Thanh Toán ────────────────────────────────────────────

function PaymentMethodsTab() {
  const { toast, show } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try { setMethods(await settingsApi.getPaymentMethods()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (pm: PaymentMethod) => {
    try {
      await settingsApi.updatePaymentMethod(pm.id, { isActive: !pm.isActive });
      show(pm.isActive ? 'Đã tắt' : 'Đã bật');
      load();
    } catch (err: any) { show(err.message ?? 'Lỗi', false); }
  };

  const handleDelete = async (pm: PaymentMethod) => {
    if (!confirm(`Xóa "${pm.name}"? Thao tác không thể hoàn tác.`)) return;
    try {
      await settingsApi.deletePaymentMethod(pm.id);
      show('Đã xóa');
      load();
    } catch (err: any) { show(err.message ?? 'Lỗi', false); }
  };

  const handleSetDefault = async (pm: PaymentMethod) => {
    try {
      await settingsApi.updatePaymentMethod(pm.id, { isDefault: true });
      show(`Đã đặt "${pm.name}" làm mặc định`);
      load();
    } catch (err: any) { show(err.message ?? 'Lỗi', false); }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">Danh sách phương thức thanh toán trong hệ thống</p>
          <p className="text-xs text-amber-600 mt-0.5">4 PTTT hệ thống (TM/CK/MM/KH) không thể xóa, chỉ có thể tắt</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Thêm mới
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-8">#</th>
                <th className="text-left px-4 py-3 w-24">Mã</th>
                <th className="text-left px-4 py-3">Tên</th>
                <th className="text-left px-4 py-3 w-28">Mặc định</th>
                <th className="text-left px-4 py-3 w-28">Trạng thái</th>
                <th className="text-left px-4 py-3 w-36">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {methods.map((pm) => (
                <tr key={pm.id} className="hover:bg-gray-50 transition text-sm">
                  <td className="px-4 py-3 text-gray-400 text-xs">{pm.sortOrder}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{pm.code}</span>
                    {pm.isSystem && <span className="ml-1.5 text-xs text-gray-400">HT</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{pm.name}</td>
                  <td className="px-4 py-3">
                    {pm.isDefault ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Mặc định</span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(pm)}
                        className="text-xs text-gray-400 hover:text-blue-600 transition"
                      >
                        Đặt mặc định
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pm.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {pm.isActive ? 'Đang dùng' : 'Tắt'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => { setEditing(pm); setShowModal(true); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Sửa</button>
                      <button onClick={() => handleToggle(pm)} className={`text-xs font-medium ${pm.isActive ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}>
                        {pm.isActive ? 'Tắt' : 'Bật'}
                      </button>
                      {!pm.isSystem && (
                        <button onClick={() => handleDelete(pm)} className="text-xs text-red-500 hover:text-red-700 font-medium">Xóa</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <PmModal
          pm={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); show(editing ? 'Đã cập nhật' : 'Đã thêm mới'); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const TABS = ['Thông Tin & Hệ Thống', 'Phương Thức Thanh Toán'] as const;
type Tab = typeof TABS[number];

export default function CaiDatChungPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Thông Tin & Hệ Thống');
  const [setting, setSetting] = useState<StoreSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    settingsApi.get()
      .then(setSetting)
      .catch((err) => setError(err.message ?? 'Không tải được cài đặt'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cài Đặt Chung</h1>
        <p className="text-sm text-gray-500 mt-0.5">Thông tin công ty, phương thức thanh toán và cài đặt hệ thống</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : error ? (
          <div className="py-16 text-center text-red-500 text-sm">{error}</div>
        ) : activeTab === 'Thông Tin & Hệ Thống' ? (
          <CompanyTab setting={setting!} onSaved={setSetting} />
        ) : (
          <PaymentMethodsTab />
        )}
      </div>
    </div>
  );
}
