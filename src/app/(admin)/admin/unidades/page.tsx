import { Home } from 'lucide-react';
import { ComingSoonPlaceholder } from '@/components/admin/ComingSoonPlaceholder';

export default function UnidadesPage() {
  return (
    <ComingSoonPlaceholder
      title="Unidades"
      storyId="2.3"
      icon={<Home className="h-12 w-12" aria-hidden />}
      description="O CRUD de unidades (apartamentos/casas) por setor será implementado na story 2.3."
    />
  );
}
