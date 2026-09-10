'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { partnersApi } from '@/lib/partners';
import { employeesApi } from '@/lib/employees';

const PROVINCES = [
  'An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Định',
  'Bình Dương','Bình Phước','Bình Thuận','Cà Mau','Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông',
  'Điện Biên','Đồng Nai','Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương',
  'Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng',
  'Lạng Sơn','Lào Cai','Long An','Nam Định','Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên',
  'Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh',
  'Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh',
  'Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];

interface Props {
  partner?: Record<string, unknown>;
  isEdit?: boolean;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  );
}

const labelCls = 'text-[10px] font-semibold text-gray-400 mb-0.5 block uppercase tracking-wide';
const inputCls = 'w-full border border-gray-200 rounded-md px-2 py-1 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const inputErrCls = 'w-full border border-red-300 rounded-md px-2.5 py-1.5 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white';
const selectCls = inputCls + ' cursor-pointer';

function filterPhone(v: string) { return v.replace(/[^0-9+\-\s]/g, ''); }
function filterDigits(v: string) { return v.replace(/\D/g, ''); }

function isValidPhone(v: string) {
  const digits = v.replace(/[\s\-+]/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^\d+$/.test(digits);
}
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export default function PartnerFormPage({ partner, isEdit = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeFromUrl = searchParams.get('type') || 'customer';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(typeFromUrl);
  const [customerType, setCustomerType] = useState('individual');
  const [rank, setRank] = useState('new');
  const [source, setSource] = useState('');
  const [group, setGroup] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [website, setWebsite] = useState('');
  const [zalo, setZalo] = useState('');
  const [facebook, setFacebook] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [contactPhone2, setContactPhone2] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [rating, setRating] = useState(0);
  const [currency, setCurrency] = useState('VND');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [nhomGia, setNhomGia] = useState('');
  const [priceListId, setPriceListId] = useState('');
  // Freight-specific
  const [phuongThucVanChuyen, setPhuongThucVanChuyen] = useState('');
  const [phuongThucTinhCuoc, setPhuongThucTinhCuoc] = useState('');
  const [dacDiem, setDacDiem] = useState('');
  const [diaChiKhoVN, setDiaChiKhoVN] = useState('');
  const [diaChiKhoTQ, setDiaChiKhoTQ] = useState('');

  useEffect(() => {
    employeesApi.getAll({ limit: '200' })
      .then((res: any) => {
        const list = res?.data ?? res;
        setEmployees(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (partner) {
      setCode((partner.code as string) || '');
      setName((partner.name as string) || '');
      setType((partner.type as string) || 'customer');
      setCustomerType((partner.customerType as string) || 'individual');
      setRank((partner.rank as string) || 'new');
      setSource((partner.source as string) || '');
      setGroup((partner.group as string) || '');
      setSupplierType((partner.supplierType as string) || '');
      setAssignedStaffId(partner.assignedStaffId ? String(partner.assignedStaffId) : '');
      setPhone((partner.phone as string) || '');
      setEmail((partner.email as string) || '');
      setContactPerson((partner.contactPerson as string) || '');
      setProvince((partner.province as string) || '');
      setAddress((partner.address as string) || '');
      setBirthday((partner.birthday as string) || '');
      setGender((partner.gender as string) || '');
      setTaxCode((partner.taxCode as string) || '');
      const social = (partner.socialLinks as Record<string, string>) || {};
      setWebsite((partner.website as string) || '');
      setZalo(social.zalo || '');
      setFacebook(social.facebook || '');
      setCreditLimit(partner.creditLimit ? String(partner.creditLimit) : '');
      setPaymentTerm(partner.paymentTerm ? String(partner.paymentTerm) : '');
      setBankAccount((partner.bankAccount as string) || '');
      setBankName((partner.bankName as string) || '');
      setBankAccountHolder((partner.bankAccountHolder as string) || '');
      setBankBranch((partner.bankBranch as string) || '');
      setContactPhone2((partner.contactPhone2 as string) || '');
      setTaxAddress((partner.taxAddress as string) || '');
      setDeliveryAddress((partner.deliveryAddress as string) || '');
      setRating((partner.rating as number) || 0);
      setCurrency((partner.currency as string) || 'VND');
      setNotes((partner.notes as string) || '');
      setIsActive(partner.isActive !== false);
      setNhomGia((partner.nhomGia as string) || '');
      setPriceListId(partner.priceListId ? String(partner.priceListId) : '');
      setPhuongThucVanChuyen((partner.phuongThucVanChuyen as string) || '');
      setPhuongThucTinhCuoc((partner.phuongThucTinhCuoc as string) || '');
      setDacDiem((partner.dacDiem as string) || '');
      setDiaChiKhoVN((partner.diaChiKhoVN as string) || '');
      setDiaChiKhoTQ((partner.diaChiKhoTQ as string) || '');
    }
  }, [partner]);

  const isFreight      = type === 'freight';
  const isSupplierLike = type === 'supplier' || type === 'both' || type === 'freight';
  const isCustomerLike = type === 'customer' || type === 'both';

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Vui lòng nhập tên đối tác';
    if (phone && !isValidPhone(phone)) errs.phone = 'Số điện thoại không hợp lệ (8–15 chữ số)';
    if (email && !isValidEmail(email)) errs.email = 'Địa chỉ email không đúng định dạng';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); setError('Vui lòng kiểm tra lại các trường bị lỗi'); return; }
    setFieldErrors({});
    setError('');
    setLoading(true);
    try {
      const socialLinks: Record<string, string> = {};
      if (zalo) socialLinks.zalo = zalo;
      if (facebook) socialLinks.facebook = facebook;

      const payload: Record<string, unknown> = {
        code: code.trim() || undefined,
        name: name.trim(),
        type,
        customerType,
        rank,
        source: source || undefined,
        group: group.trim() || undefined,
        supplierType: supplierType || undefined,
        assignedStaffId: assignedStaffId ? Number(assignedStaffId) : undefined,
        phone: phone || undefined,
        email: email || undefined,
        contactPerson: contactPerson || undefined,
        province: province || undefined,
        address: address || undefined,
        taxCode: taxCode || undefined,
        website: website || undefined,
        creditLimit: creditLimit ? Number(creditLimit) : undefined,
        paymentTerm: paymentTerm ? Number(paymentTerm) : undefined,
        bankAccount: bankAccount || undefined,
        bankName: bankName || undefined,
        bankAccountHolder: bankAccountHolder || undefined,
        bankBranch: bankBranch || undefined,
        contactPhone2: contactPhone2 || undefined,
        taxAddress: taxAddress || undefined,
        deliveryAddress: deliveryAddress || undefined,
        rating: rating > 0 ? rating : undefined,
        currency: currency || undefined,
        notes:       notes || undefined,
        nhomGia:     nhomGia || undefined,
        priceListId: priceListId ? Number(priceListId) : undefined,
        phuongThucVanChuyen: phuongThucVanChuyen || undefined,
        phuongThucTinhCuoc: phuongThucTinhCuoc || undefined,
        dacDiem: dacDiem || undefined,
        diaChiKhoVN: diaChiKhoVN || undefined,
        diaChiKhoTQ: diaChiKhoTQ || undefined,
      };

      if (isEdit) payload.isActive = isActive;

      if (customerType === 'individual') {
        payload.gender = gender || undefined;
        payload.birthday = birthday || undefined;
      }

      if (Object.keys(socialLinks).length > 0) {
        payload.socialLinks = socialLinks;
      }

      if (isEdit && partner) {
        await partnersApi.update(partner.id as number, payload);
      } else {
        await partnersApi.create(payload);
      }
      router.push('/dashboard/partners');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại danh sách
        </button>

        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-500 mr-2">{error}</span>}
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {isEdit ? 'Cập nhật' : 'Lưu đối tác'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-3 py-3">
        <form className="grid grid-cols-3 gap-3 items-start" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

          {/* LEFT col-span-2 */}
          <div className="col-span-2 space-y-2">

            {/* Thông tin cơ bản */}
            <Card title="Thông tin cơ bản">
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Tên đối tác <span className="text-red-400">*</span></label>
                    <input type="text" value={name} onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })); }}
                      placeholder="Nhập tên đối tác..." className={fieldErrors.name ? inputErrCls : inputCls} />
                    {fieldErrors.name && <p className="text-xs text-red-400 mt-0.5">{fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Mã đối tác</label>
                    {isEdit
                      ? <input type="text" value={code} disabled className={inputCls + ' bg-gray-50 text-gray-400 cursor-not-allowed font-mono'} />
                      : <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                          placeholder="Tự động (KH001...)" className={inputCls + ' font-mono'} />}
                  </div>
                </div>

                <div className={`grid gap-2 ${isFreight ? 'grid-cols-2' : 'grid-cols-4'}`}>
                  <div>
                    <label className={labelCls}>Loại đối tác</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                      <option value="customer">Khách hàng</option>
                      <option value="supplier">Nhà cung cấp</option>
                      <option value="both">KH + NCC</option>
                      <option value="freight">Đơn vị vận chuyển</option>
                    </select>
                  </div>
                  {!isFreight && (
                    <div>
                      <label className={labelCls}>Hình thức</label>
                      <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} className={selectCls}>
                        <option value="individual">Cá nhân</option>
                        <option value="business">Doanh nghiệp</option>
                      </select>
                    </div>
                  )}
                  {!isFreight && (
                    <div>
                      <label className={labelCls}>Hạng</label>
                      <select value={rank} onChange={(e) => setRank(e.target.value)} className={selectCls}>
                        <option value="new">Mới</option>
                        <option value="normal">Thường</option>
                        <option value="loyal">Thân thiết</option>
                        <option value="vip">VIP</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Nguồn</label>
                    <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
                      <option value="">-- Chọn --</option>
                      <option value="facebook">Facebook</option>
                      <option value="zalo">Zalo</option>
                      <option value="referral">Giới thiệu</option>
                      <option value="website">Website</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Nhóm giá</label>
                    <select value={nhomGia} onChange={(e) => setNhomGia(e.target.value)} className={selectCls}>
                      <option value="">-- Bán lẻ (mặc định) --</option>
                      <option value="Le">Lẻ</option>
                      <option value="NoiBo">Nội bộ</option>
                      <option value="TM1">Thương mại cấp 1</option>
                      <option value="TM2">Thương mại cấp 2</option>
                      <option value="TM3">Thương mại cấp 3</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Nhóm đối tác</label>
                    <input type="text" value={group} onChange={(e) => setGroup(e.target.value)}
                      placeholder="VD: Khách sỉ, Đại lý cấp 1..." className={inputCls} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Liên hệ */}
            <Card title="Liên hệ">
              <div className="space-y-1.5">
                {/* Hàng 1: SĐT | SĐT 2 | Email */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Điện thoại</label>
                    <input type="tel" value={phone}
                      onChange={(e) => { setPhone(filterPhone(e.target.value)); setFieldErrors((p) => ({ ...p, phone: '' })); }}
                      placeholder="0901 234 567" className={fieldErrors.phone ? inputErrCls : inputCls}
                      inputMode="tel" />
                    {fieldErrors.phone && <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Điện thoại 2</label>
                    <input type="tel" value={contactPhone2}
                      onChange={(e) => setContactPhone2(filterPhone(e.target.value))}
                      placeholder="Dự phòng" className={inputCls} inputMode="tel" />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })); }}
                      placeholder="example@email.com" className={fieldErrors.email ? inputErrCls : inputCls} />
                    {fieldErrors.email && <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>}
                  </div>
                </div>

                {/* Hàng 2: Người LH | Tỉnh/TP | MST hoặc Ngày sinh */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Người liên hệ</label>
                    <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Họ và tên" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Tỉnh / Thành phố</label>
                    <select value={province} onChange={(e) => setProvince(e.target.value)} className={selectCls}>
                      <option value="">-- Chọn tỉnh/TP --</option>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {customerType === 'business' ? (
                    <div>
                      <label className={labelCls}>Mã số thuế</label>
                      <input type="text" value={taxCode}
                        onChange={(e) => setTaxCode(filterDigits(e.target.value))}
                        placeholder="0123456789" className={inputCls}
                        inputMode="numeric" maxLength={13} />
                    </div>
                  ) : customerType === 'individual' ? (
                    <div>
                      <label className={labelCls}>Ngày sinh</label>
                      <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputCls} />
                    </div>
                  ) : <div />}
                </div>

                {/* Giới tính — chỉ khi cá nhân */}
                {customerType === 'individual' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>Giới tính</label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
                        <option value="">-- Chọn --</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Địa chỉ */}
                <div>
                  <label className={labelCls}>Địa chỉ</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện..." className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Địa chỉ giao hàng / kho</label>
                    <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Nếu khác địa chỉ trên" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Địa chỉ trên hóa đơn VAT</label>
                    <input type="text" value={taxAddress} onChange={(e) => setTaxAddress(e.target.value)} placeholder="Địa chỉ đăng ký kinh doanh" className={inputCls} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Thông tin vận chuyển — chỉ hiện cho freight */}
            {type === 'freight' && (
              <Card title="Thông tin vận chuyển">
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>Phương thức vận chuyển</label>
                      <select value={phuongThucVanChuyen} onChange={(e) => setPhuongThucVanChuyen(e.target.value)} className={selectCls}>
                        <option value="">-- Chọn --</option>
                        <option value="bien">Đường biển</option>
                        <option value="bo">Đường bộ</option>
                        <option value="ket_hop">Kết hợp</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Kho Việt Nam</label>
                      <input type="text" value={diaChiKhoVN} onChange={(e) => setDiaChiKhoVN(e.target.value)} placeholder="Địa chỉ kho tại VN..." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Kho Trung Quốc</label>
                      <input type="text" value={diaChiKhoTQ} onChange={(e) => setDiaChiKhoTQ(e.target.value)} placeholder="Địa chỉ kho tại TQ..." className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Phương thức tính cước</label>
                      <textarea value={phuongThucTinhCuoc} onChange={(e) => setPhuongThucTinhCuoc(e.target.value)} rows={2} placeholder="VD: Tính theo CBM, tối thiểu 1m³..." className={inputCls + ' resize-none'} />
                    </div>
                    <div>
                      <label className={labelCls}>Đặc điểm</label>
                      <textarea value={dacDiem} onChange={(e) => setDacDiem(e.target.value)} rows={2} placeholder="Ưu điểm, nhược điểm, lưu ý..." className={inputCls + ' resize-none'} />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Mạng xã hội */}
            <Card title="Mạng xã hội">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Website</label>
                  <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Zalo</label>
                  <input type="text" value={zalo} onChange={(e) => setZalo(e.target.value)} placeholder="Số Zalo hoặc link" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Facebook</label>
                  <input type="text" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." className={inputCls} />
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT col-span-1 */}
          <div className="col-span-1 space-y-2">

            {/* Nhân viên phụ trách */}
            <Card title="Nhân viên phụ trách">
              <select value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)} className={selectCls}>
                <option value="">-- Không phân công --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </Card>

            {/* Trạng thái — chỉ hiện khi sửa */}
            {isEdit && (
              <Card title="Trạng thái">
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition ${
                    isActive
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <span className={`text-sm font-semibold ${isActive ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {isActive ? 'Đang hoạt động' : 'Đã ngừng hoạt động'}
                    </span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <p className="text-[11px] text-gray-400 mt-2">
                  {isActive ? 'Đối tác hiển thị trong hệ thống' : 'Đối tác bị ẩn, không thể chọn trong đơn hàng'}
                </p>
              </Card>
            )}

            {/* Tài chính */}
            <Card title="Tài chính">
              <div className="space-y-1.5">
                {/* Hạn mức + Thời hạn TT */}
                <div className={`grid gap-3 ${isCustomerLike ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {isCustomerLike && (
                    <div>
                      <label className={labelCls}>Hạn mức công nợ (đ)</label>
                      <input type="number" min="0" value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        placeholder="0" className={inputCls} />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Thời hạn TT (ngày)</label>
                    <input type="number" min="0" value={paymentTerm}
                      onChange={(e) => setPaymentTerm(e.target.value)}
                      placeholder="0" className={inputCls} />
                  </div>
                </div>

                {/* Tiền tệ + Đánh giá — ẩn với ĐVVC */}
                {!isFreight && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Tiền tệ</label>
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls}>
                        <option value="VND">VND — Đồng</option>
                        <option value="CNY">CNY — Nhân dân tệ</option>
                        <option value="USD">USD — Đô la Mỹ</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Đánh giá</label>
                      <div className="flex items-center gap-0.5 mt-1.5">
                        {[1,2,3,4,5].map((s) => (
                          <button key={s} type="button" onClick={() => setRating(rating === s ? 0 : s)}
                            className={`text-xl leading-none transition-transform hover:scale-110 ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`}>
                            ★
                          </button>
                        ))}
                        {rating > 0 && (
                          <button type="button" onClick={() => setRating(0)} className="text-[10px] text-gray-300 hover:text-gray-400 ml-1">xóa</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STK + Ngân hàng */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Số tài khoản NH</label>
                    <input type="text" value={bankAccount}
                      onChange={(e) => setBankAccount(filterDigits(e.target.value))}
                      placeholder="VD: 0123456789" className={inputCls}
                      inputMode="numeric" />
                  </div>
                  <div>
                    <label className={labelCls}>Ngân hàng</label>
                    <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="VD: MB Bank" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Tên chủ tài khoản</label>
                    <input type="text" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="Tên in hoa đúng như trên TK" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Chi nhánh NH</label>
                    <input type="text" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="VD: CN Hai Bà Trưng" className={inputCls} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Ghi chú */}
            <Card title="Ghi chú">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ghi chú thêm về đối tác..."
                className={inputCls + ' resize-none'}
              />
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
