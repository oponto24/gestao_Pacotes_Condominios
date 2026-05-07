import * as React from 'react';
import { EmptyState } from '@/components/ui/empty-state';

interface ComingSoonPlaceholderProps {
  title: string;
  storyId: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ComingSoonPlaceholder({
  title,
  storyId,
  description,
  icon,
}: ComingSoonPlaceholderProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <EmptyState
        icon={icon}
        title="Em breve"
        description={description ?? `Esta tela será implementada na story ${storyId}.`}
      />
    </div>
  );
}
