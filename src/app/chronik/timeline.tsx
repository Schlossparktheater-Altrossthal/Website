"use client";
import { useEffect, useState } from "react";

type ChronikItem = {
  id: string;
  year: number;
  title?: string | null;
};

export function ChronikTimeline({ items }: { items: ChronikItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id || null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsUserScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsUserScrolling(false);
      }, 150);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    if (isUserScrolling) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio that's above 40%
        const validEntries = entries
          .filter(entry => entry.isIntersecting && entry.intersectionRatio > 0.4)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        
        if (validEntries.length > 0) {
          const newActiveId = validEntries[0].target.id;
          if (newActiveId !== activeId) {
            setActiveId(newActiveId);
          }
        }
      },
      { 
        threshold: [0.4, 0.6, 0.8],
        rootMargin: '-20% 0px -20% 0px'
      }
    );

    // Observe all chronik sections
    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [items, activeId, isUserScrolling]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const activeIndex = items.findIndex((item) => item.id === activeId);
  const completion =
    items.length > 0 && activeIndex !== -1
      ? Math.max(8, ((items.length - activeIndex) / items.length) * 100)
      : 100;

  return (
    <div className="px-4 pb-12 sm:px-0 sm:pb-0">
      <div className="relative w-full sm:fixed sm:bottom-8 sm:left-1/2 sm:z-40 sm:w-auto sm:-translate-x-1/2 sm:transform">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/65 px-5 py-4 shadow-xl backdrop-blur-lg sm:rounded-2xl sm:px-8">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 sm:rounded-2xl" />

          {/* Progress bar background */}
          <div className="pointer-events-none absolute top-2 left-4 right-4 h-0.5 rounded-full bg-white/10" />

          {/* Active progress bar */}
          <div
            className="pointer-events-none absolute top-2 left-4 h-0.5 rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
            style={{ width: `${completion}%` }}
          />

          <div className="relative flex items-center gap-4 overflow-x-auto px-1 pt-3 scrollbar-hide sm:max-w-[85vw]">
          {[...items].reverse().map((item, index) => {
            const isActive = activeId === item.id;
            const originalIndex = items.findIndex(i => i.id === item.id);
            const activeOriginalIndex = items.findIndex(i => i.id === activeId);
            const isPast = activeOriginalIndex < originalIndex;
            
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="group relative flex flex-col items-center gap-2 min-w-fit transition-all duration-300 hover:scale-105 focus:outline-none rounded-lg p-3 m-1"
                title={item.title || `Saison ${item.year}`}
                style={{
                  boxShadow: isActive ? '0 0 0 2px rgba(184, 139, 46, 0.5)' : 'none'
                }}
              >
                {/* Connection Line */}
                {index < items.length - 1 && (
                  <div className={`absolute left-full top-7 w-4 h-px transition-colors duration-500 ${
                    isPast ? 'bg-white/15' : 'bg-primary/40'
                  }`} />
                )}
                
                {/* Year Dot */}
                <div className="relative">
                  <div className={`w-4 h-4 rounded-full border-2 transition-all duration-500 ${
                    isActive 
                      ? 'bg-primary border-primary scale-110 shadow-lg shadow-primary/50' 
                      : isPast
                      ? 'bg-primary/60 border-primary/60 shadow-md shadow-primary/25'
                      : 'bg-transparent border-white/40 group-hover:border-primary group-hover:bg-primary/20 group-hover:scale-110'
                  }`} />
                  
                  {isActive && (
                    <>
                      <div className="absolute inset-0 w-4 h-4 bg-primary/20 rounded-full animate-ping" />
                      <div className="absolute inset-0 w-4 h-4 bg-primary/10 rounded-full animate-pulse scale-150" />
                    </>
                  )}
                </div>
                
                {/* Year Label */}
                <span className={`text-sm font-semibold whitespace-nowrap [text-shadow:_1px_1px_3px_rgba(0,0,0,0.9)] transition-all duration-300 ${
                  isActive 
                    ? 'text-primary scale-105' 
                    : isPast
                    ? 'text-primary/80'
                    : 'text-white/70 group-hover:text-white group-hover:scale-105'
                }`}>
                  {item.year}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
