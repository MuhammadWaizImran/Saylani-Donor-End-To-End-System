/**
 * Builds the "Sponsorship Impact Report" PDF — the dashboard's "Export to
 * sheet" button. Laid out on standard A4 pages (not the single, ~8-foot-tall
 * page the reference export produced — that shape is a print-to-PDF
 * artifact of whatever tool made it, not something worth reproducing; a
 * normal paginated report is what anyone can actually open and print).
 *
 * Every number in here comes from SponsorshipReportData (live MongoDB
 * queries — see getSponsorshipReportData). Metrics the reference PDF
 * showed that this training system doesn't actually track — jobs secured,
 * salary figures, an employment ratio — are left out entirely rather than
 * rendered as fabricated zeros; Job Placements gets an explicit note
 * instead of a fake empty table.
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import type { SponsorshipReportData } from "@/lib/management-api";

/**
 * pdfkit's built-in "Helvetica" font name triggers it to load a bundled AFM
 * metrics file via a path relative to its own package internals — which
 * breaks under both `next dev` (Turbopack virtualizes that path) and a
 * traced production build (the .afm file isn't in the deploy bundle). Two
 * real embedded TTFs sidestep that lookup entirely — Montserrat, matching
 * the app's own brand font, instanced from Google's variable font at 400/700
 * weight with fonttools (their internal name tables still say "Thin
 * Regular", a cosmetic leftover of that process; the actual outlines are
 * the correct weight).
 */
const FONT_REGULAR = fs.readFileSync(path.join(process.cwd(), "lib/reports/fonts/Montserrat-Regular.ttf"));
const FONT_BOLD = fs.readFileSync(path.join(process.cwd(), "lib/reports/fonts/Montserrat-Bold.ttf"));

const BRAND_BLUE = "#0b73b7";
const BRAND_GREEN = "#558124";
const INK = "#0e1d29";
const INK_MUTED = "#6f6f6f";
const EDGE = "#dde8ef";
const SURFACE_MUTED = "#f3f7fa";
const DOT_RED = "#b91c1c";
const DOT_AMBER = "#b45309";

const PAGE_MARGIN = 48;
const CONTENT_W = 595.28 - PAGE_MARGIN * 2; // A4 width in pt minus margins

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Colour the real enrolment/assessment status labels by what they mean —
 *  a reader shouldn't need a legend to tell "Enrolled" from "Rejected". */
function dotColorFor(label: string): string {
  const l = label.toLowerCase();
  if (["passed", "completed", "approved"].includes(l)) return BRAND_GREEN;
  if (["dropout", "rejected", "blacklisted"].includes(l)) return DOT_RED;
  if (["pending", "unreviewed"].includes(l)) return DOT_AMBER;
  return BRAND_BLUE;
}

function ensureRoom(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) doc.addPage();
}

/** Every helper below draws at least one `.text(str, x, y, …)` call with an
 *  EXPLICIT x — and pdfkit leaves the cursor sitting at that x afterwards,
 *  not back at the page's left margin. A bare `.text(str)` call right after
 *  (no coordinates) then silently inherits that stale x, landing wherever
 *  the last positioned box happened to be — not at the margin. Every
 *  function that goes back to plain flowing text resets `doc.x` first. */
function resetX(doc: PDFKit.PDFDocument) {
  doc.x = doc.page.margins.left;
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  ensureRoom(doc, 50);
  resetX(doc);
  doc.moveDown(0.6);
  doc.font("Heading").fontSize(14).fillColor(INK).text(title);
  doc.font("Body").fontSize(9.5).fillColor(INK_MUTED).text(subtitle);
  doc.moveDown(0.5);
}

/** A stat tile grid — 4 across, matching the reference's rounded cards. */
function statGrid(doc: PDFKit.PDFDocument, tiles: Array<{ label: string; value: string }>) {
  const gap = 10;
  const w = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const h = 56;
  ensureRoom(doc, h + 10);
  const x0 = doc.page.margins.left;
  const y0 = doc.y;
  tiles.forEach((t, i) => {
    const x = x0 + i * (w + gap);
    doc.roundedRect(x, y0, w, h, 6).lineWidth(1).strokeColor(EDGE).stroke();
    doc.font("Heading").fontSize(16).fillColor(INK).text(t.value, x + 10, y0 + 10, { width: w - 20 });
    doc.font("Body").fontSize(8.5).fillColor(INK_MUTED).text(t.label, x + 10, y0 + 34, { width: w - 20 });
  });
  doc.y = y0 + h + 14;
  resetX(doc);
}

/** A dotted status list — "Enrolled  ......  84" style, colour-coded. */
function dotList(doc: PDFKit.PDFDocument, rows: Array<{ label: string; value: number }>) {
  const x0 = doc.page.margins.left;
  for (const row of rows) {
    ensureRoom(doc, 20);
    const y = doc.y;
    doc.circle(x0 + 4, y + 6, 3.5).fill(dotColorFor(row.label));
    doc.font("Body").fontSize(10.5).fillColor(INK).text(row.label, x0 + 16, y, { continued: false });
    doc
      .font("Heading")
      .fontSize(10.5)
      .fillColor(INK)
      .text(row.value.toLocaleString(), x0, y, { width: CONTENT_W, align: "right" });
    doc.moveDown(0.55);
  }
  doc.moveDown(0.3);
  resetX(doc);
}

/** Cuts a cell string down to fit one row's fixed height — long course
 *  names (e.g. a stray "UI/UX Very Long Course…" test record) would
 *  otherwise wrap to a second line and overlap the row below, since every
 *  row here is a fixed 22pt tall. The full name is never lost: it's still
 *  in the dashboard's own table view this PDF is exported from. */
function truncateToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  if (doc.widthOfString(text) <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid).trimEnd() + ellipsis;
    if (doc.widthOfString(candidate) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + ellipsis;
}

/** A simple bordered table with a brand-blue header row — the same shape
 *  the reference export used for every data section. Paginates on its own:
 *  each row checks for room and starts a fresh header on the next page. */
function table(doc: PDFKit.PDFDocument, columns: Array<{ header: string; width: number; align?: "left" | "right" }>, rows: string[][]) {
  const x0 = doc.page.margins.left;
  const rowH = 22;

  function drawHeader() {
    const y = doc.y;
    doc.rect(x0, y, CONTENT_W, rowH).fill(BRAND_BLUE);
    let x = x0;
    for (const col of columns) {
      doc
        .font("Heading")
        .fontSize(9.5)
        .fillColor("#ffffff")
        .text(col.header, x + 8, y + 6.5, { width: col.width - 16, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y = y + rowH;
  }

  ensureRoom(doc, rowH * 2);
  drawHeader();

  rows.forEach((row, i) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(x0, y, CONTENT_W, rowH).fill(SURFACE_MUTED);
    doc.rect(x0, y, CONTENT_W, rowH).lineWidth(0.5).strokeColor(EDGE).stroke();
    let x = x0;
    row.forEach((cell, ci) => {
      const col = columns[ci];
      doc.font("Body").fontSize(9.5);
      const fitted = truncateToWidth(doc, cell, col.width - 16);
      doc
        .fillColor(INK)
        .text(fitted, x + 8, y + 6.5, { width: col.width - 16, align: col.align ?? "left", lineBreak: false, ellipsis: false });
      x += col.width;
    });
    doc.y = y + rowH;
  });
  doc.moveDown(0.6);
  resetX(doc);
}

function emptyNote(doc: PDFKit.PDFDocument, text: string) {
  ensureRoom(doc, 40);
  const y = doc.y;
  doc.roundedRect(doc.page.margins.left, y, CONTENT_W, 32, 4).fillAndStroke(SURFACE_MUTED, EDGE);
  doc.font("Body").fontSize(9.5).fillColor(INK_MUTED).text(text, doc.page.margins.left + 12, y + 10, {
    width: CONTENT_W - 24,
  });
  doc.y = y + 32 + 12;
  resetX(doc);
}

export function buildSponsorshipReportPdf(data: SponsorshipReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // `font: false` stops the constructor from setting its own default —
    // which is the literal string "Helvetica", triggering the broken AFM
    // lookup before we ever get a chance to register our own fonts below.
    // @types/pdfkit types `font` as always a string; `false` is the real,
    // documented way to skip it (pdfkit only treats `undefined` as "use the
    // default"), so the cast below is narrowing a type gap, not lying to it.
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      font: false as unknown as string,
    });
    doc.registerFont("Body", FONT_REGULAR);
    doc.registerFont("Heading", FONT_BOLD);
    doc.font("Body");

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Header ──────────────────────────────────────────────
    try {
      const logoPath = path.join(process.cwd(), "public", "saylani-logo.png");
      const logo = fs.readFileSync(logoPath);
      doc.image(logo, doc.page.width / 2 - 90, doc.y, { width: 180 });
      doc.y += 70;
    } catch {
      // Logo missing shouldn't block the report — fall through without it.
    }

    doc.font("Heading").fontSize(22).fillColor(BRAND_BLUE).text("Sponsorship Impact Report", { align: "center" });
    doc.moveDown(0.8);

    const metaX = doc.page.margins.left;
    const metaRow = (label: string, value: string) => {
      doc.font("Heading").fontSize(10).fillColor(INK).text(`${label}: `, metaX, doc.y, { continued: true });
      doc.font("Body").fillColor(INK).text(value);
    };
    metaRow("Date", formatDate(data.generatedAt));
    metaRow("Generated By", data.generatedBy);
    metaRow("Campus", data.campusName);
    doc.moveDown(0.5);
    doc.moveTo(metaX, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor(EDGE).stroke();

    // ── Key metrics (only the real ones) ───────────────────────
    sectionHeading(doc, "Key Metrics", `A snapshot of ${data.campusName === "All Campuses" ? "every campus" : data.campusName}, read live from the database`);
    statGrid(doc, [
      { label: "Total Students", value: data.totalStudents.toLocaleString() },
      { label: "Active Classes", value: data.activeClasses.toLocaleString() },
      { label: "Courses Running", value: data.coursesRunning.toLocaleString() },
      { label: "Trainers Onboard", value: data.trainersOnboard.toLocaleString() },
    ]);
    doc
      .font("Body")
      .fontSize(8)
      .fillColor(INK_MUTED)
      .text("Job placements, salaries, and an employment ratio are not tracked in the training system, so they're left out here rather than shown as zero.", { width: CONTENT_W });
    doc.moveDown(0.6);

    // ── Enrolment breakdown ─────────────────────────────────
    sectionHeading(doc, "Enrolment Breakdown", "Where every student stands, exactly as recorded");
    dotList(doc, data.enrolmentBreakdown);

    // ── Assessment performance ──────────────────────────────
    sectionHeading(doc, "Assessment Performance", "How assignment submissions are being reviewed");
    dotList(doc, data.assessmentPerformance);

    // ── Course enrolment ─────────────────────────────────────
    sectionHeading(doc, "Course Enrolment", "How many students are enrolled on each course");
    if (data.courseEnrolment.length === 0) {
      emptyNote(doc, "No course enrolments recorded for this campus.");
    } else {
      table(
        doc,
        [
          { header: "Course Name", width: CONTENT_W * 0.72 },
          { header: "Enrolled Students", width: CONTENT_W * 0.28, align: "right" },
        ],
        data.courseEnrolment.map((c) => [c.label, c.value.toLocaleString()]),
      );
    }

    // ── Job placements ───────────────────────────────────────
    sectionHeading(doc, "Job Placements", "Which courses are producing the most employed graduates");
    if (data.jobPlacements.length === 0) {
      emptyNote(doc, "No job placements have been recorded in the training system yet.");
    } else {
      table(
        doc,
        [
          { header: "Course Name", width: CONTENT_W * 0.72 },
          { header: "Employed Students", width: CONTENT_W * 0.28, align: "right" },
        ],
        data.jobPlacements.map((c) => [c.label, c.value.toLocaleString()]),
      );
    }

    // ── Enrolment over time ──────────────────────────────────
    sectionHeading(doc, "Enrolment Over Time", "How enrolments and dropouts have moved, month by month");
    if (data.enrolmentOverTime.length === 0) {
      emptyNote(doc, "No enrolment history recorded for this campus.");
    } else {
      table(
        doc,
        [
          { header: "Month", width: CONTENT_W * 0.4 },
          { header: "Enrolled", width: CONTENT_W * 0.3, align: "right" },
          { header: "Dropouts", width: CONTENT_W * 0.3, align: "right" },
        ],
        data.enrolmentOverTime.map((p) => [p.fullLabel, p.primary.toLocaleString(), p.secondary.toLocaleString()]),
      );
    }

    // ── Employment trend ──────────────────────────────────────
    sectionHeading(doc, "Employment Trend", "Certified students vs. confirmed job placements, month by month");
    if (data.employmentTrend.length === 0) {
      emptyNote(doc, "No certification history recorded for this campus.");
    } else {
      table(
        doc,
        [
          { header: "Month", width: CONTENT_W * 0.4 },
          { header: "Certified", width: CONTENT_W * 0.3, align: "right" },
          { header: "Employed", width: CONTENT_W * 0.3, align: "right" },
        ],
        data.employmentTrend.map((p) => [p.fullLabel, p.primary.toLocaleString(), p.secondary.toLocaleString()]),
      );
    }

    // ── Footer on every page ────────────────────────────────
    // Writing this close to the bottom edge (inside the page's own bottom
    // margin, by design) still trips pdfkit's own overflow check even with
    // an explicit y and `lineBreak: false` — it silently calls addPage()
    // mid-loop, which is what produced extra blank trailing pages. Zeroing
    // the bottom margin for the duration of this one write removes the
    // threshold that check compares against; it's restored right after.
    const range = doc.bufferedPageRange();
    const realBottomMargin = doc.page.margins.bottom;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.page.margins.bottom = 0;
      doc
        .font("Body")
        .fontSize(8)
        .fillColor("#9ca3af")
        .text(`Generated by Saylani Intelligence — SMIT Donations Portal · Page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 30, {
          width: CONTENT_W,
          align: "center",
          lineBreak: false,
        });
      doc.page.margins.bottom = realBottomMargin;
    }

    doc.end();
  });
}
