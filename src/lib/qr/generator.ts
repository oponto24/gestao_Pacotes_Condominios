import QRCode from 'qrcode';
import sharp from 'sharp';

const CANVAS_SIZE = 800;
const QR_SIZE = 600;
const QR_LEFT = Math.round((CANVAS_SIZE - QR_SIZE) / 2);
const QR_TOP = 30;
const TEXT_TOP = QR_TOP + QR_SIZE + 10;

export interface GenerateQrImageInput {
  /** URL absoluta que será codificada no QR. Geralmente `${APP_URL}/retirada/confirmar/${qrToken}`. */
  qrPayloadUrl: string;
  /** Nome do condomínio (renderizado abaixo do QR). */
  condominioNome: string;
}

export interface GenerateQrImageResult {
  buffer: Buffer;
  mimeType: 'image/png';
}

/**
 * Gera PNG 800×800 quadrado com QR Code centralizado + nome do condomínio
 * + label de instrução abaixo.
 */
export async function generateQrImage(input: GenerateQrImageInput): Promise<GenerateQrImageResult> {
  const qrBuffer = await QRCode.toBuffer(input.qrPayloadUrl, {
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const condominioEscaped = escapeXml(input.condominioNome);

  const textOverlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE - TEXT_TOP}">
  <style>
    .nome { font: 600 36px -apple-system, "Segoe UI", Arial, sans-serif; fill: #0F172A; }
    .label { font: 500 24px -apple-system, "Segoe UI", Arial, sans-serif; fill: #475569; }
  </style>
  <text x="50%" y="40" text-anchor="middle" class="nome">${condominioEscaped}</text>
  <text x="50%" y="80" text-anchor="middle" class="label">Apresente para retirar</text>
</svg>`.trim();

  const svgBuffer = Buffer.from(textOverlay);

  const buffer = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: qrBuffer, left: QR_LEFT, top: QR_TOP },
      { input: svgBuffer, left: 0, top: TEXT_TOP },
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
