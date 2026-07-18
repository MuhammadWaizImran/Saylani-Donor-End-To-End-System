import { BadgeCheck, Building2, CalendarDays, Mail, Phone, School, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth-server";
import { getMyProfile } from "@/lib/management-api";
import { Avatar, Pill, PortalHeading } from "@/components/portal/ui";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

/** One labelled row of the profile card — omitted entirely when the account
 *  document doesn't record the value, rather than showing a placeholder. */
function ProfileRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 py-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        <div className="mt-0.5 text-sm font-semibold text-ink">{children}</div>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await requireRole(["admin", "trainer", "donor"]);
  const profile = await getMyProfile(session);

  const joined = profile.joinedAt
    ? new Date(profile.joinedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <PortalHeading
        title="My"
        accent="profile"
        description="Your account, exactly as it's stored in the system."
      />

      <div className="mx-auto max-w-2xl">
        <section className="portal-glow overflow-hidden rounded-2xl border border-edge bg-surface">
          {/* Identity band */}
          <div className="flex flex-wrap items-center gap-4 border-b border-edge bg-gradient-to-r from-brand-50 via-surface to-accent-50 px-6 py-6">
            <Avatar name={profile.name} className="h-16 w-16 text-xl" />
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl text-ink-strong">{profile.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Pill tone="green">
                  <span className="uppercase tracking-wider">{profile.role}</span>
                </Pill>
                {profile.isTestAccount && <Pill tone="amber">Test account</Pill>}
              </div>
            </div>
          </div>

          <div className="divide-y divide-edge px-6 py-2">
            <ProfileRow icon={Mail} label="Email">
              {profile.email}
            </ProfileRow>
            {profile.phone && (
              <ProfileRow icon={Phone} label="Phone">
                {profile.phone}
              </ProfileRow>
            )}
            {profile.sourceRole && (
              <ProfileRow icon={BadgeCheck} label="System role">
                <span className="capitalize">{profile.sourceRole.replace(/_/g, " ")}</span>
              </ProfileRow>
            )}
            {profile.employeeId && (
              <ProfileRow icon={BadgeCheck} label="Employee ID">
                {profile.employeeId}
              </ProfileRow>
            )}
            {profile.campusName && (
              <ProfileRow icon={Building2} label="Campus">
                {profile.campusName}
              </ProfileRow>
            )}
            {profile.hourlyRate != null && (
              <ProfileRow icon={Wallet} label="Hourly rate">
                {formatCurrency(profile.hourlyRate)} / hour
              </ProfileRow>
            )}
            {profile.courseNames && profile.courseNames.length > 0 && (
              <ProfileRow icon={School} label="Courses taught">
                <ul className="flex flex-wrap gap-1.5">
                  {profile.courseNames.map((c) => (
                    <li
                      key={c}
                      className="rounded-full border border-edge bg-surface-muted px-2.5 py-0.5 text-xs font-semibold"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </ProfileRow>
            )}
            {joined && (
              <ProfileRow icon={CalendarDays} label="Account created">
                {joined}
              </ProfileRow>
            )}
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Something look wrong? Account details are managed by the Saylani admin team.
        </p>
      </div>
    </>
  );
}
