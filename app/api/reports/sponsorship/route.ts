import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { getCampuses, getSponsorshipReportData } from "@/lib/management-api";
import { buildSponsorshipReportPdf } from "@/lib/reports/sponsorship-pdf";

/**
 * "Export to sheet" — generates the Sponsorship Impact Report PDF fresh from
 * live data on every request (no storage, no expiring link: it's a direct
 * browser download, always current). Admin-only, same as the dashboard it's
 * exported from.
 */
export async function GET(req: Request) {
  const session = await getSessionUser(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const campusParam = searchParams.get("campus");
  const campusId = !campusParam || campusParam === "all" ? null : campusParam;

  if (campusId) {
    // Validate against the real campus list rather than trusting the query
    // param straight into a database lookup.
    const campuses = await getCampuses();
    if (!campuses.some((c) => c.id === campusId)) {
      return NextResponse.json({ error: "Unknown campus." }, { status: 400 });
    }
  }

  const data = await getSponsorshipReportData(campusId, session.name);
  const pdf = await buildSponsorshipReportPdf(data);

  const slug = data.campusName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
  const filename = `sponsorship-impact-report-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
