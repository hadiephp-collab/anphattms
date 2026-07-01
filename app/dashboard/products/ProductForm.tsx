'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/products';
import { productCategoriesApi } from '@/lib/product-categories';
import { unitsApi } from '@/lib/units';
import { getToken } from '@/lib/auth';

interface ProductVariant {
  id?: number; sku: string; attributes: Record<string, string>;
  costPrice?: number | string; sellingPrice?: number | string; barcode?: string; isActive?: boolean;
}
interface ProductImage { id: number; url: string; isMain: boolean; sortOrder: number; }
interface InvoiceName { id?: number; invoiceName: string; invoiceUnit?: string; isDefault?: boolean; notes?: string; }
interface ProductData {
  id?: number; code?: string; name?: string; category?: string; brand?: string; unit?: string;
  costPrice?: number; sellingPrice?: number; wholesalePrice?: number; defaultVatRate?: number;
  lowStockThreshold?: number; barcode?: string; description?: string; notes?: string;
  hasVariants?: boolean; isSaleable?: boolean; isActive?: boolean;
  warehouseLocation?: string; supplierCode?: string; weight?: number; weightUnit?: string;
  tags?: string[]; defaultSupplierId?: number;
  variants?: ProductVariant[]; images?: ProductImage[]; invoiceNames?: InvoiceName[];
}

interface AttrDef { name: string; values: string; }

const fmt = (v: number | string | undefined) => v != null && v !== '' ? Number(v).toLocaleString('vi-VN') : '';

function PriceInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : (value ? Number(value).toLocaleString('vi-VN') : '');
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder="0"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, '');
        onChange(raw);
      }}
      className={className}
    />
  );
}

function generateCombinations(attrs: AttrDef[]): Record<string, string>[] {
  const valid = attrs.filter((a) => a.name.trim() && a.values.trim());
  if (!valid.length) return [];
  const valueArrays = valid.map((a) => a.values.split(',').map((v) => v.trim()).filter(Boolean));
  const result: Record<string, string>[] = [];
  function recurse(idx: number, current: Record<string, string>) {
    if (idx === valid.length) { result.push({ ...current }); return; }
    for (const val of valueArrays[idx]) {
      recurse(idx + 1, { ...current, [valid[idx].name.trim()]: val });
    }
  }
  recurse(0, {});
  return result;
}

function skuFromAttrs(code: string, attrs: Record<string, string>): string {
  const parts = Object.values(attrs).map((v) => v.replace(/\s+/g, '').substring(0, 6).toUpperCase());
  return `${code}-${parts.join('-')}`;
}

export default function ProductForm({ initialData, mode }: { initialData?: ProductData; mode: 'create' | 'edit' }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Basic fields
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [unit, setUnit] = useState(initialData?.unit || '');
  const [costPrice, setCostPrice] = useState(initialData?.costPrice?.toString() || '');
  const [sellingPrice, setSellingPrice] = useState(initialData?.sellingPrice?.toString() || '');
  const [wholesalePrice, setWholesalePrice] = useState(initialData?.wholesalePrice?.toString() || '');
  const [defaultVatRate, setDefaultVatRate] = useState(initialData?.defaultVatRate?.toString() || '10');
  const [lowStockThreshold, setLowStockThreshold] = useState(initialData?.lowStockThreshold?.toString() || '');
  const [barcode, setBarcode] = useState(initialData?.barcode || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [warehouseLocation, setWarehouseLocation] = useState(initialData?.warehouseLocation || '');
  const [supplierCode, setSupplierCode] = useState(initialData?.supplierCode || '');
  const [weight, setWeight] = useState(initialData?.weight?.toString() || '');
  const [weightUnit, setWeightUnit] = useState(initialData?.weightUnit || 'kg');
  const [isSaleable, setIsSaleable] = useState(initialData?.isSaleable !== false);
  const [isActive, setIsActive] = useState(initialData?.isActive !== false);
  const [tagsInput, setTagsInput] = useState((initialData?.tags || []).join(', '));
  const [activeUnits, setActiveUnits] = useState<{ id: number; name: string; code: string }[]>([]);

  // Variants
  const [hasVariants, setHasVariants] = useState(initialData?.hasVariants || false);
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([{ name: '', values: '' }]);
  const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
  const [variantsGenerated, setVariantsGenerated] = useState(false);

  // Images
  const [images, setImages] = useState<ProductImage[]>(initialData?.images || []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgDragging, setImgDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [invoiceNameError, setInvoiceNameError] = useState('');
  const [variantMsg, setVariantMsg] = useState('');

  // Invoice names
  const [invoiceNames, setInvoiceNames] = useState<InvoiceName[]>(initialData?.invoiceNames || []);
  const [newInvoice, setNewInvoice] = useState<InvoiceName>({ invoiceName: '', invoiceUnit: '', isDefault: false, notes: '' });

  useEffect(() => {
    productCategoriesApi.getNames().then(setCategories).catch(() => {});
    unitsApi.getActive().then(setActiveUnits).catch(() => {});
  }, []);

  // Pre-populate attrDefs from existing variants if editing
  useEffect(() => {
    if (mode === 'edit' && initialData?.variants?.length) {
      const firstVariant = initialData.variants[0];
      if (firstVariant.attributes) {
        const defs = Object.entries(firstVariant.attributes).map(([name, _]) => {
          const vals = [...new Set(initialData.variants!.map((v) => v.attributes[name]).filter(Boolean))];
          return { name, values: vals.join(', ') };
        });
        setAttrDefs(defs);
        setVariantsGenerated(true);
      }
    }
  }, [mode, initialData]);

  function generateVariants() {
    const valid = attrDefs.filter((a) => a.name.trim() && a.values.trim());
    if (!valid.length) {
      setVariantMsg('error:Cần điền đủ Tên thuộc tính VÀ Giá trị (cột bên phải) cho ít nhất 1 dòng');
      return;
    }
    const combos = generateCombinations(attrDefs);
    const currentCode = code || 'SP';
    const newVariants: ProductVariant[] = combos.map((attrs) => ({
      sku: skuFromAttrs(currentCode, attrs),
      attributes: attrs,
      costPrice: costPrice || undefined,
      sellingPrice: sellingPrice || undefined,
    }));
    setVariants(newVariants);
    setVariantsGenerated(true);
    setVariantMsg(`ok:Đã tạo ${newVariants.length} biến thể — kiểm tra bảng bên dưới rồi bấm Lưu`);
  }

  async function uploadSingleFile(file: File, isFirst: boolean): Promise<void> {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API}/uploads/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload thất bại');
    const url: string = data.url;
    if (mode === 'edit' && initialData?.id) {
      const img = await productsApi.addImage(initialData.id, { url, isMain: isFirst && images.length === 0 });
      setImages((prev) => [...prev, img]);
    } else {
      setImages((prev) => [...prev, { id: Date.now() + Math.random(), url, isMain: isFirst && prev.length === 0, sortOrder: prev.length }]);
    }
  }

  async function uploadAndAddImages(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    const oversize = arr.find((f) => f.size > 5 * 1024 * 1024);
    if (oversize) { setError(`"${oversize.name}" vượt quá 5MB`); return; }
    setUploadingImg(true);
    setUploadProgress({ done: 0, total: arr.length });
    try {
      for (let i = 0; i < arr.length; i++) {
        await uploadSingleFile(arr[i], i === 0);
        setUploadProgress({ done: i + 1, total: arr.length });
      }
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || 'Upload ảnh thất bại');
    } finally {
      setUploadingImg(false);
      setUploadProgress(null);
    }
  }

  async function addImage() {
    if (!newImageUrl.trim()) return;
    if (mode === 'edit' && initialData?.id) {
      const img = await productsApi.addImage(initialData.id, { url: newImageUrl, isMain: images.length === 0 });
      setImages((prev) => [...prev, img]);
    } else {
      setImages((prev) => [...prev, { id: Date.now(), url: newImageUrl, isMain: prev.length === 0, sortOrder: prev.length }]);
    }
    setNewImageUrl('');
  }

  async function removeImage(imgId: number) {
    if (mode === 'edit' && initialData?.id) {
      await productsApi.deleteImage(initialData.id, imgId);
    }
    setImages((prev) => prev.filter((i) => i.id !== imgId));
  }

  async function setMainImage(imgId: number) {
    if (mode === 'edit' && initialData?.id) {
      await productsApi.setMainImage(initialData.id, imgId);
    }
    setImages((prev) => prev.map((i) => ({ ...i, isMain: i.id === imgId })));
  }

  async function addInvoiceName() {
    if (!newInvoice.invoiceName.trim()) {
      setInvoiceNameError('Vui lòng nhập tên trên hóa đơn');
      return;
    }
    setInvoiceNameError('');
    if (mode === 'edit' && initialData?.id) {
      const saved = await productsApi.addInvoiceName(initialData.id, newInvoice);
      setInvoiceNames((prev) => [...prev, saved]);
    } else {
      setInvoiceNames((prev) => [...prev, { ...newInvoice, id: Date.now() }]);
    }
    setNewInvoice({ invoiceName: '', invoiceUnit: '', isDefault: false, notes: '' });
  }

  async function removeInvoiceName(idx: number, id?: number) {
    if (mode === 'edit' && initialData?.id && id) {
      await productsApi.deleteInvoiceName(initialData.id, id);
    }
    setInvoiceNames((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Tên sản phẩm không được để trống'); return; }
    // Auto-save pending invoice name if user forgot to click "+ Thêm"
    let finalInvoiceNames = invoiceNames;
    if (newInvoice.invoiceName.trim()) {
      const pending = { ...newInvoice, id: Date.now() };
      finalInvoiceNames = [...invoiceNames, pending];
      setInvoiceNames(finalInvoiceNames);
      setNewInvoice({ invoiceName: '', invoiceUnit: '', isDefault: false, notes: '' });
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        ...(code.trim() && { code: code.trim() }),
        ...(category && { category }),
        ...(brand.trim() && { brand: brand.trim() }),
        ...(unit.trim() && { unit: unit.trim() }),
        ...(costPrice && { costPrice: Number(costPrice) }),
        ...(sellingPrice && { sellingPrice: Number(sellingPrice) }),
        ...(wholesalePrice && { wholesalePrice: Number(wholesalePrice) }),
        defaultVatRate: Number(defaultVatRate) || 10,
        ...(lowStockThreshold && { lowStockThreshold: Number(lowStockThreshold) }),
        ...(barcode.trim() && { barcode: barcode.trim() }),
        ...(description.trim() && { description: description.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(warehouseLocation.trim() && { warehouseLocation: warehouseLocation.trim() }),
        ...(supplierCode.trim() && { supplierCode: supplierCode.trim() }),
        ...(weight && { weight: Number(weight), weightUnit }),
        hasVariants,
        isSaleable,
        ...(mode === 'edit' && { isActive }),
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      };

      if (mode === 'create') {
        const product = await productsApi.create(payload);
        // Save variants
        if (hasVariants && variants.length > 0) {
          await productsApi.bulkCreateVariants(product.id, variants.map((v) => ({
            sku: v.sku, attributes: v.attributes,
            ...(v.costPrice && { costPrice: Number(v.costPrice) }),
            ...(v.sellingPrice && { sellingPrice: Number(v.sellingPrice) }),
          })));
        }
        // Save images
        for (const [i, img] of images.entries()) {
          await productsApi.addImage(product.id, { url: img.url, isMain: img.isMain, sortOrder: i });
        }
        // Save invoice names
        for (const inv of finalInvoiceNames) {
          await productsApi.addInvoiceName(product.id, inv);
        }
        router.push(`/dashboard/products/${product.id}`);
      } else if (initialData?.id) {
        await productsApi.update(initialData.id, payload);
        if (hasVariants && variantsGenerated) {
          await productsApi.bulkCreateVariants(initialData.id, variants.map((v) => ({
            sku: v.sku, attributes: v.attributes,
            ...(v.costPrice && { costPrice: Number(v.costPrice) }),
            ...(v.sellingPrice && { sellingPrice: Number(v.sellingPrice) }),
          })));
        }
        // Save pending invoice name in edit mode
        for (const inv of finalInvoiceNames.filter((n) => !invoiceNames.includes(n))) {
          await productsApi.addInvoiceName(initialData.id, inv);
        }
        router.push(`/dashboard/products/${initialData.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-300';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5';
  const sectionCls = 'bg-white rounded-xl border border-gray-100 shadow-sm p-5';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">{mode === 'create' ? 'Thêm sản phẩm' : 'Chỉnh sửa sản phẩm'}</h1>
            {initialData?.code && <p className="text-xs text-gray-400 mt-0.5">{initialData.code}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Hủy
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm shadow-blue-200">
            {saving ? 'Đang lưu...' : mode === 'create' ? 'Tạo sản phẩm' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4 max-w-6xl">
          {/* Left col (2/3) */}
          <div className="col-span-2 space-y-4">
            {/* Thông tin cơ bản */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-4">Thông tin cơ bản</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Tên sản phẩm <span className="text-red-400">*</span></label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên sản phẩm..." className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Mã sản phẩm</label>
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tự sinh nếu để trống" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Đơn vị tính (ĐVT)</label>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                      <option value="">-- Chọn đơn vị --</option>
                      {activeUnits.map((u) => (
                        <option key={u.id} value={u.name}>{u.name} ({u.code})</option>
                      ))}
                      {unit && !activeUnits.some((u) => u.name === unit) && (
                        <option value={unit}>{unit} (cũ)</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Danh mục</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                      <option value="">-- Chọn loại sản phẩm --</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {categories.length === 0 && (
                      <p className="text-[11px] text-gray-300 mt-1">
                        Chưa có loại nào — <a href="/dashboard/products/categories" className="text-blue-400 hover:underline">Thêm loại sản phẩm</a>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Thương hiệu</label>
                    <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Tên thương hiệu / hãng sản xuất" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Barcode</label>
                    <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Mã vạch sản phẩm" className={inputCls} />
                  </div>
                  <div />
                </div>
              </div>
            </div>

            {/* Giá */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-4">Giá</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Giá vốn</label>
                  <div className="relative">
                    <PriceInput value={costPrice} onChange={setCostPrice} className={inputCls + ' pr-6'} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Giá bán lẻ</label>
                  <div className="relative">
                    <PriceInput value={sellingPrice} onChange={setSellingPrice} className={inputCls + ' pr-6'} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Giá bán buôn</label>
                  <div className="relative">
                    <PriceInput value={wholesalePrice} onChange={setWholesalePrice} className={inputCls + ' pr-6'} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">đ</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Thuế suất VAT mặc định (%)</label>
                  <select value={defaultVatRate} onChange={(e) => setDefaultVatRate(e.target.value)} className={inputCls}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="8">8%</option>
                    <option value="10">10%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Kho & Vận chuyển */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-4">Kho & Vận chuyển</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Vị trí kho</label>
                  <input value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)}
                    placeholder="VD: Kệ A1, Tầng 1" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ngưỡng cảnh báo tồn kho</label>
                  <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)}
                    placeholder="VD: 5" min={0} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mã SP nhà cung cấp</label>
                  <input value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)}
                    placeholder="Mã của NCC" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Trọng lượng</label>
                  <div className="flex gap-2">
                    <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                      placeholder="0" min={0} step="0.001" className={inputCls} />
                    <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Mô tả & Ghi chú */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-4">Mô tả & Ghi chú</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Mô tả sản phẩm</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    rows={3} placeholder="Mô tả chi tiết về sản phẩm, thông số kỹ thuật..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ghi chú nội bộ</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Ghi chú chỉ dùng nội bộ, không hiển thị ra ngoài..." className={inputCls} />
                </div>
              </div>
            </div>

            {/* Biến thể */}
            <div className={sectionCls}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">Biến thể sản phẩm</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} className="sr-only" />
                    <div className={`w-10 h-5 rounded-full transition-colors ${hasVariants ? 'bg-blue-500' : 'bg-gray-200'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasVariants ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-600">Sản phẩm có biến thể</span>
                </label>
              </div>

              {hasVariants && (
                <div className="space-y-3">
                  {/* Attribute groups — each group is 1 dimension */}
                  {attrDefs.map((attr, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">
                          Nhóm thuộc tính {idx + 1}
                          {idx === 0 && <span className="ml-1 font-normal text-gray-400">(VD: Điện áp, Màu sắc, Size…)</span>}
                          {idx >= 1 && <span className="ml-1 font-normal text-gray-400">— kết hợp với nhóm trên tạo tổ hợp</span>}
                        </span>
                        {attrDefs.length > 1 && (
                          <button type="button"
                            onClick={() => { setAttrDefs((prev) => prev.filter((_, i) => i !== idx)); setVariantMsg(''); }}
                            className="text-xs text-red-400 hover:text-red-600 font-medium transition">
                            Xóa nhóm
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Tên thuộc tính</label>
                          <input value={attr.name}
                            onChange={(e) => { const n = [...attrDefs]; n[idx].name = e.target.value; setAttrDefs(n); setVariantMsg(''); }}
                            placeholder="VD: Điện áp" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">Các giá trị (phân cách bằng dấu phẩy)</label>
                          <input value={attr.values}
                            onChange={(e) => { const n = [...attrDefs]; n[idx].values = e.target.value; setAttrDefs(n); setVariantMsg(''); }}
                            placeholder="VD: 24V, 36V, 220V" className={inputCls} />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => setAttrDefs((prev) => [...prev, { name: '', values: '' }])}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      + Thêm nhóm thuộc tính
                    </button>
                    <span className="text-[11px] text-gray-400">
                      {attrDefs.length >= 2 ? `${attrDefs.filter(a=>a.values.trim()).map(a=>a.values.split(',').filter(Boolean).length).reduce((a,b)=>a*b,1)} tổ hợp sẽ được tạo` : 'Thêm nhóm để tạo tổ hợp (VD: Điện áp × Màu sắc)'}
                    </span>
                    <button type="button" onClick={generateVariants}
                      className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition shadow-sm">
                      Tạo biến thể
                    </button>
                  </div>

                  {variantMsg && (
                    <div className={`p-2.5 rounded-lg text-xs font-medium ${variantMsg.startsWith('error:') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                      {variantMsg.replace(/^(error|ok):/, '')}
                    </div>
                  )}

                  {variants.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-600">{variants.length} biến thể — có thể chỉnh giá riêng từng biến thể bên dưới</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase">Biến thể</th>
                            <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase">SKU</th>
                            <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase">Giá vốn (đ)</th>
                            <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase">Giá bán (đ)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, idx) => (
                            <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-xs font-medium text-gray-700">
                                {Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')}
                              </td>
                              <td className="px-3 py-2">
                                <input value={v.sku} onChange={(e) => {
                                    const n = [...variants]; n[idx].sku = e.target.value; setVariants(n);
                                  }} className="w-28 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              </td>
                              <td className="px-3 py-2">
                                <PriceInput value={v.costPrice?.toString() || ''} onChange={(val) => {
                                    const n = [...variants]; n[idx].costPrice = val; setVariants(n);
                                  }} className="w-28 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              </td>
                              <td className="px-3 py-2">
                                <PriceInput value={v.sellingPrice?.toString() || ''} onChange={(val) => {
                                    const n = [...variants]; n[idx].sellingPrice = val; setVariants(n);
                                  }} className="w-28 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right col (1/3) */}
          <div className="space-y-4">

            {/* ── Ảnh sản phẩm (ĐẦU TIÊN - quan trọng nhất) ── */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-3">Ảnh sản phẩm</h3>

              {/* Grid ảnh đã thêm */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {images.map((img) => (
                    <div key={img.id} className={`relative group rounded-xl overflow-hidden border-2 aspect-square ${img.isMain ? 'border-blue-400' : 'border-transparent hover:border-gray-200'}`}>
                      <img src={img.url} alt="" className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/></svg>'; }} />
                      {img.isMain && <span className="absolute top-1 left-1 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium">Chính</span>}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-1">
                        {!img.isMain && (
                          <button type="button" onClick={() => setMainImage(img.id)}
                            className="text-[10px] bg-white/90 text-gray-800 px-2 py-1 rounded-md font-semibold w-full text-center">Ảnh chính</button>
                        )}
                        <button type="button" onClick={() => removeImage(img.id)}
                          className="text-[10px] bg-red-500 text-white px-2 py-1 rounded-md font-semibold w-full text-center">Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag-drop upload zone — multiple files */}
              <label
                onDragOver={(e) => { e.preventDefault(); setImgDragging(true); }}
                onDragLeave={() => setImgDragging(false)}
                onDrop={(e) => { e.preventDefault(); setImgDragging(false); if (e.dataTransfer.files.length) uploadAndAddImages(e.dataTransfer.files); }}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-5 cursor-pointer transition-colors ${
                  imgDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                } ${uploadingImg ? 'pointer-events-none' : ''}`}>
                {uploadingImg ? (
                  <>
                    <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="text-xs text-blue-500 font-medium">
                      {uploadProgress ? `Đang tải ${uploadProgress.done}/${uploadProgress.total} ảnh...` : 'Đang tải lên...'}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400">Kéo thả hoặc click để chọn nhiều ảnh</span>
                    <span className="text-[11px] text-gray-300">JPG, PNG, WebP · Tối đa 5MB/ảnh</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingImg}
                  onChange={(e) => { if (e.target.files?.length) uploadAndAddImages(e.target.files); e.target.value = ''; }} />
              </label>

              {/* URL fallback */}
              <details className="mt-2">
                <summary className="text-xs text-gray-300 hover:text-gray-500 cursor-pointer select-none">Hoặc nhập URL ảnh</summary>
                <div className="flex gap-2 mt-1.5">
                  <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://..." className={`${inputCls} flex-1 text-xs`}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())} />
                  <button type="button" onClick={addImage}
                    className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
                    Thêm
                  </button>
                </div>
              </details>
            </div>

            {/* ── Tags ── */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-3">Tags</h3>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                placeholder="bán chạy, mùa hè, ký gửi..." className={inputCls} />
              <p className="text-xs text-gray-300 mt-1.5">Phân cách bằng dấu phẩy</p>
              {tagsInput && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tagsInput.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-500 border border-blue-100 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Tên hóa đơn VAT ── */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-1">Tên hóa đơn VAT</h3>
              <p className="text-xs text-gray-400 mb-3">Tên kế toán dùng khi xuất hóa đơn — có thể khác tên hàng ngày</p>

              {/* Danh sách tên đã thêm */}
              {invoiceNames.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {invoiceNames.map((inv, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 flex-wrap">
                          {inv.invoiceName}
                          {inv.isDefault && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium">Mặc định</span>}
                        </div>
                        {inv.invoiceUnit && <div className="text-[11px] text-gray-400 mt-0.5">ĐVT: {inv.invoiceUnit}</div>}
                        {inv.notes && <div className="text-[11px] text-gray-400 truncate">{inv.notes}</div>}
                      </div>
                      <button type="button" onClick={() => removeInvoiceName(idx, inv.id)}
                        className="text-gray-300 hover:text-red-400 transition flex-shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Form thêm mới */}
              <div className="space-y-2 border-t border-gray-50 pt-3">
                <div>
                  <input value={newInvoice.invoiceName}
                    onChange={(e) => { setNewInvoice({ ...newInvoice, invoiceName: e.target.value }); setInvoiceNameError(''); }}
                    placeholder="Tên trên hóa đơn VAT *"
                    className={`${inputCls} ${invoiceNameError ? 'border-red-300 focus:ring-red-400' : ''}`}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInvoiceName())} />
                  {invoiceNameError && <p className="text-[11px] text-red-500 mt-1">{invoiceNameError}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={newInvoice.invoiceUnit || ''} onChange={(e) => setNewInvoice({ ...newInvoice, invoiceUnit: e.target.value })}
                    placeholder="ĐVT trên HĐ" className={inputCls} />
                  <label className="flex items-center gap-2 cursor-pointer px-2">
                    <input type="checkbox" checked={newInvoice.isDefault || false} onChange={(e) => setNewInvoice({ ...newInvoice, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                    <span className="text-xs text-gray-600">Mặc định</span>
                  </label>
                </div>
                <input value={newInvoice.notes || ''} onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                  placeholder="Ghi chú (VD: Dùng khi mua từ Cty ABC)" className={inputCls} />
                <button type="button" onClick={addInvoiceName}
                  className="w-full px-3 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm tên hóa đơn
                </button>
              </div>
            </div>

            {/* ── Tùy chọn (ít thao tác - để cuối) ── */}
            <div className={sectionCls}>
              <h3 className="text-sm font-bold text-gray-700 mb-3">Tùy chọn</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={isSaleable} onChange={(e) => setIsSaleable(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                  <div>
                    <div className="text-sm text-gray-700 font-medium group-hover:text-gray-900">Được bán</div>
                    <div className="text-xs text-gray-400">Hiển thị khi tạo đơn hàng</div>
                  </div>
                </label>
                {mode === 'edit' && (
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                    <div>
                      <div className="text-sm text-gray-700 font-medium group-hover:text-gray-900">Đang hoạt động</div>
                      <div className="text-xs text-gray-400">Bỏ tick để ngừng bán</div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
