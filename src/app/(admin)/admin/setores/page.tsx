import { Layers } from 'lucide-react';
import { ComingSoonPlaceholder } from '@/components/admin/ComingSoonPlaceholder';

export default function SetoresPage() {
  return (
    <ComingSoonPlaceholder
      title="Setores"
      storyId="2.2"
      icon={<Layers className="h-12 w-12" aria-hidden />}
      description="O CRUD de setores do condomínio (ex: Bloco A, Bloco B) será implementado na story 2.2."
    />
  );
}
