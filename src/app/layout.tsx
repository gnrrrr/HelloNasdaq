import type { Metadata } from 'next';
import { Roboto_Mono, Roboto } from 'next/font/google';
import './globals.css';

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  display: 'swap',
});

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HELLONASDAQ — Portfolio Terminal',
  description: 'Personal portfolio tracker with Bloomberg Terminal-style interface. Track your stock positions, returns, and performance vs NASDAQ-100.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${robotoMono.variable} ${roboto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
