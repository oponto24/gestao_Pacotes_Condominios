import { CsvImportClient } from '@/components/admin/CsvImportClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function ImportarCsvPage() {
  return <CsvImportClient />;
}
