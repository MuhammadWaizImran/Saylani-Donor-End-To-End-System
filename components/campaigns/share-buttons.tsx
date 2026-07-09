"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import {
  FacebookIcon,
  WhatsappIcon,
  XTwitterIcon,
} from "@/components/ui/social-icons";

export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = encodeURIComponent(`Support "${title}" on SMIT Donations`);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  };

  const buttonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300";

  return (
    <div className="flex items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-ink-muted">Share:</span>
      <a
        href={`https://wa.me/?text=${text}%20${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        className={buttonClass}
      >
        <WhatsappIcon className="h-4 w-4" aria-hidden />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className={buttonClass}
      >
        <FacebookIcon className="h-4 w-4" aria-hidden />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X (Twitter)"
        className={buttonClass}
      >
        <XTwitterIcon className="h-4 w-4" aria-hidden />
      </a>
      <button type="button" onClick={copy} aria-label="Copy link" className={buttonClass}>
        {copied ? (
          <Check className="h-4 w-4 text-accent-600" aria-hidden />
        ) : (
          <Link2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
