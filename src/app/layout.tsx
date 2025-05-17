
import type { Metadata } from 'next';
// import { GeistSans } from 'geist/font/sans'; // Corrected import path
// import { GeistMono } from 'geist/font/mono'; // Corrected import path
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';

// const geistSans = GeistSans;
// const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'ThesisFlow360',
  description: 'Optimisez votre processus de rédaction de thèse.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
    <html lang="fr">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
