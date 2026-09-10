'use client';
import { useState, useEffect, useCallback } from 'react';
import { backupApi, BackupConfig, BackupLog, CheckEnvResult } from '@/lib/backup';

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };
  return { toast, show };
}

const fmtBytes = (b: number) => b === 0 ? '—' : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const fmtMs = (ms: number) => ms === 0 ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">Chưa chạy</span>;
  if (status === 'ok') return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Thành công</span>;
  if (status === 'error') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">❌ Lỗi</span>;
  if (status === 'running') return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium animate-pulse">⏳ Đang chạy...</span>;
  return <span className="text-xs text-gray-400">{status}</span>;
}

export default function BackupPage() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [envInfo, setEnvInfo] = useState<CheckEnvResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [showEnv, setShowEnv] = useState(false);
  const { toast, show } = useToast();

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState('daily');
  const [retentionDays, setRetentionDays] = useState(30);
  const [storagePath, setStoragePath] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, logsResult] = await Promise.all([
        backupApi.getConfig(),
        backupApi.getLogs(page),
      ]);
      setConfig(cfg);
      setEnabled(cfg.enabled);
      setSchedule(cfg.schedule ?? 'daily');
      setRetentionDays(cfg.retentionDays ?? 30);
      setStoragePath(cfg.storagePath ?? '');
      setLogs(logsResult.data);
      setTotal(logsResult.total);
    } catch (e: any) { show(e.message, false); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll khi đang running
  useEffect(() => {
    if (config?.lastStatus !== 'running') return;
    const t = setInterval(async () => {
      try {
        const cfg = await backupApi.getConfig();
        setConfig(cfg);
        if (cfg.lastStatus !== 'running') {
          clearInterval(t);
          loadAll();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [config?.lastStatus]);

  async function handleSave() {
    setSaving(true);
    try {
      const cfg = await backupApi.updateConfig({ enabled, schedule, retentionDays, storagePath });
      setConfig(cfg);
      show('Đã lưu cấu hình');
    } catch (e: any) { show(e.message, false); }
    finally { setSaving(false); }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await backupApi.run();
      show('Backup đang chạy, vui lòng chờ...');
      setConfig((c) => c ? { ...c, lastStatus: 'running' } : c);
    } catch (e: any) { show(e.message, false); }
    finally { setRunning(false); }
  }

  async function handleDownload(log: BackupLog) {
    setDownloading(log.id);
    try {
      await backupApi.downloadFile(log.id, log.filename);
    } catch (e: any) { show(e.message, false); }
    finally { setDownloading(null); }
  }

  async function handleDelete(log: BackupLog) {
    if (!confirm(`Xóa backup ${log.filename}?`)) return;
    try {
      await backupApi.deleteLog(log.id);
      show('Đã xóa');
      loadAll();
    } catch (e: any) { show(e.message, false); }
  }

  async function handleCheckEnv() {
    setShowEnv(true);
    try {
      const info = await backupApi.checkEnv();
      setEnvInfo(info);
    } catch (e: any) { show(e.message, false); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-3">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-white text-sm shadow-lg ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sao lưu và khôi phục dữ liệu hệ thống · Chỉ dành cho Admin</p>
        </div>
        <button
          onClick={handleCheckEnv}
          className="text-xs text-gray-500 border rounded-lg px-3 py-1.5 hover:bg-gray-50"
        >
          🔍 Kiểm tra môi trường
        </button>
      </div>

      {/* Banner Supabase */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-blue-500 text-lg mt-0.5">ℹ️</span>
        <div className="text-sm text-blue-700">
          <span className="font-semibold">Supabase tự động backup hàng ngày, giữ 7 ngày gần nhất.</span>{' '}
          Xem và restore tại Supabase Dashboard → Project → Backups.
          Module này dùng để backup theo lịch tùy chỉnh và lưu lâu hơn 7 ngày.
        </div>
      </div>

      {/* Trạng thái + nút chạy */}
      <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Backup tự động:</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {config?.enabled ? 'Đang hoạt động' : 'Đã tắt'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Lần cuối:</span>
            <span>{config?.lastRun ?? '—'}</span>
            <StatusBadge status={config?.lastStatus ?? null} />
          </div>
          {config?.lastMessage && (
            <p className={`text-xs ${config.lastStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
              {config.lastMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={running || config?.lastStatus === 'running'}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap"
        >
          {config?.lastStatus === 'running' ? (
            <><span className="animate-spin">⏳</span> Đang chạy...</>
          ) : (
            <><span>🔄</span> Chạy Backup Ngay</>
          )}
        </button>
      </div>

      {/* Cấu hình */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Cấu Hình Backup Tự Động</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Bật backup tự động</p>
              <p className="text-xs text-gray-400">Tự động chạy theo lịch định kỳ</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lịch chạy</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="daily">Hàng ngày (02:00 sáng VN)</option>
              <option value="weekly">Hàng tuần (Thứ 2, 02:00 sáng VN)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Giữ backup (ngày)</label>
            <input
              type="number" min={1} max={365} value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Thư mục lưu backup</label>
            <input
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              placeholder="Để trống = dùng đường dẫn mặc định"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">Mặc định: thư mục <code>backups/</code> trong project (dev) hoặc <code>/tmp/backups</code> (server)</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {/* Lịch sử backup */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Lịch Sử Backup ({total})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left">Thời gian</th>
              <th className="px-4 py-2.5 text-center w-24">Loại</th>
              <th className="px-4 py-2.5 text-right w-24">Kích thước</th>
              <th className="px-4 py-2.5 text-right w-20">Thời gian</th>
              <th className="px-4 py-2.5 text-center w-28">Trạng thái</th>
              <th className="px-4 py-2.5 text-right w-28">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Chưa có backup nào</td></tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-gray-600">{fmtDate(log.createdAt)}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{log.filename}</div>
                  {log.status === 'error' && log.errorMessage && (
                    <div className="text-xs text-red-500 mt-0.5 truncate max-w-[220px]" title={log.errorMessage}>
                      {log.errorMessage}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.triggerType === 'auto' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {log.triggerType === 'auto' ? 'Tự động' : 'Thủ công'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{fmtBytes(log.sizeBytes)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmtMs(log.durationMs)}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={log.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {log.status === 'ok' && log.filepath && (
                    <button
                      onClick={() => handleDownload(log)}
                      disabled={downloading === log.id}
                      className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded disabled:opacity-50"
                    >
                      {downloading === log.id ? '...' : '↓ Tải'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(log)}
                    className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded ml-1"
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-gray-500">
            <span>Trang {page}/{totalPages} · {total} bản ghi</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">‹</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40">›</button>
            </div>
          </div>
        )}
      </div>

      {/* Hướng dẫn Restore */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-orange-800 mb-2">⚠️ Restore Dữ Liệu — Thực Hiện Qua CLI</h2>
        <p className="text-xs text-orange-700 mb-3">
          Thao tác này <strong>XÓA toàn bộ dữ liệu hiện tại</strong> và thay thế bằng file backup.
          Không thể hoàn tác. Hãy chắc chắn bạn biết mình đang làm gì.
        </p>
        <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-green-400 space-y-1">
          <div className="text-gray-400"># Bước 1: Tải file backup (nút "↓ Tải" ở bảng trên)</div>
          <div className="text-gray-400"># Bước 2: Chạy lệnh restore (cần pg_restore và kết nối Supabase)</div>
          <div>pg_restore -h {'<DB_HOST>'} -p 5432 -U postgres \</div>
          <div className="pl-4">-d anphat_tms --clean --if-exists \</div>
          <div className="pl-4">anphat_backup_YYYYMMDD_HHmm.dump</div>
          <div className="text-gray-400 mt-2"># Hoặc với Supabase connection string:</div>
          <div>pg_restore -d {"\"$DATABASE_URL\""} --clean --if-exists backup.dump</div>
        </div>
        <p className="text-xs text-orange-600 mt-2">
          💡 Backup thủ công trước khi restore: nhấn "Chạy Backup Ngay" ở trên.
        </p>
      </div>

      {/* Check env modal */}
      {showEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Kiểm Tra Môi Trường</h3>
            {!envInfo ? (
              <p className="text-sm text-gray-400">Đang kiểm tra...</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {[
                    { label: 'pg_dump path', value: envInfo.pgDumpPath },
                    { label: 'pg_dump version', value: envInfo.pgDumpVersion },
                    { label: 'Storage path', value: envInfo.storagePath },
                    { label: 'Thư mục tồn tại', value: envInfo.storagePathExists ? '✅ Có' : '❌ Chưa có (sẽ tự tạo khi backup)' },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="py-2 text-gray-500 w-36">{row.label}</td>
                      <td className="py-2 font-mono text-xs text-gray-700 break-all">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowEnv(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
