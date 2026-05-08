import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import { ClerkProvider, SignInButton, Show, UserButton } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import { ImpersonateBanner } from '@/components/super-admin/ImpersonateBanner';
import './globals.css';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ponto 24 — Pacotes',
  description: 'Pacotes na portaria, sem mistério.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ponto 24',
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
          <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
            <Logo size="sm" />
            <div className="flex items-center gap-2">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="h-btn-sm rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-primary-light">
                    Entrar
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          <ImpersonateBanner />
          <main>{children}</main>
          <Toaster position="top-right" richColors closeButton />
        </ClerkProvider>
      </body>
    </html>
  );
}
