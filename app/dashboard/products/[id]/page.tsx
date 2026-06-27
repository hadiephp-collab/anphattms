'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { productsApi } from '@/lib/products';
import { inventoryApi } from '@/lib/inventory';

interface Variant { id: number; sku: string; attributes: Record<string, string>; costPrice?: number; sellingPrice?: number; barcode?: string; isActive: boolean; }
interface Image { id: number; url: string; isMain: boolean; sortOrder: number; }
interface InvoiceName { id: number; invoiceName: string; invoiceUnit?: string; isDefault: boolean; notes?: string; }
interface Product {
  id: number; code: string; name: string; category?: string; unit?: string;
  costPrice?: number; sellingPrice?: number; wholesalePrice?: number; defaultVatRate?: number;
  stockQuantity?: number; lowStockThreshold?: number; barcode?: string; description?: string; notes?: string;
  hasVariants: boolean; isSaleable: boolean; isActive: boolean;
  warehouseLocation?: string; supplierCode?: string; weight?: number; weightUnit?: string;
  tags?: string[];
  variants: Variant[]; images: Image[]; invoiceNames: InvoiceName[];
  createdAt: string; updatedAt: string;
}
interface Movement {
  id: number; type: string; quantity: number; stockBefore: number; stockAfter: number;
  referenceId?: number; referenceType?: string; notes?: string;
  performedBy?: { id: number; name: string };
  createdAt: string;
}

const fmt = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '—';
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
};

type Tab = 'info' | 'variants' | 'images' | 'invoice' | 'history';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('info');

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

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'info',     label: 'Thông tin' },
    { key: 'variants', label: 'Biến thể',   count: product.variants?.length },
    { key: 'images',   label: 'Ảnh',        count: product.images?.length },
    { key: 'invoice',  label: 'Tên HĐ VAT', count: product.invoiceNames?.length },
    { key: 'history',  label: 'Lịch sử kho' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/products')}
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
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete}
            className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">
            Xóa
          </button>
          <Link href={`/dashboard/products/${product.id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200">
            Chỉnh sửa
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-4 max-w-6xl">
          {/* Left — tabs */}
          <div className="col-span-2 space-y-4">
            {/* Tab bar */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex border-b border-gray-100 px-4">
                {tabs.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                    {t.count != null && t.count > 0 && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${tab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Tab: Thông tin */}
                {tab === 'info' && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {[
                      { label: 'Danh mục', value: product.category },
                      { label: 'Đơn vị tính', value: product.unit },
                      { label: 'Barcode', value: product.barcode },
                      { label: 'Vị trí kho', value: product.warehouseLocation },
                      { label: 'Mã NCC', value: product.supplierCode },
                      { label: 'Trọng lượng', value: product.weight ? `${product.weight} ${product.weightUnit || 'kg'}` : undefined },
                      { label: 'Thuế suất mặc định', value: product.defaultVatRate != null ? `${product.defaultVatRate}%` : undefined },
                      { label: 'Cảnh báo tồn kho', value: product.lowStockThreshold?.toString() },
                      { label: 'Có biến thể', value: product.hasVariants ? 'Có' : 'Không' },
                      { label: 'Được bán', value: product.isSaleable ? 'Có' : 'Không' },
                      { label: 'Ngày tạo', value: fmtDate(product.createdAt) },
                      { label: 'Cập nhật', value: fmtDate(product.updatedAt) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</p>
                      </div>
                    ))}
                    {product.description && (
                      <div className="col-span-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Mô tả</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
                      </div>
                    )}
                    {product.notes && (
                      <div className="col-span-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Ghi chú nội bộ</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.notes}</p>
                      </div>
                    )}
                    {product.tags && product.tags.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {product.tags.map((t, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-500 border border-blue-100 px-2 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Biến thể */}
                {tab === 'variants' && (
                  <div>
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
                              <td className="px-3 py-2.5 text-sm text-gray-600">{fmt(v.costPrice)}</td>
                              <td className="px-3 py-2.5 text-sm font-medium text-gray-700">{fmt(v.sellingPrice)}</td>
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
                      <p className="text-gray-300 text-sm text-center py-8">Chưa có biến thể nào</p>
                    )}
                  </div>
                )}

                {/* Tab: Ảnh */}
                {tab === 'images' && (
                  <div>
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
                      <p className="text-gray-300 text-sm text-center py-8">Chưa có ảnh nào</p>
                    )}
                    <p className="text-xs text-gray-300 mt-3">Để quản lý ảnh, vào trang Chỉnh sửa sản phẩm</p>
                  </div>
                )}

                {/* Tab: Tên HĐ VAT */}
                {tab === 'invoice' && (
                  <div>
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
                      <div className="text-center py-8">
                        <p className="text-gray-300 text-sm">Chưa có tên hóa đơn nào</p>
                        <Link href={`/dashboard/products/${product.id}/edit`}
                          className="text-blue-500 text-xs hover:underline font-medium mt-1 block">
                          + Thêm tên hóa đơn
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Lịch sử kho */}
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
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
                                      {meta.label}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {delta > 0 ? '+' : ''}{Number(delta).toLocaleString('vi-VN')}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-sm text-gray-500">
                                    {Math.floor(Number(m.stockBefore)).toLocaleString('vi-VN')}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                                    {Math.floor(Number(m.stockAfter)).toLocaleString('vi-VN')}
                                  </td>
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
                : <div className="w-full h-48 bg-gray-50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>}
            </div>

            {/* Giá */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Giá</h3>
              <div className="space-y-2">
                {[
                  { label: 'Giá vốn', value: product.costPrice, color: 'text-gray-700' },
                  { label: 'Giá bán lẻ', value: product.sellingPrice, color: 'text-blue-600 font-semibold' },
                  { label: 'Giá bán buôn', value: product.wholesalePrice, color: 'text-gray-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className={`text-sm ${color}`}>{fmt(value)}</span>
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
            </div>

            {/* Tồn kho */}
            <div className={`bg-white rounded-xl border shadow-sm p-4 ${isOutOfStock ? 'border-red-100' : isLowStock ? 'border-amber-100' : 'border-gray-100'}`}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Tồn kho</h3>
              <div className="text-center py-2">
                <p className={`text-3xl font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : 'text-gray-800'}`}>
                  {stockQty.toLocaleString('vi-VN')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {product.unit ? `${product.unit}` : 'đơn vị'}
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
              <button
                onClick={() => setTab('history')}
                className="w-full mt-3 text-[11px] text-blue-500 hover:text-blue-600 font-medium text-center transition">
                Xem lịch sử biến động →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
