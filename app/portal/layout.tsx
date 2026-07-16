import type { Metadata } from "next";
import { PortalShell } from "@/components/portal/portal-shell";
import { AutoRefresh } from "@/components/portal/auto-refresh";

export const metadata: Metadata = {
  title: "Portal",
  description: "Saylani donor management portal — dashboards for admins, donors, and trainers.",
  robots: { index: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Keeps every dashboard in sync with the live database — external
          changes (Compass, other users) show up within ~8s, no refresh. */}
      <AutoRefresh />
      <PortalShell>{children}</PortalShell>
    </>
  );
}
