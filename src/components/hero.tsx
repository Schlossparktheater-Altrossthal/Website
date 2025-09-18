"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroRotator } from "@/components/hero-rotator";
import { useEffect, useState } from "react";

export function Hero({ images }: { images: string[] }) {
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const rotateImages = images.length > 0 ? images.slice(0, 5) : ["https://picsum.photos/id/1069/1600/900"];
  
  return (
    <section className="relative w-full h-screen min-h-[100dvh] sm:min-h-[90vh] lg:min-h-[100vh] overflow-hidden -mt-16 sm:-mt-20">
      {/* Full-screen background images */}
      <div 
        className="absolute inset-0 w-full h-full hero-bg z-0 pointer-events-none"
        style={{
          transform: `translateY(${scrollY * 0.5}px) scale(${1 + scrollY * 0.0005})`,
          filter: `blur(${Math.min(scrollY * 0.02, 8)}px)`,
        }}
      >
        <HeroRotator images={rotateImages} />
      </div>
      
      {/* Lighter overlays for better image visibility */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none" />
      
      {/* Subtle mystical color overlays */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_60rem_30rem_at_30%_70%,_color-mix(in_oklab,var(--primary)_8%,transparent),transparent_80%)] pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_40rem_20rem_at_70%_30%,_color-mix(in_oklab,var(--primary)_12%,transparent),transparent_75%)] mix-blend-screen opacity-40 pointer-events-none" />
      
      {/* Content container */}
      <div 
        className="relative z-20 h-full flex items-center justify-center pt-16 pb-8 hero-content"
        style={{
          transform: `translateY(${scrollY * -0.3}px) translateZ(50px)`,
          perspective: '1000px',
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div 
            className="max-w-4xl mx-auto text-center"
            style={{
              transform: `rotateX(${Math.min(scrollY * 0.05, 15)}deg) translateZ(20px)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="space-y-4 sm:space-y-6 lg:space-y-8">
              <h1 className="font-serif leading-tight text-[clamp(2rem,7vw,4.5rem)] text-white [text-shadow:_0_0_10px_rgba(0,0,0,0.9),_2px_2px_6px_rgba(0,0,0,0.8),_-1px_-1px_3px_rgba(0,0,0,0.7)] font-bold">
                <span className="block">Das Geheimnis</span>
                <span className="block text-[0.85em] mt-1">im Schlosspark</span>
              </h1>
              
              <p className="text-white text-base sm:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed px-2 [text-shadow:_0_0_8px_rgba(0,0,0,0.9),_1px_1px_4px_rgba(0,0,0,0.8),_-1px_-1px_2px_rgba(0,0,0,0.6)] font-medium">
                Ein Sommer. Ein Wochenende. Ein einziges Stück – verborgen zwischen Licht und Laub.
              </p>
              
              <div className="relative z-[200] isolate pointer-events-auto flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 px-4 sm:px-0">
                <Button asChild size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 bg-primary hover:bg-primary/90 shadow-xl">
                  <Link className="pointer-events-auto" href="/mystery">Das Geheimnis entdecken</Link>
                </Button>
                <Button variant="outline" asChild size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 border-white/30 text-white hover:bg-white/10 hover:border-white/50 shadow-xl backdrop-blur-sm">
                  <Link className="pointer-events-auto" href="/chronik">Chronik</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
