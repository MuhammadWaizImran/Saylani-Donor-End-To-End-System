/**
 * Chart palette — shared by server components (which pass colours as props)
 * and the client chart components that draw with them.
 *
 * Deliberately NOT inside a "use client" module: every export of a client
 * module becomes a client reference, so a server component importing these
 * would receive `undefined` and the marks would render colourless.
 *
 * Every export is a `var()` reference so the SVG marks re-skin when the user
 * switches theme — the actual hexes live in globals.css (:root and .dark).
 *
 * Every pair here was run through the data-viz palette checker (CVD,
 * normal-vision floor, lightness band, chroma, contrast) against its own
 * surface:
 *   line/column pair   light  #0b73b7 + #558124            on #ffffff  — all pass
 *                       dark   #2e8ac9 + #6da800            on #101c28 — all pass
 *   enrolment donut     light  #8cc544 + #0b73b7 + #b91c1c  on #ffffff  — all pass
 *                       dark   #6da800 + #2e8ac9 + #dc2626  on #101c28  — all pass
 *   trend green+red     light  #60c92c + #ff6163            on #ffffff — CVD ΔE 5.5 (below
 *                       dark   #4caf1f + #e33d40            on #101c28 —  the 6 floor; these
 *     exact hues came from a user-supplied reference image and are used deliberately
 *     despite the fail — legal per the checker's own exception because Enrolment Over
 *     Time already carries secondary encoding (a text legend + full data table).
 * Re-run the checker before changing any value in globals.css.
 */

/** Categorical slot 1 — brand blue. Also the single hue for one-series charts. */
export const SERIES_1 = "var(--chart-series-1)";
/** Categorical slot 2 — accent green. */
export const SERIES_2 = "var(--chart-series-2)";

/** Fixed slot order — assign in sequence, never cycle. */
export const CHART_SERIES = [SERIES_1, SERIES_2] as const;

/** Chart chrome, following the app's theme tokens. */
export const CHART_GRID = "var(--chart-grid)";
export const CHART_AXIS_INK = "var(--chart-axis-ink)";
export const CHART_SURFACE = "var(--chart-surface)";

/** The enrolment donut's 3 fixed slots — assign by meaning, not order. */
export const DONUT_ENROLLED = "var(--chart-donut-enrolled)";
export const DONUT_CERTIFIED = "var(--chart-donut-certified)";
export const DONUT_DROPOUT = "var(--chart-donut-dropout)";

/** Same validated 3-slot triple, generic names — reused by any other
 *  3-category status chart (e.g. Assessment Performance's Approved / Rejected
 *  / Unreviewed). The underlying CSS vars are colour tokens, not specific to
 *  enrolments; re-running the validator for a second "green+red+amber" combo
 *  kept failing the dark-mode CVD check, so this reuses the one that passes. */
export const DONUT_GREEN = DONUT_ENROLLED;
export const DONUT_BLUE = DONUT_CERTIFIED;
export const DONUT_RED = DONUT_DROPOUT;

/** A brighter, more saturated blue than SERIES_1 — matches a user-supplied
 *  reference exactly (sampled pixel-for-pixel). Used only for Course
 *  Enrolment's bars, deliberately distinct from the rest of the dashboard's
 *  brand blue. Passes on its own on both surfaces (a single hue never fails
 *  CVD — nothing to confuse it with). */
export const BRIGHT_BLUE = "var(--chart-bright-blue)";

/** Enrolment Over Time's dedicated green/red pair — see the file header for
 *  the CVD-floor tradeoff this deliberately accepts. */
export const TREND_GREEN = "var(--chart-trend-green)";
export const TREND_RED = "var(--chart-trend-red)";
