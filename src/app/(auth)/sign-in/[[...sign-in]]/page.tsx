import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {/* signUpUrl aponta pra página com aviso de cadastro indisponível
          (decisão produto: sem self-signup durante MVP sem cobrança). */}
      <SignIn signUpUrl="/sign-up" />
    </div>
  );
}
