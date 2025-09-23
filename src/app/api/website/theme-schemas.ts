import { z } from "zod";

export const themeIdSchema = z.string().trim().min(1);

export function createModeSchema() {
  return z
    .record(z.string().trim().min(1), z.string().trim().min(1).max(200))
    .refine((value) => Object.keys(value).length > 0, {
      message: "Jeder Modus benötigt mindestens ein Token.",
    });
}

const oklchSchema = z.object({
  l: z.number(),
  c: z.number(),
  h: z.number(),
  alpha: z.number().min(0).max(1).optional(),
});

const familyModesSchema = z.record(z.string().min(1), oklchSchema);

const familiesSchema = z.record(z.string().min(1), familyModesSchema);

export const tokenAdjustmentSchema = z.object({
  deltaL: z.number().optional(),
  l: z.number().optional(),
  scaleL: z.number().optional(),
  deltaC: z.number().optional(),
  c: z.number().optional(),
  scaleC: z.number().optional(),
  h: z.number().optional(),
  deltaH: z.number().optional(),
  alpha: z.number().optional(),
  deltaAlpha: z.number().optional(),
  scaleAlpha: z.number().optional(),
  value: z.string().trim().min(1).optional(),
  family: z.string().trim().min(1).optional(),
});

const tokenMetaSchema = z.object({
  description: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const semanticTokenSchema = tokenMetaSchema
  .extend({ family: z.string().trim().min(1) })
  .catchall(tokenAdjustmentSchema);

export const parametersSchema = z.object({
  families: familiesSchema,
  tokens: z.record(z.string().min(1), semanticTokenSchema),
});

const tokensMetaSchema = z
  .object({
    modes: z.array(z.string().trim().min(1)).optional(),
    generatedAt: z.string().trim().optional(),
  })
  .catchall(z.any())
  .optional();

const modeValuesSchema = createModeSchema();

const themeModesSchema = z
  .object({
    light: modeValuesSchema.optional(),
    dark: modeValuesSchema.optional(),
  })
  .catchall(modeValuesSchema)
  .optional();

export const themeTokensSchema = z.object({
  radius: z.object({ base: z.string().trim().min(1).max(120) }),
  parameters: parametersSchema,
  modes: themeModesSchema,
  meta: tokensMetaSchema,
});

export const themeNameSchema = z.string().trim().min(2).max(120);

export const themeDescriptionSchema = z.string().trim().max(500).optional().nullable();
