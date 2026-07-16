import { redirect } from "next/navigation";

// This app is dashboard-only — there is no public marketing site, so the
// root URL sends visitors straight to the login screen.
export default function RootPage() {
  redirect("/auth/login");
}
