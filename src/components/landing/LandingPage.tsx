import Link from 'next/link';
import {
  ScanLine,
  Sparkles,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Building2,
  Smartphone,
  Lock,
  Server,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Reveal } from './Reveal';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_LP_WHATSAPP ?? '5511914980582';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Olá! Quero saber mais sobre o Ponto 24 para o meu condomínio.',
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

export function LandingPage() {
  return (
    <div className="bg-background text-brand-ink">
      <Header />
      <main>
        <Hero />
        <ProvaSocial />
        <ComoFunciona />
        <Diferenciais />
        <Problema />
        <FAQ />
        <CtaFinal />
      </main>
      <Footer />
    </div>
  );
}

// ============================================================================
// HEADER — sticky, com link de entrar e WhatsApp
// ============================================================================

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo size="sm" />
        <nav className="hidden items-center gap-8 text-sm font-medium text-brand-mid md:flex">
          <a href="#como-funciona" className="transition-colors hover:text-brand-ink">
            Como funciona
          </a>
          <a href="#diferenciais" className="transition-colors hover:text-brand-ink">
            Diferenciais
          </a>
          <a href="#faq" className="transition-colors hover:text-brand-ink">
            Perguntas
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-brand-mid transition-colors hover:text-brand-ink"
          >
            Entrar
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// HERO — headline + sub + CTAs + mockup CSS-only
// ============================================================================

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient + glow background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-light/40 via-background to-background" />
      <div
        aria-hidden
        className="absolute left-1/2 top-32 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-12 sm:pb-24 sm:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span
            className="animate-hero-rise inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-dark"
            style={{ animationDelay: '0ms' }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            IA + WhatsApp + QR auditável
          </span>

          <h1
            className="animate-hero-rise mt-8 text-5xl font-bold leading-[1.05] tracking-tighter text-brand-ink sm:text-6xl md:text-7xl"
            style={{ animationDelay: '100ms' }}
          >
            Zero pacote perdido.
            <br />
            <span className="bg-gradient-to-br from-brand-ink to-brand-mid bg-clip-text text-transparent">
              Zero reclamação no grupo.
            </span>
          </h1>

          <p
            className="animate-hero-rise mt-6 max-w-2xl text-lg leading-relaxed text-brand-mid sm:text-xl"
            style={{ animationDelay: '200ms' }}
          >
            Notificação automática, retirada auditada, IA que identifica o morador pela
            etiqueta. A portaria inteligente que síndicos profissionais escolheram para
            acabar com pacote sumido.
          </p>

          <div
            className="animate-hero-rise mt-10 flex flex-col items-center gap-4 sm:flex-row"
            style={{ animationDelay: '300ms' }}
          >
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/30"
            >
              Falar no WhatsApp
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#como-funciona"
              className="inline-flex h-14 items-center justify-center rounded-full border border-border bg-background px-8 text-base font-semibold text-brand-ink transition-all hover:-translate-y-0.5 hover:bg-surface"
            >
              Ver como funciona
            </a>
          </div>

          <p
            className="animate-hero-rise mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-brand-mid"
            style={{ animationDelay: '400ms' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Sem instalação
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Funciona no celular
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Setup em 15 min
            </span>
          </p>
        </div>

        {/* Mockup CSS-only — composição com phone (porteiro) + card admin */}
        <Reveal className="mx-auto mt-20 max-w-5xl">
          <div className="relative">
            <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-primary/10 via-accent/5 to-transparent blur-2xl" />
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <PhoneMockup className="animate-mockup-float lg:col-span-5 lg:rotate-[-4deg]" />
              <DashboardMockup className="lg:col-span-7" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// Mockup mobile — tela do porteiro
function PhoneMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative mx-auto max-w-[280px] ${className}`}>
      <div className="rounded-[2.5rem] bg-brand-ink p-2.5 shadow-2xl shadow-brand-ink/30">
        <div className="overflow-hidden rounded-[2rem] bg-background">
          {/* notch */}
          <div className="flex h-7 items-center justify-center bg-brand-ink">
            <div className="h-1.5 w-16 rounded-full bg-brand-ink" />
          </div>
          {/* status bar */}
          <div className="flex items-center justify-between px-5 py-2 text-[10px] font-semibold text-brand-ink">
            <span>9:41</span>
            <span>●●●●● 100%</span>
          </div>
          {/* app content — chegada */}
          <div className="space-y-3 px-4 pb-6 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-ink">Chegada</span>
              <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                ● online
              </span>
            </div>
            {/* IA card — identificou */}
            <div className="rounded-xl border border-success/20 bg-success-light/40 p-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <Sparkles className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-brand-ink">
                    IA identificou
                  </div>
                  <div className="mt-1 text-xs font-bold text-brand-ink">
                    Maria Silva — Apto 302
                  </div>
                  <div className="text-[10px] text-brand-mid">Bloco B · 98% certeza</div>
                </div>
              </div>
            </div>
            {/* Pacote info */}
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="text-[10px] uppercase tracking-wider text-brand-mid">
                Rastreio
              </div>
              <div className="font-mono text-xs font-bold text-brand-ink">
                BR123456789BR
              </div>
              <div className="mt-1 text-[10px] text-brand-mid">Mercado Livre</div>
            </div>
            {/* Botão confirmar */}
            <button className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar entrada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mockup desktop — admin
function DashboardMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-brand-ink/10 ring-1 ring-border/50">
        {/* fake browser bar */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-danger/60" />
            <div className="h-3 w-3 rounded-full bg-warning/60" />
            <div className="h-3 w-3 rounded-full bg-success/60" />
          </div>
          <div className="ml-3 flex-1">
            <div className="mx-auto max-w-md rounded-md bg-background px-3 py-1 text-center text-[10px] text-brand-mid">
              ponto24.com.br/admin
            </div>
          </div>
        </div>
        {/* dashboard content */}
        <div className="grid grid-cols-12 gap-0">
          {/* sidebar */}
          <div className="col-span-3 border-r border-border bg-surface/50 p-4">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-wider text-brand-mid">
              Ponto 24
            </div>
            {['Dashboard', 'Pacotes', 'Moradores', 'Funcionários'].map((item, i) => (
              <div
                key={item}
                className={`mb-1 rounded-md px-2 py-1.5 text-[11px] ${
                  i === 1
                    ? 'bg-primary/15 font-semibold text-brand-ink'
                    : 'text-brand-mid'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          {/* main */}
          <div className="col-span-9 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-brand-ink">Pacotes hoje</div>
                <div className="text-[10px] text-brand-mid">Atualizado agora</div>
              </div>
              <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                +12 hoje
              </span>
            </div>
            {/* stats */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { l: 'Aguardando', v: '23', c: 'text-info' },
                { l: 'Retirados', v: '47', c: 'text-success' },
                { l: 'Pendentes ID', v: '2', c: 'text-warning' },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-border p-2">
                  <div className={`text-base font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-[9px] text-brand-mid">{s.l}</div>
                </div>
              ))}
            </div>
            {/* lista */}
            <div className="space-y-1.5">
              {[
                { n: 'Maria Silva', a: '302B', s: 'Aguardando', c: 'bg-info' },
                { n: 'João Pereira', a: '108A', s: 'Aguardando', c: 'bg-info' },
                { n: 'Ana Costa', a: '504B', s: 'Retirado', c: 'bg-success' },
              ].map((p) => (
                <div
                  key={p.n}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${p.c}`} />
                    <div>
                      <div className="text-[11px] font-semibold text-brand-ink">
                        {p.n}
                      </div>
                      <div className="text-[9px] text-brand-mid">Apto {p.a}</div>
                    </div>
                  </div>
                  <span className="text-[9px] text-brand-mid">{p.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROVA SOCIAL — métrica destaque
// ============================================================================

function ProvaSocial() {
  return (
    <section className="border-y border-border bg-surface/50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {[
            { v: '< 30s', l: 'do bipe à notificação' },
            { v: '98%', l: 'precisão da IA' },
            { v: '0', l: 'apps pro morador instalar' },
            { v: '100%', l: 'auditoria via QR Code' },
          ].map((m, i) => (
            <Reveal key={m.l} delay={i * 80}>
              <div className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
                {m.v}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-brand-mid">
                {m.l}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// COMO FUNCIONA — 3 passos com visual
// ============================================================================

function ComoFunciona() {
  const passos = [
    {
      n: '01',
      icon: ScanLine,
      titulo: 'Porteiro bipa e fotografa',
      texto:
        'Em segundos, o porteiro escaneia o código de rastreio e tira foto da etiqueta direto do celular.',
    },
    {
      n: '02',
      icon: Sparkles,
      titulo: 'IA identifica o morador',
      texto:
        'O Ponto 24 lê a etiqueta, encontra o apartamento e o destinatário automaticamente — sem digitação.',
    },
    {
      n: '03',
      icon: QrCode,
      titulo: 'Morador retira com QR Code',
      texto:
        'Notificação no WhatsApp com QR. Na retirada, o porteiro escaneia e o pacote é dado como entregue — com auditoria completa.',
    },
  ];

  return (
    <section id="como-funciona" className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-ink">
            Como funciona
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Três passos. Zero papel.
            <br />
            <span className="text-brand-mid">Rastreabilidade total.</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {passos.map((p, i) => (
            <Reveal key={p.n} delay={i * 120}>
              <div className="group relative h-full rounded-2xl border border-border bg-background p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5">
                {/* connector arrow on desktop */}
                {i < passos.length - 1 && (
                  <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 md:block">
                    <ArrowRight className="h-5 w-5 text-border" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary-dark transition-transform group-hover:scale-110">
                    <p.icon className="h-6 w-6" />
                  </div>
                  <span className="font-mono text-sm font-bold text-brand-mid/40">
                    {p.n}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold text-brand-ink">{p.titulo}</h3>
                <p className="mt-2 leading-relaxed text-brand-mid">{p.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// DIFERENCIAIS — 6 cards com ícones
// ============================================================================

function Diferenciais() {
  const items = [
    {
      icon: Sparkles,
      titulo: 'IA identifica sozinha',
      texto:
        'Lê a etiqueta e encontra o apartamento. Porteiro só confirma — não digita nome.',
    },
    {
      icon: MessageCircle,
      titulo: 'WhatsApp oficial Meta',
      texto:
        'Notificação chega instantânea no app que o morador já usa. Sem template estranho.',
    },
    {
      icon: QrCode,
      titulo: 'QR Code auditável',
      texto:
        'Toda retirada tem trilha: quem entregou, quem retirou, hora. Ninguém perde nada.',
    },
    {
      icon: Smartphone,
      titulo: 'Sem app pro morador',
      texto:
        'Morador não baixa nada. Recebe link, abre, retira. 100% via navegador.',
    },
    {
      icon: Building2,
      titulo: 'Multi-condomínio',
      texto:
        'Administra vários condomínios na mesma conta. Ideal pra administradoras.',
    },
    {
      icon: ShieldCheck,
      titulo: 'Conforme LGPD',
      texto:
        'Dados isolados por condomínio (RLS). Hospedagem no Brasil. Política clara.',
    },
  ];

  return (
    <section id="diferenciais" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-dark">
            Por que Ponto 24
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Não é só notificação por WhatsApp.
          </h2>
          <p className="mt-4 text-lg text-brand-mid">
            É o sistema completo da chegada à retirada — auditável, simples e sem fricção
            pro morador.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.titulo} delay={(i % 3) * 100}>
              <div className="group h-full rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-dark transition-transform group-hover:scale-110">
                  <it.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-brand-ink">
                  {it.titulo}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-mid">
                  {it.texto}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PROBLEMA — dores reconhecíveis
// ============================================================================

function Problema() {
  const dores = [
    {
      titulo: 'Pacote some no caderno',
      texto:
        'Anotação manual falha, papel se perde, e quando o morador cobra ninguém acha.',
    },
    {
      titulo: 'Fila no balcão da portaria',
      texto:
        'Porteiro perde tempo procurando pacote, morador espera, e o resto da rotina trava.',
    },
    {
      titulo: 'Reclamação no grupo do prédio',
      texto:
        'Sem notificação automática, o morador descobre que tem encomenda só quando reclama.',
    },
  ];

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Você reconhece esse cenário?
          </h2>
          <p className="mt-4 text-lg text-brand-mid">
            Toda administradora e todo síndico conhece a dor da gestão de pacotes — e
            todo morador sente o impacto.
          </p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
          {dores.map((d, i) => (
            <Reveal key={d.titulo} delay={i * 100}>
              <div className="h-full rounded-xl border-l-4 border-danger/60 bg-danger/5 p-6">
                <h3 className="font-semibold text-brand-ink">{d.titulo}</h3>
                <p className="mt-2 text-sm text-brand-mid">{d.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ
// ============================================================================

function FAQ() {
  const perguntas = [
    {
      q: 'Quanto tempo leva pra colocar no ar?',
      a: 'Setup completo em até 15 minutos. Cadastramos o condomínio, importamos a lista de moradores (CSV ou planilha) e o porteiro já começa a usar no celular dele — sem instalar nada.',
    },
    {
      q: 'O morador precisa baixar app?',
      a: 'Não. A notificação chega no WhatsApp com um link. O morador abre no navegador, vê o QR Code e leva no dia da retirada. Zero atrito.',
    },
    {
      q: 'Funciona com qualquer celular do porteiro?',
      a: 'Sim. É um web app — abre em qualquer celular Android ou iPhone com câmera e internet. Funciona offline em áreas com sinal fraco e sincroniza depois.',
    },
    {
      q: 'Como vocês cobram?',
      a: 'Modelo SaaS por condomínio, com plano fixo mensal. Sem fidelidade, sem taxa de instalação. Fale conosco no WhatsApp pra cotação ajustada ao seu tamanho.',
    },
    {
      q: 'Os dados ficam onde?',
      a: 'Hospedagem 100% no Brasil. Cada condomínio tem isolamento total dos dados (RLS no banco). Em conformidade com a LGPD.',
    },
    {
      q: 'E se o sistema cair?',
      a: 'Se faltar internet, o porteiro pode anotar como sempre fez. Quando voltar, registra normalmente. Não trava a portaria — substitui o caderno só quando estável.',
    },
  ];

  return (
    <section id="faq" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Perguntas comuns
          </h2>
          <p className="mt-4 text-lg text-brand-mid">
            Não achou sua dúvida? Manda no WhatsApp.
          </p>
        </Reveal>
        <Reveal className="mt-12 divide-y divide-border rounded-2xl border border-border bg-background" delay={100}>
          {perguntas.map((p) => (
            <details key={p.q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-brand-ink">
                {p.q}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface text-brand-mid transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-brand-mid">{p.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ============================================================================
// CTA FINAL
// ============================================================================

function CtaFinal() {
  return (
    <section className="py-24 sm:py-32">
      <Reveal className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-ink p-10 shadow-2xl sm:p-16">
          {/* decorative glow */}
          <div
            aria-hidden
            className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/30 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
          />
          <div className="relative text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Clock className="h-3.5 w-3.5" />
              Setup em 15 min
            </span>
            <h2 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Pronto pra acabar com a
              <br />
              <span className="text-primary">dor de cabeça da portaria?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/70">
              Fale com a gente no WhatsApp. Te mostramos o sistema funcionando em até 15
              minutos — direto no celular.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-primary-foreground shadow-xl transition-all hover:bg-primary-dark hover:shadow-2xl hover:shadow-primary/30"
              >
                Falar no WhatsApp agora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#como-funciona"
                className="text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                ou ver como funciona ↑
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo size="sm" />
            <p className="mt-3 max-w-sm text-sm text-brand-mid">
              Pacotes na portaria, sem mistério. A central de pacotes do seu condomínio,
              com IA + WhatsApp + auditoria.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1 text-[11px] font-semibold text-success">
                <Lock className="h-3 w-3" /> LGPD
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1 text-[11px] font-semibold text-info">
                <Server className="h-3 w-3" /> Hospedado no Brasil
              </span>
            </div>
          </div>
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-ink">
              Produto
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-brand-mid">
              <li>
                <a href="#como-funciona" className="hover:text-brand-ink">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="#diferenciais" className="hover:text-brand-ink">
                  Diferenciais
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-brand-ink">
                  Perguntas
                </a>
              </li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-ink">
              Contato
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-brand-mid">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-ink"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-brand-ink">
                  Entrar no sistema
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-brand-mid sm:flex-row">
          <span>© {new Date().getFullYear()} Ponto 24. Todos os direitos reservados.</span>
          <span>Pacotes na portaria, sem mistério.</span>
        </div>
      </div>
    </footer>
  );
}
