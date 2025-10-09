"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Images } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { SchulkatzeImageRotator } from "./image-rotator";

type SchulkatzeGalleryProps = {
  images: string[];
  alt: string;
  caption: string;
  sizes?: string;
  className?: string;
};

const DIALOG_IMAGE_SIZES = "(min-width: 1280px) 512px, (min-width: 768px) 45vw, 90vw";

export function SchulkatzeGallery({
  images,
  alt,
  caption,
  sizes,
  className,
}: SchulkatzeGalleryProps) {
  const validImages = useMemo(
    () =>
      Array.from(
        new Set(images.filter((src) => typeof src === "string" && src.trim().length > 0))
      ),
    [images]
  );

  if (validImages.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <figure
        className={cn(
          "relative mx-auto max-w-sm overflow-hidden rounded-3xl border border-border bg-background shadow-lg",
          className
        )}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="group relative block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            aria-label="Galerie mit Erinnerungsfotos unserer Schulkatze öffnen"
          >
            <SchulkatzeImageRotator
              images={validImages}
              alt={alt}
              sizes={sizes}
              className="pointer-events-none"
            />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
            <span className="pointer-events-none absolute bottom-4 left-1/2 flex min-w-[12rem] -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow ring-1 ring-border transition-transform duration-200 group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5">
              <Images className="h-4 w-4" aria-hidden="true" />
              Galerie ansehen
            </span>
          </button>
        </DialogTrigger>
        <figcaption className="border-t border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {caption}
        </figcaption>
      </figure>

      <DialogContent className="max-w-4xl border border-border/60 bg-background/95 p-0 sm:rounded-3xl">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle>Galerie unserer Schulkatze</DialogTitle>
          <DialogDescription>{caption}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
          {validImages.map((src, index) => (
            <div key={src} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted">
              <Image
                src={src}
                alt={alt}
                fill
                sizes={DIALOG_IMAGE_SIZES}
                priority={index === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
