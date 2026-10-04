'use client';
/**
 * Bước 1 khi tạo phiếu thu / chi: BẮT BUỘC chọn loại trước.
 * Loại dính tới khách hàng / NCC trong nước → mở App Bán hàng (nơi giữ công nợ); loại còn lại → form TMS.
 */
import { useRouter } from 'next/navigation';
import { moBanHang } from '@/lib/ban-hang';

interface Loai { ten: string; moTa: string; noi: 'ban_hang' | 'tms'; duongDan: string }

const THU: Loai[] = [
  { ten: 'Thu công nợ khách hàng', moTa: 'Khách trả tiền mua hàng / trả nợ — trừ công nợ khách ngay', noi: 'ban_hang', duongDan: '/dashboard/thu-chi/phieu-thu/tao-moi' },
  { ten: 'Thu khác', moTa: 'Lãi ngân hàng, thanh lý tài sản, góp vốn, NCC nước ngoài hoàn tiền…', noi: 'tms', duongDan: '/dashboard/thu-chi/phieu-thu/tao-moi' },
];
const CHI: Loai[] = [
  { ten: 'Chi NCC trong nước', moTa: 'Trả công ty nhập khẩu / NCC trong nước theo hoá đơn — trừ công nợ phải trả', noi: 'ban_hang', duongDan: '/dashboard/cong-no/phai-tra' },
  { ten: 'Hoàn tiền khách trả hàng', moTa: 'Làm qua phiếu trả hàng (duyệt phiếu → hoàn tiền)', noi: 'ban_hang', duongDan: '/dashboard/returns' },
  { ten: 'Chi NCC nước ngoài', moTa: 'Trả tiền hàng / vận chuyển cho đối tác nước ngoài', noi: 'tms', duongDan: '/dashboard/thu-chi/phieu-chi/tao-moi?doiTuong=supplier' },
  { ten: 'Chi lương / chi khác', moTa: 'Lương, văn phòng, chi phí khác', noi: 'tms', duongDan: '/dashboard/thu-chi/phieu-chi/tao-moi' },
];

export default function ChonLoaiPhieu({ loai, onClose }: { loai: 'thu' | 'chi'; onClose: () => void }) {
  const router = useRouter();
  const ds = loai === 'thu' ? THU : CHI;
  // class viết đủ (Tailwind không nhận class ghép chuỗi)
  const hover = loai === 'thu' ? 'hover:border-emerald-400 hover:bg-emerald-50' : 'hover:border-red-300 hover:bg-red-50';
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}
      onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div role="dialog" aria-label="Chọn loại phiếu" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">{loai === 'thu' ? 'Tạo phiếu thu' : 'Tạo phiếu chi'} — chọn loại</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Đóng">✕</button>
        </div>
        <div className="p-3 space-y-2">
          {ds.map(l => (
            <button key={l.ten} autoFocus={l === ds[0]}
              onClick={() => { if (l.noi === 'ban_hang') { moBanHang(l.duongDan); onClose(); } else router.push(l.duongDan); }}
              className={`w-full text-left px-4 py-3 rounded-xl border border-gray-200 ${hover} transition flex items-start gap-3`}>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{l.ten}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l.moTa}</div>
              </div>
              {l.noi === 'ban_hang'
                ? <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">App Bán hàng ↗</span>
                : <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">TMS</span>}
            </button>
          ))}
        </div>
        <p className="px-5 pb-4 text-xs text-gray-400">
          Phiếu làm ở App Bán hàng tự hiện trong sổ quỹ TMS sau khoảng 1 giây (chỉ xem ở TMS, sửa / huỷ bên App Bán hàng).
        </p>
      </div>
    </div>
  );
}
