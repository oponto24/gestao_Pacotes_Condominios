import { Package } from 'lucide-react';
import { ComingSoonPlaceholder } from '@/components/admin/ComingSoonPlaceholder';

export default function PacotesPage() {
  return (
    <ComingSoonPlaceholder
      title="Pacotes"
      storyId="6.1"
      icon={<Package className="h-12 w-12" aria-hidden />}
      description="A lista de pacotes com filtros e busca será implementada na story 6.1."
    />
  );
}
