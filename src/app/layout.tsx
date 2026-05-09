import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import { ClerkProvider, Show, UserButton } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import { ImpersonateBanner } from '@/components/super-admin/ImpersonateBanner';
import './globals.css';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PONTO24 Pacotes',
  description: 'Pacotes na portaria, sem mistério. Um produto PONTO24.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PONTO24 Pacotes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FDC800',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body className="font-sans antialiased">
        <ClerkProvider>
          {/* Header global só pra signed-in. Signed-out vê a LandingPage com header próprio. */}
          <Show when="signed-in">
            <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
              <Logo size="sm" />
              <div className="flex items-center gap-2">
                <UserButton />
              </div>
            </header>
          </Show>
          <ImpersonateBanner />
          <main>{children}</main>
          <Toaster position="top-right" richColors closeButton />
        </ClerkProvider>
      </body>
    </html>
  );
}
