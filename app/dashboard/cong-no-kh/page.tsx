'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CongNoKhRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/cong-no/phai-thu'); }, [router]);
  return null;
}
