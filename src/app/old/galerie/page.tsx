import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archiv und Bilder",
  description: "Noch in Arbeit.",
};

export default function PublicGalleryPage() {
  return (
    <div className="layout-container flex min-h-[60vh] items-center justify-center py-24">
      <div className="w-full max-w-xl rounded-xl border border-dashed bg-muted/40 p-6 text-center">
        <p className="text-base font-medium text-muted-foreground">
          Die Archiv- und Bilderseite befindet sich derzeit noch in Arbeit.
        </p>
      </div>
    </div>
  );
}
