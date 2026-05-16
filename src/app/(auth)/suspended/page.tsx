import { SignOutButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export const metadata = {
  title: 'Acesso Suspenso',
};

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <ShieldAlert className="mx-auto h-16 w-16 text-warning" />
        <h1 className="text-2xl font-semibold text-foreground">
          Acesso temporariamente suspenso
        </h1>
        <p className="text-text-secondary">
          O condomínio vinculado à sua conta está temporariamente suspenso.
          Entre em contato com o suporte para mais informações.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="mailto:suporte@ponto24.app"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Contatar suporte
          </a>
          <SignOutButton>
            <Button variant="ghost">Sair da conta</Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
