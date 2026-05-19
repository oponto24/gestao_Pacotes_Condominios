interface AuditDiffViewerProps {
  metadata: Record<string, unknown>;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function AuditDiffViewer({ metadata }: AuditDiffViewerProps) {
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;
  const changed = (metadata.changed as string[]) ?? [];

  // Delete: only before
  if (before && !after) {
    return (
      <div className="rounded border border-danger/30 bg-danger/5 p-2">
        <p className="mb-1 text-xs font-medium text-danger">Registro excluído</p>
        <SnapshotTable data={before} />
      </div>
    );
  }

  // Create: only after
  if (!before && after) {
    return (
      <div className="rounded border border-success/30 bg-success/5 p-2">
        <p className="mb-1 text-xs font-medium text-success">Registro criado</p>
        <SnapshotTable data={after} />
      </div>
    );
  }

  // Update: before + after
  if (before && after) {
    const fields = changed.length > 0 ? changed : Object.keys(after);
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="py-1 pr-2">Campo</th>
            <th className="py-1 pr-2">Antes</th>
            <th className="py-1">Depois</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field} className="border-b border-border/50">
              <td className="py-1 pr-2 font-medium">{field}</td>
              <td className="py-1 pr-2 text-danger line-through">
                {formatValue(before[field])}
              </td>
              <td className="py-1 text-success">{formatValue(after[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Fallback: raw JSON
  return (
    <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px]">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

function SnapshotTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([k]) => !['id', 'created_at', 'updated_at'].includes(k),
  );
  if (entries.length === 0) return null;
  return (
    <table className="w-full text-xs">
      <tbody>
        {entries.map(([key, val]) => (
          <tr key={key} className="border-b border-border/50">
            <td className="py-0.5 pr-2 font-medium">{key}</td>
            <td className="py-0.5">{formatValue(val)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
