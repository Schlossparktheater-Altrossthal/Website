import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Hero } from "@/components/hero";
import { getHeroImages, pickHeroForNow } from "@/lib/hero-images";
import React from "react";

export default function Home() {
  const files = getHeroImages();
  const picked = pickHeroForNow(files) ?? "https://picsum.photos/id/1069/1600/900";
  const heroImages = files.length > 0 ? files.slice(0, 5) : [picked];
  
  return (
    <div>
      <Hero images={heroImages} />
      <div className="container mx-auto px-4 sm:px-6">
        <div className="space-y-8 py-12 sm:py-16">
          <section className="text-center py-6 sm:py-8">
            <div className="mt-2 opacity-80">Ein einziges Wochenende. Ein Sommer. Ein Stück.</div>
            <div className="mt-4 text-xl">Countdown: bald verfügbar…</div>
          </section>
          <Card>
            <CardTitle className="p-4">Teaser-Hinweis</CardTitle>
            <CardContent>Folge den Spuren im Nebel…</CardContent>
          </Card>
        </div>
      </div>
      {/* JSON-LD for basic organization/site */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Sommertheater im Schlosspark",
            url: (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
          }),
        }}
      />
    </div>
  );
}
