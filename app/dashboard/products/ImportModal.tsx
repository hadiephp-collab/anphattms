'use client';

import { useRef, useState } from 'react';
import { productsApi } from '@/lib/products';

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
  total: number;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const TEMPLATE_COLS = ['Tên sản phẩm*', 'Mã SP', 'Danh mục', 'Thương hiệu', 'ĐVT', 'Giá vốn', 'Giá bán', 'Giá sỉ', 'Vị trí kho', 'Barcode', 'Mô tả', 'Tags (phân cách ;)', 'Trạng thái'];
const TEMPLATE_KEY  = ['name', 'code', 'category', 'brand', 'unit', 'costPrice', 'sellingPrice', 'wholesalePrice', 'warehouseLocation', 'barcode', 'description', 'tags', 'status'];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
  return lines.slice(1).map((line) => {
    const vals = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function downloadTemplate() {
  const bom = '﻿';
  const header = TEMPLATE_COLS.join(',');
  const sample = ['Que hàn 3.2mm', 'QH-001', 'Que hàn', 'Lincoln', 'Kg', '85000', '120000', '100000', 'Kệ A1', '', 'Que hàn điện thông dụng', 'Hàn;Điện', 'Đang bán'];
  const csv = bom + header + '\n' + sample.join(',');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'mau_nhap_san_pham.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function ImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState('');

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { setParseError('Chỉ chấp nhận file CSV'); return; }
    setFileName(file.name);
    setParseError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const parsed = parseCsv(text);
      if (!parsed.length) { setParseError('File CSV không có dữ liệu hoặc định dạng sai'); return; }
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function mapRow(raw: Record<string, string>) {
    const out: Record<string, string> = {};
    TEMPLATE_COLS.forEach((col, i) => { out[TEMPLATE_KEY[i]] = raw[col] ?? ''; });
    return out;
  }

  async function handleImport() {
    setImporting(true);
    try {
      const mapped = rows.map(mapRow).filter((r) => r.name?.trim());
      const res = await productsApi.import(mapped);
      setResult(res);
      setStep('result');
      onImported();
    } catch (e: unknown) {
      setParseError((e as { message?: string })?.message || 'Lỗi nhập file');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[680px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Nhập sản phẩm từ file CSV</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'upload' && 'Tải file CSV theo đúng mẫu để nhập hàng loạt'}
              {step === 'preview' && `Xem trước ${rows.length} dòng dữ liệu từ "${fileName}"`}
              {step === 'result' && 'Kết quả nhập file'}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 px-6 py-2.5 border-b border-gray-50 bg-gray-50/50 flex-shrink-0">
          {[['upload', '1', 'Tải file'], ['preview', '2', 'Xem trước'], ['result', '3', 'Kết quả']].map(([s, n, label], idx) => (
            <div key={s} className="flex items-center">
              {idx > 0 && <div className={`w-8 h-px mx-1 ${['preview', 'result'].includes(step) && idx <= (step === 'result' ? 2 : 1) ? 'bg-blue-400' : 'bg-gray-200'}`} />}
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${step === s ? 'bg-blue-600 text-white' : (step === 'result' && s !== 'result') || (step === 'preview' && s === 'upload') ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{n}</div>
                <span className={`text-xs font-medium ${step === s ? 'text-blue-700' : 'text-gray-400'}`}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'}`}>
                <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-500 font-medium">Kéo thả file CSV vào đây</p>
                <p className="text-xs text-gray-300 mt-1">hoặc click để chọn file</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
              {parseError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{parseError}</div>}

              {/* Template download */}
              <div className="flex items-center justify-between p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Tải file mẫu</p>
                  <p className="text-xs text-blue-500 mt-0.5">File CSV với đầy đủ cột và 1 dòng mẫu</p>
                </div>
                <button onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải mẫu
                </button>
              </div>

              {/* Rules */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lưu ý</p>
                {[
                  'Cột "Tên sản phẩm" là bắt buộc, các cột còn lại tùy chọn',
                  'Nếu có Mã SP trùng với sản phẩm đã tồn tại → sẽ cập nhật, không tạo mới',
                  'Cột Tags: phân cách bằng dấu chấm phẩy (;)',
                  'Trạng thái: để trống hoặc "Đang bán" = đang bán; "Ngừng bán" = ngừng bán',
                  'Lưu file định dạng UTF-8 để hiển thị đúng tiếng Việt',
                ].map((r, i) => (
                  <div key={i} className="flex gap-2 text-xs text-gray-400">
                    <span className="text-blue-300 mt-0.5 flex-shrink-0">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Hiển thị tối đa 20 dòng đầu</span>
                <button onClick={() => { setStep('upload'); setRows([]); }} className="text-blue-500 hover:underline">Chọn file khác</button>
              </div>
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-500 border-b border-gray-200 whitespace-nowrap">#</th>
                      {TEMPLATE_COLS.slice(0, 7).map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-bold text-gray-500 border-b border-gray-200 whitespace-nowrap">{col}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-bold text-gray-500 border-b border-gray-200">...</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-2 text-gray-300 font-mono">{i + 2}</td>
                        {TEMPLATE_COLS.slice(0, 7).map((col) => (
                          <td key={col} className={`px-3 py-2 whitespace-nowrap max-w-[120px] truncate ${!row[col] ? 'text-gray-200' : 'text-gray-700'}`}>
                            {row[col] || '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-gray-200">...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 20 && (
                <p className="text-xs text-gray-400 text-center">+ {rows.length - 20} dòng nữa không hiển thị</p>
              )}
              {parseError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{parseError}</div>}
            </div>
          )}

          {/* STEP 3: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                  <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                  <p className="text-xs text-emerald-500 mt-1 font-medium">Tạo mới</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-blue-500 mt-1 font-medium">Cập nhật</p>
                </div>
                <div className={`p-4 rounded-xl text-center border ${result.errors.length ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-2xl font-bold ${result.errors.length ? 'text-red-500' : 'text-gray-300'}`}>{result.errors.length}</p>
                  <p className={`text-xs mt-1 font-medium ${result.errors.length ? 'text-red-400' : 'text-gray-300'}`}>Lỗi</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Chi tiết lỗi</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex gap-2 text-xs p-2 bg-red-50 border border-red-100 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-red-600">{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-400 text-center">
                Tổng cộng {result.total} dòng được xử lý
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            {step === 'result' ? 'Đóng' : 'Hủy'}
          </button>
          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <button onClick={() => { setStep('upload'); setRows([]); }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
                  Quay lại
                </button>
                <button onClick={handleImport} disabled={importing}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-60">
                  {importing && <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>}
                  {importing ? 'Đang nhập...' : `Nhập ${rows.length} sản phẩm`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
