/**
 * Public-site data access layer — LIVE Supabase queries with automatic
 * fallback to the bundled mock data when the database is unreachable.
 * Testimonials/team remain static content (not database-worthy yet).
 */
import type { Campaign, Donation, Donor, SiteStats, Testimonial, TeamMember } from "@/types";
import { campaigns as mockCampaigns } from "@/lib/mock-data/campaigns";
import { donations as mockDonations } from "@/lib/mock-data/donations";
import { donors as mockDonors, myDonations as mockMyDonations, type MyDonation } from "@/lib/mock-data/donors";
import { testimonials, team } from "@/lib/mock-data/testimonials";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase";

export type { MyDonation };

/* ── row mappers ───────────────────────────────────────────── */

type Row = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");
const n = (v: unknown) => Number(v ?? 0);

const toCampaign = (r: Row): Campaign => ({
  id: s(r.id), slug: s(r.slug), title: s(r.title), tagline: s(r.tagline),
  description: s(r.description), story: (r.story as string[]) ?? [],
  imageUrl: s(r.image_url), gallery: (r.gallery as string[]) ?? [],
  category: s(r.category) as Campaign["category"], location: s(r.location),
  goalAmount: n(r.goal_amount), raisedAmount: n(r.raised_amount),
  donorCount: n(r.donor_count), currency: s(r.currency),
  status: s(r.status) as Campaign["status"],
  createdAt: s(r.created_at), endsAt: s(r.ends_at),
});

const toDonation = (r: Row): Donation => ({
  id: s(r.id), campaignId: s(r.campaign_id), donorName: s(r.donor_name),
  amount: n(r.amount), currency: s(r.currency),
  isAnonymous: Boolean(r.is_anonymous),
  message: r.message ? s(r.message) : undefined,
  createdAt: s(r.created_at),
});

/** Run a live query, falling back to mock data on any failure. */
async function live<T>(fallback: () => T, query: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured()) return fallback();
  try {
    return await query();
  } catch (error) {
    console.error("[api] falling back to mock:", (error as Error).message);
    return fallback();
  }
}

/* ── campaigns ─────────────────────────────────────────────── */

export interface CampaignFilters {
  category?: string;
  status?: string;
  location?: string;
  query?: string;
}

/** Most recent campaigns for public listings — capped so the explorer stays
 *  fast no matter how large the table grows. */
async function fetchCampaigns(limit = 120): Promise<Campaign[]> {
  return live(
    () => mockCampaigns,
    async () => {
      const { data, error } = await supabaseServer()
        .from("campaigns")
        .select("*")
        // Load-test rows (id prefix "lc-", from npm run load:seed-all) are
        // synthetic filler that all share one placeholder image — they exist
        // to stress-test the backend, not to appear in public listings/slider.
        .not("id", "like", "lc-%")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map(toCampaign);
    },
  );
}

export async function getCampaigns(filters: CampaignFilters = {}): Promise<Campaign[]> {
  const all = await fetchCampaigns();
  const q = filters.query?.trim().toLowerCase();
  return all.filter((c) => {
    if (filters.category && c.category !== filters.category) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (filters.location && c.location !== filters.location) return false;
    if (q && !`${c.title} ${c.tagline} ${c.description} ${c.category} ${c.location}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export async function getCampaign(idOrSlug: string): Promise<Campaign | null> {
  return live(
    () => mockCampaigns.find((c) => c.id === idOrSlug || c.slug === idOrSlug) ?? null,
    async () => {
      const safe = idOrSlug.replace(/[%,()]/g, "");
      const { data, error } = await supabaseServer()
        .from("campaigns")
        .select("*")
        .or(`id.eq.${safe},slug.eq.${safe}`)
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0] ? toCampaign(data[0]) : null;
    },
  );
}

export async function getFeaturedCampaigns(limit = 3): Promise<Campaign[]> {
  const all = await fetchCampaigns();
  const urgent = all.filter((c) => c.status === "urgent");
  const active = all.filter((c) => c.status === "active");
  return [...urgent, ...active].slice(0, limit);
}

export async function getCategories(): Promise<string[]> {
  return [...new Set((await fetchCampaigns()).map((c) => c.category))];
}

export async function getLocations(): Promise<string[]> {
  return [...new Set((await fetchCampaigns()).map((c) => c.location))];
}

/* ── donations ─────────────────────────────────────────────── */

export async function getDonations(campaignId?: string, limit = 100): Promise<Donation[]> {
  return live(
    () => {
      const list = campaignId
        ? mockDonations.filter((d) => d.campaignId === campaignId)
        : mockDonations;
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async () => {
      let query = supabaseServer()
        .from("donations")
        .select("*")
        .is("donor_id", null) // public feed excludes account-linked history rows
        .order("created_at", { ascending: false })
        .limit(limit);
      if (campaignId) query = query.eq("campaign_id", campaignId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(toDonation);
    },
  );
}

export async function getRecentDonations(limit = 8): Promise<Donation[]> {
  return (await getDonations()).slice(0, limit);
}

/* ── stats / misc ──────────────────────────────────────────── */

export async function getSiteStats(): Promise<SiteStats> {
  const all = await fetchCampaigns();
  return {
    totalRaised: all.reduce((sum, c) => sum + c.raisedAmount, 0),
    totalDonors: all.reduce((sum, c) => sum + c.donorCount, 0),
    activeCampaigns: all.filter((c) => c.status !== "completed").length,
    livesImpacted: 148200,
    currency: "PKR",
  };
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return testimonials;
}

export async function getTeam(): Promise<TeamMember[]> {
  return team;
}

/* ── demo signed-in donor (until real auth in Phase 2) ─────── */

export async function getCurrentDonor(): Promise<Donor> {
  return live(
    () => mockDonors[0],
    async () => {
      const { data, error } = await supabaseServer()
        .from("donors")
        .select("*")
        .eq("id", "u1")
        .single();
      if (error) throw new Error(error.message);
      return {
        id: s(data.id), name: s(data.name), email: s(data.email), phone: s(data.phone),
        totalDonated: n(data.total_donated), donationCount: n(data.donation_count),
        memberSince: s(data.member_since),
      };
    },
  );
}

export async function getMyDonations(): Promise<MyDonation[]> {
  return live(
    () => mockMyDonations,
    async () => {
      const [{ data, error }, campaigns] = await Promise.all([
        supabaseServer()
          .from("donations")
          .select("*")
          .eq("donor_id", "u1")
          .order("created_at", { ascending: false }),
        fetchCampaigns(),
      ]);
      if (error) throw new Error(error.message);
      const titleOf = Object.fromEntries(campaigns.map((c) => [c.id, c.title]));
      return (data ?? []).map((r) => ({
        id: s(r.id),
        campaignId: s(r.campaign_id),
        campaignTitle: titleOf[s(r.campaign_id)] ?? "Campaign",
        amount: n(r.amount),
        currency: s(r.currency),
        method: s(r.method ?? "—"),
        status: "completed" as const,
        receiptNo: s(r.receipt_no ?? "—"),
        createdAt: s(r.created_at),
      }));
    },
  );
}
