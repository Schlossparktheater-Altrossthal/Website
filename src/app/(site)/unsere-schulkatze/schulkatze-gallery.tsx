"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, Maximize2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SchulkatzeImageRotator } from "./image-rotator";

type SchulkatzeGalleryProps = {
  images: string[];
  alt: string;
  caption: string;
  sizes?: string;
  className?: string;
};

const DIALOG_PREVIEW_SIZES = "(min-width: 1440px) 960px, (min-width: 1024px) 70vw, 90vw";
const THUMBNAIL_SIZES = "(min-width: 1024px) 120px, (min-width: 768px) 15vw, 25vw";

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
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

  const totalImages = validImages.length;
  const activeImageSrc = validImages[activeIndex] ?? validImages[0];

  const showPrevious = useCallback(() => {
    if (totalImages <= 1) {
      return;
    }

    setActiveIndex((previousIndex) =>
      previousIndex === 0 ? totalImages - 1 : previousIndex - 1
    );
  }, [totalImages]);

  const showNext = useCallback(() => {
    if (totalImages <= 1) {
      return;
    }

    setActiveIndex((previousIndex) =>
      previousIndex + 1 >= totalImages ? 0 : previousIndex + 1
    );
  }, [totalImages]);

  const handleThumbnailClick = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      setFullScreenOpen(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, showNext, showPrevious]);

  if (validImages.length === 0) {
    return null;
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
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

      <DialogContent
        className="max-h-[min(95vh,72rem)] w-[min(95vw,80rem)] border border-border/60 bg-background/95 p-0 sm:rounded-[2.5rem]"
      >
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle>Galerie unserer Schulkatze</DialogTitle>
          <DialogDescription>{caption}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto px-6 pb-8">
          {activeImageSrc ? (
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-muted/60 shadow-xl">
              <Image
                key={activeImageSrc}
                src={activeImageSrc}
                alt={`${alt} – Bild ${activeIndex + 1} von ${totalImages}`}
                fill
                sizes={DIALOG_PREVIEW_SIZES}
                priority
                className="object-contain"
              />

              {totalImages > 1 ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/70 to-transparent" />
              ) : null}

              {totalImages > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 bg-background/90 shadow-lg backdrop-blur"
                    onClick={showPrevious}
                    aria-label="Vorheriges Bild anzeigen"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 bg-background/90 shadow-lg backdrop-blur"
                    onClick={showNext}
                    aria-label="Nächstes Bild anzeigen"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-4 top-4 z-10 bg-background/90 shadow-lg backdrop-blur"
                onClick={() => {
                  if (!activeImageSrc) {
                    return;
                  }

                  setFullScreenOpen(true);
                }}
                aria-label="Bild vergrößert anzeigen"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>
              Bild {activeIndex + 1} von {totalImages}
            </span>
            <span>{caption}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-5 md:grid-cols-6">
            {validImages.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => handleThumbnailClick(index)}
                className={cn(
                  "group relative aspect-[3/4] overflow-hidden rounded-xl border border-border/60 bg-background/60 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  index === activeIndex &&
                    "border-primary ring-2 ring-primary/40 shadow-lg"
                )}
                aria-label={`Bild ${index + 1} auswählen`}
                aria-current={index === activeIndex ? "true" : undefined}
              >
                <Image
                  src={src}
                  alt={`${alt} – Vorschau ${index + 1}`}
                  fill
                  sizes={THUMBNAIL_SIZES}
                  className="object-cover transition-opacity duration-200 group-hover:opacity-90"
                  priority={index === 0}
                />
              </button>
            ))}
          </div>
        </div>
        </DialogContent>
      </Dialog>
      {activeImageSrc ? (
        <Dialog
          open={fullScreenOpen}
          onOpenChange={(nextOpen) => {
            setFullScreenOpen(nextOpen);
          }}
        >
          <DialogContent className="h-screen w-screen max-w-none gap-0 border-0 bg-background/98 p-0 sm:rounded-none sm:border-0 sm:p-0 [&>button[data-radix-dialog-close]]:right-6 [&>button[data-radix-dialog-close]]:top-6">
            <DialogHeader className="sr-only">
              <DialogTitle>Bild in Vollbildansicht</DialogTitle>
              <DialogDescription>
                {caption} – {alt} (Bild {activeIndex + 1} von {totalImages})
              </DialogDescription>
            </DialogHeader>
            <div className="relative flex h-full w-full items-center justify-center bg-muted/80">
              <div className="relative h-full min-h-0 w-full min-w-0">
                <Image
                  src={activeImageSrc}
                  alt={`${alt} – vergrößerte Ansicht`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
