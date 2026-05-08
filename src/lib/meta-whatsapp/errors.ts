import type { MetaApiErrorResponse } from './types';

interface MetaErrorMapping {
  retriable: boolean;
  userFacing: string;
}

const ERROR_CODE_MAP: Record<number, MetaErrorMapping> = {
  100: { retriable: false, userFacing: 'Parâmetro inválido — confira número e template.' },
  131026: { retriable: false, userFacing: 'Morador não tem WhatsApp ativo neste número.' },
  131047: { retriable: false, userFacing: 'Janela de 24h expirada — só template é permitido.' },
  131056: { retriable: true, userFacing: 'Limite de envios atingido, retry mais tarde.' },
};

const FALLBACK_MAPPING: MetaErrorMapping = {
  retriable: false,
  userFacing: 'Falha ao enviar mensagem WhatsApp.',
};

export class MetaApiError extends Error {
  readonly code: number;
  readonly subcode?: number;
  readonly httpStatus: number;
  readonly fbtrace_id?: string;
  readonly retriable: boolean;
  readonly userFacing: string;

  constructor(params: {
    code: number;
    httpStatus: number;
    message: string;
    subcode?: number;
    fbtrace_id?: string;
    retriable?: boolean;
    userFacing?: string;
  }) {
    super(params.message);
    this.name = 'MetaApiError';
    this.code = params.code;
    this.subcode = params.subcode;
    this.httpStatus = params.httpStatus;
    this.fbtrace_id = params.fbtrace_id;

    const mapped = ERROR_CODE_MAP[params.code] ?? FALLBACK_MAPPING;
    this.retriable = params.retriable ?? mapped.retriable;
    this.userFacing = params.userFacing ?? mapped.userFacing;
  }

  /** Constrói erro a partir de resposta JSON da Meta. */
  static fromMetaResponse(httpStatus: number, body: MetaApiErrorResponse): MetaApiError {
    const e = body.error;
    return new MetaApiError({
      code: e.code,
      subcode: e.error_subcode,
      httpStatus,
      message: e.message,
      fbtrace_id: e.fbtrace_id,
    });
  }

  /** Erro genérico de rede/timeout — sempre retriable. */
  static fromNetworkError(message: string): MetaApiError {
    return new MetaApiError({
      code: 0,
      httpStatus: 0,
      message: `network_error: ${message}`,
      retriable: true,
      userFacing: 'Falha temporária Meta — retry automático.',
    });
  }
}
