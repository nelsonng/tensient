"use client";

import { useEffect, useState } from "react";

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span";
  autoGlitch?: boolean;
  glitchOnHover?: boolean;
}

export function GlitchText({
  text,
  className = "",
  as: Tag = "h1",
  autoGlitch = true,
  glitchOnHover = true,
}: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(false);

  const triggerGlitch = () => {
    setIsGlitching(true);
    setTimeout(() => setIsGlitching(false), 200);
  };

  useEffect(() => {
    if (!autoGlitch) return;
    const interval = setInterval(triggerGlitch, 3000);
    return () => clearInterval(interval);
  }, [autoGlitch]);

  const baseClasses = `font-display font-bold tracking-tight ${className}`;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={glitchOnHover ? triggerGlitch : undefined}
    >
      {/* Cyan layer */}
      <Tag
        className={`${baseClasses} absolute inset-0 text-cyan-400 select-none ${
          isGlitching ? "opacity-70" : "opacity-0"
        }`}
        style={{
          transform: isGlitching ? "translateX(-2px)" : "translateX(0)",
          transition: "transform 50ms, opacity 50ms",
        }}
        aria-hidden="true"
      >
        {text}
      </Tag>

      {/* Magenta layer */}
      <Tag
        className={`${baseClasses} absolute inset-0 text-fuchsia-500 select-none ${
          isGlitching ? "opacity-70" : "opacity-0"
        }`}
        style={{
          transform: isGlitching ? "translateX(2px)" : "translateX(0)",
          transition: "transform 50ms, opacity 50ms",
        }}
        aria-hidden="true"
      >
        {text}
      </Tag>

      {/* Base layer (white) */}
      <Tag className={baseClasses}>{text}</Tag>
    </span>
  );
}
