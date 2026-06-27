'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CongNoKhDetailRedirect() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/dashboard/cong-no/phai-thu/${partnerId}`); }, [router, partnerId]);
  return null;
}
