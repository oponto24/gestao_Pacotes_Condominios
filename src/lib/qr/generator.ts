import QRCode from 'qrcode';
import sharp from 'sharp';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 628;
const QR_SIZE = 600;
const QR_LEFT = 14;
const QR_TOP = 14;
const TEXT_AREA_LEFT = QR_LEFT + QR_SIZE + 60;

export interface GenerateQrImageInput {
  /** URL absoluta que será codificada no QR. Geralmente `${APP_URL}/retirada/confirmar/${qrToken}`. */
  qrPayloadUrl: string;
  /** Nome do condomínio (renderizado ao lado do QR). */
  condominioNome: string;
}

export interface GenerateQrImageResult {
  buffer: Buffer;
  mimeType: 'image/png';
}

/**
 * Gera PNG 1200×628 com QR Code centralizado à esquerda + nome do condomínio
 * + label de instrução à direita.
 *
 * Aspect ratio panorâmico (1.91:1) escolhido para que o WhatsApp não corte
 * o QR no preview do header de template. Decisão registrada em
 * memory/setup-meta-whatsapp-progresso.md.
 */
export async function generateQrImage(input: GenerateQrImageInput): Promise<GenerateQrImageResult> {
  // QR PNG 600×600 com error correction H (alta tolerância a artefatos)
  const qrBuffer = await QRCode.toBuffer(input.qrPayloadUrl, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const condominioEscaped = escapeXml(input.condominioNome);

  const textOverlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH - TEXT_AREA_LEFT - 40}" height="${CANVAS_HEIGHT}">
  <style>
    .nome { font: 600 38px -apple-system, "Segoe UI", Arial, sans-serif; fill: #0F172A; }
    .label { font: 500 22px -apple-system, "Segoe UI", Arial, sans-serif; fill: #475569; }
  </style>
  <text x="0" y="280" class="nome">${condominioEscaped}</text>
  <text x="0" y="320" class="label">Apresente para retirar</text>
</svg>`.trim();

  const svgBuffer = Buffer.from(textOverlay);

  const buffer = await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: qrBuffer, left: QR_LEFT, top: QR_TOP },
      { input: svgBuffer, left: TEXT_AREA_LEFT, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer, mimeType: 'image/png' };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
