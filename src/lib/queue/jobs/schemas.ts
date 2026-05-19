import { z } from 'zod';

const uuid = z.string().uuid();

export const extractLabelPayloadSchema = z.object({
  pacote_id: uuid,
  condominio_id: uuid,
});

export const sendWhatsAppPayloadSchema = z.object({
  pacote_id: uuid,
  condominio_id: uuid,
});

export const processWebhookPayloadSchema = z.object({
  value: z.object({
    metadata: z.object({
      display_phone_number: z.string(),
      phone_number_id: z.string(),
    }),
    contacts: z.array(z.object({
      profile: z.object({ name: z.string() }).optional(),
      wa_id: z.string(),
    })).optional(),
    statuses: z.array(z.any()).optional(),
    messages: z.array(z.any()).optional(),
  }),
});

export const processPalavraChavePayloadSchema = z.object({
  whatsapp_message_id: uuid,
});
