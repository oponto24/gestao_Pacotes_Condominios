import { SignUpButton } from '@clerk/nextjs';
import { Logo } from '@/components/brand/Logo';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_LP_WHATSAPP ?? '5511914980582';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Olá! Quero saber mais sobre o Ponto 24 para o meu condomínio.',
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

export function LandingPage() {
  return (
    <div className="bg-background text-brand-ink">
      <Hero />
      <Problema />
      <ComoFunciona />
      <Diferenciais />
      <CtaFinal />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary-light/60 via-background to-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-16 text-center sm:py-24">
        <Logo size="lg" />
        <div className="space-y-4">
          <span className="inline-block rounded-full bg-accent-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-dark">
            Para síndicos e administradoras
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Pacotes na portaria,
            <br />
            <span className="text-primary-dark">sem mistério.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-brand-mid sm:text-xl">
            Acabe com pacote perdido, fila no balcão e reclamação no grupo do condomínio.
            O Ponto 24 organiza a chegada, identifica o morador com IA e avisa pelo WhatsApp
            automaticamente.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-btn-lg items-center justify-center rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
          >
            Falar no WhatsApp
          </a>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="inline-flex h-btn-lg items-center justify-center rounded-md border border-input bg-white px-8 text-base font-semibold text-brand-ink transition-colors hover:bg-primary-light"
            >
              Criar conta grátis
            </button>
          </SignUpButton>
        </div>
        <p className="text-sm text-brand-mid">
          Sem instalação · Funciona no celular do porteiro · Setup em minutos
        </p>
      </div>
    </section>
  );
}

function Problema() {
  const dores = [
    {
      titulo: 'Pacote some no caderno',
      texto: 'Anotação manual falha, papel se perde, e quando o morador cobra ninguém acha.',
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
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Você reconhece esse cenário?
          </h2>
          <p className="mt-4 text-lg text-brand-mid">
            Toda administradora e todo síndico conhece a dor da gestão de pacotes — e
            todo morador sente o impacto.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {dores.map((d) => (
            <div
              key={d.titulo}
              className="rounded-lg border border-border bg-background p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{d.titulo}</h3>
              <p className="mt-2 text-brand-mid">{d.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComoFunciona() {
  const passos = [
    {
      n: '1',
      titulo: 'Porteiro bipa e fotografa',
      texto:
        'Em segundos, o porteiro escaneia o código de rastreio e tira foto da etiqueta direto do celular.',
    },
    {
      n: '2',
      titulo: 'IA identifica o morador',
      texto:
        'O Ponto 24 lê a etiqueta, encontra o apartamento e o destinatário automaticamente.',
    },
    {
      n: '3',
      titulo: 'Morador retira com QR Code',
      texto:
        'Notificação via WhatsApp com QR Code. Na retirada, o porteiro escaneia e o pacote é dado como entregue — com auditoria completa.',
    },
  ];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Como funciona</h2>
          <p className="mt-4 text-lg text-brand-mid">
            Três passos. Zero papel. Rastreabilidade total.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {passos.map((p) => (
            <div key={p.n} className="flex flex-col items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                {p.n}
              </div>
              <h3 className="text-xl font-semibold">{p.titulo}</h3>
              <p className="text-brand-mid">{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Diferenciais() {
  const itens = [
    {
      titulo: 'IA que aprende sua portaria',
      texto:
        'Reconhecimento automático de etiquetas e casamento inteligente com unidades e moradores.',
    },
    {
      titulo: 'WhatsApp nativo',
      texto:
        'Notificação automática de chegada e retirada via Meta Cloud API — sem bot caseiro.',
    },
    {
      titulo: 'Multi-condomínio',
      texto:
        'Administradoras gerenciam vários condomínios em uma única conta, com isolamento total de dados.',
    },
    {
      titulo: 'Auditoria completa',
      texto:
        'Cada chegada, retirada e exceção fica registrada com foto, hora e responsável.',
    },
    {
      titulo: 'Funciona no celular',
      texto:
        'PWA otimizado pro porteiro: instala como app, funciona offline, sem precisar de tablet caro.',
    },
    {
      titulo: 'Sem fidelidade',
      texto:
        'Mensalidade simples por condomínio. Cancela quando quiser, sem letra miúda.',
    },
  ];

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Feito pra quem gerencia de verdade
          </h2>
          <p className="mt-4 text-lg text-brand-mid">
            Tudo que síndico e administradora precisam — sem complicação.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {itens.map((i) => (
            <div key={i.titulo} className="rounded-lg bg-background p-6 shadow-sm">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-light text-accent-dark">
                <CheckIcon />
              </div>
              <h3 className="text-lg font-semibold">{i.titulo}</h3>
              <p className="mt-2 text-brand-mid">{i.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFinal() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-2xl bg-primary p-10 text-center shadow-lg sm:p-14">
          <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
            Pronto pra acabar com a dor de cabeça da portaria?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Fale com a gente no WhatsApp. Te mostramos o sistema funcionando em até 15
            minutos — direto no celular.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-btn-lg items-center justify-center rounded-md bg-brand-ink px-8 text-base font-semibold text-white transition-colors hover:bg-brand-ink/90"
            >
              Falar no WhatsApp agora
            </a>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="inline-flex h-btn-lg items-center justify-center rounded-md bg-white px-8 text-base font-semibold text-brand-ink transition-colors hover:bg-white/90"
              >
                Quero testar grátis
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-brand-mid sm:flex-row">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span>· Pacotes na portaria, sem mistério.</span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-ink"
          >
            WhatsApp
          </a>
          <span>© {new Date().getFullYear()} Ponto 24</span>
        </div>
      </div>
    </footer>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
