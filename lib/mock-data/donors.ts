import type { Donor } from "@/types";

export const donors: Donor[] = [
  {
    id: "u1",
    name: "Ahmed Raza",
    email: "ahmed.raza@example.com",
    phone: "+92 300 1234567",
    totalDonated: 87500,
    donationCount: 9,
    memberSince: "2025-02-11T00:00:00Z",
  },
  {
    id: "u2",
    name: "Fatima Zahra",
    email: "fatima.z@example.com",
    phone: "+92 321 9876543",
    totalDonated: 152000,
    donationCount: 14,
    memberSince: "2024-08-03T00:00:00Z",
  },
  {
    id: "u3",
    name: "Ibrahim Shaikh",
    email: "ibrahim.shaikh@example.com",
    phone: "+92 333 5551234",
    totalDonated: 690000,
    donationCount: 6,
    memberSince: "2024-11-19T00:00:00Z",
  },
];

/** Donation history for the mock signed-in donor (u1) shown on the dashboard. */
export const myDonations = [
  { id: "md1", campaignId: "c2", campaignTitle: "Emergency Flood Relief — Interior Sindh", amount: 15000, currency: "PKR", method: "JazzCash", status: "completed" as const, receiptNo: "SMIT-2026-018342", createdAt: "2026-07-04T10:12:00Z" },
  { id: "md2", campaignId: "c4", campaignTitle: "Daily Dastarkhwan: 10,000 Meals a Day", amount: 6000, currency: "PKR", method: "Easypaisa", status: "completed" as const, receiptNo: "SMIT-2026-017903", createdAt: "2026-06-21T14:45:00Z" },
  { id: "md3", campaignId: "c1", campaignTitle: "Sponsor a Software Engineering Student", amount: 25000, currency: "PKR", method: "Bank Transfer", status: "completed" as const, receiptNo: "SMIT-2026-016488", createdAt: "2026-05-30T09:30:00Z" },
  { id: "md4", campaignId: "c9", campaignTitle: "Dialysis Support Fund", amount: 3500, currency: "PKR", method: "Card", status: "completed" as const, receiptNo: "SMIT-2026-015119", createdAt: "2026-05-02T19:20:00Z" },
  { id: "md5", campaignId: "c3", campaignTitle: "Clean Water Wells in Tharparkar", amount: 10000, currency: "PKR", method: "JazzCash", status: "completed" as const, receiptNo: "SMIT-2026-013754", createdAt: "2026-04-11T08:05:00Z" },
  { id: "md6", campaignId: "c8", campaignTitle: "Monthly Ration Drive for Widows & Elderly", amount: 7500, currency: "PKR", method: "Easypaisa", status: "completed" as const, receiptNo: "SMIT-2026-012201", createdAt: "2026-03-18T17:55:00Z" },
  { id: "md7", campaignId: "c6", campaignTitle: "Orphan Education & Care Program", amount: 8000, currency: "PKR", method: "Bank Transfer", status: "completed" as const, receiptNo: "SMIT-2026-010937", createdAt: "2026-02-25T12:10:00Z" },
  { id: "md8", campaignId: "c4", campaignTitle: "Daily Dastarkhwan: 10,000 Meals a Day", amount: 2500, currency: "PKR", method: "JazzCash", status: "completed" as const, receiptNo: "SMIT-2026-009412", createdAt: "2026-01-29T11:00:00Z" },
  { id: "md9", campaignId: "c5", campaignTitle: "Free Medical Camps & Diagnostics", amount: 10000, currency: "PKR", method: "Card", status: "completed" as const, receiptNo: "SMIT-2026-008230", createdAt: "2026-01-05T15:40:00Z" },
];

export type MyDonation = (typeof myDonations)[number];
