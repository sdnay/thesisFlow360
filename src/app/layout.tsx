
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';

// Les importations de GeistSans et GeistMono ont été commentées
// pour le débogage des erreurs de chargement de police.
// Vous pouvez les réactiver si le problème de police est résolu.
// import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono';

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
    <html lang="fr" suppressHydrationWarning={true}>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
