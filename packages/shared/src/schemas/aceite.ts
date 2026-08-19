import { z } from 'zod';

export const registroAceiteSchema = z.object({
  sessionId: z.string().min(1),
  versaoTermo: z.string().min(1),
  aceitoEm: z.string().min(1),
  ip: z.string().min(1),
  userAgent: z.string().min(1),
});

export type RegistroAceite = z.infer<typeof registroAceiteSchema>;

export const aceiteTermoRequestSchema = z.object({
  versaoTermo: z.string().min(1),
});
