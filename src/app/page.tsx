import { Show } from '@clerk/nextjs';
import { getCurrentUser } from '@/lib/auth';
import { LandingPage } from '@/components/landing/LandingPage';

export default async function HomePage() {
  const current = await getCurrentUser();

  return (
    <>
      <Show when="signed-out">
        <LandingPage />
      </Show>

      <Show when="signed-in">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            {current?.kind === 'authenticated' && (
              <>
                <h1 className="text-3xl font-bold text-foreground">
                  Bem-vindo, {current.user.nome}!
                </h1>
                <p className="mt-2 text-text-secondary">Papel: {current.user.role}</p>
              </>
            )}
            {current?.kind === 'pending_provisioning' && (
              <>
                <h1 className="text-2xl font-bold text-foreground">Configurando sua conta…</h1>
                <p className="mt-2 text-text-secondary">
                  Estamos sincronizando seu cadastro. Atualize a página em alguns segundos.
                </p>
              </>
            )}
          </div>
        </div>
      </Show>
    </>
  );
}
