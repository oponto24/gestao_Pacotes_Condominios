import type { MetadataRoute } from 'next';

/**
 * PWA manifest (story 3.1).
 *
 * Habilita "Add to Home Screen" no celular. Standalone mode esconde a
 * URL bar do navegador. Ícones placeholder em /public/icons/ — produção
 * deve substituir por arte definitiva (ver docs/runbooks/portaria-pwa.md).
 *
 * `start_url=/chegada?source=pwa` permite analytics futuro diferenciar
 * uso PWA vs navegador comum (sugestão @po, Epic 8).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gestão de Pacotes — Condomínios',
    short_name: 'Pacotes',
    description: 'Sistema de gestão de pacotes para portaria de condomínios',
    start_url: '/chegada?source=pwa',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
