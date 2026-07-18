"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  ChevronsRight,
  FilePlus2,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  School,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import type { Session, UserRole } from "@/types/management";
import { logout, useSession } from "@/lib/auth";
import { SaylaniIcon, SaylaniLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/portal/ui";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { href: "/portal/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/admin/campuses", label: "Campuses", icon: Building2 },
    { href: "/portal/admin/students", label: "Students", icon: GraduationCap },
    { href: "/portal/admin/trainers", label: "Trainers", icon: Users },
    { href: "/portal/admin/courses", label: "Courses", icon: School },
    { href: "/portal/admin/classes", label: "Active Classes", icon: CalendarClock },
    { href: "/portal/admin/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/portal/admin/donations", label: "Donations", icon: HandCoins },
    { href: "/portal/admin/payments", label: "Fee Payments", icon: Receipt },
    { href: "/portal/admin/success-stories", label: "Success Stories", icon: Star },
    { href: "/portal/admin/data-entry", label: "Data Entry", icon: FilePlus2 },
    { href: "/portal/admin/assistant", label: "AI Assistant", icon: Sparkles },
  ],
  donor: [{ href: "/portal/donor", label: "Dashboard", icon: LayoutDashboard }],
  trainer: [
    { href: "/portal/trainer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/trainer/assistant", label: "AI Assistant", icon: Sparkles },
  ],
};

const roleHome: Record<UserRole, string> = {
  admin: "/portal/admin",
  donor: "/portal/donor",
  trainer: "/portal/trainer",
};

/** Which role a path section belongs to; used for role-based access control.
 *  null = shared portal page (e.g. /portal/profile), open to every role. */
function requiredRole(pathname: string): UserRole | null {
  if (pathname.startsWith("/portal/admin")) return "admin";
  if (pathname.startsWith("/portal/donor")) return "donor";
  if (pathname.startsWith("/portal/trainer")) return "trainer";
  return null;
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (session === undefined) return; // still hydrating
    if (session === null) {
      router.replace("/auth/login");
      return;
    }
    const needed = requiredRole(pathname);
    if (pathname === "/portal" || (needed && needed !== session.role)) {
      router.replace(roleHome[session.role]);
    }
  }, [session, pathname, router]);

  const needed = requiredRole(pathname);
  // /portal itself always redirects (effect above); role-owned sections wait
  // until the session matches. Shared pages (needed === null) render for any
  // signed-in role — without that carve-out, /portal/profile would sit on
  // this spinner forever.
  if (!session || pathname === "/portal" || (needed !== null && needed !== session.role)) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <p className="animate-pulse text-sm text-ink-muted">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <PortalChrome session={session} menuOpen={menuOpen} setMenuOpen={setMenuOpen}>
      {children}
    </PortalChrome>
  );
}

function PortalChrome({
  session,
  menuOpen,
  setMenuOpen,
  children,
}: {
  session: Session;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const nav = navByRole[session.role];
  // The AI assistant fills the whole viewport instead of sitting in a
  // padded, card-bounded page — everything else keeps the normal page layout.
  const isFullBleed = pathname.endsWith("/assistant");
  // Starts collapsed when the first page IS the assistant (deep link /
  // refresh) — the transition adjustment below only covers in-app navigation.
  const [sidebarOpen, setSidebarOpen] = useState(!isFullBleed);

  // Give the AI Assistant the full width automatically — the user shouldn't
  // have to collapse the sidebar by hand every time they open it. Adjusting
  // state during render (not in an effect) on the isFullBleed transition, per
  // React's "adjusting state when a prop changes" pattern.
  const [wasFullBleed, setWasFullBleed] = useState(isFullBleed);
  if (isFullBleed !== wasFullBleed) {
    setWasFullBleed(isFullBleed);
    if (isFullBleed) setSidebarOpen(false);
  }

  const onLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const navLinks = (
    <nav aria-label="Portal navigation" className="space-y-1">
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          href === roleHome[session.role] ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
              active
                ? "bg-surface text-brand-800 shadow-[0_0_0_1px_rgba(11,115,183,0.14),0_6px_16px_-4px_rgba(11,115,183,0.4)]"
                : "text-brand-900/70 hover:translate-x-0.5 hover:bg-surface/60 hover:text-brand-900",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-accent-500 shadow-[0_0_10px_2px_rgba(109,168,0,0.55)]"
              />
            )}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                active
                  ? "bg-surface text-brand-700 shadow-sm"
                  : "text-current group-hover:bg-surface group-hover:text-brand-600 group-hover:shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="mx-auto flex min-h-svh w-full">
      {/* Desktop sidebar — expanded */}
      {sidebarOpen ? (
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-gradient-to-br from-brand-100 via-brand-50 to-accent-100 px-4 py-6 shadow-[14px_0_36px_-22px_rgba(11,115,183,0.55)] lg:flex">
          <div className="mb-4 space-y-3">
            <div className="flex items-start justify-between gap-2 px-1">
              <Link
                href={roleHome[session.role]}
                aria-label="Saylani Welfare — go to dashboard"
                className="rounded-lg px-1.5 py-1 transition-opacity hover:opacity-80"
              >
                <SaylaniLogo width={148} />
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
                title="Close sidebar"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <p className="px-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">
              {session.role} portal
            </p>
          </div>
          {navLinks}
          <div className="mt-auto space-y-1 border-t border-edge pt-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-muted hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </button>
          </div>
        </aside>
      ) : (
        /* Desktop sidebar — collapsed icon strip */
        <aside className="sticky top-0 hidden h-svh w-14 shrink-0 flex-col items-center bg-gradient-to-br from-brand-100 to-accent-100 py-4 shadow-[14px_0_36px_-22px_rgba(11,115,183,0.55)] lg:flex">
          {/* The strip is too narrow for the wordmark, so the emblem stands in
              for it while the sidebar is collapsed. */}
          <Link
            href={roleHome[session.role]}
            aria-label="Saylani Welfare — go to dashboard"
            className="mb-3 transition-opacity hover:opacity-80"
          >
            <SaylaniIcon size={34} />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            title="Open sidebar"
            className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-accent-300 bg-accent-50 text-accent-700 transition-colors hover:bg-accent-100"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden />
          </button>
          <nav aria-label="Portal navigation" className="flex flex-col items-center gap-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                href === roleHome[session.role] ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                    active
                      ? "bg-gradient-to-br from-brand-solid to-accent-500 text-white shadow-[0_0_14px_2px_rgba(109,168,0,0.45)]"
                      : "text-ink-muted hover:scale-105 hover:bg-surface-muted hover:text-ink-strong",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-1 border-t border-edge pt-3">
            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </aside>
      )}

      <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-gradient-to-r from-brand-100/40 via-transparent via-30% to-transparent">
        {/* Portal topbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-brand-100 bg-gradient-to-r from-brand-50 via-surface to-accent-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close portal menu" : "Open portal menu"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink lg:hidden"
            >
              {menuOpen ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            </button>
            {/* Mobile has no sidebar header, so the topbar carries the mark. */}
            <div className="lg:hidden">
              <SaylaniLogo width={104} />
            </div>
            <p className="hidden text-sm text-ink-muted sm:block">
              Signed in as <span className="font-semibold text-ink-strong">{session.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-accent-800">
              {session.role}
            </span>
            <Link
              href="/portal/profile"
              aria-label="My profile"
              title="My profile"
              className="rounded-full ring-brand-400 ring-offset-2 ring-offset-surface transition-shadow hover:ring-2"
            >
              <Avatar name={session.name} />
            </Link>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <div className="border-b border-brand-100 bg-gradient-to-b from-brand-50 to-accent-50 px-4 py-4 lg:hidden">
            {navLinks}
            <div className="mt-3 border-t border-edge pt-3">
              <button
                type="button"
                onClick={onLogout}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Log out
              </button>
            </div>
          </div>
        )}

        <main className={cn("flex-1", isFullBleed ? "flex min-h-0 flex-col" : "px-5 py-8 sm:px-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}
