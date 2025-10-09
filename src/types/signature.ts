import { z } from "zod";

export const signaturePointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  time: z.number().nonnegative().finite(),
});

export const signatureStrokeSchema = z.object({
  points: z.array(signaturePointSchema).min(1),
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
