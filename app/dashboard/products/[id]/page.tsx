'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productsApi } from '@/lib/products';
import { inventoryApi } from '@/lib/inventory';
import { unitsApi } from '@/lib/units';

interface Variant { id: number; sku: string; attributes: Record<string, string>; costPrice?: number; sellingPrice?: number; barcode?: string; isActive: boolean; }
interface Image { id: number; url: string; isMain: boolean; sortOrder: number; }
interface InvoiceName { id: number; invoiceName: string; invoiceUnit?: string; isDefault: boolean; notes?: string; }
interface Product {
  id: number; code: string; name: string; category?: string; unit?: string; brand?: string;
  costPrice?: number; sellingPrice?: number; wholesalePrice?: number; defaultVatRate?: number;
  stockQuantity?: number; lowStockThreshold?: number; barcode?: string; description?: string; notes?: string;
  hasVariants: boolean; isSaleable: boolean; isActive: boolean;
  warehouseLocation?: string; supplierCode?: string; weight?: number; weightUnit?: string;
  warrantyMonths?: number; tags?: string[];
  variants: Variant[]; images: Image[]; invoiceNames: InvoiceName[];
  createdAt: string; updatedAt: string;
}
interface Movement {
  id: number; type: string; quantity: number; stockBefore: number; stockAfter: number;
  referenceId?: number; referenceType?: string; notes?: string;
  performedBy?: { id: number; name: string };
  createdAt: string;
}

const fmtMoney = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '—';
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (s: string) => new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const MOVE_LABELS: Record<string, { label: string; color: string }> = {
  PURCHASE_IN:  { label: 'Nhập kho',    color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  SALE_OUT:     { label: 'Xuất bán',    color: 'text-red-500 bg-red-50 border-red-100' },
  RETURN_IN:    { label: 'Trả về',      color: 'text-blue-600 bg-blue-50 border-blue-100' },
  RETURN_OUT:   { label: 'Xuất trả',    color: 'text-orange-500 bg-orange-50 border-orange-100' },
  ADJUSTMENT:   { label: 'Điều chỉnh', color: 'text-purple-600 bg-purple-50 border-purple-100' },
  STOCKCOUNT:   { label: 'Kiểm kho',   color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  TRANSFER_IN:  { label: 'Nhận CK',    color: 'text-teal-600 bg-teal-50 border-teal-100' },
  TRANSFER_OUT: { label: 'Xuất CK',    color: 'text-gray-600 bg-gray-50 border-gray-200' },
  DAMAGE:       { label: 'Hàng hỏng',  color: 'text-rose-700 bg-rose-50 border-rose-100' },
  SUPPLIER_RETURN_OUT: { label: 'Trả NCC', color: 'text-orange-600 bg-orange-50 border-orange-100' },
  MANUAL_IN:    { label: 'Nhập thủ công', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  MANUAL_OUT:   { label: 'Xuất thủ công', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

type Tab = 'info' | 'history';

function PriceInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : (value ? Number(value).toLocaleString('vi-VN') : '');
  return (
    <input
      type="text" inputMode="numeric" value={display} placeholder="0"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/\./g, '').replace(/[^\d]/g, ''))}
      className={className}
    />
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('info');

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Form state
  const [eName, setEName] = useState('');
  const [eCode, setECode] = useState('');
  const [eCategory, setECategory] = useState('');
  const [eBrand, setEBrand] = useState('');
  const [eUnit, setEUnit] = useState('');
  const [eCostPrice, setECostPrice] = useState('');
  const [eSellingPrice, setESellingPrice] = useState('');
  const [eWholesalePrice, setEWholesalePrice] = useState('');
  const [eDefaultVatRate, setEDefaultVatRate] = useState('10');
  const [eLowStockThreshold, setELowStockThreshold] = useState('');
  const [eBarcode, setEBarcode] = useState('');
  const [eWarehouseLocation, setEWarehouseLocation] = useState('');
  const [eSupplierCode, setESupplierCode] = useState('');
  const [eWeight, setEWeight] = useState('');
  const [eWeightUnit, setEWeightUnit] = useState('kg');
  const [eWarrantyMonths, setEWarrantyMonths] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eNotes, setENotes] = useState('');
  const [eIsSaleable, setEIsSaleable] = useState(true);
  const [eIsActive, setEIsActive] = useState(true);
  const [eTagsInput, setETagsInput] = useState('');

  // Dropdown data
  const [categories, setCategories] = useState<string[]>([]);
  const [activeUnits, setActiveUnits] = useState<{ id: number; name: string; code: string }[]>([]);

  useEffect(() => {
    productsApi.getCategories().then(setCategories).catch(() => {});
    unitsApi.getActive().then(setActiveUnits).catch(() => {});
  }, []);

  useEffect(() => {
    productsApi.getOne(Number(id))
      .then(setProduct)
      .catch(() => router.push('/dashboard/products'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (tab !== 'history') return;
    setHistoryLoading(true);
    inventoryApi.getProductStock(Number(id))
      .then((res: { product: Product; movements: Movement[] }) => setMovements(res.movements ?? []))
      .catch(() => setMovements([]))
      .finally(() => setHistoryLoading(false));
  }, [tab, id]);

  function startEditing() {
    if (!product) return;
    setEName(product.name || '');
    setECode(product.code || '');
    setECategory(product.category || '');
    setEBrand(product.brand || '');
    setEUnit(product.unit || '');
    setECostPrice(product.costPrice?.toString() || '');
    setESellingPrice(product.sellingPrice?.toString() || '');
    setEWholesalePrice(product.wholesalePrice?.toString() || '');
    setEDefaultVatRate(product.defaultVatRate != null ? String(Math.round(Number(product.defaultVatRate))) : '10');
    setELowStockThreshold(product.lowStockThreshold?.toString() || '');
    setEBarcode(product.barcode || '');
    setEWarehouseLocation(product.warehouseLocation || '');
    setESupplierCode(product.supplierCode || '');
    setEWeight(product.weight?.toString() || '');
    setEWeightUnit(product.weightUnit || 'kg');
    setEWarrantyMonths(product.warrantyMonths?.toString() || '');
    setEDescription(product.description || '');
    setENotes(product.notes || '');
    setEIsSaleable(product.isSaleable !== false);
    setEIsActive(product.isActive !== false);
    setETagsInput((product.tags || []).join(', '));
    setSaveError('');
    setTab('info');
    setIsEditing(true);
  }

  async function handleSave() {
    if (!eName.trim()) { setSaveError('Tên sản phẩm không được để trống'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        name: eName.trim(),
        ...(eCode.trim() && { code: eCode.trim() }),
        ...(eCategory && { category: eCategory }),
        ...(eBrand.trim() && { brand: eBrand.trim() }),
        ...(eUnit.trim() && { unit: eUnit.trim() }),
        ...(eCostPrice && { costPrice: Number(eCostPrice) }),
        ...(eSellingPrice && { sellingPrice: Number(eSellingPrice) }),
        ...(eWholesalePrice && { wholesalePrice: Number(eWholesalePrice) }),
        defaultVatRate: Number(eDefaultVatRate) || 10,
        ...(eLowStockThreshold && { lowStockThreshold: Number(eLowStockThreshold) }),
        ...(eBarcode.trim() && { barcode: eBarcode.trim() }),
        ...(eDescription.trim() && { description: eDescription.trim() }),
        ...(eNotes.trim() && { notes: eNotes.trim() }),
        ...(eWarehouseLocation.trim() && { warehouseLocation: eWarehouseLocation.trim() }),
        ...(eSupplierCode.trim() && { supplierCode: eSupplierCode.trim() }),
        ...(eWeight && { weight: Number(eWeight), weightUnit: eWeightUnit }),
        ...(eWarrantyMonths !== '' && Number(eWarrantyMonths) >= 0 && { warrantyMonths: Number(eWarrantyMonths) }),
        isSaleable: eIsSaleable,
        isActive: eIsActive,
        tags: eTagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      };
      await productsApi.update(Number(id), payload);
      const fresh = await productsApi.getOne(Number(id));
      setProduct(fresh);
      setIsEditing(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Lỗi lưu sản phẩm');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Xác nhận xóa sản phẩm này?')) return;
    await productsApi.remove(Number(id));
    router.push('/dashboard/products');
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <svg className="animate-spin w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  );

  if (!product) return null;

  const mainImg = product.images?.find((i) => i.isMain) || product.images?.[0];
  const stockQty = Math.floor(Number(product.stockQuantity ?? 0));
  const isLowStock = product.lowStockThreshold != null && stockQty > 0 && stockQty <= product.lowStockThreshold;
  const isOutOfStock = stockQty <= 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info',    label: 'Thông tin' },
    { key: 'history', label: 'Lịch sử kho' },
  ];

  const inputCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1';

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className={`bg-white border-b px-7 py-4 flex items-center justify-between flex-shrink-0 ${isEditing ? 'border-amber-200' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => isEditing ? setIsEditing(false) : router.push('/dashboard/products')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-md tracking-wide">{product.code}</span>
            <h1 className="text-base font-bold text-gray-900">{product.name}</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
              {product.isActive ? 'Đang bán' : 'Ngừng bán'}
            </span>
            {isEditing && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 text-amber-600 border-amber-200">
                Đang chỉnh sửa
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm shadow-blue-200">
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDelete}
                className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">
                Xóa
              </button>
              <button onClick={startEditing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200">
                Chỉnh sửa
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mx-6 mt-3 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {saveError}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4 max-w-6xl">
          {/* Left — main content */}
          <div className="col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              {/* Tab bar — only 2 tabs, always accessible */}
              <div className="flex border-b border-gray-100 px-4">
                {tabs.map((t) => (
                  <button key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px
                      ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* ── Tab: Thông tin ── */}
                {tab === 'info' && (
                  <div>
                    {/* Product fields — view mode */}
                    {!isEditing && (
                      <div>
                        <div className="mb-4">
                          <p className={labelCls}>Tên sản phẩm</p>
                          <p className="text-base font-semibold text-gray-800">{product.name}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                          {[
                            { label: 'Mã sản phẩm', value: product.code, mono: true },
                            { label: 'Danh mục', value: product.category },
                            { label: 'Đơn vị tính', value: product.unit },
                            { label: 'Thương hiệu', value: product.brand },
                            { label: 'Barcode', value: product.barcode, mono: true },
                            { label: 'Mã NCC', value: product.supplierCode, mono: true },
                            { label: 'Vị trí kho', value: product.warehouseLocation },
                            { label: 'Ngưỡng tồn kho', value: product.lowStockThreshold != null ? `${product.lowStockThreshold} ${product.unit || 'cái'}` : undefined },
                            { label: 'Bảo hành', value: product.warrantyMonths != null ? `${product.warrantyMonths} tháng` : undefined },
                            { label: 'Trọng lượng', value: product.weight ? `${product.weight} ${product.weightUnit || 'kg'}` : undefined },
                            { label: 'Thuế suất mặc định', value: `${product.defaultVatRate ?? 10}%` },
                            { label: 'Được bán', value: product.isSaleable ? 'Có' : 'Không' },
                            { label: 'Trạng thái', value: product.isActive ? 'Đang hoạt động' : 'Ngừng bán' },
                            { label: 'Có biến thể', value: product.hasVariants ? 'Có' : 'Không' },
                            { label: 'Ngày tạo', value: fmtDate(product.createdAt) },
                            { label: 'Cập nhật', value: fmtDate(product.updatedAt) },
                          ].map(({ label, value, mono }) => (
                            <div key={label}>
                              <p className={labelCls}>{label}</p>
                              <p className={`text-sm ${mono ? 'font-mono text-gray-600' : 'text-gray-700'}`}>
                                {value || <span className="text-gray-300">—</span>}
                              </p>
                            </div>
                          ))}
                        </div>
                        {product.tags && product.tags.length > 0 && (
                          <div className="mt-4">
                            <p className={labelCls}>Tags</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {product.tags.map((t, i) => (
                                <span key={i} className="text-xs bg-blue-50 text-blue-500 border border-blue-100 px-2 py-0.5 rounded-full">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {product.description && (
                          <div className="mt-4">
                            <p className={labelCls}>Mô tả sản phẩm</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{product.description}</p>
                          </div>
                        )}
                        {product.notes && (
                          <div className="mt-4">
                            <p className={labelCls}>Ghi chú nội bộ</p>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.notes}</p>
                          </div>
                        )}
                        {!product.description && !product.notes && !product.tags?.length && (
                          <p className="text-xs text-gray-300 mt-4 italic">Chưa có mô tả, ghi chú hoặc tags — bấm Chỉnh sửa để bổ sung</p>
                        )}
                      </div>
                    )}

                    {/* Product fields — edit mode */}
                    {isEditing && (
                      <div className="space-y-4">
                        {/* Tên SP */}
                        <div>
                          <label className={labelCls}>Tên sản phẩm <span className="text-red-400 normal-case font-normal">*</span></label>
                          <input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Tên sản phẩm..."
                            className={`${inputCls} text-base font-medium`} />
                        </div>

                        {/* Row 1: Mã SP | Danh mục | ĐVT */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Mã sản phẩm</label>
                            <input value={eCode} onChange={(e) => setECode(e.target.value)} placeholder="SP001"
                              className={`${inputCls} font-mono`} />
                          </div>
                          <div>
                            <label className={labelCls}>Danh mục</label>
                            <select value={eCategory} onChange={(e) => setECategory(e.target.value)} className={inputCls}>
                              <option value="">-- Chọn --</option>
                              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Đơn vị tính</label>
                            <select value={eUnit} onChange={(e) => setEUnit(e.target.value)} className={inputCls}>
                              <option value="">-- Chọn --</option>
                              {activeUnits.map((u) => <option key={u.id} value={u.name}>{u.name} ({u.code})</option>)}
                              {eUnit && !activeUnits.some((u) => u.name === eUnit) && <option value={eUnit}>{eUnit} (cũ)</option>}
                            </select>
                          </div>
                        </div>

                        {/* Row 2: Thương hiệu | Barcode | Mã NCC */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Thương hiệu</label>
                            <input value={eBrand} onChange={(e) => setEBrand(e.target.value)} placeholder="Hãng / thương hiệu" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Barcode</label>
                            <input value={eBarcode} onChange={(e) => setEBarcode(e.target.value)} placeholder="Mã vạch" className={`${inputCls} font-mono`} />
                          </div>
                          <div>
                            <label className={labelCls}>Mã NCC</label>
                            <input value={eSupplierCode} onChange={(e) => setESupplierCode(e.target.value)} placeholder="Mã của nhà cung cấp" className={`${inputCls} font-mono`} />
                          </div>
                        </div>

                        {/* Row 3: Vị trí kho | Ngưỡng tồn | Bảo hành */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Vị trí kho</label>
                            <input value={eWarehouseLocation} onChange={(e) => setEWarehouseLocation(e.target.value)} placeholder="VD: Kệ A1" className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Ngưỡng cảnh báo tồn</label>
                            <input type="number" value={eLowStockThreshold} onChange={(e) => setELowStockThreshold(e.target.value)} placeholder="VD: 5" min={0} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Bảo hành (tháng)</label>
                            <input type="number" value={eWarrantyMonths} onChange={(e) => setEWarrantyMonths(e.target.value)} placeholder="VD: 12" min={0} max={360} className={inputCls} />
                          </div>
                        </div>

                        {/* Row 4: Trọng lượng | Được bán + Hoạt động */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Trọng lượng</label>
                            <div className="flex gap-1.5">
                              <input type="number" value={eWeight} onChange={(e) => setEWeight(e.target.value)} placeholder="0" min={0} step="0.001"
                                className={`${inputCls} flex-1`} />
                              <select value={eWeightUnit} onChange={(e) => setEWeightUnit(e.target.value)}
                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-14 bg-white">
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-end gap-5 pb-1 col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={eIsSaleable} onChange={(e) => setEIsSaleable(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                              <div>
                                <div className="text-sm text-gray-700 font-medium">Được bán</div>
                                <div className="text-[11px] text-gray-400">Hiển thị khi tạo đơn hàng</div>
                              </div>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={eIsActive} onChange={(e) => setEIsActive(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                              <div>
                                <div className="text-sm text-gray-700 font-medium">Đang hoạt động</div>
                                <div className="text-[11px] text-gray-400">Bỏ tick để ngừng bán</div>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Tags */}
                        <div>
                          <label className={labelCls}>Tags</label>
                          <input value={eTagsInput} onChange={(e) => setETagsInput(e.target.value)} placeholder="bán chạy, mùa hè, ký gửi... (phân cách bằng dấu phẩy)" className={inputCls} />
                          {eTagsInput && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {eTagsInput.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                                <span key={i} className="text-xs bg-blue-50 text-blue-500 border border-blue-100 px-2 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Mô tả */}
                        <div>
                          <label className={labelCls}>Mô tả sản phẩm</label>
                          <textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)}
                            rows={3} placeholder="Mô tả chi tiết, thông số kỹ thuật..." className={inputCls} />
                        </div>

                        {/* Ghi chú */}
                        <div>
                          <label className={labelCls}>Ghi chú nội bộ</label>
                          <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)}
                            rows={2} placeholder="Ghi chú chỉ dùng nội bộ..." className={inputCls} />
                        </div>
                      </div>
                    )}

                    {/* ── Biến thể (always visible) ── */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          Biến thể
                          {(product.variants?.length ?? 0) > 0 && (
                            <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{product.variants.length}</span>
                          )}
                        </h3>
                      </div>
                      {product.variants?.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 rounded-lg">
                            <tr>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase rounded-l-lg">SKU</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">Thuộc tính</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">Giá vốn</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">Giá bán</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase rounded-r-lg">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.variants.map((v) => (
                              <tr key={v.id} className="border-t border-gray-50">
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{v.sku}</td>
                                <td className="px-3 py-2.5 text-xs text-gray-500">
                                  {Object.entries(v.attributes).map(([k, val]) => (
                                    <span key={k} className="inline-block mr-2">
                                      <span className="text-gray-400">{k}:</span> {val}
                                    </span>
                                  ))}
                                </td>
                                <td className="px-3 py-2.5 text-sm text-gray-600">{fmtMoney(v.costPrice)}</td>
                                <td className="px-3 py-2.5 text-sm font-medium text-gray-700">{fmtMoney(v.sellingPrice)}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${v.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                    {v.isActive ? 'Hoạt động' : 'Tắt'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-300 text-sm text-center py-4">Chưa có biến thể nào</p>
                      )}
                    </div>

                    {/* ── Tên HĐ VAT (always visible) ── */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          Tên HĐ VAT
                          {(product.invoiceNames?.length ?? 0) > 0 && (
                            <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{product.invoiceNames.length}</span>
                          )}
                        </h3>
                      </div>
                      {product.invoiceNames?.length > 0 ? (
                        <div className="space-y-2">
                          {product.invoiceNames.map((inv) => (
                            <div key={inv.id} className={`p-3 rounded-xl border ${inv.isDefault ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-gray-800">{inv.invoiceName}</span>
                                {inv.isDefault && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-medium">Mặc định</span>}
                              </div>
                              {inv.invoiceUnit && <p className="text-xs text-gray-500">Đơn vị tính: <span className="font-medium">{inv.invoiceUnit}</span></p>}
                              {inv.notes && <p className="text-xs text-gray-400 mt-0.5">{inv.notes}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-300 text-sm text-center py-4">
                          Chưa có tên hóa đơn nào
                          {!isEditing && <span className="text-[11px] text-gray-300"> — dấu ★ trong danh sách SP sẽ hiện cảnh báo</span>}
                        </p>
                      )}
                    </div>

                    {/* ── Ảnh sản phẩm (always visible) ── */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          Ảnh sản phẩm
                          {(product.images?.length ?? 0) > 0 && (
                            <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{product.images.length}</span>
                          )}
                        </h3>
                      </div>
                      {product.images?.length > 0 ? (
                        <div className="grid grid-cols-4 gap-3">
                          {product.images.map((img) => (
                            <div key={img.id} className={`relative rounded-xl overflow-hidden border-2 ${img.isMain ? 'border-blue-400' : 'border-gray-100'}`}>
                              <img src={img.url} alt="" className="w-full h-28 object-cover" />
                              {img.isMain && (
                                <span className="absolute top-1.5 left-1.5 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded font-semibold">Chính</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-300 text-sm text-center py-4">Chưa có ảnh nào</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Tab: Lịch sử kho ── */}
                {tab === 'history' && (
                  <div>
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      </div>
                    ) : movements.length === 0 ? (
                      <p className="text-gray-300 text-sm text-center py-10">Chưa có lịch sử biến động kho</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase rounded-l-lg whitespace-nowrap">Thời gian</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">Loại</th>
                              <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">Thay đổi</th>
                              <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">Tồn trước</th>
                              <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase whitespace-nowrap">Tồn sau</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">Ghi chú</th>
                              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase rounded-r-lg">Nhân viên</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movements.map((m) => {
                              const meta = MOVE_LABELS[m.type] ?? { label: m.type, color: 'text-gray-500 bg-gray-50 border-gray-200' };
                              const delta = Number(m.quantity);
                              return (
                                <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                                  <td className="px-3 py-2.5">
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>{meta.label}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {delta > 0 ? '+' : ''}{Number(delta).toLocaleString('vi-VN')}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-sm text-gray-500">{Math.floor(Number(m.stockBefore)).toLocaleString('vi-VN')}</td>
                                  <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">{Math.floor(Number(m.stockAfter)).toLocaleString('vi-VN')}</td>
                                  <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[160px] truncate">{m.notes || '—'}</td>
                                  <td className="px-3 py-2.5 text-xs text-gray-500">{m.performedBy?.name || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="text-[11px] text-gray-300 mt-3 text-right">Hiển thị 20 giao dịch gần nhất</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Ảnh đại diện */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {mainImg
                ? <img src={mainImg.url} alt={product.name} className="w-full h-48 object-cover" />
                : <div className="w-full h-48 bg-gray-50 flex flex-col items-center justify-center gap-2">
                    <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-300">Chưa có ảnh</span>
                  </div>}
              {product.images?.length > 1 && (
                <div className="flex gap-1 p-2 bg-gray-50/50">
                  {product.images.slice(0, 5).map((img) => (
                    <div key={img.id} className={`w-10 h-10 rounded-md overflow-hidden border ${img.isMain ? 'border-blue-300' : 'border-gray-100'}`}>
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {product.images.length > 5 && (
                    <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-100 flex items-center justify-center">
                      <span className="text-[10px] text-gray-400 font-medium">+{product.images.length - 5}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Giá */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Giá</h3>
              {isEditing ? (
                <div className="space-y-2.5">
                  {[
                    { label: 'Giá vốn', value: eCostPrice, setter: setECostPrice },
                    { label: 'Giá bán lẻ', value: eSellingPrice, setter: setESellingPrice },
                    { label: 'Giá bán buôn', value: eWholesalePrice, setter: setEWholesalePrice },
                  ].map(({ label, value, setter }) => (
                    <div key={label}>
                      <label className="block text-[11px] text-gray-400 mb-1">{label}</label>
                      <div className="relative">
                        <PriceInput value={value} onChange={setter}
                          className={`${inputCls} pr-5 text-right`} />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Thuế suất VAT</label>
                    <select value={eDefaultVatRate} onChange={(e) => setEDefaultVatRate(e.target.value)} className={inputCls}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="8">8%</option>
                      <option value="10">10%</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Giá vốn', value: product.costPrice, color: 'text-gray-700' },
                    { label: 'Giá bán lẻ', value: product.sellingPrice, color: 'text-blue-600 font-semibold' },
                    { label: 'Giá bán buôn', value: product.wholesalePrice, color: 'text-gray-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className={`text-sm ${color}`}>{fmtMoney(value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                    <span className="text-xs text-gray-400">Thuế suất</span>
                    <span className="text-sm font-medium text-gray-600">{product.defaultVatRate ?? 10}%</span>
                  </div>
                  {product.sellingPrice && product.costPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Lợi nhuận</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {((Number(product.sellingPrice) - Number(product.costPrice)) / Number(product.sellingPrice) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tồn kho */}
            <div className={`bg-white rounded-xl border shadow-sm p-4 ${isOutOfStock ? 'border-red-100' : isLowStock ? 'border-amber-100' : 'border-gray-100'}`}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tồn kho</h3>
              <div className="text-center py-2">
                <p className={`text-3xl font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-gray-800'}`}>
                  {stockQty.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {product.unit || 'đơn vị'}
                  {product.warehouseLocation && ` · ${product.warehouseLocation}`}
                </p>
                {isOutOfStock && (
                  <span className="inline-block mt-2 text-[11px] text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-medium">Hết hàng</span>
                )}
                {isLowStock && (
                  <span className="inline-block mt-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                    Sắp hết · ngưỡng {product.lowStockThreshold}
                  </span>
                )}
              </div>
              <button onClick={() => setTab('history')}
                className="w-full mt-3 text-[11px] text-blue-500 hover:text-blue-600 font-medium text-center transition">
                Xem lịch sử biến động →
              </button>
            </div>

            {/* Quick info card (only in view mode) */}
            {!isEditing && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Thông tin nhanh</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Thương hiệu', value: product.brand },
                    { label: 'Danh mục', value: product.category },
                    { label: 'Đơn vị tính', value: product.unit },
                    { label: 'Bảo hành', value: product.warrantyMonths ? `${product.warrantyMonths} tháng` : undefined },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-400 shrink-0">{label}</span>
                      <span className="text-xs text-gray-700 text-right">{value}</span>
                    </div>
                  ) : null)}
                  {product.tags && product.tags.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {product.tags.map((t, i) => (
                          <span key={i} className="text-[10px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
