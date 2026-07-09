import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import smitLogo from "@/public/smit-app-logo.avif";

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
