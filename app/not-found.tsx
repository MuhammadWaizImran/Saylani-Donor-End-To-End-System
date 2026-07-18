import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <SearchX className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-4xl text-ink">Page not found</h1>
      <p className="mt-3 text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 rounded-full bg-brand-solid px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-solid-deep"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
