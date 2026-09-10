'use client';

import { useState, useEffect } from 'react';
import { settingsApi } from '@/lib/settings';
import { telegramApi } from '@/lib/telegram';

interface TelegramSettings {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  telegramNotifyNewOrder: boolean;
  telegramNotifyCancelOrder: boolean;
  telegramNotifyLowStock: boolean;
  telegramNotifyDailyReport: boolean;
  telegramLowStockThreshold: number;
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${ok ? 'bg-green-600' : 'bg-red-600'}`}>
      {msg}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function TelegramSettingsPage() {
  const [form, setForm] = useState<TelegramSettings>({
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    telegramNotifyNewOrder: true,
    telegramNotifyCancelOrder: true,
    telegramNotifyLowStock: true,
    telegramNotifyDailyReport: true,
    telegramLowStockThreshold: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showToken, setShowToken] = useState(false);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    settingsApi.get().then((s) => {
      setForm({
        telegramEnabled: s.telegramEnabled ?? false,
        telegramBotToken: s.telegramBotToken ?? '',
        telegramChatId: s.telegramChatId ?? '',
        telegramNotifyNewOrder: s.telegramNotifyNewOrder ?? true,
        telegramNotifyCancelOrder: s.telegramNotifyCancelOrder ?? true,
        telegramNotifyLowStock: s.telegramNotifyLowStock ?? true,
        telegramNotifyDailyReport: s.telegramNotifyDailyReport ?? true,
        telegramLowStockThreshold: s.telegramLowStockThreshold ?? 5,
      });
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.update({
        telegramEnabled: form.telegramEnabled,
        telegramBotToken: form.telegramBotToken || null,
        telegramChatId: form.telegramChatId || null,
        telegramNotifyNewOrder: form.telegramNotifyNewOrder,
        telegramNotifyCancelOrder: form.telegramNotifyCancelOrder,
        telegramNotifyLowStock: form.telegramNotifyLowStock,
        telegramNotifyDailyReport: form.telegramNotifyDailyReport,
        telegramLowStockThreshold: form.telegramLowStockThreshold,
      });
      showToast('Đã lưu cài đặt Telegram');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi lưu', false);
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!form.telegramBotToken || !form.telegramChatId) {
      showToast('Nhập Bot Token và Chat ID trước khi test', false);
      return;
    }
    // Lưu trước rồi test
    setSaving(true);
    try {
      await settingsApi.update({
        telegramBotToken: form.telegramBotToken,
        telegramChatId: form.telegramChatId,
      });
    } catch { /* ignore */ }
    setSaving(false);

    setTesting(true);
    try {
      const res = await telegramApi.test();
      if (res.ok) {
        showToast('✅ Gửi thành công! Kiểm tra Telegram của bạn');
      } else {
        showToast(`❌ Thất bại: ${res.error}`, false);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi', false);
    }
    setTesting(false);
  }

  async function handleSendReport() {
    setSendingReport(true);
    try {
      await telegramApi.sendDailyReport();
      showToast('Đã gửi báo cáo hôm nay lên Telegram');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Lỗi', false);
    }
    setSendingReport(false);
  }

  function set<K extends keyof TelegramSettings>(key: K, val: TelegramSettings[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Đang tải...</div>;

  const canTest = !!form.telegramBotToken && !!form.telegramChatId;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Telegram Bot</h1>
          <p className="text-sm text-gray-500 mt-0.5">Nhận thông báo tự động về đơn hàng, tồn kho và báo cáo ngày</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{form.telegramEnabled ? 'Đang bật' : 'Đang tắt'}</span>
          <Toggle checked={form.telegramEnabled} onChange={v => set('telegramEnabled', v)} />
        </div>
      </div>

      {/* Hướng dẫn tạo bot */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-1.5">
        <p className="font-semibold">📱 Cách tạo Telegram Bot (lần đầu):</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Mở Telegram, tìm <code className="bg-blue-100 px-1 rounded">@BotFather</code></li>
          <li>Gõ <code className="bg-blue-100 px-1 rounded">/newbot</code> → đặt tên → lấy <b>Bot Token</b></li>
          <li>Mở chat với bot vừa tạo, gõ bất kỳ tin nhắn</li>
          <li>Truy cập: <code className="bg-blue-100 px-1 rounded">https://api.telegram.org/bot&#123;TOKEN&#125;/getUpdates</code></li>
          <li>Lấy <b>Chat ID</b> từ trường <code className="bg-blue-100 px-1 rounded">result[0].message.chat.id</code></li>
        </ol>
      </div>

      {/* Kết nối */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Kết nối Bot</h2>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Bot Token</label>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={form.telegramBotToken}
              onChange={e => set('telegramBotToken', e.target.value)}
              placeholder="123456789:AABBccDDeeFFggHH..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <button onClick={() => setShowToken(v => !v)}
              className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition border border-gray-200">
              {showToken ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Chat ID</label>
          <input
            type="text"
            value={form.telegramChatId}
            onChange={e => set('telegramChatId', e.target.value)}
            placeholder="-100123456789 hoặc 123456789"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1">Chat ID âm (bắt đầu bằng -100) là group/channel; số dương là tin nhắn riêng</p>
        </div>

        <button
          onClick={handleTest}
          disabled={testing || saving || !canTest}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition">
          {testing ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : '📨'}
          {testing ? 'Đang gửi...' : 'Gửi tin nhắn test'}
        </button>
      </div>

      {/* Loại thông báo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Loại thông báo</h2>

        {[
          { key: 'telegramNotifyNewOrder' as const, label: 'Đơn hàng mới', desc: 'Khi có đơn hàng bán được tạo', icon: '🛒' },
          { key: 'telegramNotifyCancelOrder' as const, label: 'Đơn hàng bị hủy', desc: 'Khi đơn hàng bị hủy', icon: '❌' },
          { key: 'telegramNotifyLowStock' as const, label: 'Tồn kho thấp', desc: `Khi sản phẩm vừa chạm ngưỡng cảnh báo`, icon: '⚠️' },
          { key: 'telegramNotifyDailyReport' as const, label: 'Báo cáo cuối ngày', desc: 'Gửi tự động lúc 21:00 mỗi ngày', icon: '📊' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <div>
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-400">{item.desc}</div>
              </div>
            </div>
            <Toggle
              checked={form[item.key]}
              onChange={v => set(item.key, v)}
              disabled={!form.telegramEnabled}
            />
          </div>
        ))}
      </div>

      {/* Cài đặt nâng cao */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Cài đặt nâng cao</h2>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Ngưỡng cảnh báo tồn kho thấp
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={999}
              value={form.telegramLowStockThreshold}
              onChange={e => set('telegramLowStockThreshold', Number(e.target.value))}
              className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <span className="text-sm text-gray-500">sản phẩm — thông báo khi tồn kho vừa xuống bằng hoặc dưới con số này</span>
          </div>
        </div>

        {/* Gửi báo cáo ngay */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <div className="text-sm font-medium text-gray-900">Gửi báo cáo hôm nay ngay</div>
            <div className="text-xs text-gray-400">Không chờ đến 21:00, gửi luôn</div>
          </div>
          <button
            onClick={handleSendReport}
            disabled={sendingReport || !form.telegramEnabled || !canTest}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-xl disabled:opacity-40 transition">
            {sendingReport ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : '📊'}
            {sendingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
          </button>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition">
          {saving ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : null}
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
