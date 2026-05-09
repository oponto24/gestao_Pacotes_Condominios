import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LandingPage } from '@/components/landing/LandingPage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Home (`/`):
 *   - signed-out → LandingPage (pública)
 *   - pending_provisioning → tela de espera (webhook ainda processando)
 *   - super_admin → /super-admin
 *   - admin → /admin
 *   - porteiro → /chegada
 *
 * Substitui tela "Bem-vindo, {nome}" sem função (auditoria UX/IA 2026-05-07).
 */
export default async function HomePage() {
  const current = await getCurrentUser();

  if (!current) return <LandingPage />;

  if (current.kind === 'pending_provisioning') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-foreground">Configurando sua conta…</h1>
          <p className="mt-2 text-text-secondary">
            Estamos sincronizando seu cadastro. Atualize a página em alguns segundos.
          </p>
        </div>
      </div>
    );
  }

  // current.kind === 'authenticated'
  const role = current.user.role;
  if (role === 'super_admin') redirect('/super-admin');
  if (role === 'admin_master') redirect('/admin');
  if (role === 'admin_funcionario') redirect('/chegada'); // story 10.5 vai criar /administracao
  if (role === 'porteiro') redirect('/chegada');

  // Role desconhecida (defensivo) — mostra tela neutra ao invés de loop
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Conta sem perfil atribuído
        </h1>
        <p className="mt-2 text-text-secondary">
          Fale com o administrador do seu condomínio para ativar seu acesso.
        </p>
      </div>
    </div>
  );
}
