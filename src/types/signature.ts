import { z } from "zod";

export const signaturePointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  time: z.number().nonnegative().finite(),
  /** Stiftdaten, nur erfasst wenn das Gerät sie liefert (Pointer Events, `pointerType: "pen"`). */
  pressure: z.number().min(0).max(1).optional(),
  tiltX: z.number().min(-90).max(90).optional(),
  tiltY: z.number().min(-90).max(90).optional(),
  twist: z.number().min(0).max(360).optional(),
  altitudeAngle: z
    .number()
    .min(0)
    .max(Math.PI / 2 + 0.001)
    .optional(),
  azimuthAngle: z
    .number()
    .min(0)
    .max(Math.PI * 2 + 0.001)
    .optional(),
});

export const signatureStrokeSchema = z.object({
  points: z.array(signaturePointSchema).min(1),
  /** Eingabegerät des Strichs: "pen", "touch" oder "mouse". */
  pointerType: z.string().max(16).optional(),
});

export const signatureBoundingBoxSchema = z.object({
  minX: z.number().finite(),
  minY: z.number().finite(),
  maxX: z.number().finite(),
  maxY: z.number().finite(),
});

export const signaturePayloadSchema = z.object({
  version: z.literal("velocity.v1"),
  width: z.number().positive().finite(),
  height: z.number().positive().finite(),
  duration: z.number().nonnegative().finite(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  boundingBox: signatureBoundingBoxSchema,
  strokes: z.array(signatureStrokeSchema).min(1),
});

export const signatureSubmissionSchema = z.object({
  version: z.literal("velocity.v1"),
  payload: signaturePayloadSchema,
});

export type SignaturePoint = z.infer<typeof signaturePointSchema>;
export type SignatureStroke = z.infer<typeof signatureStrokeSchema>;
export type SignatureBoundingBox = z.infer<typeof signatureBoundingBoxSchema>;
export type SignaturePayload = z.infer<typeof signaturePayloadSchema>;
export type SignatureSubmission = z.infer<typeof signatureSubmissionSchema>;
