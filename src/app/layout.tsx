import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI DJ Studio',
  description: 'Professional browser DJ with AI — Next.js + Elementary Audio + Groq',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
