/**
 * Smoke test manual — envia template real via Meta Cloud API.
 *
 * Pré-requisitos:
 * 1. .env.local com META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_API_VERSION preenchidos
 * 2. Destinatário cadastrado em developers.facebook.com → seu app → WhatsApp →
 *    Configuração da API → "Destinatários permitidos" (apenas no sandbox)
 * 3. Template usado deve estar APROVADO na Meta. `hello_world` é template nativo
 *    sempre disponível, ideal pra primeiro smoke antes do `pacote_chegou` aprovar.
 *
 * Uso:
 *   npm run smoke:meta -- --to=5511999999999
 *   npm run smoke:meta -- --to=5511999999999 --template=pacote_chegou --params="João,Edifício Central"
 */
import 'dotenv/config';
import { sendTemplate, MetaApiError } from '@/lib/meta-whatsapp';

function arg(name: string, fallback?: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  if (fallback !== undefined) return fallback;
  throw new Error(`Argumento --${name} obrigatório`);
}

async function main(): Promise<void> {
  const to = arg('to');
  const templateName = arg('template', 'hello_world');
  const languageCode = arg('lang', templateName === 'hello_world' ? 'en_US' : 'pt_BR');
  const paramsRaw = arg('params', '');
  const bodyParams = paramsRaw ? paramsRaw.split(',').map((p) => p.trim()) : [];
  const headerImageUrl = arg('header-image', '');

  // eslint-disable-next-line no-console
  console.log('[smoke:meta] Enviando template…', {
    to,
    templateName,
    languageCode,
    bodyParams,
    headerImageUrl: headerImageUrl || undefined,
  });

  try {
    const result = await sendTemplate({
      to,
      templateName,
      languageCode,
      bodyParams,
      ...(headerImageUrl ? { headerImageUrl } : {}),
    });
    // eslint-disable-next-line no-console
    console.log('[smoke:meta] OK ✅', result);
    process.exit(0);
  } catch (err) {
    if (err instanceof MetaApiError) {
      // eslint-disable-next-line no-console
      console.error('[smoke:meta] FALHOU ❌', {
        code: err.code,
        subcode: err.subcode,
        httpStatus: err.httpStatus,
        retriable: err.retriable,
        userFacing: err.userFacing,
        fbtrace_id: err.fbtrace_id,
        message: err.message,
      });
    } else {
      // eslint-disable-next-line no-console
      console.error('[smoke:meta] FALHOU ❌', err);
    }
    process.exit(1);
  }
}

void main();
