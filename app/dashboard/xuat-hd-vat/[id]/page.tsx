'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { vatExportApi } from '@/lib/vat-exports';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
const VND_NUM = (v: number) => Math.round(v).toLocaleString('vi-VN');

interface VatExportDetail {
  id: number; code: string; ngayXuat: string; kyHieu: string; soHD: string;
  customerId: number | null; customerName: string | null; maSoThue: string | null;
  tongTienHang: number; tongTienThue: number; tongCong: number;
  trangThai: string; voidedAt: string | null; voidReason: string | null;
  createdByName: string | null; createdAt: string; notes: string | null;
  items: {
    id: number; productId: number | null; orderId: number | null;
    tenHoaDon: string; dvt: string | null; slHoaDon: number; donGia: number;
    thanhTien: number; thueSuat: number; tienThue: number; tongTien: number;
    giaBQ: number; giaBQWarning: boolean; sortOrder: number;
  }[];
}

export default function VatExportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<VatExportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Void modal
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  useEffect(() => {
    vatExportApi.getOne(Number(id))
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleVoid = async () => {
    if (voidReason.trim().length < 10) {
      setVoidError('Lý do void cần ít nhất 10 ký tự');
      return;
    }
    setVoiding(true);
    setVoidError('');
    try {
      await vatExportApi.void(Number(id), { voidReason: voidReason.trim() });
      router.push('/dashboard/xuat-hd-vat');
    } catch (e: any) {
      setVoidError(e.message);
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>;
  if (error)   return <div className="p-6 text-red-500">{error}</div>;
  if (!data)   return <div className="p-6 text-gray-400">Không tìm thấy phiếu</div>;

  const isVoid = data.trangThai === 'void';
  const canVoid = !isVoid;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/xuat-hd-vat" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{data.code}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isVoid ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                {isVoid ? 'Void' : 'Hiệu lực'}
              </span>
              {data.items.some(i => i.giaBQWarning) && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                  ⚠ Có SP giaBQ=0
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">Tạo bởi {data.createdByName || '—'} · {new Date(data.createdAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>
        {canVoid && (
          <button onClick={() => setShowVoid(true)}
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg hover:bg-red-100 font-medium">
            Void phiếu
          </button>
        )}
      </div>

      {isVoid && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">Phiếu đã bị void</p>
          <p>Ngày void: {data.voidedAt ? new Date(data.voidedAt).toLocaleString('vi-VN') : '—'}</p>
          <p>Lý do: {data.voidReason}</p>
        </div>
      )}

      {/* Thông tin HĐ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">Ngày xuất</p>
            <p className="font-medium text-gray-900">{data.ngayXuat}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Ký hiệu / Số HĐ</p>
            <p className="font-medium">{data.kyHieu} <span className="text-gray-400">—</span> {data.soHD}</p>
          </div>
          {data.notes && (
            <div>
              <p className="text-xs text-gray-400">Ghi chú</p>
              <p className="text-sm text-gray-700">{data.notes}</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400">Khách hàng</p>
            <p className="font-medium">{data.customerName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Mã số thuế</p>
            <p className="font-mono font-medium">{data.maSoThue || '—'}</p>
          </div>
        </div>
      </div>

      {/* Bảng chi tiết hàng hóa */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b">
          <p className="text-sm font-semibold text-gray-700">Hàng hóa trên hóa đơn ({data.items.length} dòng)</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
              <th className="px-4 py-2 text-left">Tên hàng hóa (HĐ)</th>
              <th className="px-4 py-2 text-center">ĐVT</th>
              <th className="px-4 py-2 text-right">SL HĐ</th>
              <th className="px-4 py-2 text-right">Đơn giá</th>
              <th className="px-4 py-2 text-center">% Thuế</th>
              <th className="px-4 py-2 text-right">Tiền HH</th>
              <th className="px-4 py-2 text-right">Tiền thuế</th>
              <th className="px-4 py-2 text-right">Tổng cộng</th>
              <th className="px-4 py-2 text-right">Giá vốn BQ</th>
            </tr>
          </thead>
          <tbody>
            {data.items.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.tenHoaDon}</td>
                <td className="px-4 py-3 text-center text-gray-500 text-xs">{item.dvt || '—'}</td>
                <td className="px-4 py-3 text-right">{item.slHoaDon}</td>
                <td className="px-4 py-3 text-right">{VND_NUM(item.donGia)}đ</td>
                <td className="px-4 py-3 text-center">{item.thueSuat}%</td>
                <td className="px-4 py-3 text-right text-gray-700">{VND_NUM(item.thanhTien)}đ</td>
                <td className="px-4 py-3 text-right text-orange-600">{VND_NUM(item.tienThue)}đ</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">{VND_NUM(item.tongTien)}đ</td>
                <td className="px-4 py-3 text-right text-xs">
                  {item.giaBQWarning
                    ? <span className="text-orange-500">⚠ 0đ</span>
                    : <span className="text-gray-500">{VND_NUM(item.giaBQ)}đ</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t font-semibold text-sm">
              <td colSpan={5} className="px-4 py-3 text-gray-600">Tổng cộng</td>
              <td className="px-4 py-3 text-right text-gray-800">{VND(data.tongTienHang)}</td>
              <td className="px-4 py-3 text-right text-orange-600">{VND(data.tongTienThue)}</td>
              <td className="px-4 py-3 text-right text-red-600 text-base">{VND(data.tongCong)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Void Modal */}
      {showVoid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">Void phiếu {data.code}</h3>
            <p className="text-sm text-gray-500">
              Hành động này sẽ đánh dấu phiếu là <strong>VOID</strong> và rollback trạng thái hóa đơn
              của đơn hàng liên kết về "Chờ xuất HĐ".
              Dữ liệu gốc được giữ nguyên (không xóa vật lý).
            </p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Lý do void * (tối thiểu 10 ký tự)</label>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
                placeholder="Nhập lý do void phiếu này..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
              <p className="text-xs text-gray-400 mt-0.5">{voidReason.length}/10 ký tự tối thiểu</p>
            </div>
            {voidError && <p className="text-sm text-red-500">{voidError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowVoid(false); setVoidReason(''); setVoidError(''); }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50">
                Huỷ
              </button>
              <button onClick={handleVoid} disabled={voiding || voidReason.trim().length < 10}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 font-medium">
                {voiding ? 'Đang void...' : 'Xác nhận Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
