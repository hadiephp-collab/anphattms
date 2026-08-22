'use client';

import { useState, useRef } from 'react';
import { productsApi } from '@/lib/products';
import { partnersApi } from '@/lib/partners';
import { localDateStr } from '@/lib/utils';

type Tab = 'import' | 'export';
type ImportType = 'products' | 'partners';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: string[];
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${ok ? 'bg-green-600' : 'bg-red-600'}`}>
      {msg}
    </div>
  );
}

const PRODUCT_COLUMNS = [
  { key: 'name', label: 'Tên SP *', required: true },
  { key: 'code', label: 'Mã SP' },
  { key: 'category', label: 'Danh mục' },
  { key: 'brand', label: 'Thương hiệu' },
  { key: 'unit', label: 'Đơn vị tính' },
  { key: 'costPrice', label: 'Giá vốn' },
  { key: 'sellingPrice', label: 'Giá bán lẻ' },
  { key: 'wholesalePrice', label: 'Giá sỉ' },
  { key: 'warehouseLocation', label: 'Vị trí kho' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'description', label: 'Mô tả' },
  { key: 'tags', label: 'Tags (phân cách bằng dấu phẩy)' },
  { key: 'status', label: 'Trạng thái (active/inactive)' },
];

const PARTNER_COLUMNS = [
  { key: 'name', label: 'Tên đối tác *', required: true },
  { key: 'code', label: 'Mã đối tác' },
  { key: 'type', label: 'Loại (customer/supplier/freight/both)' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'province', label: 'Tỉnh/Thành phố' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'group', label: 'Nhóm' },
  { key: 'notes', label: 'Ghi chú' },
];

export default function NhapXuatDuLieuPage() {
  const [tab, setTab] = useState<Tab>('import');
  const [importType, setImportType] = useState<ImportType>('products');
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function resetImport() {
    setPreviewRows([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
    setPreviewRows(raw.slice(0, 5));
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      const cols = importType === 'products' ? PRODUCT_COLUMNS : PARTNER_COLUMNS;
      const mapped = rows.map(row => {
        const obj: Record<string, string> = {};
        cols.forEach(col => {
          const val = (row[col.label] ?? row[col.key] ?? '').toString().trim();
          if (val) obj[col.key] = val;
        });
        return obj;
      }).filter(r => Object.keys(r).length > 0);

      let res: ImportResult;
      if (importType === 'products') {
        res = await productsApi.import(mapped);
      } else {
        res = await partnersApi.import(mapped);
      }
      setResult(res);
      showToast(`Nhập xong: ${res.created} tạo mới, ${res.updated} cập nhật${res.errors.length ? `, ${res.errors.length} lỗi` : ''}`);
      resetImport();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi nhập liệu', false);
    }
    setImporting(false);
  }

  function downloadTemplate() {
    import('xlsx').then(XLSX => {
      const cols = importType === 'products' ? PRODUCT_COLUMNS : PARTNER_COLUMNS;
      const header = cols.map(c => c.label);
      const ws = XLSX.utils.aoa_to_sheet([header]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, `template_${importType === 'products' ? 'san-pham' : 'doi-tac'}.xlsx`);
    });
  }

  async function exportData(type: string) {
    setExporting(type);
    try {
      const XLSX = await import('xlsx');
      let wb = XLSX.utils.book_new();

      if (type === 'products') {
        const data = await productsApi.getAll({ limit: '10000' });
        const rows = (data.data || data).map((p: Record<string, unknown>) => ({
          'Mã SP': p.code,
          'Tên SP': p.name,
          'Danh mục': p.category,
          'Thương hiệu': p.brand,
          'Đơn vị tính': p.unit,
          'Giá vốn': p.costPrice,
          'Giá bán lẻ': p.sellingPrice,
          'Giá sỉ': p.wholesalePrice,
          'Tồn kho': p.stockQuantity,
          'Vị trí kho': p.warehouseLocation,
          'Barcode': p.barcode,
          'Mô tả': p.description,
          'Trạng thái': p.isActive ? 'active' : 'inactive',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Sản Phẩm');
        XLSX.writeFile(wb, `export_san-pham_${localDateStr()}.xlsx`);

      } else if (type === 'partners') {
        const data = await partnersApi.getAll({ limit: '10000' });
        const rows = (data.data || data).map((p: Record<string, unknown>) => ({
          'Mã': p.code,
          'Tên': p.name,
          'Loại': p.type,
          'Điện thoại': p.phone,
          'Email': p.email,
          'Địa chỉ': p.address,
          'Tỉnh/TP': p.province,
          'MST': p.taxCode,
          'Nhóm': p.group,
          'Ghi chú': p.notes,
          'Công nợ': p.totalDebt,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Đối Tác');
        XLSX.writeFile(wb, `export_doi-tac_${localDateStr()}.xlsx`);

      } else if (type === 'orders') {
        const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/orders?limit=10000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('anphat_token')}` },
        }).then(r => r.json());
        const rows = (data.data || data).map((o: Record<string, unknown>) => ({
          'Mã đơn': o.code,
          'Ngày': o.date,
          'Khách hàng': o.customerName,
          'Nhân viên': o.staffName,
          'Tổng tiền': o.totalAmount,
          'Đã trả': o.paidAmount,
          'Còn nợ': o.debtAmount,
          'Trạng thái': o.status,
          'Trạng thái TT': o.paymentStatus,
          'Ghi chú': o.notes,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Đơn Hàng');
        XLSX.writeFile(wb, `export_don-hang_${localDateStr()}.xlsx`);

      } else if (type === 'transactions') {
        const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/transactions?limit=10000`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('anphat_token')}` },
        }).then(r => r.json());
        const rows = (data.data || data).map((t: Record<string, unknown>) => ({
          'Mã phiếu': t.code,
          'Loại': t.type === 'receipt' ? 'Thu' : 'Chi',
          'Ngày': t.date,
          'Số tiền': t.amount,
          'Loại phiếu': t.typeName,
          'Đối tác': t.partnerName,
          'Tài khoản NH': t.bankAccountName,
          'Ghi chú': t.notes,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Thu Chi');
        XLSX.writeFile(wb, `export_thu-chi_${localDateStr()}.xlsx`);
      }

      showToast('Xuất file thành công');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi xuất file', false);
    }
    setExporting(null);
  }

  const columns = importType === 'products' ? PRODUCT_COLUMNS : PARTNER_COLUMNS;
  const previewCols = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Nhập / Xuất Dữ Liệu</h1>
        <p className="text-sm text-gray-500 mt-0.5">Import dữ liệu từ Excel hoặc export ra file để sao lưu / di chuyển</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([['import', 'Nhập dữ liệu'], ['export', 'Xuất dữ liệu']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); resetImport(); }}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'import' ? '⬆️ ' : '⬇️ '}{label}
          </button>
        ))}
      </div>

      {/* IMPORT TAB */}
      {tab === 'import' && (
        <div className="space-y-5">
          {/* Type selector */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Chọn loại dữ liệu</h2>
            <div className="flex gap-3">
              {([['products', 'Sản Phẩm', '📦'], ['partners', 'Đối Tác / Khách Hàng', '🤝']] as [ImportType, string, string][]).map(([t, label, icon]) => (
                <button key={t} onClick={() => { setImportType(t); resetImport(); }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition ${importType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Template download + file upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Bước 1 — Tải file mẫu</h2>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              Tải file mẫu Excel ({importType === 'products' ? 'Sản Phẩm' : 'Đối Tác'})
            </button>

            {/* Columns info */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Các cột trong file mẫu:</p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map(col => (
                  <span key={col.key} className={`px-2 py-0.5 text-xs rounded-full font-medium ${col.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {col.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-red-500 mt-2">* Cột bắt buộc màu đỏ. Nếu có cột Mã, sẽ cập nhật bản ghi đã tồn tại thay vì tạo mới.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Bước 2 — Chọn file Excel</h2>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Xem trước (5 dòng đầu)</h2>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {previewCols.map(col => (
                        <th key={col} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {previewCols.map(col => (
                          <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition">
                {importing ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : null}
                {importing ? 'Đang nhập...' : `Nhập ${importType === 'products' ? 'sản phẩm' : 'đối tác'}`}
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-2xl border p-5 ${result.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Kết quả nhập</h2>
              <div className="flex gap-6 mb-3">
                <div><span className="text-2xl font-bold text-gray-900">{result.total}</span><div className="text-xs text-gray-500">Tổng dòng</div></div>
                <div><span className="text-2xl font-bold text-green-600">{result.created}</span><div className="text-xs text-gray-500">Tạo mới</div></div>
                <div><span className="text-2xl font-bold text-blue-600">{result.updated}</span><div className="text-xs text-gray-500">Cập nhật</div></div>
                <div><span className="text-2xl font-bold text-red-600">{result.errors.length}</span><div className="text-xs text-gray-500">Lỗi</div></div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-white rounded-xl p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-red-600 mb-2">Chi tiết lỗi:</p>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-700 font-mono">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXPORT TAB */}
      {tab === 'export' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              key: 'products',
              title: 'Sản Phẩm',
              icon: '📦',
              desc: 'Xuất danh sách toàn bộ sản phẩm với giá vốn, giá bán, tồn kho',
              color: 'from-blue-500 to-blue-600',
            },
            {
              key: 'partners',
              title: 'Đối Tác / Khách Hàng',
              icon: '🤝',
              desc: 'Xuất danh sách đối tác, khách hàng, nhà cung cấp kèm thông tin liên hệ',
              color: 'from-purple-500 to-purple-600',
            },
            {
              key: 'orders',
              title: 'Đơn Hàng Bán',
              icon: '🛒',
              desc: 'Xuất lịch sử đơn hàng bán (tối đa 10.000 dòng)',
              color: 'from-green-500 to-green-600',
            },
            {
              key: 'transactions',
              title: 'Thu Chi',
              icon: '💰',
              desc: 'Xuất danh sách phiếu thu và phiếu chi (tối đa 10.000 dòng)',
              color: 'from-orange-500 to-orange-600',
            },
          ].map(card => (
            <div key={card.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-xl`}>
                {card.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{card.desc}</p>
              </div>
              <button
                onClick={() => exportData(card.key)}
                disabled={exporting === card.key}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-xl disabled:opacity-50 transition mt-auto">
                {exporting === card.key ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                )}
                {exporting === card.key ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
