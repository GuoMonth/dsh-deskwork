import { z } from 'zod';

export const recordProfileSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.literal(1),
    origin: z.url(),
    pathPrefix: z.string().startsWith('/'),
    shopId: z.string().min(1),
    fieldName: z.string().min(1),
    selectors: z
      .object({
        shop: z.string().min(1),
        object: z.string().min(1),
        name: z.string().min(1),
        value: z.string().min(1),
        save: z.string().min(1),
        revision: z.string().min(1),
      })
      .strict(),
    pageRevision: z.string().min(1),
  })
  .strict();
export type RecordProfile = z.infer<typeof recordProfileSchema>;

export function fixtureProfile(origin: string): RecordProfile {
  return {
    id: 'fixture',
    version: 1,
    origin,
    pathPrefix: '/products',
    shopId: 'test-shop',
    fieldName: '备注',
    selectors: {
      shop: '#shop-id',
      object: '#object-id',
      name: '#product-name',
      value: '#record-value',
      save: '#save',
      revision: '#page-revision',
    },
    pageRevision: 'fixture-v1',
  };
}
