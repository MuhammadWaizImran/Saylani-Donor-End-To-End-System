"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  CalendarClock,
  ChevronsRight,
  FilePlus2,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Session, UserRole } from "@/types/management";
import { logout, useSession } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
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
    { href: "/portal/admin/jobs", label: "Jobs Secured", icon: Briefcase },
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

/** Which role a path section belongs to; used for role-based access control. */
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

  if (!session || requiredRole(pathname) !== session.role) {
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const nav = navByRole[session.role];

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
                ? "bg-gradient-to-r from-brand-50 to-accent-50/70 text-brand-800 shadow-[0_0_0_1px_rgba(11,115,183,0.14),0_4px_14px_-4px_rgba(11,115,183,0.35)]"
                : "text-[#6F6F6F] hover:translate-x-0.5 hover:bg-surface-muted hover:text-black",
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
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-current group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-sm",
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
    <div className="mx-auto flex min-h-[calc(100svh-72px)] w-full max-w-[1400px]">
      {/* Desktop sidebar — expanded */}
      {sidebarOpen ? (
        <aside className="sticky top-[72px] hidden h-[calc(100svh-72px)] w-64 shrink-0 flex-col border-r border-edge bg-gradient-to-b from-white via-white to-brand-50/30 px-4 py-6 lg:flex">
          <div className="mb-4 flex items-center justify-between px-1">
            <p className="px-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">
              {session.role} portal
            </p>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-edge text-ink-muted transition-colors hover:border-brand-400 hover:text-brand-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {navLinks}
          <div className="mt-auto space-y-1 border-t border-edge pt-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#6F6F6F] hover:bg-surface-muted hover:text-black"
            >
              <Home className="h-4 w-4" aria-hidden />
              Back to website
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#6F6F6F] hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </button>
          </div>
        </aside>
      ) : (
        /* Desktop sidebar — collapsed icon strip */
        <aside className="sticky top-[72px] hidden h-[calc(100svh-72px)] w-14 shrink-0 flex-col items-center border-r border-edge bg-white py-4 lg:flex">
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
                      ? "bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-[0_0_14px_2px_rgba(109,168,0,0.45)]"
                      : "text-[#6F6F6F] hover:scale-105 hover:bg-surface-muted hover:text-black",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-1 border-t border-edge pt-3">
            <Link
              href="/"
              aria-label="Back to website"
              title="Back to website"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#6F6F6F] hover:bg-surface-muted hover:text-black"
            >
              <Home className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#6F6F6F] hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        {/* Portal topbar */}
        <div className="flex items-center justify-between gap-3 border-b border-edge bg-white px-5 py-3.5">
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
            <div className="lg:hidden">
              <Logo size={30} withWordmark={false} />
            </div>
            <p className="hidden text-sm text-[#6F6F6F] sm:block">
              Signed in as <span className="font-semibold text-black">{session.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-800">
              {session.role}
            </span>
            <Avatar name={session.name} />
          </div>
        </div>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <div className="border-b border-edge bg-white px-4 py-4 lg:hidden">
            {navLinks}
            <div className="mt-3 flex items-center gap-2 border-t border-edge pt-3">
              <Link
                href="/"
                className="flex-1 rounded-xl px-3.5 py-2.5 text-center text-sm font-semibold text-[#6F6F6F] hover:bg-surface-muted"
              >
                Back to website
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Log out
              </button>
            </div>
          </div>
        )}

        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
