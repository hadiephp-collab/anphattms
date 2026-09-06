'use client';
import { useEffect, useState, useCallback } from 'react';
import { reportsApi, profitApi } from '@/lib/reports';
import { localDateStr } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return fmt(n);
};

const pctColor = (pct: number) =>
  pct > 30 ? 'text-green-700' : pct >= 0 ? 'text-amber-600' : 'text-red-600';

const TODAY = localDateStr();
const CUR_YEAR = new Date().getFullYear();
const CUR_MONTH = new Date().getMonth() + 1;
const CUR_QUY = Math.ceil(CUR_MONTH / 3);

const REPORT_GROUP_LABELS: Record<string, string> = {
  'ban-hang': 'Chi phí bán hàng',
  'quan-ly':  'Chi phí quản lý',
  'dich-vu':  'Chi phí dịch vụ',
  'khac':     'Chi phí khác',
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function LoiNhuanPage() {
  const [tab, setTab] = useState<'pl' | 'sp' | 'vat'>('pl');

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Lợi Nhuận & Thuế</h1>
          <p className="text-sm text-gray-500 mt-0.5">P&L · Lợi nhuận theo sản phẩm · Thuế VAT theo quý</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {([
            ['pl', 'P&L (Kết Quả KD)'],
            ['sp', 'LN Theo Sản Phẩm'],
            ['vat', 'Thuế VAT'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'pl'  && <TabPL />}
      {tab === 'sp'  && <TabSP />}
      {tab === 'vat' && <TabVAT />}
    </div>
  );
}

// ── Tab 1: P&L ───────────────────────────────────────────────────────────────

function TabPL() {
  const [loaiKy, setLoaiKy]   = useState('thang');
  const [thang, setThang]     = useState(CUR_MONTH);
  const [quy, setQuy]         = useState(CUR_QUY);
  const [nam, setNam]         = useState(CUR_YEAR);
  const [tuNgay, setTuNgay]   = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [expandedNhom, setExpandedNhom] = useState<Set<string>>(new Set());
  const [showTaxPanel, setShowTaxPanel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await reportsApi.getProfitReport({
        loaiKy, thang, quy, nam,
        tuNgay: tuNgay || undefined, denNgay: denNgay || undefined,
      });
      setData(res);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [loaiKy, thang, quy, nam, tuNgay, denNgay]);

  useEffect(() => { load(); }, []);

  const toggleNhom = (nhom: string) =>
    setExpandedNhom(prev => {
      const s = new Set(prev);
      s.has(nhom) ? s.delete(nhom) : s.add(nhom);
      return s;
    });

  const k = data?.ketoan;
  const t = data?.tndn;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Kỳ</label>
            <select value={loaiKy} onChange={e => setLoaiKy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="thang">Tháng</option>
              <option value="quy">Quý</option>
              <option value="nam">Năm</option>
              <option value="tuychinh">Tùy chỉnh</option>
            </select>
          </div>
          {loaiKy === 'thang' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tháng</label>
              <select value={thang} onChange={e => setThang(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                ))}
              </select>
            </div>
          )}
          {loaiKy === 'quy' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quý</label>
              <select value={quy} onChange={e => setQuy(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={1}>Quý 1</option>
                <option value={2}>Quý 2</option>
                <option value={3}>Quý 3</option>
                <option value={4}>Quý 4</option>
              </select>
            </div>
          )}
          {loaiKy !== 'tuychinh' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Năm</label>
              <select value={nam} onChange={e => setNam(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Array.from({ length: 5 }, (_, i) => CUR_YEAR - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
          {loaiKy === 'tuychinh' && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Từ ngày</label>
                <input type="date" value={tuNgay} max={TODAY} onChange={e => setTuNgay(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Đến ngày</label>
                <input type="date" value={denNgay} max={TODAY} onChange={e => setDenNgay(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
          <button onClick={load} disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang tính...' : 'Tính'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {data && (
        <>
          {/* Warnings */}
          {data.kyBaoCao?.isPartial && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 text-sm">
              ℹ️ Kỳ chưa kết thúc — số liệu tạm tính
            </div>
          )}
          {data.dataWarnings?.cogsNullCount > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
              ⚠️ {data.dataWarnings.cogsNullCount} dòng HĐ thiếu giá vốn — COGS có thể thấp hơn thực tế
            </div>
          )}

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Doanh Thu', val: k?.doanhThu, color: 'from-blue-500 to-blue-600' },
              { label: 'Giá Vốn (COGS)', val: k?.cogs, color: 'from-gray-500 to-gray-600' },
              { label: 'Lợi Nhuận Gộp', val: k?.loiNhuanGop, color: 'from-green-500 to-green-600' },
              { label: 'Thuế Suất TNDN', val: null, pct: data.thueSuat, color: 'from-purple-500 to-purple-600' },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-4 text-white`}>
                <p className="text-xs opacity-80 mb-1">{c.label}</p>
                <p className="text-xl font-bold">
                  {c.pct != null ? `${Math.round(c.pct * 100)}%` : fmtShort(c.val ?? 0)}
                </p>
              </div>
            ))}
          </div>

          {/* P&L Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-700 text-sm">
                Bảng Kết Quả Kinh Doanh — {data.kyBaoCao?.label}
                {data.kyBaoCao?.isLocked && (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Kỳ đã khóa</span>
                )}
              </h3>
              <button onClick={() => setShowTaxPanel(!showTaxPanel)}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                ⚙ Thuế suất TNDN
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="px-5 py-2.5 text-left">Chỉ tiêu</th>
                  <th className="px-5 py-2.5 text-right w-48">Kế Toán</th>
                  <th className="px-5 py-2.5 text-right w-48">TNDN (Hợp Lệ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <PLRow label="Doanh Thu" kVal={k?.doanhThu} tVal={t?.doanhThu} bold />
                <PLRow label="Giá Vốn Hàng Bán (COGS)" kVal={-(k?.cogs ?? 0)} tVal={-(t?.cogs ?? 0)} red />
                <PLRow label="Lợi Nhuận Gộp" kVal={k?.loiNhuanGop} tVal={t?.loiNhuanGop} bold highlight />

                {/* Chi phí theo nhóm */}
                {k?.chiPhi?.map((nhom: any) => (
                  <PLGroupRow
                    key={nhom.nhom}
                    nhom={nhom}
                    expanded={expandedNhom.has(nhom.nhom)}
                    onToggle={() => toggleNhom(nhom.nhom)}
                  />
                ))}

                {/* Khấu hao */}
                {(k?.chiPhiKhauHao ?? 0) > 0 && (
                  <PLKhauHaoRow
                    chiPhiKhauHao={k.chiPhiKhauHao}
                    detail={k.chiPhiKhauHaoDetail}
                    expanded={expandedNhom.has('_khau-hao')}
                    onToggle={() => toggleNhom('_khau-hao')}
                  />
                )}

                <PLRow label="Tổng Chi Phí" kVal={-(k?.tongChiPhi ?? 0)} tVal={-(t?.tongChiPhiHopLe ?? 0)} red bold />
                <PLRow label="LN Trước Thuế" kVal={k?.loiNhuanKeToan} tVal={t?.loiNhuanChiuThue} bold highlight />
                <PLRow
                  label={`Thuế TNDN (${Math.round((data.thueSuat ?? 0.2) * 100)}%)`}
                  kVal={-(k?.thueTNDN ?? 0)} tVal={-(t?.thueTNDN ?? 0)} red
                />
                <PLRow label="Lợi Nhuận Sau Thuế" kVal={k?.loiNhuanSauThue} tVal={t?.loiNhuanSauThue} bold highlight2 />
              </tbody>
            </table>
          </div>

          {showTaxPanel && <TaxRatePanel onClose={() => setShowTaxPanel(false)} />}
        </>
      )}
    </div>
  );
}

function PLRow({ label, kVal, tVal, bold, red, highlight, highlight2 }: {
  label: string; kVal?: number; tVal?: number;
  bold?: boolean; red?: boolean; highlight?: boolean; highlight2?: boolean;
}) {
  const rowCls = highlight ? 'bg-blue-50/50' : highlight2 ? 'bg-green-50/50' : '';
  const fmtCell = (v?: number) => {
    if (v == null || v === 0) return <span className="text-gray-300">—</span>;
    const abs = fmt(Math.abs(v));
    if (v < 0 || red) return <span className="text-red-600">({abs})</span>;
    return <span className="text-green-700">{abs}</span>;
  };
  return (
    <tr className={`${rowCls} border-b border-gray-100`}>
      <td className={`px-5 py-2.5 text-gray-800 ${bold ? 'font-semibold' : ''}`}>{label}</td>
      <td className="px-5 py-2.5 text-right">{fmtCell(kVal)}</td>
      <td className="px-5 py-2.5 text-right">{fmtCell(tVal)}</td>
    </tr>
  );
}

function PLGroupRow({ nhom, expanded, onToggle }: { nhom: any; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td className="px-5 py-2.5 text-gray-700">
          <span className="text-gray-400 mr-2">{expanded ? '▾' : '▸'}</span>
          {REPORT_GROUP_LABELS[nhom.nhom] ?? nhom.nhomLabel ?? nhom.nhom}
        </td>
        <td className="px-5 py-2.5 text-right text-red-600">({fmt(nhom.tong)})</td>
        <td className="px-5 py-2.5 text-right text-red-600">
          {nhom.hopLeTaxTong > 0 ? `(${fmt(nhom.hopLeTaxTong)})` : <span className="text-gray-300">—</span>}
        </td>
      </tr>
      {expanded && nhom.items?.map((item: any, i: number) => (
        <tr key={i} className="bg-gray-50/70 text-xs text-gray-500 border-b border-gray-100">
          <td className="px-5 py-1.5 pl-12">{item.category || '(chưa có danh mục)'}</td>
          <td className="px-5 py-1.5 text-right">({fmt(item.tong)})</td>
          <td className="px-5 py-1.5 text-right">{item.hopLeTax ? `(${fmt(item.tong)})` : <span className="text-gray-300">—</span>}</td>
        </tr>
      ))}
    </>
  );
}

function PLKhauHaoRow({ chiPhiKhauHao, detail, expanded, onToggle }: {
  chiPhiKhauHao: number; detail?: any[]; expanded: boolean; onToggle: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100">
        <td className="px-5 py-2.5 text-gray-700">
          <span className="text-gray-400 mr-2">{expanded ? '▾' : '▸'}</span>
          Chi phí khấu hao
        </td>
        <td className="px-5 py-2.5 text-right text-red-600">({fmt(chiPhiKhauHao)})</td>
        <td className="px-5 py-2.5 text-right text-red-600">({fmt(chiPhiKhauHao)})</td>
      </tr>
      {expanded && detail?.map((r: any, i: number) => (
        <tr key={i} className="bg-gray-50/70 text-xs text-gray-500 border-b border-gray-100">
          <td className="px-5 py-1.5 pl-12">{r.assetName} ({r.periodKey})</td>
          <td className="px-5 py-1.5 text-right">({fmt(r.amount)})</td>
          <td className="px-5 py-1.5 text-right">({fmt(r.amount)})</td>
        </tr>
      ))}
    </>
  );
}

// ── TaxRatePanel ─────────────────────────────────────────────────────────────

function TaxRatePanel({ onClose }: { onClose: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [newDate, setNewDate] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    profitApi.getTaxRates().then(setData).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!newDate || !newRate) { setErr('Vui lòng điền đủ thông tin'); return; }
    setSaving(true); setErr('');
    try {
      await profitApi.addTaxRate({ effectiveDate: newDate, rate: Number(newRate) / 100, notes: newNote || undefined });
      const d = await profitApi.getTaxRates();
      setData(d); setNewDate(''); setNewRate(''); setNewNote('');
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const STATUS_BADGE: Record<string, string> = {
    DANG_AP_DUNG: 'bg-green-100 text-green-700',
    SAP_AP_DUNG:  'bg-blue-100 text-blue-700',
    HET_HIEU_LUC: 'bg-gray-100 text-gray-500',
  };
  const STATUS_LABEL: Record<string, string> = {
    DANG_AP_DUNG: 'Đang áp dụng',
    SAP_AP_DUNG:  'Sắp áp dụng',
    HET_HIEU_LUC: 'Hết hiệu lực',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Lịch Sử Thuế Suất TNDN</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
      </div>
      <p className="text-xs text-gray-400">Append-only — không thể sửa hoặc xóa. Thêm mức mới khi có thay đổi pháp lý.</p>

      {data?.list?.map((r: any) => (
        <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
          <div>
            <span className="font-mono text-blue-600">{r.effectiveDate}</span>
            <span className="ml-3 font-semibold">{r.pct}</span>
            {r.notes && <span className="ml-2 text-gray-400 text-xs">{r.notes}</span>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.trangThai] ?? ''}`}>
            {STATUS_LABEL[r.trangThai] ?? r.trangThai}
          </span>
        </div>
      ))}

      <div className="pt-2 space-y-2">
        <p className="text-xs font-medium text-gray-600">Thêm mức thuế mới</p>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" value={newRate} onChange={e => setNewRate(e.target.value)}
            placeholder="%" min={1} max={100} step={0.5}
            className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)}
            placeholder="Ghi chú (tuỳ chọn)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={handleAdd} disabled={saving}
            className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: LN Theo SP ─────────────────────────────────────────────────────────

function TabSP() {
  const d = new Date();
  const firstDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const [tuNgay, setTuNgay]     = useState(firstDay);
  const [denNgay, setDenNgay]   = useState(TODAY);
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy]     = useState('bienLN_pct');
  const [sortOrd, setSortOrd]   = useState<'asc' | 'desc'>('desc');
  const [page, setPage]         = useState(1);
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async (p = 1) => {
    if (!tuNgay || !denNgay) return;
    setLoading(true); setError('');
    try {
      const res = await reportsApi.getProfitByProduct({
        tuNgay, denNgay, page: p, pageSize: 50,
        sortBy, sortOrder: sortOrd, category: category || undefined,
      });
      setData(res); setPage(p);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tuNgay, denNgay, sortBy, sortOrd, category]);

  useEffect(() => { load(); }, []);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrd(o => o === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortOrd('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortBy === col ? (sortOrd === 'desc' ? <span className="ml-1 text-blue-500">↓</span> : <span className="ml-1 text-blue-500">↑</span>) : null;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Từ ngày</label>
            <input type="date" value={tuNgay} max={TODAY} onChange={e => setTuNgay(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Đến ngày</label>
            <input type="date" value={denNgay} max={TODAY} onChange={e => setDenNgay(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nhóm SP</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Tất cả"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => load(1)} disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang tính...' : 'Tìm'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {data && (
        <>
          {data.warnings?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-sm">
              ⚠️ {data.warnings[0]}
            </div>
          )}

          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Tổng SKU', val: data.total, isCount: true, color: 'from-gray-500 to-gray-600' },
              { label: 'Tổng Doanh Thu', val: data.tongDoanhThu, color: 'from-blue-500 to-blue-600' },
              { label: 'Tổng COGS', val: data.tongCogs, color: 'from-orange-500 to-orange-600' },
              { label: 'Biên LN Gộp TB', val: null, pct: data.bienLNGopTB_pct, color: 'from-green-500 to-green-600' },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-4 text-white`}>
                <p className="text-xs opacity-80 mb-1">{c.label}</p>
                <p className="text-xl font-bold">
                  {c.pct != null ? `${c.pct}%` : c.isCount ? c.val : fmtShort(c.val ?? 0)}
                </p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2.5 text-center w-10">#</th>
                    <th className="px-4 py-2.5 text-left">Sản Phẩm</th>
                    <th className="px-4 py-2.5 text-center">Nhóm</th>
                    <th className="px-4 py-2.5 text-right cursor-pointer hover:text-blue-600" onClick={() => toggleSort('soLuong')}>
                      SL <SortIcon col="soLuong" />
                    </th>
                    <th className="px-4 py-2.5 text-right cursor-pointer hover:text-blue-600" onClick={() => toggleSort('doanhThu')}>
                      Doanh Thu <SortIcon col="doanhThu" />
                    </th>
                    <th className="px-4 py-2.5 text-right cursor-pointer hover:text-blue-600" onClick={() => toggleSort('cogs')}>
                      COGS <SortIcon col="cogs" />
                    </th>
                    <th className="px-4 py-2.5 text-right cursor-pointer hover:text-blue-600" onClick={() => toggleSort('lnGop')}>
                      LN Gộp <SortIcon col="lnGop" />
                    </th>
                    <th className="px-4 py-2.5 text-right cursor-pointer hover:text-blue-600" onClick={() => toggleSort('bienLN_pct')}>
                      Biên LN% <SortIcon col="bienLN_pct" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items?.map((r: any) => (
                    <tr key={r.rank} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{r.rank}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{r.productName}</p>
                        <p className="text-xs text-gray-400 font-mono">{r.productCode}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-500">{r.category || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{r.soLuong?.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtShort(r.doanhThu)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmtShort(r.cogs)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-green-700">{fmtShort(r.lnGop)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${pctColor(r.bienLN_pct)}`}>
                        {r.bienLN_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.total > 50 && (
              <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                <span>Tổng {data.total} sản phẩm · Trang {page}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => load(page - 1)}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50">‹</button>
                  <button disabled={page * 50 >= data.total} onClick={() => load(page + 1)}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50">›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 3: Thuế VAT ───────────────────────────────────────────────────────────

function TabVAT() {
  const [nam, setNam]       = useState(CUR_YEAR);
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [declareModal, setDeclareModal] = useState<number | null>(null);

  const load = useCallback(async (y = nam) => {
    setLoading(true); setError('');
    try {
      const res = await profitApi.getVatSummary(y);
      setData(res);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [nam]);

  useEffect(() => { load(); }, []);

  const changeYear = (delta: number) => {
    const y = nam + delta;
    setNam(y);
    load(y);
  };

  const rows = data?.yearRows ?? [];

  return (
    <div className="space-y-5">
      {/* Year selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">Năm</span>
        <div className="flex items-center gap-1">
          <button onClick={() => changeYear(-1)}
            className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm">‹</button>
          <span className="px-4 py-1 font-semibold text-gray-800">{nam}</span>
          <button onClick={() => changeYear(1)} disabled={nam >= CUR_YEAR}
            className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-sm disabled:opacity-40">›</button>
        </div>
        {loading && <span className="text-xs text-gray-400">Đang tải...</span>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Lũy kế cả năm */}
      {data?.luyCe && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Tổng VAT Ra', val: data.luyCe.tongVatRa, color: 'from-blue-500 to-blue-600' },
            { label: 'Tổng VAT Vào', val: data.luyCe.tongVatVao, color: 'from-purple-500 to-purple-600' },
            { label: 'Đã Khai Báo / Nộp', val: data.luyCe.tongNopBS, color: 'from-green-500 to-green-600' },
            { label: 'KCK Cuối Năm', val: data.luyCe.kckCuoi, color: 'from-amber-500 to-amber-600' },
          ].map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-4 text-white`}>
              <p className="text-xs opacity-80 mb-1">{c.label}</p>
              <p className="text-xl font-bold">{fmtShort(c.val ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bảng 4 quý */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2.5 text-left w-48">Chỉ Tiêu</th>
                  {rows.map((r: any) => {
                    const isCur = r.year === CUR_YEAR && r.quarter === CUR_QUY;
                    return (
                      <th key={r.quarter}
                        className={`px-4 py-2.5 text-right ${isCur ? 'bg-blue-50 text-blue-700' : ''}`}>
                        Q{r.quarter}/{r.year}
                        {isCur && <span className="ml-1 text-xs">(hiện tại)</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { key: 'vatRa',       label: 'VAT Đầu Ra', cls: '' },
                  { key: 'vatVao',      label: 'VAT Đầu Vào', cls: '' },
                  { key: 'kckKyTruoc', label: 'KCK Kỳ Trước', cls: 'text-gray-400 italic text-xs' },
                  { key: 'vatPS',       label: 'VAT Phát Sinh', cls: 'font-semibold', bold: true },
                  { key: 'nopBoSung',  label: 'Đã Khai Báo / Nộp', cls: 'text-green-700' },
                  { key: 'kckKyNay',   label: 'KCK Kỳ Này', cls: 'text-amber-600' },
                ].map(({ key, label, bold, cls }) => (
                  <tr key={key} className={bold ? 'bg-blue-50/40' : ''}>
                    <td className={`px-4 py-2.5 text-gray-700 ${cls}`}>{label}</td>
                    {rows.map((r: any) => {
                      const v: number = r[key] ?? 0;
                      const isCur = r.year === CUR_YEAR && r.quarter === CUR_QUY;
                      return (
                        <td key={r.quarter}
                          className={`px-4 py-2.5 text-right ${isCur ? 'bg-blue-50/30' : ''} ${bold ? 'font-semibold' : ''}`}>
                          {v === 0 ? <span className="text-gray-300">—</span> : (
                            <span className={v < 0 ? 'text-amber-600' : ''}>
                              {fmt(Math.abs(v))}{v < 0 ? ' ↩' : ''}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Action row */}
                <tr className="bg-gray-50/60">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">Thao tác</td>
                  {rows.map((r: any) => {
                    const isFuture = r.year > CUR_YEAR || (r.year === CUR_YEAR && r.quarter > CUR_QUY);
                    return (
                      <td key={r.quarter} className="px-4 py-2.5 text-center">
                        {!isFuture && (
                          <button onClick={() => setDeclareModal(r.quarter)}
                            className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-medium">
                            Ghi nhận
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            KCK = Khấu Trừ Kết Chuyển (VAT đầu vào &gt; đầu ra — được khấu trừ sang kỳ sau) · ↩ = đang kết chuyển
          </div>
        </div>
      )}

      {declareModal != null && (
        <DeclareModal
          quy={declareModal} nam={nam}
          onClose={() => setDeclareModal(null)}
          onSaved={() => { setDeclareModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ── DeclareModal ─────────────────────────────────────────────────────────────

function DeclareModal({ quy, nam, onClose, onSaved }: {
  quy: number; nam: number; onClose: () => void; onSaved: () => void;
}) {
  const [soTien, setSoTien]     = useState('');
  const [ngayNop, setNgayNop]   = useState(localDateStr());
  const [dienGiai, setDienGiai] = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSave = async () => {
    const amount = Number(soTien.replace(/,/g, ''));
    if (!soTien || isNaN(amount) || amount <= 0) { setErr('Số tiền không hợp lệ'); return; }
    setSaving(true); setErr('');
    try {
      await profitApi.saveVatDeclaration({
        ky: quy, nam, soTien: amount,
        ngayNop, dienGiai: dienGiai || undefined,
      });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const fmtInput = (val: string) =>
    val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 space-y-4 shadow-xl">
        <h3 className="font-semibold text-gray-800">Ghi Nhận Khai Báo GTGT — Q{quy}/{nam}</h3>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tiền đã nộp (VND)</label>
          <input type="text" value={soTien} onChange={e => setSoTien(fmtInput(e.target.value))}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ngày nộp</label>
          <input type="date" value={ngayNop} onChange={e => setNgayNop(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Diễn giải (tùy chọn)</label>
          <input type="text" value={dienGiai} onChange={e => setDienGiai(e.target.value)}
            placeholder={`Nộp thuế GTGT Q${quy}/${nam}`}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}
