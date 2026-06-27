'use client';
import { useParams } from 'next/navigation';
import TxFormPage from '@/components/TxFormPage';

export default function ChinhSuaPhieuChi() {
  const params = useParams();
  return <TxFormPage type="payment" txId={Number(params.id)} />;
}
