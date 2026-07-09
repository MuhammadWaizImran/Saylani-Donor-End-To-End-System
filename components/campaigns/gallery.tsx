"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface-muted">
        <Image
          src={images[active]}
          alt={`${title} — photo ${active + 1} of ${images.length}`}
          fill
          priority={active === 0}
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3" role="tablist" aria-label="Campaign photos">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[16/10] w-24 overflow-hidden rounded-lg border-2 transition-all sm:w-28",
                active === i
                  ? "border-accent-500 opacity-100"
                  : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="112px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
