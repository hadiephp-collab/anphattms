'use client';

import { useEffect, useRef } from 'react';

interface Props {
  onCredential: (credential: string) => void;
  onError?: (msg: string) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

/**
 * Nút "Đăng nhập bằng Google" (Google Identity Services).
 * Fetch GET /auth/cau-hinh-dang-nhap để lấy Client ID — nếu backend chưa cấu hình thì không render.
 * VUA_DANG_XUAT flag: người dùng vừa đăng xuất → tắt One Tap, không tự đăng nhập lại.
 */
export default function NutDangNhapGoogle({ onCredential, onError }: Props) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Lấy Client ID từ backend
      let clientId: string | null = null;
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/cau-hinh-dang-nhap`);
        const d = await r.json();
        clientId = d?.googleClientId || null;
      } catch { /**/ }
      if (!clientId || cancelled) return;

      // Tải thư viện GIS nếu chưa có
      if (!window.google?.accounts) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.async = true;
          s.defer = true;
          s.onload = () => res();
          s.onerror = () => rej(new Error('Không tải được thư viện Google'));
          document.head.appendChild(s);
        }).catch(e => onError?.(e.message));
      }
      if (!window.google?.accounts || cancelled) return;

      const vuaDangXuat = (() => { try { return !!localStorage.getItem('VUA_DANG_XUAT'); } catch { return false; } })();

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (r: { credential?: string; error?: string }) => {
          if (r.credential) onCredential(r.credential);
          else onError?.('Đăng nhập Google bị huỷ hoặc lỗi');
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text: 'signin_with',
          size: 'large',
          locale: 'vi',
          width: 360,
        });
      }

      if (!vuaDangXuat) window.google.accounts.id.prompt();
    }

    init().catch(e => onError?.(e.message));
    return () => { cancelled = true; window.google?.accounts?.id?.cancel?.(); };
  }, [onCredential, onError]);

  return <div ref={btnRef} className="flex justify-center" />;
}
