'use client';
import { useParams } from 'next/navigation';
import OrderPOSForm from '../../OrderPOSForm';

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  return <OrderPOSForm mode="edit" orderId={parseInt(id)} />;
}
