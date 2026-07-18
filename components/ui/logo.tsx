import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import smitLogo from "@/public/smit-app-logo.avif";
import saylaniLogo from "@/public/saylani-logo.png";
import saylaniIcon from "@/public/saylani-icon.png";

/** Intrinsic size of the Saylani artwork — height is derived from the width
 *  so the mark can never be stretched. */
const SAYLANI_RATIO = 114 / 419;

/**
 * Saylani Welfare International Trust's own mark — the organization this
 * portal belongs to. The wordmark is part of the artwork, so it never gets
 * text set beside it.
 */
export function SaylaniLogo({ className, width = 200 }: { className?: string; width?: number }) {
  return (
    <Image
      src={saylaniLogo}
      alt="Saylani Welfare International Trust"
      width={width}
      height={Math.round(width * SAYLANI_RATIO)}
      className={cn("object-contain", className)}
      priority
    />
  );
}

/**
 * The square Saylani emblem, for places too narrow for the full wordmark —
 * chiefly the collapsed sidebar strip.
 */
export function SaylaniIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <Image
      src={saylaniIcon}
      alt="Saylani Welfare International Trust"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      priority
    />
  );
}

export function Logo({
  className,
  size = 40,
  withWordmark = true,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="SMIT Donations — home"
      className={cn("flex items-center gap-2.5", className)}
    >
      <Image
        src={smitLogo}
        alt="SMIT — Saylani Mass IT Training logo"
        width={size}
        height={size}
        className="rounded-lg object-contain"
        priority
      />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-2xl tracking-tight text-brand-700">
            SMIT<span className="align-super text-xs text-accent-600">®</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Donations
          </span>
        </span>
      )}
    </Link>
  );
}
