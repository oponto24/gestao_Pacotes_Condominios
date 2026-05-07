# Runbook — Portaria PWA (story 3.1)

> **Stories:** 3.1 (layout shell) — habilita 3.2 (PhotoCapture), 3.3 (BarcodeScanner), 3.6 (CapturaPage)
> **Owner:** Dev (Dex) | **Última atualização:** 2026-05-07

## Visão geral

PWA mobile-first instalável usado pelo porteiro na portaria. Tudo above-the-fold em 375px (iPhone SE). Layout shell sem features de captura — entram em 3.2+.

## Estrutura

```
┌─ Header fixo (60px)
│   Condomínio · Nome porteiro · Avatar · Sair
├──────────────────────────────────────────
│
│   <main scrollable> — 3 stubs por enquanto:
│     /chegada          → "Em breve: foto + bipe"
│     /portaria/pendentes → "Sem pendências"
│     /retirada         → "Em breve: scan QR"
│
├──────────────────────────────────────────
└─ Bottom nav fixa (56px)
    [Pacote] Chegada · [Alert] Pendentes · [QR] Retirada
```

## Acesso e roles

| Role | `/chegada` | `/portaria/pendentes` | `/retirada` |
|---|---|---|---|
| Anônimo | redirect `/sign-in` | redirect `/sign-in` | redirect `/sign-in` |
| `porteiro` | ✅ | ✅ | ✅ |
| `admin` | ✅ (decisão @po: substituição) | ✅ | ✅ |
| `super_admin` | redirect `/super-admin/condominios` | redirect | redirect |

Guard centralizado: `src/lib/api/portaria-guard.ts` (`requirePorteiro()`).

## Como instalar o PWA

### Android (Chrome)

1. Abra `https://app.exemplo.com/chegada` no Chrome
2. Tap no menu (⋮) → "Add to Home screen"
3. Confirma → ícone aparece na home, abre em modo standalone (sem URL bar)

### iOS (Safari)

⚠️ iOS NÃO oferece banner automático — instalação é manual:

1. Abra a URL no **Safari** (não funciona no Chrome iOS)
2. Tap no botão Share (□↑) → "Add to Home Screen"
3. Confirma → ícone aparece na home

## Manifest

Arquivo: `src/app/manifest.ts` (Next.js 14+ Metadata API).
Build gera automaticamente `public/manifest.webmanifest`.

| Campo | Valor |
|---|---|
| `name` | "Gestão de Pacotes — Condomínios" |
| `short_name` | "Pacotes" |
| `start_url` | `/chegada?source=pwa` |
| `display` | `standalone` (sem URL bar) |
| `theme_color` | `#0a0a0a` |
| `background_color` | `#ffffff` |
| `orientation` | `portrait` |

## Ícones

Localização: `public/icons/`

| Arquivo | Tamanho | Uso |
|---|---|---|
| `icon-192.png` | 192x192 | Android home screen |
| `icon-512.png` | 512x512 | Android splash + maskable |
| `icon-512-maskable.png` | 512x512 | Android adaptive (maskable purpose) |
| `apple-touch-icon.png` | 180x180 | iOS home screen |

⚠️ **Os ícones atuais são placeholders** (PNG simples gerado via script Python). Antes do piloto produção:

1. Designer cria arte definitiva em Figma (logo "P" branco em fundo escuro recomendado para legibilidade)
2. Exportar PNG nos 4 tamanhos
3. Substituir arquivos em `public/icons/`
4. Para `icon-512-maskable.png`: respeitar safe area de 80% (logo no centro, fundo extends até bordas)

Ferramenta útil para validar maskable: https://maskable.app/

## Roadmap features por story

| Story | O que adiciona |
|---|---|
| **3.1** ✅ | Layout shell + bottom nav + manifest |
| **3.2** ✅ | `<PhotoCapture>` componente — câmera + preview + retake |
| **3.3** ✅ | `<BarcodeScannerInput>` componente — html5-qrcode + fallback (esta story) |
| 3.4 | API POST /api/pacotes (rascunho + foto + IA job) |
| 3.5 | Worker `extractLabel` — Claude Haiku vision |
| 3.6 | `/chegada` real — formulário de captura |
| 3.7 | Algoritmo matching IA ↔ unidade/morador |
| 3.8 | `/chegada/confirmar` — IAExtractionForm |
| 3.9 | `/chegada/organizar` — tamanho + setor + posição |
| 3.10 | `/portaria/pendentes` real — pacotes não identificados |
| 5.1 | `/retirada` real — scanner QR |

## PhotoCapture (story 3.2)

Componente reusável de captura de foto da etiqueta do pacote.

### API

```tsx
<PhotoCapture
  onCapture={(blob, dataUrl) => {/* upload + setState */}}
  onError={(msg) => /* opcional */}
  preferredFacingMode="environment"  // default
  disabled={false}
  debugDownload={process.env.NODE_ENV !== 'production'}
/>
```

### State machine

```
  idle ──▶ requesting ──▶ streaming ──▶ captured
   ▲           │              │            │
   └───────────┼──────────────┘            │
               ▼                            │
             error  ◀──────────────────── retake
               │                            │
               └──── reset ─▶ idle          │
                                            ▼
                                       onCapture(blob, dataUrl)
```

### Limites técnicos

| Restrição | Detalhe |
|---|---|
| Bound de resolução | 1280px no maior lado (mantém aspect ratio) |
| Format/quality | JPEG quality 0.85 (~150-300KB típico) |
| HTTPS obrigatório em produção | `getUserMedia` só em `https://` ou localhost |
| iOS Safari `<video>` | `playsinline` + `muted` obrigatórios |
| Vibration | `navigator.vibrate?.(50)` — ignorado se browser não suporta (iOS) |
| Browsers suportados | Chrome 90+ Android, Safari 14+ iOS, Edge/Firefox modernos |

### Cleanup de MediaStream (anti-leak)

⚠️ **Crítico:** câmera deixada ligada acende LED do dispositivo + privacy concern.

Cleanup garantido em:
1. **Unmount** do componente (`useEffect` return global)
2. **Transição para `captured`/`error`/`idle`** (não streaming/requesting)
3. **getUserMedia** retorna mas componente já desmontou (flag `cancelled`)

Tests cobrem cada path (`tests/unit/photo-capture.test.tsx`).

### Privacy disclosure

Durante streaming, indicador visual no canto superior direito do visor:
- Dot vermelho pulsante
- Texto "Câmera ligada"
- `aria-live="polite"` para screen readers

### Como testar com webcam de desktop

`facingMode='environment'` falha em desktop (sem câmera traseira) →
fallback automático para qualquer câmera disponível. Mesmo fluxo
funciona em ambos.

## BarcodeScannerInput (story 3.3)

Componente reusável de captura de código de barras (1D) ou QR Code.

### API

```tsx
<BarcodeScannerInput
  value={codigo}
  onChange={setCodigo}
  onError={(msg) => /* opcional */}
  placeholder="Código do pacote (opcional)"
  disabled={false}
  maxLength={100}
/>
```

### Comportamento

- **Input texto sempre editável** — fallback para digitação manual se câmera falhar
- **Botão "Bipar"** abre modal fullscreen com scanner html5-qrcode
- **Detecção fecha modal automaticamente** + preenche input + vibração 50ms
- **Permissão negada NÃO bloqueia** — usuário pode fechar modal e digitar

### Formatos suportados

QR_CODE · CODE_128 · CODE_39 · EAN_13 · EAN_8 · UPC_A.
Cobertura típica: Correios (CODE_128) + e-commerce BR (EAN/UPC) + QR.

### State machine

```
  closed ──▶ requesting ──▶ scanning ──▶ closed (após detecção)
   ▲             │              │
   │             └──┬───────────┘
   │                ▼
   └───────────── error ──── retry ──▶ requesting
                    │
                    └─ "Fechar e digitar manualmente" ──▶ closed
```

### Cleanup html5-qrcode (anti-leak)

⚠️ **Crítico:** scanner deixado ativo prende câmera + acende LED + privacy concern.

Cleanup em **2 passos**: `instance.stop()` (para o stream) + `instance.clear()` (limpa o DOM do div).

Idempotente — pode ser chamado múltiplas vezes (close manual, detecção, unmount, error).

### Decisões técnicas

| Decisão | Motivo |
|---|---|
| `html5-qrcode` (não BarcodeDetector API) | iOS Safari ainda limitado em 2025; html5-qrcode é polyfill confiável |
| Dynamic import (`await import('html5-qrcode')`) | Lib ~50KB só carrega quando user clica "Bipar" — bundle inicial fica leve |
| Modal fullscreen via `<Sheet>` | Reuso da story 2.4 + viewport grande melhora detecção |
| `useId()` no div do scanner | Evita conflito "instância já anexada" se modal abre/fecha rápido (sugestão @po) |
| Flag `alreadyDetected.current` | Previne onChange múltiplas vezes do mesmo código (sugestão @po) |
| `maxLength=100` no input texto | Defesa contra paste acidental de strings gigantes (sugestão @po) |

### Como testar com QR Code

1. Acesse `https://www.qr-code-generator.com/` ou similar
2. Gere QR com texto "TESTE-3.3"
3. No `/admin/.../chegada` (ou playground), click "Bipar"
4. Aponte câmera pro QR na tela
5. Detecção deve ocorrer em ~1s e fechar modal

## Tech debt registrado

- **Ícones placeholder** → trocar por arte definitiva antes do piloto
- **`apple-mobile-web-app-status-bar-style`** já configurado via `appleWebApp.statusBarStyle = 'default'`
- **Service worker offline** → fora do MVP (NFR-053)
- **Notificações push web** → fora do MVP (notificação é via WhatsApp)

## Permissões mobile (futuras)

- **Câmera:** será solicitada na primeira visita a `/chegada` (story 3.2). Se negada, mostrar tela "Sem acesso à câmera. Vá em Configurações > Site > Permissões".
- **Notificações push:** NÃO no MVP.

## Próximas stories

- **3.2/3.3** — PhotoCapture + BarcodeScanner (depende desta)
- **5.1** — Scanner QR de retirada
- **3.10** — Lista de pendentes real
