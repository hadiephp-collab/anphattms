'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { settingsApi, StoreSetting } from '@/lib/settings';

const CUR_SYM: Record<string, string> = { CNY: '¥', USD: '$', VND: '₫' };

function fmtNum(n: number, dec = 2) {
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function SupplierPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<StoreSetting | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      purchaseOrdersApi.getSupplierExport(Number(id)),
      settingsApi.get().catch(() => null),
    ]).then(([d, s]) => {
      setData(d);
      setSettings(s);
      setTimeout(() => window.print(), 600);
    }).catch(e => setErr(e?.message ?? '加载失败'));
  }, [id]);

  if (err) return <div className="p-8 text-red-600 text-center">{err}</div>;
  if (!data) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
      正在加载 / Đang tải...
    </div>
  );

  const { po, items, summary } = data;
  const sym = CUR_SYM[po.currency] ?? po.currency;
  const storeName = settings?.storeName || 'AN PHÁT';
  const storePhone = settings?.storePhone || '';
  const discountPct = summary.totalForeign > 0
    ? ((summary.discountAmount / summary.totalForeign) * 100).toFixed(2)
    : '0.00';

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm 10mm; }
        @media print { .no-print { display: none !important; } }
        body { font-family: 'SimSun', 'Times New Roman', serif; font-size: 11pt; color: #1a1a2e; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d1d5db; padding: 5px 7px; }
        th { background: #1e3a5f; color: #fff; font-weight: 600; }
        tr:nth-child(even) td { background: #f8fafc; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between z-50">
        <span className="text-sm text-gray-600 font-medium">Đơn đặt hàng NCC · {po.code}</span>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          🖨️ In / Lưu PDF
        </button>
      </div>
      <div className="no-print h-14" />

      {/* ── Page content ── */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 4px' }}>

        {/* Header */}
        <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 6, padding: '14px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>采购订单</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>PURCHASE ORDER / ĐƠN ĐẶT HÀNG</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{storeName}</div>
              {storePhone && <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{storePhone}</div>}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* Left: buyer + supplier */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', fontSize: 10.5 }}>
            <div style={{ fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 5, marginBottom: 8, color: '#1e3a5f' }}>
              买卖双方 / Thông tin
            </div>
            <table style={{ border: 'none', fontSize: 10 }}>
              <tbody>
                {[
                  ['购买单位 (Bên mua)', storeName],
                  ['供应商 (NCC)', po.supplier?.name ?? '—'],
                  ['联系人 (Liên hệ)', po.supplier?.contactPerson ?? '—'],
                  ['电话 (SĐT)', po.supplier?.phone ?? '—'],
                ].map(([label, val]) => (
                  <tr key={label} style={{ border: 'none' }}>
                    <td style={{ border: 'none', color: '#64748b', paddingRight: 8, paddingTop: 2, paddingBottom: 2, whiteSpace: 'nowrap' }}>{label}</td>
                    <td style={{ border: 'none', fontWeight: 600, paddingTop: 2, paddingBottom: 2 }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: order meta */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', fontSize: 10.5 }}>
            <div style={{ fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: 5, marginBottom: 8, color: '#1e3a5f' }}>
              订单信息 / Thông tin đơn
            </div>
            <table style={{ border: 'none', fontSize: 10 }}>
              <tbody>
                {[
                  ['订单编号 (Mã đơn)', po.code],
                  ['下单日期 (Ngày đặt)', fmtDate(po.date)],
                  ['预计交货 (Dự kiến nhận)', fmtDate(po.expectedDeliveryDate)],
                  ['结算货币 (Tiền tệ)', `${po.currency} (1 ${po.currency} = ${fmtNum(po.exchangeRate, 0)} VND)`],
                ].map(([label, val]) => (
                  <tr key={label} style={{ border: 'none' }}>
                    <td style={{ border: 'none', color: '#64748b', paddingRight: 8, paddingTop: 2, paddingBottom: 2, whiteSpace: 'nowrap' }}>{label}</td>
                    <td style={{ border: 'none', fontWeight: 600, paddingTop: 2, paddingBottom: 2 }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, fontSize: 10.5 }}>
          {[
            { label: '订单总额', sub: 'Tổng tiền', val: `${sym}${fmtNum(summary.totalForeign)}`, color: '#1e40af', bg: '#eff6ff' },
            { label: '折扣', sub: 'Chiết khấu', val: `${discountPct}% (${sym}${fmtNum(summary.discountAmount)})`, color: '#b45309', bg: '#fffbeb' },
            { label: '实付金额', sub: 'Thực trả', val: `${sym}${fmtNum(summary.netForeign)}`, color: '#065f46', bg: '#ecfdf5' },
            { label: '总重量', sub: 'Tổng trọng lượng', val: summary.totalWeight > 0 ? `${fmtNum(summary.totalWeight, 0)}g` : '—', color: '#6b21a8', bg: '#faf5ff' },
          ].map(c => (
            <div key={c.label} style={{ flex: 1, background: c.bg, border: `1px solid ${c.color}22`, borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#64748b' }}>{c.label} / {c.sub}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginTop: 2 }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Items table */}
        <table style={{ fontSize: 9.5, marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={{ width: 28, textAlign: 'center' }}>序号<br /><span style={{ fontWeight: 400, fontSize: 8 }}>STT</span></th>
              <th style={{ width: 52 }}>商品编号<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Mã NCC</span></th>
              <th>商品名称 / 产品描述<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Tên sản phẩm</span></th>
              <th style={{ width: 36, textAlign: 'center' }}>单位<br /><span style={{ fontWeight: 400, fontSize: 8 }}>ĐVT</span></th>
              <th style={{ width: 52 }}>越南编号<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Mã VN</span></th>
              <th style={{ width: 44, textAlign: 'right' }}>数量<br /><span style={{ fontWeight: 400, fontSize: 8 }}>SL</span></th>
              <th style={{ width: 52, textAlign: 'right' }}>单价({sym})<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Đơn giá</span></th>
              <th style={{ width: 60, textAlign: 'right' }}>金额({sym})<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Thành tiền</span></th>
              <th style={{ width: 46, textAlign: 'right' }}>重量(g)<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Khối lượng</span></th>
              <th style={{ width: 60 }}>图片链接<br /><span style={{ fontWeight: 400, fontSize: 8 }}>Ảnh SP</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.no}>
                <td style={{ textAlign: 'center', color: '#6b7280' }}>{item.no}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 9 }}>{item.supplierCode || '—'}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.nameChinese || item.productName}</div>
                  {item.nameChinese && <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 1 }}>{item.productName}</div>}
                  {item.notes && <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>※ {item.notes}</div>}
                </td>
                <td style={{ textAlign: 'center' }}>{item.unit}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 9, color: '#2563eb' }}>{item.productCode}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNum(item.quantity, item.quantity % 1 === 0 ? 0 : 2)}</td>
                <td style={{ textAlign: 'right' }}>{fmtNum(item.priceForeign)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#1e3a5f' }}>{fmtNum(item.totalForeign)}</td>
                <td style={{ textAlign: 'right', color: '#6b7280' }}>
                  {item.weight != null ? fmtNum(item.weight * item.quantity, 0) : '—'}
                </td>
                <td style={{ fontSize: 8 }}>
                  {item.imageUrl
                    ? <a href={item.imageUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>
                        🔗 Xem ảnh
                      </a>
                    : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
              </tr>
            ))}

            {/* Discount row */}
            {summary.discountAmount > 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'right', fontStyle: 'italic', color: '#92400e', background: '#fffbeb' }}>
                  折扣 {discountPct}% / Chiết khấu
                </td>
                <td style={{ textAlign: 'right', color: '#92400e', fontWeight: 700, background: '#fffbeb' }}>
                  -{fmtNum(summary.discountAmount)}
                </td>
                <td colSpan={2} style={{ background: '#fffbeb' }} />
              </tr>
            )}

            {/* Total row */}
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <td colSpan={5} style={{ fontWeight: 700 }}>
                合计 / TỔNG CỘNG ({summary.itemCount} mặt hàng · {fmtNum(summary.totalQty, 0)} sp)
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(summary.totalQty, 0)}</td>
              <td />
              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{sym}{fmtNum(summary.netForeign)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                {summary.totalWeight > 0 ? fmtNum(summary.totalWeight, 0) : '—'}
              </td>
              <td />
            </tr>
          </tbody>
        </table>

        {/* Notes + Terms */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', fontSize: 9.5 }}>
            <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}>备注 / Ghi chú</div>
            <div style={{ color: '#374151', minHeight: 32 }}>{po.notes || po.reference || '—'}</div>
          </div>
          <div style={{ border: '1px solid #fbbf24', borderRadius: 6, padding: '10px 14px', fontSize: 9, background: '#fffbeb' }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 6 }}>重要说明 / Lưu ý quan trọng</div>
            <div style={{ color: '#78350f', lineHeight: 1.6 }}>
              为了长期合作，如产品质量和品牌与之前不同，请在发货前通知，以避免因退货造成的额外费用和麻烦。
              <div style={{ color: '#6b7280', marginTop: 4 }}>
                Để hợp tác lâu dài, nếu chất lượng sản phẩm hoặc thương hiệu khác với trước, vui lòng thông báo trước khi giao hàng.
              </div>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 9.5 }}>
          {[
            { cn: '供应商确认', vn: 'Xác nhận NCC', name: po.supplier?.name },
            { cn: '采购方确认', vn: 'Xác nhận bên mua', name: storeName },
          ].map(s => (
            <div key={s.cn} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: '#1e3a5f' }}>{s.cn}</div>
              <div style={{ fontSize: 8.5, color: '#64748b', marginBottom: 32 }}>{s.vn}</div>
              <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 6, color: '#374151' }}>{s.name}</div>
              <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>签名/Chữ ký &nbsp;&nbsp;&nbsp; 日期/Ngày: ___________</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 8.5, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
          {po.code} · 打印时间 {new Date().toLocaleString('zh-CN')} · {storeName}
        </div>
      </div>
    </>
  );
}
