'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  taxSupportApi, generateExcel,
  MetricValues, NoiBo, TaxDoiSoat, TaxDoiSoatLog, QuarterSummary, XuLyData,
} from '@/lib/tax-support';
import { fmtMoney } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtVnd(n: number | undefined | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
}

function getQuarterLabel(ky: number) { return `Quý ${ky}`; }

const TRANG_THAI_LABEL: Record<string, { label: string; cls: string }> = {
  CHUA_DOI_SOAT: { label: 'Chưa đối soát', cls: 'bg-gray-100 text-gray-600' },
  DANG_XU_LY:    { label: 'Đang xử lý',    cls: 'bg-blue-50 text-blue-700' },
  MATCH_TOAN_BO: { label: 'Khớp hoàn toàn', cls: 'bg-green-50 text-green-700' },
  CON_LECH:      { label: 'Còn lệch',        cls: 'bg-red-50 text-red-700' },
};

const XU_LY_OPTIONS = [
  { value: 'CHUA_XU_LY', label: 'Chưa xử lý' },
  { value: 'DANG_XU_LY', label: 'Đang xử lý' },
  { value: 'DA_XU_LY',   label: 'Đã xử lý' },
];

const ACTION_LABEL: Record<string, string> = {
  TAO_DOI_SOAT:      'Tạo đối soát',
  CAP_NHAT_KE_NGOAI: 'Cập nhật kế ngoài',
  XU_LY_LECH:        'Xử lý chênh lệch',
  XUAT_EXCEL:        'Xuất Excel',
  TINH_LAI_NOI_BO:   'Tính lại nội bộ',
};

const METRIC_KEYS: (keyof MetricValues)[] = ['vatDauRa', 'vatDauVao', 'thueGTGT', 'doanhThu', 'chiPhi'];
const METRIC_LABEL: Record<keyof MetricValues, string> = {
  vatDauRa:  'VAT Đầu Ra',
  vatDauVao: 'VAT Đầu Vào',
  thueGTGT:  'Thuế GTGT Phải Nộp',
  doanhThu:  'Doanh Thu (TNDN)',
  chiPhi:    'Chi Phí Được Trừ',
};

const MATCH_THRESHOLD = 1000;

// ── Main Page ────────────────────────────────────────────────────────────────

export default function HoTroKeToanThuePage() {
  const curYear = new Date().getFullYear();
  const curKy = Math.ceil((new Date().getMonth() + 1) / 3); // quý hiện tại
  const [nam, setNam] = useState(curYear);
  const [selectedKy, setSelectedKy] = useState<number | null>(curKy);
  const [detailTab, setDetailTab] = useState<'doi-soat' | 'xuat-chung-tu' | 'lich-su'>('doi-soat');

  const [summaries, setSummaries] = useState<QuarterSummary[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [noiBo, setNoiBo] = useState<NoiBo | null>(null);
  const [loadingNoiBo, setLoadingNoiBo] = useState(false);

  const [doiSoat, setDoiSoat] = useState<TaxDoiSoat | null>(null);
  const [loadingDoiSoat, setLoadingDoiSoat] = useState(false);

  const [logs, setLogs] = useState<TaxDoiSoatLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  // Kế ngoài form
  const [keNgoaiForm, setKeNgoaiForm] = useState<Partial<MetricValues>>({});
  const [ghiChuForm, setGhiChuForm] = useState<Partial<Record<keyof MetricValues, string>>>({});
  const [savingDoiSoat, setSavingDoiSoat] = useState(false);

  // Xử lý lệch form
  const [xuLyForm, setXuLyForm] = useState<Partial<XuLyData>>({});
  const [savingXuLy, setSavingXuLy] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Load summary (4 quý) ──────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await taxSupportApi.getQuarterSummary(nam);
      setSummaries(data);
    } catch { /* silent */ }
    finally { setLoadingSummary(false); }
  }, [nam]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ── Load quarter detail ───────────────────────────────────────────────────

  const loadQuarterDetail = useCallback(async (ky: number) => {
    setNoiBo(null);
    setDoiSoat(null);
    setLogs([]);
    setLoadingNoiBo(true);
    setLoadingDoiSoat(true);
    setLoadingLogs(true);

    const [nb, ds, lg] = await Promise.allSettled([
      taxSupportApi.getNoiBo(ky, nam),
      taxSupportApi.getDoiSoat(ky, nam),
      taxSupportApi.getDoiSoatLog(ky, nam),
    ]);

    if (nb.status === 'fulfilled') setNoiBo(nb.value);
    setLoadingNoiBo(false);

    if (ds.status === 'fulfilled') {
      const rec = ds.value;
      setDoiSoat(rec);
      if (rec?.keNgoaiData) setKeNgoaiForm(rec.keNgoaiData);
      if (rec?.xuLyData) setXuLyForm(rec.xuLyData as Partial<XuLyData>);
      if (rec?.ghiChuData) setGhiChuForm(rec.ghiChuData as Partial<Record<keyof MetricValues, string>>);
    }
    setLoadingDoiSoat(false);

    if (lg.status === 'fulfilled') setLogs(lg.value);
    setLoadingLogs(false);
  }, [nam]);

  // Load quý được chọn khi nam thay đổi hoặc lần đầu vào trang
  useEffect(() => {
    if (selectedKy) {
      setKeNgoaiForm({});
      setGhiChuForm({});
      setXuLyForm({});
      loadQuarterDetail(selectedKy);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nam, loadQuarterDetail]);

  function selectKy(ky: number) {
    if (selectedKy === ky) { setSelectedKy(null); return; }
    setSelectedKy(ky);
    setKeNgoaiForm({});
    setGhiChuForm({});
    setXuLyForm({});
    loadQuarterDetail(ky);
  }

  // ── Đối soát save ──────────────────────────────────────────────────────────

  async function handleSaveDoiSoat() {
    if (!selectedKy) return;
    setSavingDoiSoat(true);
    try {
      const rec = await taxSupportApi.saveDoiSoat({
        ky: selectedKy,
        nam,
        keNgoaiData: keNgoaiForm as MetricValues,
        ghiChuData: ghiChuForm as Partial<Record<keyof MetricValues, string | null>>,
      });
      setDoiSoat(rec);
      showToast('Đã lưu đối soát');
      loadSummary();
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu đối soát', false);
    } finally {
      setSavingDoiSoat(false);
    }
  }

  // ── Xử lý lệch save ───────────────────────────────────────────────────────

  async function handleSaveXuLy() {
    if (!doiSoat) return;
    setSavingXuLy(true);
    try {
      const rec = await taxSupportApi.updateXuLyLech(doiSoat.id, {
        xuLyData: xuLyForm as Partial<XuLyData>,
        ghiChuData: ghiChuForm as Partial<Record<keyof MetricValues, string | null>>,
      });
      setDoiSoat(rec);
      showToast('Đã lưu trạng thái xử lý');
      loadSummary();
    } catch (err: any) {
      showToast(err.message || 'Lỗi cập nhật', false);
    } finally {
      setSavingXuLy(false);
    }
  }

  // ── Export Excel ──────────────────────────────────────────────────────────

  async function handleExport() {
    if (!selectedKy) return;
    setExporting(true);
    setExportMsg('Đang tải dữ liệu...');
    try {
      const data = await taxSupportApi.getExportData(selectedKy, nam);
      setExportMsg('Đang tạo file Excel...');
      await generateExcel(data);
      const tabCounts = { tab1: data.tab1.length, tab2: data.tab2.length, tab3: data.tab3.length };
      await taxSupportApi.recordExport(selectedKy, nam, tabCounts);
      // Reload logs
      taxSupportApi.getDoiSoatLog(selectedKy, nam).then(setLogs).catch(() => {});
      showToast(`Đã xuất Excel: ${tabCounts.tab1} HĐ đầu ra, ${tabCounts.tab2} HĐ đầu vào, ${tabCounts.tab3} phiếu chi`);
    } catch (err: any) {
      showToast(err.message || 'Lỗi xuất file', false);
    } finally {
      setExporting(false);
      setExportMsg('');
    }
  }

  // ── KPI bar ───────────────────────────────────────────────────────────────

  const totalDoiSoat = summaries.filter(s => s.doiSoat).length;
  const totalKhop = summaries.filter(s => s.doiSoat?.trangThai === 'MATCH_TOAN_BO').length;
  const totalLech = summaries.filter(s => s.doiSoat?.trangThai === 'CON_LECH').length;
  const totalChuaDS = 4 - totalDoiSoat;

  const currentQ = summaries.find(s => s.ky === selectedKy);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hỗ Trợ Kế Toán Thuế</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tổng hợp VAT, đối soát kế toán ngoài, xuất chứng từ Excel 4 tab</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNam(y => y - 1)} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-lg font-bold text-gray-900 min-w-[4rem] text-center">{nam}</span>
            <button onClick={() => setNam(y => y + 1)} disabled={nam >= curYear} className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* KPI Bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Đã Đối Soát', value: totalDoiSoat, sub: 'quý', cls: 'from-blue-500 to-blue-600' },
            { label: 'Khớp Hoàn Toàn', value: totalKhop, sub: 'quý', cls: 'from-green-500 to-green-600' },
            { label: 'Còn Lệch', value: totalLech, sub: 'quý', cls: 'from-red-500 to-red-600' },
            { label: 'Chưa Đối Soát', value: totalChuaDS, sub: 'quý', cls: 'from-gray-400 to-gray-500' },
          ].map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.cls} rounded-2xl p-5 text-white`}>
              <p className="text-sm font-medium text-white/80">{c.label}</p>
              <p className="text-3xl font-bold mt-1">{c.value}</p>
              <p className="text-xs text-white/60 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Quarter cards */}
        <div className="grid grid-cols-4 gap-4">
          {loadingSummary
            ? [1, 2, 3, 4].map(k => (
                <div key={k} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse h-36" />
              ))
            : [1, 2, 3, 4].map(ky => {
                const s = summaries.find(x => x.ky === ky);
                const ds = s?.doiSoat;
                const tt = ds?.trangThai || 'CHUA_DOI_SOAT';
                const ttInfo = TRANG_THAI_LABEL[tt];
                const isSelected = selectedKy === ky;
                return (
                  <button key={ky} onClick={() => selectKy(ky)}
                    className={`group text-left bg-white rounded-2xl border shadow-sm p-5 transition hover:shadow-md ${isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-900">{getQuarterLabel(ky)}</span>
                        {ky === curKy && nam === curYear && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-md">Hiện tại</span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ttInfo.cls}`}>{ttInfo.label}</span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">HĐ đầu ra</span>
                        <span className="font-medium text-gray-700">{s?.soHoaDonDauRa ? s.soHoaDonDauRa : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">HĐ đầu vào</span>
                        <span className="font-medium text-gray-700">{s?.soHoaDonDauVao ? s.soHoaDonDauVao : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">VAT đầu ra</span>
                        <span className="font-medium text-blue-700">{s?.vatDauRa ? fmtVnd(s.vatDauRa) : '—'}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-xs text-gray-400 group-hover:text-blue-500 transition">
                        {isSelected ? 'Đang xem' : 'Xem chi tiết'}
                      </span>
                      <svg className={`w-3.5 h-3.5 transition ${isSelected ? 'text-blue-500 rotate-90' : 'text-gray-300 group-hover:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
        </div>

        {/* Detail panel */}
        {selectedKy && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-gray-900">{getQuarterLabel(selectedKy)} / {nam}</h2>
                {doiSoat && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TRANG_THAI_LABEL[doiSoat.trangThai]?.cls || 'bg-gray-100 text-gray-600'}`}>
                    {TRANG_THAI_LABEL[doiSoat.trangThai]?.label}
                  </span>
                )}
              </div>
              {/* Tab switcher */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                  { id: 'doi-soat', label: 'Đối Soát' },
                  { id: 'xuat-chung-tu', label: 'Xuất Chứng Từ' },
                  { id: 'lich-su', label: 'Lịch Sử' },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setDetailTab(t.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${detailTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB: Đối Soát */}
            {detailTab === 'doi-soat' && (
              <div className="p-6 space-y-6">
                {/* Nội bộ */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Số liệu nội bộ (tính từ hệ thống)</h3>
                  {loadingNoiBo ? (
                    <div className="h-20 animate-pulse bg-gray-50 rounded-xl" />
                  ) : noiBo ? (
                    <div className="grid grid-cols-3 gap-3">
                      {METRIC_KEYS.map(k => (
                        <div key={k} className="bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-blue-600 font-medium">{METRIC_LABEL[k]}</p>
                          <p className="text-base font-bold text-blue-900 mt-1">{fmtVnd(noiBo[k])}</p>
                        </div>
                      ))}
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 font-medium">KCK Kỳ Trước</p>
                        <p className="text-base font-bold text-gray-800 mt-1">{fmtVnd(noiBo.kckKyTruoc)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 font-medium">KCK Kỳ Này (sang kỳ sau)</p>
                        <p className="text-base font-bold text-gray-800 mt-1">{fmtVnd(noiBo.kckKyNay)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Không tải được dữ liệu</p>
                  )}
                </div>

                {/* Kế ngoài + so sánh */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Số liệu kế toán ngoài (nhập vào)</h3>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-2.5 text-left font-semibold">Chỉ tiêu</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Nội bộ</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Kế ngoài</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Chênh lệch</th>
                          <th className="px-4 py-2.5 text-center font-semibold">Kết quả</th>
                          <th className="px-4 py-2.5 text-center font-semibold w-36">Xử lý</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {METRIC_KEYS.map(k => {
                          const nb = noiBo?.[k] ?? 0;
                          const ke = keNgoaiForm[k] ?? null;
                          const cl = doiSoat?.chenhLechData?.[k] ?? (ke != null ? nb - ke : null);
                          const isMatch = cl != null && Math.abs(cl) <= MATCH_THRESHOLD;
                          return (
                            <tr key={k} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-gray-700">{METRIC_LABEL[k]}</td>
                              <td className="px-4 py-3 text-right text-gray-900 font-mono text-xs">{fmtVnd(nb)}</td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  value={keNgoaiForm[k] ?? ''}
                                  onChange={e => setKeNgoaiForm(prev => ({ ...prev, [k]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                  placeholder="Nhập số"
                                  className="w-32 px-2 py-1 text-right text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              </td>
                              <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${cl == null ? 'text-gray-400' : isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                {cl != null ? fmtVnd(cl) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {cl != null ? (
                                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${isMatch ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {isMatch ? 'KHỚP' : 'LỆCH'}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {!isMatch && cl != null ? (
                                  <select value={xuLyForm[k] || 'CHUA_XU_LY'}
                                    onChange={e => setXuLyForm(prev => ({ ...prev, [k]: e.target.value }))}
                                    className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
                                    {XU_LY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Ghi chú */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {METRIC_KEYS.filter(k => {
                      const ke = keNgoaiForm[k] ?? null;
                      const nb = noiBo?.[k] ?? 0;
                      const cl = ke != null ? nb - ke : null;
                      return cl != null && Math.abs(cl) > MATCH_THRESHOLD;
                    }).map(k => (
                      <div key={k}>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Ghi chú – {METRIC_LABEL[k]}</label>
                        <input type="text" value={ghiChuForm[k] ?? ''}
                          onChange={e => setGhiChuForm(prev => ({ ...prev, [k]: e.target.value }))}
                          placeholder="Lý do chênh lệch..."
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button onClick={handleSaveDoiSoat} disabled={savingDoiSoat}
                      className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-60">
                      {savingDoiSoat ? 'Đang lưu...' : '💾 Lưu đối soát'}
                    </button>
                    {doiSoat && (
                      <button onClick={handleSaveXuLy} disabled={savingXuLy}
                        className="px-4 py-2 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100 transition disabled:opacity-60">
                        {savingXuLy ? 'Đang lưu...' : 'Cập nhật xử lý lệch'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Xuất Chứng Từ */}
            {detailTab === 'xuat-chung-tu' && (
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Xuất chứng từ thuế Excel</h3>
                  <p className="text-sm text-gray-500 mb-4">File Excel gồm 4 tab: HĐ VAT Đầu Ra · HĐ VAT Đầu Vào · Chi Phí TNDN · Tổng Hợp Quý</p>

                  {/* Preview counts */}
                  {currentQ && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { label: 'Tab 1 — HĐ VAT Đầu Ra', count: currentQ.soHoaDonDauRa, sub: 'hóa đơn xuất', cls: 'bg-blue-50 border-blue-100 text-blue-700' },
                        { label: 'Tab 2 — HĐ VAT Đầu Vào', count: currentQ.soHoaDonDauVao, sub: 'hóa đơn nhập', cls: 'bg-purple-50 border-purple-100 text-purple-700' },
                        { label: 'Tab 3 — Chi Phí TNDN', count: currentQ.soPhieuChi, sub: 'phiếu chi hợp lệ', cls: 'bg-orange-50 border-orange-100 text-orange-700' },
                      ].map(c => (
                        <div key={c.label} className={`border rounded-xl p-4 ${c.cls}`}>
                          <p className="text-xs font-medium opacity-80">{c.label}</p>
                          <p className="text-2xl font-bold mt-1">{c.count}</p>
                          <p className="text-xs opacity-60 mt-0.5">{c.sub}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQ?.soPhieuChi === 0 && (
                    <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                      <strong>Lưu ý:</strong> Tab 3 đang trống. Đánh dấu <em>"Chi phí hợp lệ tính thuế TNDN"</em> khi tạo phiếu chi để dữ liệu xuất hiện ở đây.
                    </div>
                  )}

                  <button onClick={handleExport} disabled={exporting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition disabled:opacity-60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    {exporting ? exportMsg || 'Đang xuất...' : `Xuất Excel — Q${selectedKy}/${nam}`}
                  </button>
                </div>

                {/* Lịch sử xuất */}
                {doiSoat?.exportHistory && doiSoat.exportHistory.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Lịch sử xuất file</h3>
                    <div className="space-y-2">
                      {[...doiSoat.exportHistory].reverse().slice(0, 5).map((e, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl text-sm">
                          <span className="text-gray-600">{new Date(e.exportedAt).toLocaleString('vi-VN')}</span>
                          <span className="text-gray-500">
                            {e.tabCounts.tab1} HĐ ra · {e.tabCounts.tab2} HĐ vào · {e.tabCounts.tab3} phiếu chi
                          </span>
                          <span className="text-gray-400">{e.exportedBy || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Lịch Sử */}
            {detailTab === 'lich-su' && (
              <div className="p-6">
                {loadingLogs ? (
                  <div className="h-32 animate-pulse bg-gray-50 rounded-xl" />
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Chưa có hoạt động nào cho quý này</div>
                ) : (
                  <div className="space-y-3">
                    {logs.map(log => (
                      <div key={log.id} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                              log.action === 'XUAT_EXCEL' ? 'bg-green-50 text-green-700' :
                              log.action === 'XU_LY_LECH' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              {ACTION_LABEL[log.action] || log.action}
                            </span>
                            {log.actor && <span className="text-xs text-gray-500">bởi {log.actor}</span>}
                            <span className="text-xs text-gray-400 ml-auto">
                              {new Date(log.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          {log.chiTiet && <p className="text-sm text-gray-600 mt-1">{log.chiTiet}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state — chỉ hiện khi user bấm collapse quý đang chọn */}
        {!selectedKy && !loadingSummary && (
          <div className="text-center py-10 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Chọn một quý để xem chi tiết và xuất chứng từ</p>
          </div>
        )}
      </div>
    </div>
  );
}
