"use client";
import React from "react";

export function MysticBackground() {
  return (
    <div className="mystic-bg" aria-hidden>
      {/* Warm gold glow */}
      <span className="mystic-blob mystic-amber" />
      {/* Forest green glow */}
      <span className="mystic-blob mystic-forest" />
      {/* Teal water glow */}
      <span className="mystic-blob mystic-teal" />
      {/* Soft band near bottom to hint at mist/water */}
      <span className="mystic-mist" />
    </div>
  );
}

