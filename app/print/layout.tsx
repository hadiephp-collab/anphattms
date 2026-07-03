import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'In ấn — An Phát TMS' };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
