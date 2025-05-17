import type { Metadata } from 'next';
import { GeistSans } from 'geist/sans'; // Corrected import path
import { GeistMono } from 'geist/mono'; // Corrected import path
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const geistSans = GeistSans; // Directly use the imported object
const geistMono = GeistMono; // Directly use the imported object

export const metadata: Metadata = {
  title: 'ThesisFlow 360',
  description: 'Streamline your thesis writing process.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
