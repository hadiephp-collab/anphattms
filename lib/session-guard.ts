import { clearAuth, getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Token hết hạn (đọc trường exp trong JWT, không cần gọi máy chủ) */
export function tokenHetHan(token: string | null): boolean {
  if (!token) return true;
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof p.exp === 'number' && p.exp * 1000 <= Date.now();
  } catch { return false; }
}

function veDangNhap() {
  clearAuth();
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?het-han=1&next=${next}`);
}

/**
 * Bọc window.fetch 1 lần cho cả app: lời gọi API có token mà máy chủ trả 401 (hết hạn 7 ngày / token sai)
 * → xoá phiên, về trang đăng nhập (có báo "hết hạn"), đăng nhập xong quay lại đúng trang.
 * Trước đây 401 bị nuốt im lặng → danh sách hiện "Chưa có dữ liệu" gây hiểu nhầm.
 */
export function installSessionGuard() {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { __tmsGuard?: boolean };
  if (w.__tmsGuard) return;
  w.__tmsGuard = true;
  const goc = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await goc(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (res.status === 401 && url.startsWith(API) && !url.includes('/auth/login') && getToken()) veDangNhap();
    return res;
  };
}

/** Gọi khi vào khu vực đã đăng nhập: token đã hết hạn thì về đăng nhập ngay, không chờ API báo lỗi */
export function kiemTraPhien() {
  if (tokenHetHan(getToken())) { veDangNhap(); return false; }
  return true;
}
