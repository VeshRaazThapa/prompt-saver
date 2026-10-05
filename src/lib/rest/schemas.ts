import { z } from 'zod';
import { MAX_CONTENT_LENGTH } from '../limits';

const tags = z.array(z.string().trim().min(1).max(50)).max(20);

export const createPromptBody = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  description: z.string().max(2000).optional(),
  tags: tags.optional(),
});

export const patchPromptBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(MAX_CONTENT_LENGTH).optional(),
    description: z.string().max(2000).optional(),
    tags: tags.optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
