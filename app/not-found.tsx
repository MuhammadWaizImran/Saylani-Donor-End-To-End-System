import Link from "next/link";
import { HeartHandshake, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        <SearchX className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-4xl text-ink">Page not found</h1>
      <p className="mt-3 text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved. The campaigns, however, are very much still here.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-accent-950 transition-colors hover:bg-accent-400"
        >
          <HeartHandshake className="h-4 w-4" aria-hidden />
          Browse campaigns
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border-2 border-brand-600 px-6 py-3 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
