'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { productsApi } from '@/lib/products';
import { inventoryApi } from '@/lib/inventory';
import { unitsApi } from '@/lib/units';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Variant { id: number; sku: string; attributes: Record<string, string>; costPrice?: number; sellingPrice?: number; barcode?: string; isActive: boolean; }
interface Image { id: number; url: string; isMain: boolean; sortOrder: number; }
interface InvoiceName { id: number; invoiceName: string; invoiceUnit?: string; isDefault: boolean; notes?: string; }
interface Product {
  id: number; code: string; name: string; category?: string; unit?: string; brand?: string;
  costPrice?: number; sellingPrice?: number; wholesalePrice?: number; averageCost?: number; defaultVatRate?: number;
  stockQuantity?: number; lowStockThreshold?: number; barcode?: string; description?: string; notes?: string;
  hasVariants: boolean; isSaleable: boolean; isActive: boolean; priority?: number;
  warehouseLocation?: string; supplierCode?: string; weight?: number; weightUnit?: string;
  warrantyMonths?: number; tags?: string[];
  nameChinese?: string | null; nameEnglish?: string | null;
  customsDescription?: string | null; costPriceCny?: number | null;
  hsCode?: string | null; customsName?: string | null;
  customsUsdPrice?: number | null; packagingInfo?: string | null; importNotes?: string | null;
  variants: Variant[]; images: Image[]; invoiceNames: InvoiceName[];
  createdAt: string; updatedAt: string;
}
interface Movement {
  id: number; type: string; quantity: number; stockBefore: number; stockAfter: number;
  referenceId?: number; referenceType?: string; notes?: string;
  performedBy?: { id: number; name: string };
  createdAt: string;
}
interface PurchaseHistory {
  poId: number; poCode: string; date: string | null; status: string;
  currency: string; exchangeRate: number;
  supplierId: number | null; supplierName: string | null;
  quantity: number; priceForeign: number; priceVnd: number;
  discountPercent: number; totalVnd: number; unit: string;
}
interface EditVariant {
  id?: number; sku: string; attrStr: string;
  costPrice: string; sellingPrice: string; barcode: string; isActive: boolean; isNew: boolean;
}

const MOVE_LABELS: Record<string, { label: string; color: string }> = {
  PURCHASE_IN:  { label: 'Nhập kho',       color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  SALE_OUT:     { label: 'Xuất bán',       color: 'text-red-500 bg-red-50 border-red-100' },
  RETURN_IN:    { label: 'Trả về',         color: 'text-blue-600 bg-blue-50 border-blue-100' },
  RETURN_OUT:   { label: 'Xuất trả',       color: 'text-orange-500 bg-orange-50 border-orange-100' },
  ADJUSTMENT:   { label: 'Điều chỉnh',     color: 'text-purple-600 bg-purple-50 border-purple-100' },
  STOCKCOUNT:   { label: 'Kiểm kho',       color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  TRANSFER_IN:  { label: 'Nhận CK',        color: 'text-teal-600 bg-teal-50 border-teal-100' },
  TRANSFER_OUT: { label: 'Xuất CK',        color: 'text-gray-600 bg-gray-50 border-gray-200' },
  DAMAGE:       { label: 'Hàng hỏng',      color: 'text-rose-700 bg-rose-50 border-rose-100' },
  SUPPLIER_RETURN_OUT: { label: 'Trả NCC', color: 'text-orange-600 bg-orange-50 border-orange-100' },
  MANUAL_IN:    { label: 'Nhập thủ công',  color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  MANUAL_OUT:   { label: 'Xuất thủ công',  color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

type Tab = 'info' | 'history' | 'purchases';

function PriceInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : (value ? Number(value).toLocaleString('vi-VN') : '');
  return (
    <input type="text" inputMode="numeric" value={display} placeholder="0"
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/\./g, '').replace(/[^\d]/g, ''))}
      className={className} />
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

function FieldItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono text-gray-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function fmtMoney(v: number | null | undefined): string {
  return v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—';
}
function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function attrToStr(attrs: Record<string, string>): string {
  return Object.entries(attrs || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
}
function strToAttr(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  str.split(',').forEach(part => {
    const idx = part.indexOf(':');
    if (idx > 0) { const k = part.slice(0, idx).trim(); const v = part.slice(idx + 1).trim(); if (k) result[k] = v; }
  });
  return result;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [movLimit] = useState(30);
  const [movTypeFilter, setMovTypeFilter] = useState('');
  const [movDateFrom, setMovDateFrom] = useState('');
  const [movDateTo, setMovDateTo] = useState('');
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Form state — basic
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
  const [ePriority, setEPriority] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eNotes, setENotes] = useState('');
  const [eIsSaleable, setEIsSaleable] = useState(true);
  const [eIsActive, setEIsActive] = useState(true);
  const [eTagsInput, setETagsInput] = useState('');
  // Form state — import
  const [eNameChinese, setENameChinese] = useState('');
  const [eNameEnglish, setENameEnglish] = useState('');
  const [eHsCode, setEHsCode] = useState('');
  const [eCustomsName, setECustomsName] = useState('');
  const [eCustomsDescription, setECustomsDescription] = useState('');
  const [eCostPriceCny, setECostPriceCny] = useState('');
  const [eCustomsUsdPrice, setECustomsUsdPrice] = useState('');
  const [ePackagingInfo, setEPackagingInfo] = useState('');
  const [eImportNotes, setEImportNotes] = useState('');

  // Image gallery state
  const [activeImgUrl, setActiveImgUrl] = useState<string | null>(null);
  const [showAllImgs, setShowAllImgs] = useState(false);

  // Expand/collapse for long text fields
  const [expandDesc, setExpandDesc] = useState(false);
  const [expandNotes, setExpandNotes] = useState(false);
  const [expandCustomsDesc, setExpandCustomsDesc] = useState(false);
  const [expandImportNotes, setExpandImportNotes] = useState(false);
  const [expandPackaging, setExpandPackaging] = useState(false);

  // Variant modal state
  const [variantModal, setVariantModal] = useState(false);
  const [editVariants, setEditVariants] = useState<EditVariant[]>([]);
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantError, setVariantError] = useState('');

  // Image modal state
  const [imageModal, setImageModal] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState('');
  const [imgUrlInput, setImgUrlInput] = useState('');

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
    const params: Record<string, string> = {
      productId: String(id),
      page: String(movPage),
      limit: String(movLimit),
    };
    if (movTypeFilter) params.type = movTypeFilter;
    if (movDateFrom)   params.startDate = movDateFrom;
    if (movDateTo)     params.endDate   = movDateTo;
    inventoryApi.getMovements(params)
      .then((res: { data: Movement[]; total: number }) => {
        setMovements(res.data ?? []);
        setMovTotal(res.total ?? 0);
      })
      .catch(() => { setMovements([]); setMovTotal(0); })
      .finally(() => setHistoryLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id, movPage, movTypeFilter, movDateFrom, movDateTo]);

  useEffect(() => {
    if (tab !== 'purchases') return;
    setPurchasesLoading(true);
    purchaseOrdersApi.getByProduct(Number(id))
      .then((rows: PurchaseHistory[]) => setPurchaseHistory(rows))
      .catch(() => setPurchaseHistory([]))
      .finally(() => setPurchasesLoading(false));
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
    setEPriority(product.priority?.toString() || '');
    setEDescription(product.description || '');
    setENotes(product.notes || '');
    setEIsSaleable(product.isSaleable !== false);
    setEIsActive(product.isActive !== false);
    setETagsInput((product.tags || []).join(', '));
    setENameChinese(product.nameChinese || '');
    setENameEnglish(product.nameEnglish || '');
    setEHsCode(product.hsCode || '');
    setECustomsName(product.customsName || '');
    setECustomsDescription(product.customsDescription || '');
    setECostPriceCny(product.costPriceCny != null ? String(product.costPriceCny) : '');
    setECustomsUsdPrice(product.customsUsdPrice != null ? String(product.customsUsdPrice) : '');
    setEPackagingInfo(product.packagingInfo || '');
    setEImportNotes(product.importNotes || '');
    setSaveError('');
    setTab('info');
    setIsEditing(true);
  }

  async function handleSave() {
    if (!eName.trim()) { setSaveError('Tên sản phẩm không được để trống'); return; }
    setSaving(true); setSaveError('');
    try {
      await productsApi.update(Number(id), {
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
        ...(ePriority && { priority: Number(ePriority) }),
        isSaleable: eIsSaleable,
        isActive: eIsActive,
        tags: eTagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        nameChinese: eNameChinese.trim() || null,
        nameEnglish: eNameEnglish.trim() || null,
        hsCode: eHsCode.trim() || null,
        customsName: eCustomsName.trim() || null,
        customsDescription: eCustomsDescription.trim() || null,
        costPriceCny: eCostPriceCny ? Number(eCostPriceCny) : null,
        customsUsdPrice: eCustomsUsdPrice ? Number(eCustomsUsdPrice) : null,
        packagingInfo: ePackagingInfo.trim() || null,
        importNotes: eImportNotes.trim() || null,
      });
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

  function openVariantModal() {
    setEditVariants((product?.variants ?? []).map(v => ({
      id: v.id, sku: v.sku, attrStr: attrToStr(v.attributes),
      costPrice: v.costPrice ? String(Math.round(Number(v.costPrice))) : '',
      sellingPrice: v.sellingPrice ? String(Math.round(Number(v.sellingPrice))) : '',
      barcode: v.barcode || '', isActive: v.isActive, isNew: false,
    })));
    setVariantError('');
    setVariantModal(true);
  }

  async function saveVariants() {
    if (!product) return;
    setVariantSaving(true); setVariantError('');
    try {
      const originalIds = new Set((product.variants ?? []).map(v => v.id));
      const remainingIds = new Set(editVariants.filter(v => !v.isNew).map(v => v.id!));
      const deletedIds = [...originalIds].filter(id => !remainingIds.has(id));

      for (const did of deletedIds) {
        await productsApi.deleteVariant(Number(id), did);
      }
      for (const v of editVariants.filter(e => !e.isNew)) {
        await productsApi.updateVariant(Number(id), v.id!, {
          sku: v.sku.trim(), attributes: strToAttr(v.attrStr),
          costPrice: v.costPrice ? Number(v.costPrice) : null,
          sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : null,
          barcode: v.barcode.trim() || null, isActive: v.isActive,
        });
      }
      const newOnes = editVariants.filter(e => e.isNew && e.sku.trim());
      if (newOnes.length > 0) {
        await productsApi.bulkCreateVariants(Number(id), newOnes.map(v => ({
          sku: v.sku.trim(), attributes: strToAttr(v.attrStr),
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
          sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : undefined,
          barcode: v.barcode.trim() || undefined,
        })));
      }
      const hasV = editVariants.filter(e => !e.isNew || e.sku.trim()).length > 0 || (newOnes.length > 0);
      await productsApi.update(Number(id), { hasVariants: hasV && (editVariants.length - deletedIds.length + newOnes.length) > 0 });
      const fresh = await productsApi.getOne(Number(id));
      setProduct(fresh);
      setVariantModal(false);
    } catch (e: unknown) {
      setVariantError(e instanceof Error ? e.message : 'Lỗi khi lưu biến thể');
    } finally {
      setVariantSaving(false);
    }
  }

  async function uploadImageFile(file: File) {
    setImgUploading(true); setImgError('');
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      await productsApi.addImage(Number(id), { url: data.url, isMain: product!.images.length === 0 });
      const fresh = await productsApi.getOne(Number(id)); setProduct(fresh);
    } catch (e: unknown) { setImgError(e instanceof Error ? e.message : 'Lỗi upload ảnh'); }
    finally { setImgUploading(false); }
  }

  async function addImageUrl() {
    const url = imgUrlInput.trim();
    if (!url) return;
    setImgUploading(true); setImgError('');
    try {
      await productsApi.addImage(Number(id), { url, isMain: product!.images.length === 0 });
      const fresh = await productsApi.getOne(Number(id)); setProduct(fresh); setImgUrlInput('');
    } catch (e: unknown) { setImgError(e instanceof Error ? e.message : 'Lỗi thêm ảnh'); }
    finally { setImgUploading(false); }
  }

  async function deleteImg(imgId: number) {
    try {
      await productsApi.deleteImage(Number(id), imgId);
      const fresh = await productsApi.getOne(Number(id));
      setProduct(fresh);
      if (activeImgUrl && !fresh.images.find((i: Image) => i.url === activeImgUrl)) setActiveImgUrl(null);
    } catch (e: unknown) { setImgError(e instanceof Error ? e.message : 'Lỗi xóa ảnh'); }
  }

  async function setMainImg(imgId: number) {
    try {
      await productsApi.setMainImage(Number(id), imgId);
      const fresh = await productsApi.getOne(Number(id)); setProduct(fresh);
    } catch (e: unknown) { setImgError(e instanceof Error ? e.message : 'Lỗi đặt ảnh chính'); }
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
  const hasImportData = [
    product.nameChinese, product.nameEnglish, product.hsCode, product.customsName,
    product.customsDescription, product.costPriceCny, product.customsUsdPrice,
    product.packagingInfo, product.importNotes,
  ].some((v) => v != null && v !== '');

  const inputCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300 bg-white';
  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'history', label: 'Lịch sử kho' },
    { key: 'purchases', label: 'Đơn nhập' },
  ];

  return (
    <>
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* ── Header ── */}
      <div className={`bg-white border-b px-6 py-2.5 flex items-center justify-between flex-shrink-0 ${isEditing ? 'border-amber-200' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => isEditing ? setIsEditing(false) : router.push('/dashboard/products')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-md tracking-wide">{product.code}</span>
            <h1 className="text-base font-bold text-gray-900">{product.name}</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
              {product.isActive ? 'Đang bán' : 'Ngừng bán'}
            </span>
            {isEditing && <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 text-amber-600 border-amber-200">Đang chỉnh sửa</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="px-3.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Hủy</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm shadow-blue-200">
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDelete} className="px-3.5 py-1.5 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">Xóa</button>
              <button onClick={startEditing} className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200">Chỉnh sửa</button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mx-6 mt-3 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {saveError}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4">

          {/* ──────────────── LEFT — main panel ──────────────── */}
          <div className="col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              {/* Tab bar */}
              <div className="flex border-b border-gray-100 px-4">
                {tabs.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition -mb-px
                      ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">

                {/* ══════════ THÔNG TIN TAB ══════════ */}
                {tab === 'info' && (
                  <>
                    {/* ────── VIEW MODE ────── */}
                    {!isEditing && (
                      <div>
                        {/* Tên SP + tên nước ngoài */}
                        <div className="mb-4">
                          <h2 className="text-lg font-bold text-gray-900 leading-snug">{product.name}</h2>
                          {(product.nameChinese || product.nameEnglish) && (
                            <div className="mt-1.5 space-y-0.5">
                              {product.nameChinese && (
                                <div className="flex items-start gap-1">
                                  <span className="text-base leading-none mt-0.5 flex-shrink-0">🇨🇳</span>
                                  <span className="text-sm text-gray-500 line-clamp-1">{product.nameChinese}</span>
                                </div>
                              )}
                              {product.nameEnglish && (
                                <div className="flex items-start gap-1">
                                  <span className="text-base leading-none mt-0.5 flex-shrink-0">🇬🇧</span>
                                  <span className="text-sm text-gray-500 line-clamp-1">{product.nameEnglish}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Status badges row */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${product.isSaleable ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${product.isSaleable ? 'bg-emerald-400' : 'bg-gray-300'}`}/>
                            {product.isSaleable ? 'Được bán' : 'Không bán'}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${product.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`}/>
                            {product.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
                          </span>
                          {product.hasVariants && (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium bg-blue-50 text-blue-600 border-blue-100">
                              Có biến thể
                            </span>
                          )}
                          {product.priority != null && (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium bg-amber-50 text-amber-600 border-amber-100">
                              {'★'.repeat(product.priority)}{'☆'.repeat(Math.max(0, 5 - product.priority))}
                              <span className="ml-0.5">Ưu tiên {product.priority}</span>
                            </span>
                          )}
                        </div>

                        {/* ── GIÁ BÁN section — luôn hiện ── */}
                        <SectionLabel>Giá bán</SectionLabel>
                        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-1">
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Giá vốn</p>
                            <p className="text-sm text-gray-700">{product.costPrice != null ? fmtMoney(product.costPrice) : <span className="text-gray-300">—</span>}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Giá bán lẻ</p>
                            {product.sellingPrice != null
                              ? <p className="text-sm font-bold text-blue-600">{fmtMoney(product.sellingPrice)}</p>
                              : <p className="text-sm text-gray-300">—</p>}
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Giá bán buôn</p>
                            <p className="text-sm text-gray-700">{product.wholesalePrice != null ? fmtMoney(product.wholesalePrice) : <span className="text-gray-300">—</span>}</p>
                          </div>
                          {product.averageCost != null && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Giá vốn BQ</p>
                              <p className="text-sm text-gray-600">{fmtMoney(product.averageCost)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Thuế VAT</p>
                            <p className="text-sm text-gray-700">{Math.round(Number(product.defaultVatRate ?? 10))}%</p>
                          </div>
                          {product.sellingPrice && product.costPrice && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Biên lợi nhuận</p>
                              <p className="text-sm font-semibold text-emerald-600">
                                {((Number(product.sellingPrice) - Number(product.costPrice)) / Number(product.sellingPrice) * 100).toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ── Mô tả & Ghi chú — luôn hiện ── */}
                        <SectionLabel>Mô tả & Ghi chú</SectionLabel>
                        <div className="mb-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Mô tả sản phẩm</p>
                          {product.description ? (
                            <>
                              <p className={`text-sm text-gray-700 whitespace-pre-wrap leading-relaxed ${!expandDesc ? 'line-clamp-3' : ''}`}>
                                {product.description}
                              </p>
                              {product.description.length > 120 && (
                                <button onClick={() => setExpandDesc(!expandDesc)}
                                  className="mt-1 text-xs text-blue-500 hover:text-blue-600 font-medium transition">
                                  {expandDesc ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-300 italic">Chưa có mô tả</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Ghi chú nội bộ</p>
                          {product.notes ? (
                            <>
                              <p className={`text-sm text-gray-500 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg px-3 py-2 ${!expandNotes ? 'line-clamp-2' : ''}`}>
                                {product.notes}
                              </p>
                              {product.notes.length > 80 && (
                                <button onClick={() => setExpandNotes(!expandNotes)}
                                  className="mt-1 text-xs text-blue-500 hover:text-blue-600 font-medium transition">
                                  {expandNotes ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-gray-300 italic px-3 py-2 bg-gray-50 rounded-lg">Chưa có ghi chú</p>
                          )}
                        </div>

                        {/* ── NHẬP KHẨU & HẢI QUAN section ── */}
                        {hasImportData && (
                          <>
                            <SectionLabel>Nhập khẩu & Hải quan</SectionLabel>
                            <div className="bg-sky-50/40 border border-sky-100/80 rounded-xl p-3 space-y-2.5">
                              <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
                                {product.customsName && <FieldItem label="Tên hải quan" value={product.customsName} />}
                                {product.costPriceCny != null && <FieldItem label="Giá vốn (CNY)" value={`¥${Number(product.costPriceCny).toLocaleString('vi-VN')}`} />}
                                {product.customsUsdPrice != null && <FieldItem label="Giá HQ (USD)" value={`$${Number(product.customsUsdPrice).toLocaleString('en-US')}`} />}
                              </div>
                              {product.customsDescription && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Mô tả hải quan</p>
                                  <p className={`text-sm text-gray-800 ${!expandCustomsDesc ? 'line-clamp-2' : ''}`}>{product.customsDescription}</p>
                                  {product.customsDescription.length > 80 && (
                                    <button onClick={() => setExpandCustomsDesc(!expandCustomsDesc)}
                                      className="mt-0.5 text-xs text-blue-500 hover:text-blue-600 font-medium transition">
                                      {expandCustomsDesc ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                                    </button>
                                  )}
                                </div>
                              )}
                              {product.packagingInfo && (
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Thông tin đóng gói</p>
                                  <p className={`text-sm text-gray-700 ${!expandPackaging ? 'line-clamp-2' : ''}`}>{product.packagingInfo}</p>
                                  {product.packagingInfo.length > 80 && (
                                    <button onClick={() => setExpandPackaging(!expandPackaging)}
                                      className="mt-0.5 text-xs text-blue-500 hover:text-blue-600 font-medium transition">
                                      {expandPackaging ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                                    </button>
                                  )}
                                </div>
                              )}
                              {product.importNotes && (
                                <div className="pt-2 border-t border-sky-100">
                                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Ghi chú nhập khẩu</p>
                                  <p className={`text-sm text-gray-600 ${!expandImportNotes ? 'line-clamp-2' : ''}`}>{product.importNotes}</p>
                                  {product.importNotes.length > 80 && (
                                    <button onClick={() => setExpandImportNotes(!expandImportNotes)}
                                      className="mt-0.5 text-xs text-blue-500 hover:text-blue-600 font-medium transition">
                                      {expandImportNotes ? 'Thu gọn ↑' : 'Xem thêm ↓'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* ── Meta footer ── */}
                        <div className="mt-5 pt-3 border-t border-gray-50 flex items-center gap-4">
                          <span className="text-[11px] text-gray-300">Tạo {fmtDate(product.createdAt)}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-[11px] text-gray-300">Cập nhật {fmtDate(product.updatedAt)}</span>
                        </div>
                      </div>
                    )}

                    {/* ────── EDIT MODE ────── */}
                    {isEditing && (
                      <div className="space-y-6">
                        {/* Tên SP */}
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                            Tên sản phẩm <span className="text-red-400 normal-case font-normal">*</span>
                          </label>
                          <input value={eName} onChange={(e) => setEName(e.target.value)}
                            placeholder="Tên sản phẩm..." className={`${inputCls} text-base font-medium`} />
                        </div>

                        {/* ─ NHẬN DIỆN ─ */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nhận diện</span>
                            <div className="flex-1 border-t border-gray-100"/>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Mã sản phẩm</label>
                              <input value={eCode} onChange={(e) => setECode(e.target.value)} placeholder="SP001" className={`${inputCls} font-mono`}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Danh mục</label>
                              <select value={eCategory} onChange={(e) => setECategory(e.target.value)} className={inputCls}>
                                <option value="">-- Chọn --</option>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Đơn vị tính</label>
                              <select value={eUnit} onChange={(e) => setEUnit(e.target.value)} className={inputCls}>
                                <option value="">-- Chọn --</option>
                                {activeUnits.map((u) => <option key={u.id} value={u.name}>{u.name} ({u.code})</option>)}
                                {eUnit && !activeUnits.some((u) => u.name === eUnit) && <option value={eUnit}>{eUnit} (cũ)</option>}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Thương hiệu</label>
                              <input value={eBrand} onChange={(e) => setEBrand(e.target.value)} placeholder="Hãng / thương hiệu" className={inputCls}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Barcode</label>
                              <input value={eBarcode} onChange={(e) => setEBarcode(e.target.value)} placeholder="Mã vạch" className={`${inputCls} font-mono`}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Mã NCC</label>
                              <input value={eSupplierCode} onChange={(e) => setESupplierCode(e.target.value)} placeholder="Mã của NCC" className={`${inputCls} font-mono`}/>
                            </div>
                          </div>
                        </div>

                        {/* ─ GIÁ BÁN ─ */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Giá bán</span>
                            <div className="flex-1 border-t border-gray-100"/>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Giá vốn</label>
                              <div className="relative">
                                <PriceInput value={eCostPrice} onChange={setECostPrice} className={`${inputCls} pr-5 text-right`}/>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Giá bán lẻ</label>
                              <div className="relative">
                                <PriceInput value={eSellingPrice} onChange={setESellingPrice} className={`${inputCls} pr-5 text-right font-semibold text-blue-600`}/>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Giá bán buôn</label>
                              <div className="relative">
                                <PriceInput value={eWholesalePrice} onChange={setEWholesalePrice} className={`${inputCls} pr-5 text-right`}/>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Thuế suất VAT</label>
                              <select value={eDefaultVatRate} onChange={(e) => setEDefaultVatRate(e.target.value)} className={inputCls}>
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="8">8%</option>
                                <option value="10">10%</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* ─ KHO & VẬN CHUYỂN ─ */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kho & Vận chuyển</span>
                            <div className="flex-1 border-t border-gray-100"/>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Vị trí kho</label>
                              <input value={eWarehouseLocation} onChange={(e) => setEWarehouseLocation(e.target.value)} placeholder="VD: Kệ A1" className={inputCls}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Ngưỡng cảnh báo</label>
                              <input type="number" value={eLowStockThreshold} onChange={(e) => setELowStockThreshold(e.target.value)} placeholder="VD: 5" min={0} className={inputCls}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Bảo hành (tháng)</label>
                              <input type="number" value={eWarrantyMonths} onChange={(e) => setEWarrantyMonths(e.target.value)} placeholder="0" min={0} max={360} className={inputCls}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Trọng lượng</label>
                              <div className="flex gap-1">
                                <input type="number" value={eWeight} onChange={(e) => setEWeight(e.target.value)} placeholder="0" min={0} step="0.001" className={`${inputCls} flex-1`}/>
                                <select value={eWeightUnit} onChange={(e) => setEWeightUnit(e.target.value)}
                                  className="px-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-14 bg-white">
                                  <option value="kg">kg</option>
                                  <option value="g">g</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ─ TRẠNG THÁI ─ */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trạng thái</span>
                            <div className="flex-1 border-t border-gray-100"/>
                          </div>
                          <div className="flex flex-wrap gap-6 items-start">
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={eIsSaleable} onChange={(e) => setEIsSaleable(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"/>
                              <div>
                                <div className="text-sm text-gray-700 font-medium">Được bán</div>
                                <div className="text-[11px] text-gray-400">Hiện trong form tạo đơn</div>
                              </div>
                            </label>
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={eIsActive} onChange={(e) => setEIsActive(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"/>
                              <div>
                                <div className="text-sm text-gray-700 font-medium">Hoạt động</div>
                                <div className="text-[11px] text-gray-400">Bỏ tick để ngừng bán</div>
                              </div>
                            </label>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Độ ưu tiên (1–5)</label>
                              <input type="number" value={ePriority} onChange={(e) => setEPriority(e.target.value)}
                                placeholder="—" min={1} max={5} className={`${inputCls} w-20`}/>
                            </div>
                          </div>
                        </div>

                        {/* ─ MÔ TẢ & GHI CHÚ ─ */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mô tả & Ghi chú</span>
                            <div className="flex-1 border-t border-gray-100"/>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Tags (phân cách bằng dấu phẩy)</label>
                              <input value={eTagsInput} onChange={(e) => setETagsInput(e.target.value)}
                                placeholder="bán chạy, mùa hè, ký gửi..." className={inputCls}/>
                              {eTagsInput && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {eTagsInput.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                                    <span key={i} className="text-xs bg-blue-50 text-blue-500 border border-blue-100 px-2 py-0.5 rounded-full">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Mô tả sản phẩm</label>
                              <textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)}
                                rows={3} placeholder="Mô tả chi tiết, thông số kỹ thuật..." className={inputCls}/>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Ghi chú nội bộ</label>
                              <textarea value={eNotes} onChange={(e) => setENotes(e.target.value)}
                                rows={2} placeholder="Ghi chú chỉ dùng nội bộ..." className={inputCls}/>
                            </div>
                          </div>
                        </div>

                        {/* ─ NHẬP KHẨU & HẢI QUAN ─ */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nhập khẩu & Hải quan</span>
                            <div className="flex-1 border-t border-gray-100"/>
                            <span className="text-[10px] text-gray-300 italic">Tùy chọn</span>
                          </div>
                          <div className="bg-sky-50/40 border border-sky-100/80 rounded-xl p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Tên tiếng Trung</label>
                                <textarea rows={2} value={eNameChinese} onChange={(e) => setENameChinese(e.target.value)} placeholder="品名 ..." className={inputCls + ' resize-none'}/>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Tên tiếng Anh</label>
                                <textarea rows={2} value={eNameEnglish} onChange={(e) => setENameEnglish(e.target.value)} placeholder="Product name in English" className={inputCls + ' resize-none'}/>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Mã HS</label>
                                <input value={eHsCode} onChange={(e) => setEHsCode(e.target.value)} placeholder="VD: 8543.70.99" className={`${inputCls} font-mono`}/>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Tên hải quan</label>
                                <input value={eCustomsName} onChange={(e) => setECustomsName(e.target.value)} placeholder="Tên khai báo HQ" className={inputCls}/>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Mô tả hải quan</label>
                                <textarea rows={2} value={eCustomsDescription} onChange={(e) => setECustomsDescription(e.target.value)} placeholder="Mô tả khai báo" className={inputCls + ' resize-none'}/>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Giá vốn (CNY ¥)</label>
                                <input type="number" value={eCostPriceCny} onChange={(e) => setECostPriceCny(e.target.value)} placeholder="0.00" min={0} step="0.01" className={inputCls}/>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Giá hải quan (USD $)</label>
                                <input type="number" value={eCustomsUsdPrice} onChange={(e) => setECustomsUsdPrice(e.target.value)} placeholder="0.00" min={0} step="0.01" className={inputCls}/>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Thông tin đóng gói</label>
                                <textarea rows={2} value={ePackagingInfo} onChange={(e) => setEPackagingInfo(e.target.value)} placeholder="VD: 12 cái/thùng" className={inputCls + ' resize-none'}/>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-1">Ghi chú nhập khẩu</label>
                              <textarea value={eImportNotes} onChange={(e) => setEImportNotes(e.target.value)}
                                rows={2} placeholder="Ghi chú riêng cho đơn nhập / hải quan..." className={inputCls}/>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── BIẾN THỂ (luôn hiện) ── */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <h3 className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Biến thể</span>
                        {(product.variants?.length ?? 0) > 0 && (
                          <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{product.variants.length}</span>
                        )}
                        <button onClick={openVariantModal}
                          className="ml-auto text-[11px] px-2 py-0.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition font-medium">
                          Quản lý
                        </button>
                      </h3>
                      {product.variants?.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-l-lg">SKU</th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Thuộc tính</th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Giá vốn</th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Giá bán</th>
                              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-r-lg">TT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.variants.map((v) => (
                              <tr key={v.id} className="border-t border-gray-50">
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{v.sku}</td>
                                <td className="px-3 py-2.5 text-xs text-gray-500">
                                  {Object.entries(v.attributes).map(([k, val]) => (
                                    <span key={k} className="inline-block mr-2"><span className="text-gray-300">{k}:</span> {val}</span>
                                  ))}
                                </td>
                                <td className="px-3 py-2.5 text-sm text-gray-500">{fmtMoney(v.costPrice)}</td>
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
                        <p className="text-gray-300 text-sm text-center py-3">Chưa có biến thể nào</p>
                      )}
                    </div>

                    {/* ── TÊN HĐ VAT (luôn hiện) ── */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <h3 className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tên HĐ VAT</span>
                        {(product.invoiceNames?.length ?? 0) > 0 && (
                          <span className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{product.invoiceNames.length}</span>
                        )}
                      </h3>
                      {product.invoiceNames?.length > 0 ? (
                        <div className="space-y-2">
                          {product.invoiceNames.map((inv) => (
                            <div key={inv.id} className={`p-3 rounded-xl border ${inv.isDefault ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-gray-50/40'}`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm text-gray-800">{inv.invoiceName}</span>
                                {inv.isDefault && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-medium">Mặc định</span>}
                              </div>
                              {inv.invoiceUnit && <p className="text-xs text-gray-500">Đơn vị: <span className="font-medium">{inv.invoiceUnit}</span></p>}
                              {inv.notes && <p className="text-xs text-gray-400 mt-0.5">{inv.notes}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-300 text-sm text-center py-3">Chưa có tên hóa đơn nào</p>
                      )}
                    </div>

                  </>
                )}

                {/* ══════════ LỊCH SỬ KHO TAB ══════════ */}
                {tab === 'history' && (
                  <div>
                    {/* Filter bar */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <input type="date" value={movDateFrom}
                        onChange={(e) => { setMovDateFrom(e.target.value); setMovPage(1); }}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"/>
                      <span className="text-gray-300 text-sm">—</span>
                      <input type="date" value={movDateTo}
                        onChange={(e) => { setMovDateTo(e.target.value); setMovPage(1); }}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"/>
                      <select value={movTypeFilter}
                        onChange={(e) => { setMovTypeFilter(e.target.value); setMovPage(1); }}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700">
                        <option value="">Tất cả loại</option>
                        <option value="PURCHASE_IN">Nhập kho</option>
                        <option value="SALE_OUT">Xuất bán</option>
                        <option value="RETURN_IN">Trả về</option>
                        <option value="RETURN_OUT">Xuất trả</option>
                        <option value="ADJUSTMENT">Điều chỉnh</option>
                        <option value="STOCKCOUNT">Kiểm kho</option>
                        <option value="SUPPLIER_RETURN_OUT">Trả NCC</option>
                        <option value="DAMAGE">Hàng hỏng</option>
                        <option value="MANUAL_IN">Nhập thủ công</option>
                        <option value="MANUAL_OUT">Xuất thủ công</option>
                      </select>
                      {(movDateFrom || movDateTo || movTypeFilter) && (
                        <button onClick={() => { setMovDateFrom(''); setMovDateTo(''); setMovTypeFilter(''); setMovPage(1); }}
                          className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg bg-white transition">
                          Xóa lọc
                        </button>
                      )}
                      {historyLoading && (
                        <svg className="animate-spin w-4 h-4 text-gray-300 ml-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      )}
                      {!historyLoading && movTotal > 0 && (
                        <span className="ml-auto text-[11px] text-gray-400">{movTotal.toLocaleString('vi-VN')} giao dịch</span>
                      )}
                    </div>

                    {historyLoading && movements.length === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      </div>
                    ) : movements.length === 0 ? (
                      <p className="text-gray-300 text-sm text-center py-10">Không có biến động kho phù hợp</p>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-l-lg whitespace-nowrap">Thời gian</th>
                                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Loại</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Thay đổi</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">Tồn trước</th>
                                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">Tồn sau</th>
                                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">Nguồn</th>
                                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Ghi chú</th>
                                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-r-lg">NV</th>
                              </tr>
                            </thead>
                            <tbody>
                              {movements.map((m) => {
                                const meta = MOVE_LABELS[m.type] ?? { label: m.type, color: 'text-gray-500 bg-gray-50 border-gray-200' };
                                const delta = Number(m.quantity);
                                const refHref = m.referenceType === 'purchase_order'
                                  ? `/dashboard/don-hang-nhap/${m.referenceId}`
                                  : null;
                                const codeMatch = m.notes?.match(/\b([A-Z]{2,3}-\d{4,6}(?:-\d{3,})?)\b/);
                                const refLabel = codeMatch ? codeMatch[1] : (m.referenceId ? `#${m.referenceId}` : null);
                                return (
                                  <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                                    <td className="px-3 py-2.5"><span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>{meta.label}</span></td>
                                    <td className="px-3 py-2.5 text-right">
                                      <span className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{delta > 0 ? '+' : ''}{Number(delta).toLocaleString('vi-VN')}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm text-gray-400">{Math.floor(Number(m.stockBefore)).toLocaleString('vi-VN')}</td>
                                    <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">{Math.floor(Number(m.stockAfter)).toLocaleString('vi-VN')}</td>
                                    <td className="px-3 py-2.5">
                                      {refHref && refLabel ? (
                                        <a href={refHref} className="text-[11px] font-mono text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">{refLabel}</a>
                                      ) : <span className="text-xs text-gray-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">{m.notes || '—'}</td>
                                    <td className="px-3 py-2.5 text-xs text-gray-500">{m.performedBy?.name || '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {movTotal > movLimit && (() => {
                          const totalPages = Math.ceil(movTotal / movLimit);
                          return (
                            <div className="flex items-center justify-between mt-4">
                              <p className="text-[11px] text-gray-400">
                                Trang {movPage}/{totalPages} · {movTotal.toLocaleString('vi-VN')} giao dịch
                              </p>
                              <div className="flex gap-1">
                                <button disabled={movPage <= 1}
                                  onClick={() => setMovPage(movPage - 1)}
                                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition">
                                  ‹
                                </button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                  const p = totalPages <= 5 ? i + 1
                                    : movPage <= 3 ? i + 1
                                    : movPage >= totalPages - 2 ? totalPages - 4 + i
                                    : movPage - 2 + i;
                                  return (
                                    <button key={p} onClick={() => setMovPage(p)}
                                      className={`px-2.5 py-1 text-xs border rounded-lg transition ${p === movPage ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}>
                                      {p}
                                    </button>
                                  );
                                })}
                                <button disabled={movPage >= totalPages}
                                  onClick={() => setMovPage(movPage + 1)}
                                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition">
                                  ›
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* ══════════ LỊCH SỬ ĐƠN NHẬP TAB ══════════ */}
                {tab === 'purchases' && (
                  <div>
                    {purchasesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      </div>
                    ) : purchaseHistory.length === 0 ? (
                      <p className="text-gray-300 text-sm text-center py-10">Chưa có đơn nhập nào cho sản phẩm này</p>
                    ) : (() => {
                      const totalQty = purchaseHistory.reduce((s, r) => s + r.quantity, 0);
                      const totalVnd = purchaseHistory.reduce((s, r) => s + r.totalVnd, 0);
                      const avgPrice = totalQty > 0
                        ? purchaseHistory.reduce((s, r) => s + r.priceVnd * r.quantity, 0) / totalQty
                        : 0;
                      const statusLabel: Record<string, { label: string; cls: string }> = {
                        draft:     { label: 'Nháp',      cls: 'text-gray-500 bg-gray-50 border-gray-200' },
                        ordered:   { label: 'Đặt hàng',  cls: 'text-blue-600 bg-blue-50 border-blue-100' },
                        received:  { label: 'Đã nhận',   cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                        cancelled: { label: 'Huỷ',       cls: 'text-red-500 bg-red-50 border-red-100' },
                      };
                      return (
                        <>
                          {/* Summary bar */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Tổng đơn</p>
                              <p className="text-lg font-bold text-blue-700">{purchaseHistory.length}</p>
                            </div>
                            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">Tổng SL nhập</p>
                              <p className="text-lg font-bold text-emerald-700">{totalQty.toLocaleString('vi-VN')}</p>
                            </div>
                            <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-center">
                              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-0.5">Giá vốn TB</p>
                              <p className="text-lg font-bold text-purple-700">{avgPrice > 0 ? Math.round(avgPrice).toLocaleString('vi-VN') + 'đ' : '—'}</p>
                            </div>
                          </div>

                          {/* Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-l-lg whitespace-nowrap">Mã đơn</th>
                                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">Ngày nhập</th>
                                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">Nhà cung cấp</th>
                                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase">SL</th>
                                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">Đơn giá</th>
                                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">Thành tiền</th>
                                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-r-lg">TT</th>
                                </tr>
                              </thead>
                              <tbody>
                                {purchaseHistory.map((row, i) => {
                                  const st = statusLabel[row.status] ?? { label: row.status, cls: 'text-gray-500 bg-gray-50 border-gray-200' };
                                  const isForeign = row.currency !== 'VND';
                                  return (
                                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                                      <td className="px-3 py-2.5">
                                        <a href={`/dashboard/don-hang-nhap/${row.poId}`}
                                          className="font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium">
                                          {row.poCode}
                                        </a>
                                      </td>
                                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                                        {row.date ? fmtDate(row.date) : '—'}
                                      </td>
                                      <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[140px] truncate">
                                        {row.supplierName || <span className="text-gray-300">—</span>}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                                        {row.quantity.toLocaleString('vi-VN')}
                                        <span className="text-[10px] text-gray-400 ml-1">{row.unit}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                                        {isForeign ? (
                                          <span className="text-gray-700">
                                            {row.priceForeign.toLocaleString('vi-VN')} {row.currency === 'CNY' ? '¥' : '$'}
                                            <span className="block text-[10px] text-gray-400">≈ {Math.round(row.priceVnd).toLocaleString('vi-VN')}đ</span>
                                          </span>
                                        ) : (
                                          <span className="text-gray-700">{Math.round(row.priceVnd).toLocaleString('vi-VN')}đ</span>
                                        )}
                                        {row.discountPercent > 0 && (
                                          <span className="block text-[10px] text-emerald-600">-{row.discountPercent}%</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-800 whitespace-nowrap">
                                        {Math.round(row.totalVnd).toLocaleString('vi-VN')}đ
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-gray-100">
                                  <td colSpan={3} className="px-3 py-2 text-[11px] font-semibold text-gray-400">Tổng cộng</td>
                                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-800">{totalQty.toLocaleString('vi-VN')}</td>
                                  <td></td>
                                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-800">{Math.round(totalVnd).toLocaleString('vi-VN')}đ</td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ──────────────── RIGHT sidebar ──────────────── */}
          <div className="space-y-3">

            {/* Ảnh sản phẩm — top of sidebar */}
            {(() => {
              const hasImages = product.images && product.images.length > 0;
              const displayUrl = hasImages ? (activeImgUrl || (mainImg?.url || product.images[0].url)) : null;
              const visibleThumbs = showAllImgs ? product.images : product.images?.slice(0, 4) ?? [];
              const hiddenCount = (product.images?.length ?? 0) - 4;
              return (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {hasImages && displayUrl ? (
                    <img src={displayUrl} alt={product.name} className="w-full h-44 object-cover" />
                  ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center text-gray-300 gap-2">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <span className="text-xs">Chưa có ảnh</span>
                    </div>
                  )}
                  {hasImages && product.images.length > 1 && (
                    <div className="px-2 pt-2 flex gap-1.5 flex-wrap">
                      {visibleThumbs.map((img) => (
                        <button key={img.id} onClick={() => setActiveImgUrl(img.url)}
                          className={`w-11 h-11 rounded-lg overflow-hidden border-2 transition flex-shrink-0 ${img.url === displayUrl ? 'border-blue-400' : 'border-transparent hover:border-gray-200'}`}>
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {!showAllImgs && hiddenCount > 0 && (
                        <button onClick={() => setShowAllImgs(true)}
                          className="w-11 h-11 rounded-lg bg-gray-100 text-xs text-gray-500 font-medium flex items-center justify-center hover:bg-gray-200 transition flex-shrink-0">
                          +{hiddenCount}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="px-3 py-2">
                    <button onClick={() => { setImgError(''); setImageModal(true); }}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium text-center py-1 hover:bg-blue-50 rounded-lg transition">
                      Quản lý ảnh {product.images?.length ? `(${product.images.length})` : ''}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Tồn kho — compact */}
            <div className={`bg-white rounded-xl border shadow-sm p-4 ${isOutOfStock ? 'border-red-100' : isLowStock ? 'border-amber-100' : 'border-gray-100'}`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tồn kho</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-gray-800'}`}>
                  {stockQty.toLocaleString('vi-VN')}
                </span>
                <span className="text-sm text-gray-400">{product.unit || 'đvt'}</span>
              </div>
              {isOutOfStock && <span className="inline-block mt-1.5 text-[11px] text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-medium">Hết hàng</span>}
              {isLowStock && <span className="inline-block mt-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-medium">Sắp hết</span>}
              <button onClick={() => setTab('history')} className="w-full mt-2.5 text-[11px] text-blue-500 hover:text-blue-600 font-medium text-left transition">
                Xem lịch sử biến động →
              </button>
            </div>

            {/* Thông tin nhanh */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Thông tin nhanh</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Nhận diện — luôn hiện tất cả */}
                <div className="col-span-2">
                  <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-1.5">Nhận diện</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Mã SP</p>
                      <p className="text-xs font-mono text-gray-700 truncate">{product.code}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Danh mục</p>
                      <p className={`text-xs truncate ${product.category ? 'text-gray-700' : 'text-gray-300'}`}>{product.category || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Đơn vị</p>
                      <p className={`text-xs ${product.unit ? 'text-gray-700' : 'text-gray-300'}`}>{product.unit || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Thương hiệu</p>
                      <p className={`text-xs truncate ${product.brand ? 'text-gray-700' : 'text-gray-300'}`}>{product.brand || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Barcode</p>
                      <p className={`text-xs font-mono truncate ${product.barcode ? 'text-gray-600' : 'text-gray-300'}`}>{product.barcode || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Mã NCC</p>
                      <p className={`text-xs font-mono truncate ${product.supplierCode ? 'text-gray-600' : 'text-gray-300'}`}>{product.supplierCode || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Kho & Logistics — luôn hiện */}
                <div className="col-span-2 pt-2.5 border-t border-gray-50">
                  <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-1.5">Kho & Logistics</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Vị trí kho</p>
                      <p className={`text-xs ${product.warehouseLocation ? 'text-gray-700' : 'text-gray-300'}`}>{product.warehouseLocation || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Ngưỡng cảnh báo</p>
                      <p className={`text-xs ${product.lowStockThreshold != null ? 'text-gray-700' : 'text-gray-300'}`}>
                        {product.lowStockThreshold != null ? `${product.lowStockThreshold} ${product.unit || 'cái'}` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Bảo hành</p>
                      <p className={`text-xs ${product.warrantyMonths != null ? 'text-gray-700' : 'text-gray-300'}`}>
                        {product.warrantyMonths != null ? `${product.warrantyMonths} tháng` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Trọng lượng</p>
                      <p className={`text-xs ${product.weight != null ? 'text-gray-700' : 'text-gray-300'}`}>
                        {product.weight != null ? `${product.weight} ${product.weightUnit || 'kg'}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hải quan — chỉ hiện khi có mã HS */}
                {product.hsCode && (
                  <div className="col-span-2 pt-2.5 border-t border-gray-50">
                    <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-1.5">Hải quan</p>
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Mã HS</p>
                      <p className="text-xs font-mono text-gray-700">{product.hsCode}</p>
                    </div>
                  </div>
                )}

                {/* Tags — luôn hiện */}
                <div className="col-span-2 pt-2.5 border-t border-gray-50">
                  <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest mb-1.5">Tags</p>
                  {product.tags && product.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((t, i) => (
                        <span key={i} className="text-[10px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300">Chưa có tags</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

    {/* ══════════ VARIANT MODAL ══════════ */}
    {variantModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Quản lý biến thể</h2>
              <p className="text-xs text-gray-400 mt-0.5">{product.name}</p>
            </div>
            <button onClick={() => setVariantModal(false)} className="text-gray-300 hover:text-gray-500 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Hint */}
            <p className="text-xs text-gray-400 mb-3">Thuộc tính nhập dạng: <span className="font-mono bg-gray-50 px-1 rounded">Màu: Đỏ, Size: L</span></p>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase rounded-l-lg w-32">SKU *</th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase">Thuộc tính</th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase w-28">Giá vốn</th>
                    <th className="text-left px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase w-28">Giá bán</th>
                    <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase w-16">Hiện</th>
                    <th className="px-2 py-2 rounded-r-lg w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {editVariants.map((v, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-1 py-1.5">
                        <input value={v.sku} onChange={e => setEditVariants(prev => prev.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                          placeholder="SKU-001" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"/>
                      </td>
                      <td className="px-1 py-1.5">
                        <input value={v.attrStr} onChange={e => setEditVariants(prev => prev.map((x, j) => j === i ? { ...x, attrStr: e.target.value } : x))}
                          placeholder="Màu: Đỏ, Size: L" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="text" inputMode="numeric" value={v.costPrice}
                          onChange={e => setEditVariants(prev => prev.map((x, j) => j === i ? { ...x, costPrice: e.target.value.replace(/\D/g, '') } : x))}
                          placeholder="0" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"/>
                      </td>
                      <td className="px-1 py-1.5">
                        <input type="text" inputMode="numeric" value={v.sellingPrice}
                          onChange={e => setEditVariants(prev => prev.map((x, j) => j === i ? { ...x, sellingPrice: e.target.value.replace(/\D/g, '') } : x))}
                          placeholder="0" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"/>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => setEditVariants(prev => prev.map((x, j) => j === i ? { ...x, isActive: !x.isActive } : x))}
                          className={`w-8 h-4 rounded-full transition-colors relative inline-flex ${v.isActive ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                          <span className={`w-3 h-3 bg-white rounded-full shadow absolute top-0.5 transition-all ${v.isActive ? 'left-4' : 'left-0.5'}`}/>
                        </button>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => setEditVariants(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-500 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {editVariants.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-300 text-sm py-6">Chưa có biến thể nào. Nhấn "+ Thêm" để bắt đầu.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={() => setEditVariants(prev => [...prev, { sku: '', attrStr: '', costPrice: '', sellingPrice: '', barcode: '', isActive: true, isNew: true }])}
              className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Thêm biến thể
            </button>

            {variantError && <p className="mt-3 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{variantError}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <p className="text-xs text-gray-400">{editVariants.length} biến thể</p>
            <div className="flex gap-2">
              <button onClick={() => setVariantModal(false)} disabled={variantSaving}
                className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
                Hủy
              </button>
              <button onClick={saveVariants} disabled={variantSaving}
                className="px-5 py-2 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                {variantSaving && <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                Lưu biến thể
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {imageModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Quản lý ảnh</h2>
              <p className="text-xs text-gray-400 mt-0.5">{product.name}</p>
            </div>
            <button onClick={() => setImageModal(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-lg leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {imgError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{imgError}</div>
            )}
            {product.images && product.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {product.images.map((img: Image) => (
                  <div key={img.id} className="relative group rounded-xl overflow-hidden border border-gray-100 shadow-sm aspect-square bg-gray-50">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {img.isMain && (
                      <span className="absolute top-1.5 left-1.5 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">Chính</span>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      {!img.isMain && (
                        <button onClick={() => setMainImg(img.id)}
                          className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition text-blue-600 text-xs font-bold"
                          title="Đặt làm ảnh chính">★</button>
                      )}
                      <button onClick={() => deleteImg(img.id)}
                        className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition text-red-500"
                        title="Xóa ảnh">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">Chưa có ảnh nào</div>
            )}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thêm ảnh</p>
              <label className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition ${imgUploading ? 'border-blue-200 bg-blue-50 cursor-not-allowed' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                {imgUploading ? (
                  <><svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><span className="text-xs text-blue-400">Đang upload...</span></>
                ) : (
                  <><svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span className="text-xs text-gray-400">Click để chọn ảnh <span className="text-gray-300">(max 5MB)</span></span></>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={imgUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImageFile(f); e.target.value = ''; }} />
              </label>
              <div className="flex gap-2">
                <input type="text" value={imgUrlInput} onChange={e => setImgUrlInput(e.target.value)}
                  placeholder="Hoặc nhập URL ảnh..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  onKeyDown={e => { if (e.key === 'Enter') addImageUrl(); }} />
                <button onClick={addImageUrl} disabled={imgUploading || !imgUrlInput.trim()}
                  className="text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-40">
                  Thêm
                </button>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
            <button onClick={() => setImageModal(false)}
              className="px-5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Đóng
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
