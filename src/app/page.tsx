import { Show } from '@clerk/nextjs';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const current = await getCurrentUser();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Show when="signed-out">
          <h1 className="text-3xl font-bold text-foreground">Sistema de Gestão de Pacotes</h1>
          <p className="mt-4 text-text-secondary">
            Faça login no canto superior direito para acessar.
          </p>
        </Show>

        <Show when="signed-in">
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
        </Show>
      </div>
    </div>
  );
}
