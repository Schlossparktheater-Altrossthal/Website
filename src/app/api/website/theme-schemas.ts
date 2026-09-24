import { z } from "zod";

export const themeIdSchema = z.string().trim().min(1);

const themeVariablesSchema = z
  .record(z.string().trim().min(1).max(66), z.string().trim().min(1).max(400))
  .refine((value) => Object.keys(value).length <= 200, {
    message: "Zu viele Theme-Variablen.",
  });

/** Theme im tweakcn-Format; Werte werden serverseitig zusätzlich bereinigt. */
export const themeTokensSchema = z.object({
  format: z.literal("tweakcn"),
  theme: themeVariablesSchema,
  light: themeVariablesSchema,
  dark: themeVariablesSchema,
});

/** Eingefügtes CSS/JSON oder ein tweakcn-Link. */
export const themeImportSourceSchema = z.string().trim().min(1).max(200_000);

export const themeNameSchema = z.string().trim().min(2).max(120);

export const themeDescriptionSchema = z.string().trim().max(500).optional().nullable();
