'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { partnersApi } from '@/lib/partners';
import PartnerFormPage from '../../PartnerFormPage';

function EditContent() {
  const { id } = useParams();
  const [partner, setPartner] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partnersApi.getOne(Number(id)).then(setPartner).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!partner) return (
    <div className="flex items-center justify-center h-full text-gray-400">Không tìm thấy đối tác</div>
  );
  return <PartnerFormPage partner={partner} isEdit />;
}

export default function EditPartnerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <EditContent />
    </Suspense>
  );
}
