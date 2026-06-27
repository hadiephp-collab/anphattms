'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { createPurchaseReturn, LoaiTraHang, LOAI_TRA_HANG } from '@/lib/purchase-returns';

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

interface POItem {
  id: number;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  priceVnd: number;
  priceForeign: number;
  totalVnd: number;
}

interface PO {
  id: number;
  code: string;
  supplier: { id: number; name: string } | null;
  status: string;
  items: POItem[];
  currency: string;
}

interface ReturnItemDraft {
  purchaseOrderItemId: number;
  productCode: string;
  productName: string;
  unit: string;
  maxQty: number;
  priceVnd: number;
  quantity: number;
  reason: string;
  enabled: boolean;
}

export default function CreatePurchaseReturnPage() {
  const router = useRouter();

  // PO search state
  const [poSearch, setPoSearch]     = useState('');
  const [poList, setPoList]         = useState<PO[]>([]);
  const [poLoading, setPoLoading]   = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);

  // Return form
  const [returnDate, setReturnDate]     = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [loaiTraHang, setLoaiTraHang]   = useState<LoaiTraHang | ''>('');
  const [reason, setReason]             = useState('');
  const [ghiChuNCC, setGhiChuNCC]       = useState('');
  const [notes, setNotes]               = useState('');
  const [items, setItems]           = useState<ReturnItemDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  // Search received POs
  useEffect(() => {
    const t = setTimeout(async () => {
      setPoLoading(true);
      try {
        const res = await purchaseOrdersApi.getAll({ status: 'received', search: poSearch, limit: '20' });
        setPoList(res.data ?? []);
      } catch {
        setPoList([]);
      } finally {
        setPoLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [poSearch]);

  async function selectPO(po: PO) {
    // Fetch detail to get items
    const detail = await purchaseOrdersApi.getOne(po.id);
    setSelectedPO(detail);
    setItems(
      (detail.items ?? []).map((i: POItem) => ({
        purchaseOrderItemId: i.id,
        productCode: i.productCode,
        productName: i.productName,
        unit: i.unit,
        maxQty: Number(i.quantity),
        priceVnd: Number(i.priceVnd),
        quantity: 0,
        reason: '',
        enabled: false,
      }))
    );
  }

  function updateItem(idx: number, field: keyof ReturnItemDraft, value: string | number | boolean) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity') {
          const q = Math.max(0, Math.min(Number(value), item.maxQty));
          updated.quantity = q;
          updated.enabled = q > 0;
        }
        if (field === 'enabled' && !value) {
          updated.quantity = 0;
        }
        return updated;
      })
    );
  }

  const enabledItems = items.filter((i) => i.enabled && i.quantity > 0);
  const totalAmountVnd = enabledItems.reduce((sum, i) => sum + i.quantity * i.priceVnd, 0);

  async function handleSubmit() {
    if (!selectedPO) { setError('Vui lòng chọn đơn nhập'); return; }
    if (enabledItems.length === 0) { setError('Vui lòng chọn ít nhất một sản phẩm để trả'); return; }

    setSubmitting(true);
    setError('');
    try {
      const result = await createPurchaseReturn({
        purchaseOrderId: selectedPO.id,
        returnDate,
        loaiTraHang: loaiTraHang || undefined,
        reason: reason || undefined,
        ghiChuNCC: ghiChuNCC || undefined,
        notes: notes || undefined,
        items: enabledItems.map((i) => ({
          purchaseOrderItemId: i.purchaseOrderItemId,
          quantity: i.quantity,
          reason: i.reason || undefined,
        })),
      });
      router.push(`/dashboard/don-hang-nhap/tra-hang-ncc/${result.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/don-hang-nhap/tra-hang-ncc"
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Tạo Phiếu Trả Hàng NCC</h1>
          <p className="text-sm text-gray-500 mt-0.5">Chọn đơn nhập đã nhận và khai báo hàng cần trả</p>
        </div>
      </div>

      {/* Step 1: Choose PO */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
          Chọn đơn nhập hàng
        </h2>

        {selectedPO ? (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div>
              <span className="font-mono text-blue-700 font-semibold">{selectedPO.code}</span>
              <span className="text-gray-500 text-sm ml-3">{selectedPO.supplier?.name ?? 'Không có NCC'}</span>
            </div>
            <button onClick={() => { setSelectedPO(null); setItems([]); }}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Đổi đơn
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                placeholder="Tìm mã đơn nhập, tên NCC..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            {poLoading && <p className="text-sm text-gray-400 px-1">Đang tìm...</p>}
            {poList.length > 0 && (
              <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                {poList.map((po) => (
                  <button key={po.id} onClick={() => selectPO(po)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left">
                    <div>
                      <span className="font-mono font-medium text-gray-800">{po.code}</span>
                      <span className="text-sm text-gray-500 ml-3">{po.supplier?.name ?? '—'}</span>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">Đã nhận</span>
                  </button>
                ))}
              </div>
            )}
            {!poLoading && poList.length === 0 && poSearch && (
              <p className="text-sm text-gray-400 px-1">Không tìm thấy đơn nhập đã nhận nào phù hợp</p>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Select items */}
      {selectedPO && items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Chọn sản phẩm cần trả
          </h2>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.purchaseOrderItemId}
                className={`border rounded-xl p-4 transition-colors ${item.enabled ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={item.enabled}
                    onChange={(e) => updateItem(idx, 'enabled', e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-blue-600 border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.productCode && (
                        <span className="font-mono text-xs text-gray-400">{item.productCode}</span>
                      )}
                      <span className="font-medium text-gray-800 text-sm">{item.productName}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Giá nhập: {fmt(item.priceVnd)} / {item.unit} · Đã nhập: {item.maxQty} {item.unit}
                    </div>

                    {item.enabled && (
                      <div className="mt-3 flex gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Số lượng trả</label>
                          <input
                            type="number"
                            min={1}
                            max={item.maxQty}
                            step={0.001}
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-right"
                          />
                          <span className="text-xs text-gray-400">{item.unit} (tối đa {item.maxQty})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-40">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Lý do</label>
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => updateItem(idx, 'reason', e.target.value)}
                            placeholder="Hàng lỗi, sai quy cách..."
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                          />
                        </div>
                        {item.quantity > 0 && (
                          <div className="ml-auto text-sm font-medium text-blue-700 whitespace-nowrap">
                            {fmt(item.quantity * item.priceVnd)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Return info */}
      {selectedPO && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Thông tin phiếu trả
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ngày trả hàng</label>
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Loại trả hàng</label>
              <select value={loaiTraHang} onChange={(e) => setLoaiTraHang(e.target.value as LoaiTraHang | '')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                <option value="">-- Chọn loại --</option>
                {(Object.entries(LOAI_TRA_HANG) as [LoaiTraHang, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Lý do trả (chung)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Hàng lỗi, không đúng đơn..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ghi chú cho NCC</label>
            <textarea value={ghiChuNCC} onChange={(e) => setGhiChuNCC(e.target.value)}
              rows={2}
              placeholder="Nội dung ghi chú sẽ gửi kèm yêu cầu trả hàng cho nhà cung cấp..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ghi chú nội bộ</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Thông tin thêm về lô hàng trả (nội bộ)..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            />
          </div>
        </div>
      )}

      {/* Summary & Submit */}
      {selectedPO && enabledItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">{enabledItems.length} sản phẩm · Tổng giá trị trả</p>
              <p className="text-2xl font-bold text-gray-800">{fmt(totalAmountVnd)}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">{error}</div>
          )}

          <div className="flex gap-3">
            <Link href="/dashboard/don-hang-nhap/tra-hang-ncc"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center">
              Huỷ
            </Link>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 text-center">
              {submitting ? 'Đang lưu...' : 'Lưu phiếu trả (Nháp)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
