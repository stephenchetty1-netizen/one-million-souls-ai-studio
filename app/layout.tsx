import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'One Million Souls AI Studio v59',
  description: 'Christian Content AI Discernment Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
