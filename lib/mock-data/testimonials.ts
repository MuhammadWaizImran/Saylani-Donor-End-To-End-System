import type { Testimonial, TeamMember } from "@/types";

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Hamza Farooq",
    role: "Monthly donor since 2024",
    quote:
      "My sister went through SMIT's bootcamp and now works as a developer. I've seen with my own eyes where the money goes — that's why I give every month without hesitation.",
    avatarColor: "bg-brand-600",
  },
  {
    id: "t2",
    name: "Khadija Noor",
    role: "Orphan program sponsor",
    quote:
      "I sponsor two children through the orphan care program. Every month I get their attendance and grades. It feels less like a donation and more like being part of their family.",
    avatarColor: "bg-accent-600",
  },
  {
    id: "t3",
    name: "Ibrahim Shaikh",
    role: "Funded a water well in Thar",
    quote:
      "I funded a well in my father's memory. Three months later they sent me photos and GPS coordinates of it running in a village of 400 people. Complete transparency, start to finish.",
    avatarColor: "bg-brand-800",
  },
  {
    id: "t4",
    name: "Sana Mirza",
    role: "Overseas donor, UK",
    quote:
      "Giving from abroad always worried me — where does it really end up? Saylani's reporting and reputation made it easy. The receipts and updates arrive like clockwork.",
    avatarColor: "bg-accent-700",
  },
];

export const team: TeamMember[] = [
  {
    id: "m1",
    name: "Muhammad Yousuf",
    role: "Director, Donation Programs",
    bio: "Oversees all giving programs and ensures every rupee is tracked from donor to beneficiary.",
  },
  {
    id: "m2",
    name: "Amina Siddiqui",
    role: "Head of Field Operations",
    bio: "Leads the volunteer network running relief drives, medical camps, and ration distributions nationwide.",
  },
  {
    id: "m3",
    name: "Kashif Mehmood",
    role: "Head of Education Initiatives",
    bio: "A SMIT graduate himself, Kashif now runs the scholarship and student sponsorship programs.",
  },
  {
    id: "m4",
    name: "Nadia Anwar",
    role: "Donor Relations & Transparency",
    bio: "Publishes impact reports and makes sure every donor gets receipts, updates, and answers.",
  },
];
