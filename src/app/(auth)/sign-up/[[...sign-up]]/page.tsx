import Link from 'next/link';

/**
 * Cadastro público desabilitado durante MVP (decisão produto 2026-05-07):
 * usuários só entram após serem provisionados pelo super-admin/admin via UI
 * (stories 8.5/8.6/8.7). Sem cobrança ainda — não pode haver self-signup.
 */
export default function SignUpDisabledPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Cadastro indisponível</h1>
        <p className="mt-3 text-text-secondary">
          O PONTO24 Pacotes está em fase de acesso controlado. Para usar o sistema,
          fale conosco pelo WhatsApp e nós cadastramos seu condomínio diretamente.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href="https://wa.me/5511914980582?text=Olá!%20Quero%20saber%20mais%20sobre%20o%20PONTO24%20Pacotes%20para%20o%20meu%20condomínio."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
          >
            Falar no WhatsApp
          </a>
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Já tenho acesso — entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
