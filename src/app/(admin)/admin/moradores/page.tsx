import { Users } from 'lucide-react';
import { ComingSoonPlaceholder } from '@/components/admin/ComingSoonPlaceholder';

export default function MoradoresPage() {
  return (
    <ComingSoonPlaceholder
      title="Moradores"
      storyId="2.4"
      icon={<Users className="h-12 w-12" aria-hidden />}
      description="O CRUD de moradores (principal + adicionais) por unidade será implementado na story 2.4."
    />
  );
}
