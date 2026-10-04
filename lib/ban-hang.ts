/**
 * Liên kết sang App Bán hàng (thu chi – sổ quỹ giữa 2 app, thiết kế: App quản lý bán hàng/docs/thiet-ke/THU-CHI-SO-QUY-giua-2-app.md).
 * Khoản tiền của KHÁCH HÀNG / NCC TRONG NƯỚC lưu ở App Bán hàng (để trừ công nợ ngay) rồi tự gửi bản sao về sổ quỹ TMS.
 */
export const BAN_HANG_URL = (process.env.NEXT_PUBLIC_BAN_HANG_URL || '').replace(/\/+$/, '');

/** Mở trang App Bán hàng ở tab riêng (cùng 1 tab cho mọi lần mở) — kèm ?tu=tms để bên đó hiện nút "Quay lại TMS" */
export function moBanHang(duongDan: string) {
  if (!BAN_HANG_URL) { alert('Chưa cấu hình địa chỉ App Bán hàng (NEXT_PUBLIC_BAN_HANG_URL)'); return; }
  const url = `${BAN_HANG_URL}${duongDan}${duongDan.includes('?') ? '&' : '?'}tu=tms`;
  window.open(url, 'anphat-ban-hang');
}

/** Phiếu đồng bộ từ App Bán hàng (chỉ xem ở TMS) */
export const laPhieuBanHang = (tx: { nguon?: string | null }) => tx.nguon === 'ban_hang';
