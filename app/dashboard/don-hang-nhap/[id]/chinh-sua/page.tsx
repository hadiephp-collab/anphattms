import CreatePurchaseOrderPage from '../../CreatePurchaseOrderPage';

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreatePurchaseOrderPage editId={parseInt(id, 10)} />;
}
