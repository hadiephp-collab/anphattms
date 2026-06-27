'use client';
import { Suspense } from 'react';
import PartnerFormPage from '../PartnerFormPage';

export default function NewPartnerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <PartnerFormPage />
    </Suspense>
  );
}
