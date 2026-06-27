'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductForm from '../../ProductForm';
import { productsApi } from '@/lib/products';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState(null);

  useEffect(() => {
    productsApi.getOne(Number(id)).then(setData).catch(console.error);
  }, [id]);

  if (!data) return (
    <div className="flex items-center justify-center h-full text-gray-300 text-sm">Đang tải...</div>
  );

  return <ProductForm mode="edit" initialData={data} />;
}
