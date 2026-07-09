export type CampaignStatus = "active" | "completed" | "urgent";

export type CampaignCategory =
  | "Education"
  | "Healthcare"
  | "Food Relief"
  | "Clean Water"
  | "Emergency"
  | "Orphan Care";

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  story: string[];
  imageUrl: string;
  gallery: string[];
  category: CampaignCategory;
  location: string;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  currency: string;
  status: CampaignStatus;
  createdAt: string;
  endsAt: string;
}

export interface Donation {
  id: string;
  campaignId: string;
  donorName: string;
  amount: number;
  currency: string;
  isAnonymous: boolean;
  message?: string;
  createdAt: string;
}

export interface Donor {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalDonated: number;
  donationCount: number;
  memberSince: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatarColor: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
}

export interface SiteStats {
  totalRaised: number;
  totalDonors: number;
  activeCampaigns: number;
  livesImpacted: number;
  currency: string;
}

export type PaymentMethodId = "jazzcash" | "easypaisa" | "bank" | "card";

export interface DonationDraft {
  campaignId: string | null;
  amount: number;
  donorName: string;
  email: string;
  phone: string;
  isAnonymous: boolean;
  paymentMethod: PaymentMethodId | null;
}
