'use client';
import { useParams } from 'next/navigation';
import TxFormPage from '@/components/TxFormPage';

export default function ChinhSuaPhieuThu() {
  const params = useParams();
  return <TxFormPage type="receipt" txId={Number(params.id)} />;
}
