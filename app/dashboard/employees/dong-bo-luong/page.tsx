'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';

async function goi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...init.headers },
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || 'Lỗi server');
  return d as T;
}

interface DongNV { nhanVienId: number; maNV: string; hoTen: string; coTaiKhoan: boolean }
interface ThayDoi { truong: string; nhan: string; cu: string | boolean | null; moi: string | boolean }
interface NVLuong { maNV: string; hoTen: string; chucVu: string | null; phongBan?: string | null; ngayVaoLam: string | null; soDienThoai: string | null }
interface LanGanNhat { createdAt: string; actorName: string | null; details: Record<string, number> | null }
interface XemTruoc {
  capNhat: (DongNV & { thayDoi: ThayDoi[] })[];
  taoMoi: NVLuong[];
  nghiViec: DongNV[];
  tamNghi: DongNV[];
  moLai: DongNV[];
  khongCoTrongLuong: DongNV[];
  daKhop: number;
  tongLuong: number;
  canhBao: string[];
  lanGanNhat: LanGanNhat | null;
}
interface KetQua {
  capNhat: number; taoMoi: number; chuaTao: number;
  nghiViec: number; taiKhoanVoHieu: number; taiKhoanMoLai: number;
  boQua: string[];
}
interface TuDong { daCauHinh: boolean; coChuong: boolean; lanTuDongCuoi: { luc: string; loi: string | null } | null }

const hienGiaTri = (v: string | boolean | null) =>
  v === true ? 'Đang làm' : v === false ? 'Đã nghỉ' : v || '—';
const fmtTime = (s: string) => new Date(s).toLocaleString('vi-VN', { hour12: false });

function TomTatLanTruoc({ l }: { l: LanGanNhat | null }) {
  if (!l?.createdAt) return <span>Chưa đồng bộ lần nào</span>;
  const d = l.details ?? {};
  return (
    <span>
      Lần đồng bộ gần nhất: {fmtTime(l.createdAt)}{l.actorName ? ` (${l.actorName})` : ''} —{' '}
      {d.capNhat ?? 0} cập nhật, {d.taoMoi ?? 0} tạo mới, {d.nghiViec ?? 0} nghỉ việc
    </span>
  );
}

function Nhom({ tieuDe, mau, so, children }: { tieuDe: string; mau: string; so: number; children: React.ReactNode }) {
  if (!so) return null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">
        {tieuDe} <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mau}`}>{so}</span>
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500';
const td = 'px-4 py-2.5 text-sm';

export default function DongBoLuongPage() {
  const [xt, setXt] = useState<XemTruoc | null>(null);
  const [lanTruoc, setLanTruoc] = useState<LanGanNhat | null>(null);
  const [tuDong, setTuDong] = useState<TuDong | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState('');
  const [hoi, setHoi] = useState(false);
  const [ketQua, setKetQua] = useState<KetQua | null>(null);

  useEffect(() => {
    goi<LanGanNhat | null>('/dong-bo-luong/lan-gan-nhat').then(setLanTruoc).catch(() => {});
    goi<TuDong>('/dong-bo-luong/tu-dong').then(setTuDong).catch(() => {});
  }, []);

  async function xemTruoc() {
    setDangTai(true); setLoi(''); setKetQua(null);
    try {
      const d = await goi<XemTruoc>('/dong-bo-luong/xem-truoc');
      setXt(d); setLanTruoc(d.lanGanNhat);
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : 'Không tải được dữ liệu App Lương');
    } finally {
      setDangTai(false);
    }
  }

  async function dongBo(taoMoi: boolean) {
    setHoi(false); setDangTai(true); setLoi('');
    try {
      const kq = await goi<KetQua>('/dong-bo-luong', { method: 'POST', body: JSON.stringify({ taoMoi }) });
      setKetQua(kq); setXt(null);
      setLanTruoc(await goi<LanGanNhat | null>('/dong-bo-luong/lan-gan-nhat'));
      setTuDong(await goi<TuDong>('/dong-bo-luong/tu-dong'));
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : 'Đồng bộ thất bại');
    } finally {
      setDangTai(false);
    }
  }

  const coViec = xt && (xt.capNhat.length + xt.taoMoi.length + xt.nghiViec.length + xt.moLai.length) > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <Link href="/dashboard/employees" className="text-sm text-gray-500 hover:text-gray-800">← Nhân viên</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Đồng bộ hồ sơ nhân viên từ App Lương</h1>
            <p className="mt-0.5 text-sm text-gray-500"><TomTatLanTruoc l={lanTruoc} /></p>
          </div>
          <div className="flex gap-2">
            <button onClick={xemTruoc} disabled={dangTai}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {dangTai && !hoi ? 'Đang tải…' : 'Xem trước'}
            </button>
            {coViec && (
              <button onClick={() => setHoi(true)} disabled={dangTai}
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
                Đồng bộ
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          App Lương là nguồn dữ liệu chuẩn (họ tên, SĐT, email, chức vụ, phòng ban, ngày vào làm, tình trạng nghỉ việc) — khớp theo
          <b> Mã nhân viên</b>. Chỉ đọc từ Lương, không ghi ngược lại. Ô trống bên Lương không xoá dữ liệu bên này.
          Đồng bộ chỉ tạo <b>hồ sơ</b>; ai cần đăng nhập thì cấp tài khoản ở trang Nhân viên.
        </p>
        {tuDong && (
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className={`flex items-center gap-1 ${tuDong.daCauHinh ? 'text-emerald-600' : 'text-amber-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tuDong.daCauHinh ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              {tuDong.daCauHinh ? 'Đã kết nối App Lương' : 'Chưa cấu hình App Lương (LUONG_API_URL/KEY)'}
            </span>
            <span className={`flex items-center gap-1 ${tuDong.coChuong ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tuDong.coChuong ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {tuDong.coChuong ? 'Chuông báo đã cấu hình' : 'Chưa có chuông báo (LUONG_CHUONG_KEY)'}
            </span>
            {tuDong.lanTuDongCuoi && (
              <span>
                Tự động cuối: {fmtTime(tuDong.lanTuDongCuoi.luc)}
                {tuDong.lanTuDongCuoi.loi && <span className="text-red-500"> — Lỗi: {tuDong.lanTuDongCuoi.loi}</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {loi && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{loi}</div>}

      {ketQua && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 space-y-1">
          <div className="font-semibold">Đã đồng bộ xong</div>
          <div>
            {ketQua.capNhat} hồ sơ cập nhật · {ketQua.taoMoi} hồ sơ tạo mới
            {ketQua.chuaTao ? ` (${ketQua.chuaTao} chưa tạo)` : ''} · {ketQua.nghiViec} chuyển sang Đã nghỉ
            {ketQua.taiKhoanVoHieu ? ` · ${ketQua.taiKhoanVoHieu} tài khoản bị vô hiệu hoá` : ''}
            {ketQua.taiKhoanMoLai ? ` · ${ketQua.taiKhoanMoLai} tài khoản được mở lại` : ''}
          </div>
          {ketQua.boQua.map(b => <div key={b} className="text-amber-700">⚠ {b}</div>)}
        </div>
      )}

      {!xt && !ketQua && (
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Bấm &quot;Xem trước&quot; để tải danh sách từ App Lương và xem sẽ có gì thay đổi.
        </div>
      )}

      {xt && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {([
              ['Nhân viên ở Lương', xt.tongLuong, 'text-gray-900'],
              ['Đã khớp', xt.daKhop, 'text-emerald-700'],
              ['Cần cập nhật', xt.capNhat.length, 'text-blue-700'],
              ['Chưa có ở TMS', xt.taoMoi.length, 'text-amber-700'],
              ['Nghỉ việc', xt.nghiViec.length, 'text-red-700'],
            ] as const).map(([nhan, so, mau]) => (
              <div key={nhan} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div className="text-xs text-gray-500">{nhan}</div>
                <div className={`mt-1 text-2xl font-bold ${mau}`}>{so}</div>
              </div>
            ))}
          </div>

          {xt.canhBao.map(c => (
            <div key={c} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">⚠ {c}</div>
          ))}
          {!coViec && (
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Dữ liệu đã khớp với App Lương — không có gì cần đồng bộ.
            </div>
          )}

          <Nhom tieuDe="Cần cập nhật" mau="bg-blue-50 text-blue-700" so={xt.capNhat.length}>
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className={th}>Mã NV</th><th className={th}>Họ tên</th><th className={th}>Thay đổi</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {xt.capNhat.map(c => (
                  <tr key={c.nhanVienId}>
                    <td className={`${td} font-mono text-xs text-gray-500`}>{c.maNV}</td>
                    <td className={td}>{c.hoTen}</td>
                    <td className={td}>
                      {c.thayDoi.map(t => (
                        <div key={t.truong} className="text-gray-700">
                          <span className="text-gray-500">{t.nhan}:</span>{' '}
                          <span className="text-gray-400 line-through">{hienGiaTri(t.cu)}</span> → <b>{hienGiaTri(t.moi)}</b>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Nhom>

          <Nhom tieuDe="Chưa có ở TMS — sẽ tạo hồ sơ" mau="bg-amber-50 text-amber-700" so={xt.taoMoi.length}>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr><th className={th}>Mã NV</th><th className={th}>Họ tên</th><th className={th}>Phòng ban</th><th className={th}>Chức vụ</th><th className={th}>Ngày vào làm</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {xt.taoMoi.map(n => (
                  <tr key={n.maNV}>
                    <td className={`${td} font-mono text-xs text-gray-500`}>{n.maNV}</td>
                    <td className={td}>{n.hoTen}</td>
                    <td className={`${td} text-gray-600`}>{n.phongBan || '—'}</td>
                    <td className={`${td} text-gray-600`}>{n.chucVu || '—'}</td>
                    <td className={`${td} text-gray-600`}>{n.ngayVaoLam || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Nhom>

          <Nhom tieuDe="Đã nghỉ việc bên App Lương — sẽ chuyển sang Đã nghỉ" mau="bg-red-50 text-red-700" so={xt.nghiViec.length}>
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className={th}>Mã NV</th><th className={th}>Họ tên</th><th className={th}>Tài khoản</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {xt.nghiViec.map(n => (
                  <tr key={n.nhanVienId}>
                    <td className={`${td} font-mono text-xs text-gray-500`}>{n.maNV}</td>
                    <td className={td}>{n.hoTen}</td>
                    <td className={`${td} ${n.coTaiKhoan ? 'text-red-600' : 'text-gray-400'}`}>
                      {n.coTaiKhoan ? 'Sẽ bị vô hiệu hoá + đăng xuất' : 'Không có'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Nhom>

          <Nhom tieuDe="Sẽ được mở lại tài khoản (tình trạng không còn Nghỉ việc)" mau="bg-emerald-50 text-emerald-700" so={xt.moLai.length}>
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {xt.moLai.map(n => (
                  <tr key={n.nhanVienId}>
                    <td className={`${td} font-mono text-xs text-gray-500 w-32`}>{n.maNV}</td>
                    <td className={td}>{n.hoTen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Nhom>

          <Nhom tieuDe="Tạm nghỉ bên App Lương — chỉ để xem, không tự thay đổi" mau="bg-gray-100 text-gray-600" so={xt.tamNghi.length}>
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {xt.tamNghi.map(n => (
                  <tr key={n.nhanVienId}>
                    <td className={`${td} font-mono text-xs text-gray-500 w-32`}>{n.maNV}</td>
                    <td className={td}>{n.hoTen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Nhom>

          <Nhom tieuDe="Có ở TMS nhưng không thấy bên App Lương — kiểm tra lại mã NV" mau="bg-gray-100 text-gray-600" so={xt.khongCoTrongLuong.length}>
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {xt.khongCoTrongLuong.map(n => (
                  <tr key={n.nhanVienId}>
                    <td className={`${td} font-mono text-xs text-gray-500 w-32`}>{n.maNV}</td>
                    <td className={td}>{n.hoTen}</td>
                    <td className={`${td} text-gray-400`}>{n.coTaiKhoan ? 'Có tài khoản' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Nhom>
        </>
      )}

      {hoi && xt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" onClick={() => setHoi(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="hoi-dong-bo"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 id="hoi-dong-bo" className="text-lg font-bold text-gray-900">Đồng bộ từ App Lương?</h2>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              {xt.capNhat.length > 0 && <li>• Cập nhật {xt.capNhat.length} hồ sơ</li>}
              {xt.nghiViec.length > 0 && <li>• Chuyển {xt.nghiViec.length} người sang Đã nghỉ, vô hiệu hoá tài khoản (nếu có)</li>}
              {xt.moLai.length > 0 && <li>• Mở lại {xt.moLai.length} tài khoản</li>}
              {xt.taoMoi.length > 0 && <li>• {xt.taoMoi.length} nhân viên chưa có ở TMS — tạo hồ sơ (không tạo tài khoản)?</li>}
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              {xt.taoMoi.length > 0 && (
                <button onClick={() => dongBo(true)}
                  className="rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  Cập nhật + Tạo mới ({xt.taoMoi.length})
                </button>
              )}
              <button onClick={() => dongBo(false)}
                className={xt.taoMoi.length > 0
                  ? 'rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50'
                  : 'rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black'}>
                {xt.taoMoi.length > 0 ? 'Chỉ cập nhật' : 'Đồng bộ'}
              </button>
              <button onClick={() => setHoi(false)} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
