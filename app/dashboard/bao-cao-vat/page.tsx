'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { vatReportApi } from '@/lib/vat-report';

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

interface QuarterRow {
  year: number;
  quarter: number;
  kyKey: string;
  vatVao: number;
  vatRa: number;
  vatPS: number;
  kckKyTruoc: number;
  thucNop: number;
  kckKyNay: number;
  nopBoSung: number;
  conLai: number;
}

interface ReportData {
  luyCe: { tongVatVao: number; tongVatRa: number; tongNopBS: number; kckCuoi: number };
  kyHienTai: QuarterRow | null;
  yearRows: QuarterRow[];
  allRows: QuarterRow[];
}

interface NopBoSungMap {
  [kyKey: string]: { ngayNop: string | null; soTien: number; dienGiai: string | null };
}

export default function BaoCaoVatPage() {
  const curYear = new Date().getFullYear();
  const curQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(curYear);
  const [quarter, setQuarter] = useState<number>(curQuarter);
  const [showAllYears, setShowAllYears] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [nopBoMap, setNopBoMap] = useState<NopBoSungMap>({});
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKyKey, setDrawerKyKey] = useState('');
  const [drawerKyLabel, setDrawerKyLabel] = useState('');
  const [drawerNgayNop, setDrawerNgayNop] = useState('');
  const [drawerSoTien, setDrawerSoTien] = useState('');
  const [drawerDienGiai, setDrawerDienGiai] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [report, nopBo] = await Promise.all([
        vatReportApi.getReport(year, quarter === 0 ? undefined : quarter),
        vatReportApi.getNopBoSung(),
      ]);
      setData(report);
      setNopBoMap(nopBo);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [year, quarter]);

  useEffect(() => { load(); }, [load]);

  const openDrawer = (kyKey: string, kyLabel: string) => {
    const existing = nopBoMap[kyKey] || {};
    setDrawerKyKey(kyKey);
    setDrawerKyLabel(kyLabel);
    setDrawerNgayNop(existing.ngayNop || '');
    setDrawerSoTien(String(existing.soTien || ''));
    setDrawerDienGiai(existing.dienGiai || '');
    setDrawerOpen(true);
  };

  const saveNopBoSung = async () => {
    if (!drawerKyKey) return;
    setSaving(true);
    try {
      await vatReportApi.saveNopBoSung({
        kyKey: drawerKyKey,
        ngayNop: drawerNgayNop || undefined,
        soTien: Number(drawerSoTien) || 0,
        dienGiai: drawerDienGiai || undefined,
      });
      showToast('Đã lưu thành công!', 'success');
      setDrawerOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const kyLabel = (yr: number, q: number) =>
    q === 0 ? `Cả năm ${yr}` : `Quý ${q}/${yr}`;

  const displayRows: QuarterRow[] = showAllYears
    ? (data?.allRows || [])
    : (data?.yearRows || []);

  const kd = data?.kyHienTai;
  const luy = data?.luyCe;

  // Group rows by year for showAllYears mode
  const groupedByYear: { year: number; rows: QuarterRow[] }[] = [];
  if (showAllYears && displayRows.length > 0) {
    let curYr = -1;
    displayRows.forEach(r => {
      if (r.year !== curYr) {
        groupedByYear.push({ year: r.year, rows: [r] });
        curYr = r.year;
      } else {
        groupedByYear[groupedByYear.length - 1].rows.push(r);
      }
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Thuế VAT</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tổng hợp VAT đầu vào / đầu ra · KCK chuyển kỳ · Nộp bổ sung</p>
        </div>
        <div />
      </div>

      {/* Lũy kế block */}
      {luy && (
        <div className={`rounded-xl border-2 p-4 flex flex-wrap items-center gap-5 ${
          luy.kckCuoi > 0
            ? 'bg-green-50 border-green-300'
            : luy.tongVatRa > luy.tongVatVao
            ? 'bg-red-50 border-red-300'
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex-1 min-w-52">
            <div className={`text-xs font-bold uppercase tracking-wide mb-1 ${luy.kckCuoi > 0 ? 'text-green-700' : 'text-red-700'}`}>
              📌 Lũy kế toàn bộ từ khi dùng hệ thống
            </div>
            {luy.kckCuoi > 0 ? (
              <div className="text-green-700 font-semibold">Còn được khấu trừ / KCK: <strong className="text-lg">{fmt(luy.kckCuoi)}</strong></div>
            ) : (luy.tongVatRa - luy.tongVatVao - luy.tongNopBS) > 0 ? (
              <div className="text-red-700 font-semibold">Còn phải nộp: <strong className="text-lg">{fmt(luy.tongVatRa - luy.tongVatVao - luy.tongNopBS)}</strong></div>
            ) : (
              <div className="text-green-700 font-semibold">✓ Đã cân bằng — không còn phát sinh</div>
            )}
          </div>
          <div className="flex gap-5 flex-wrap">
            <div className="text-center">
              <div className="text-xs text-gray-500">Tổng VAT vào</div>
              <div className="font-bold text-blue-700">{fmt(luy.tongVatVao)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Tổng VAT ra</div>
              <div className="font-bold text-emerald-700">{fmt(luy.tongVatRa)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Đã nộp bổ sung</div>
              <div className="font-bold text-green-700">{fmt(luy.tongNopBS)}</div>
            </div>
            {luy.kckCuoi > 0 && (
              <div className="text-center border-l border-gray-300 pl-4">
                <div className="text-xs font-bold text-purple-700">KCK hiện tại</div>
                <div className="font-extrabold text-purple-700 text-lg">{fmt(luy.kckCuoi)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bộ lọc kỳ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <strong className="text-gray-700">Chọn kỳ kê khai:</strong>
        <select
          className="border rounded-lg px-3 py-1.5 text-sm"
          value={quarter}
          onChange={e => setQuarter(Number(e.target.value))}
          disabled={showAllYears}
        >
          <option value={0}>Cả năm</option>
          {[1, 2, 3, 4].map(q => <option key={q} value={q}>Quý {q}</option>)}
        </select>
        <select
          className="border rounded-lg px-3 py-1.5 text-sm"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          disabled={showAllYears}
        >
          {Array.from({ length: curYear - 2019 }, (_, i) => curYear - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAllYears(v => !v)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${showAllYears ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          {showAllYears ? '✓ ' : ''}Tất cả năm
        </button>
        <span className="text-sm text-gray-500 ml-1">
          {showAllYears ? 'Toàn bộ lịch sử' : kyLabel(year, quarter)}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải...</div>
      ) : (
        <>
          {/* Chi tiết kỳ hiện tại */}
          {kd && !showAllYears && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Chi tiết VAT — {kyLabel(kd.year, kd.quarter)}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-700 font-semibold mb-1">↓ VAT đầu vào (HH)</div>
                  <div className="text-lg font-bold text-blue-700">{fmt(kd.vatVao)}</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-xs text-emerald-700 font-semibold mb-1">↑ VAT đầu ra</div>
                  <div className="text-lg font-bold text-emerald-700">{fmt(kd.vatRa)}</div>
                </div>
                <div className={`rounded-xl p-4 border-2 ${kd.vatPS > 0 ? 'bg-red-50 border-red-400' : kd.vatPS < 0 ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-300'}`}>
                  <div className={`text-xs font-bold mb-1 ${kd.vatPS > 0 ? 'text-red-700' : kd.vatPS < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    Phát sinh GTGT
                  </div>
                  <div className={`text-lg font-bold ${kd.vatPS > 0 ? 'text-red-700' : kd.vatPS < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {fmt(Math.abs(kd.vatPS))}
                  </div>
                  <div className={`text-xs mt-1 ${kd.vatPS > 0 ? 'text-red-600' : kd.vatPS < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {kd.vatPS > 0 ? 'Phải nộp thêm' : kd.vatPS < 0 ? 'Được khấu trừ' : 'Không phát sinh'}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-xs text-purple-700 font-semibold mb-1">KCK kỳ trước</div>
                  <div className="text-lg font-bold text-purple-700">{kd.kckKyTruoc > 0 ? fmt(kd.kckKyTruoc) : '—'}</div>
                </div>
                <div className={`rounded-xl p-4 ${kd.thucNop > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <div className={`text-xs font-semibold mb-1 ${kd.thucNop > 0 ? 'text-orange-700' : 'text-gray-500'}`}>Thực phải nộp</div>
                  <div className={`text-lg font-bold ${kd.thucNop > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
                    {kd.thucNop > 0 ? fmt(kd.thucNop) : '0 đ'}
                  </div>
                </div>
                <div className={`rounded-xl p-4 border-2 ${kd.conLai > 0 ? 'bg-red-50 border-red-400' : kd.conLai < 0 ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`text-xs font-bold mb-1 ${kd.conLai > 0 ? 'text-red-700' : kd.conLai < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {kd.conLai > 0 ? 'Còn phải nộp' : kd.conLai < 0 ? 'KCK chuyển sang' : '✓ Đã nộp đủ'}
                  </div>
                  {Math.abs(kd.conLai) > 0 && (
                    <div className={`text-lg font-bold ${kd.conLai > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {fmt(Math.abs(kd.conLai))}
                    </div>
                  )}
                </div>
              </div>

              {/* Nộp bổ sung kỳ này */}
              {kd.nopBoSung > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 flex-wrap">
                  <span className="text-green-700 text-sm">✓ Đã nộp bổ sung: <strong>{fmt(kd.nopBoSung)}</strong></span>
                  {nopBoMap[kd.kyKey]?.ngayNop && (
                    <span className="text-gray-500 text-sm">— ngày {nopBoMap[kd.kyKey].ngayNop}</span>
                  )}
                  {nopBoMap[kd.kyKey]?.dienGiai && (
                    <span className="text-gray-500 text-sm">— {nopBoMap[kd.kyKey].dienGiai}</span>
                  )}
                  <button
                    onClick={() => openDrawer(kd.kyKey, kyLabel(kd.year, kd.quarter))}
                    className="ml-auto px-3 py-1 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                  >
                    Sửa
                  </button>
                </div>
              )}

              {quarter !== 0 && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => openDrawer(`${year}_Q${quarter}`, `Quý ${quarter}/${year}`)}
                    className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-semibold"
                  >
                    Khai báo nộp bổ sung — Quý {quarter}/{year}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bảng tổng hợp */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">
                {showAllYears ? 'Toàn bộ lịch sử theo quý' : `Tổng hợp cả năm ${year} theo quý`}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Kỳ</th>
                    <th className="px-4 py-3 text-right">VAT vào</th>
                    <th className="px-4 py-3 text-right">VAT ra</th>
                    <th className="px-4 py-3 text-right">Phát sinh</th>
                    <th className="px-4 py-3 text-right text-purple-600">KCK kỳ trước</th>
                    <th className="px-4 py-3 text-right text-red-600">Thực nộp</th>
                    <th className="px-4 py-3 text-right">Đã nộp BS</th>
                    <th className="px-4 py-3 text-right">Còn lại / KCK</th>
                    <th className="px-4 py-3 text-center">Khai báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {showAllYears ? (
                    groupedByYear.map(group => (
                      <>
                        <tr key={`year-${group.year}`} className="bg-purple-50">
                          <td colSpan={9} className="px-4 py-1.5 text-xs font-bold text-purple-700 tracking-wider">
                            ── NĂM {group.year} ──
                          </td>
                        </tr>
                        {group.rows.map(row => (
                          <QuarterTableRow
                            key={row.kyKey}
                            row={row}
                            isActive={!showAllYears && row.year === year && row.quarter === quarter}
                            onKhaiBao={openDrawer}
                          />
                        ))}
                      </>
                    ))
                  ) : (
                    displayRows.map(row => (
                      <QuarterTableRow
                        key={row.kyKey}
                        row={row}
                        isActive={row.year === year && row.quarter === quarter}
                        onKhaiBao={openDrawer}
                      />
                    ))
                  )}
                  {displayRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lịch sử nộp bổ sung */}
          {Object.keys(nopBoMap).filter(k => (nopBoMap[k]?.soTien || 0) > 0).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Lịch sử nộp bổ sung
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Kỳ</th>
                      <th className="px-4 py-3 text-right">Số tiền nộp BS</th>
                      <th className="px-4 py-3 text-left">Ngày nộp</th>
                      <th className="px-4 py-3 text-left">Diễn giải</th>
                      <th className="px-4 py-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.keys(nopBoMap)
                      .filter(k => (nopBoMap[k]?.soTien || 0) > 0)
                      .sort()
                      .map(k => {
                        const parts = k.split('_Q');
                        const label = parts.length === 2 ? `Quý ${parts[1]}/${parts[0]}` : k;
                        const rec = nopBoMap[k];
                        return (
                          <tr key={k} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold">{label}</td>
                            <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(rec.soTien)}</td>
                            <td className="px-4 py-3 text-gray-600">{rec.ngayNop || '—'}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{rec.dienGiai || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => openDrawer(k, label)}
                                className="px-3 py-1 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
                              >
                                Sửa
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawer nộp bổ sung */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 w-96 max-w-full bg-white h-full shadow-xl flex flex-col">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">Khai báo nộp bổ sung</div>
                <div className="text-sm opacity-80 mt-0.5">{drawerKyLabel}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
                ✕
              </button>
            </div>
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Ngày nộp</label>
                <input
                  type="date"
                  value={drawerNgayNop}
                  onChange={e => setDrawerNgayNop(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Số tiền nộp bổ sung (VND)</label>
                <input
                  type="number"
                  value={drawerSoTien}
                  onChange={e => setDrawerSoTien(e.target.value)}
                  placeholder="Nhập số tiền..."
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Diễn giải</label>
                <textarea
                  value={drawerDienGiai}
                  onChange={e => setDrawerDienGiai(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: Nộp qua ngân hàng Vietcombank..."
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t space-y-2">
              <button
                onClick={saveNopBoSung}
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : 'Lưu khai báo'}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function QuarterTableRow({
  row,
  isActive,
  onKhaiBao,
}: {
  row: QuarterRow;
  isActive: boolean;
  onKhaiBao: (kyKey: string, label: string) => void;
}) {
  const qLabel = `Quý ${row.quarter}/${row.year}`;
  const psColor = row.vatPS > 0 ? 'text-red-700' : row.vatPS < 0 ? 'text-green-700' : 'text-gray-400';
  const thucNopColor = row.thucNop > 0 ? 'text-red-700 font-bold' : 'text-gray-400';
  const conLaiColor = row.conLai > 0 ? 'text-red-700' : row.conLai < 0 ? 'text-green-700' : 'text-gray-400';

  return (
    <tr className={`hover:bg-gray-50 transition ${isActive ? 'bg-blue-50 font-semibold' : ''}`}>
      <td className="px-4 py-3">
        {qLabel}
        {isActive && <span className="ml-1 text-xs text-blue-500">(đang xem)</span>}
      </td>
      <td className="px-4 py-3 text-right text-blue-700">{fmt(row.vatVao)}</td>
      <td className="px-4 py-3 text-right text-emerald-700">{fmt(row.vatRa)}</td>
      <td className={`px-4 py-3 text-right font-bold ${psColor}`}>
        {row.vatPS >= 0 ? '+' : ''}{fmt(row.vatPS)}
      </td>
      <td className="px-4 py-3 text-right text-purple-700">
        {row.kckKyTruoc > 0 ? <strong>{fmt(row.kckKyTruoc)}</strong> : <span className="text-gray-300">—</span>}
      </td>
      <td className={`px-4 py-3 text-right ${thucNopColor}`}>
        {row.thucNop > 0 ? fmt(row.thucNop) : <span className="text-green-600">0</span>}
      </td>
      <td className="px-4 py-3 text-right">
        {row.nopBoSung > 0
          ? <span className="text-green-700 font-semibold">{fmt(row.nopBoSung)}</span>
          : <span className="text-gray-300">—</span>}
      </td>
      <td className={`px-4 py-3 text-right ${conLaiColor}`}>
        {fmt(Math.abs(row.conLai))}
        {row.conLai < 0 && <span className="text-xs ml-1 text-green-600">(KCK)</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onKhaiBao(row.kyKey, qLabel)}
          className="px-3 py-1 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
        >
          Khai báo
        </button>
      </td>
    </tr>
  );
}
