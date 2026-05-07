import type { Metadata, Viewport } from 'next';
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestão de Pacotes',
  description: 'Sistema de gestão de pacotes em condomínios',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pacotes',
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
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <ClerkProvider>
          <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <span className="text-base font-semibold">Gestão de Pacotes</span>
            <div className="flex items-center gap-2">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="h-btn-sm rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-primary-light">
                    Entrar
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="h-btn-sm rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark">
                    Criar conta
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          <main>{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
