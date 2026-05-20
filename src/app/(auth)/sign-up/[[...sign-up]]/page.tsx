'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SignUp } from '@clerk/nextjs';

/**
 * Cadastro público desabilitado durante MVP (decisão produto 2026-05-07),
 * MAS permitido via convite (invitation) do Clerk.
 *
 * Se a URL tem `__clerk_ticket` (vindo do link de convite), renderiza o
 * <SignUp /> do Clerk dentro da nossa interface para o usuário definir a senha.
 * Caso contrário, mostra mensagem de cadastro indisponível.
 */
export default function SignUpPage() {
  const params = useSearchParams();
  const hasTicket = params.has('__clerk_ticket');

  if (hasTicket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <SignUp signInUrl="/sign-in" />
      </div>
    );
  }

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
