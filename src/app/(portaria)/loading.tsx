import { Skeleton } from '@/components/ui/skeleton';

export default function PortariaLoading() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-12 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}
