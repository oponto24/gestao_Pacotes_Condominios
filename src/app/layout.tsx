import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';
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
  // Apple HIG / WCAG (achado UX U5): pinch-zoom disponível pra acessibilidade.
  // Sem userScalable=false. maximumScale alto pra suportar baixa visão sem
  // permitir zoom-in acidental que destruísse layout.
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#FDC800',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body className="font-sans antialiased">
        <ClerkProvider>
          {/* Sem chrome global — cada área (admin, portaria, super-admin, administracao)
              renderiza seu próprio header. Evita header duplicado em mobile (achado U1)
              e centraliza o ponto de logout por área (achado U2). */}
          <ImpersonateBanner />
          <main>{children}</main>
          <Toaster position="top-right" richColors closeButton />
        </ClerkProvider>
      </body>
    </html>
  );
}
