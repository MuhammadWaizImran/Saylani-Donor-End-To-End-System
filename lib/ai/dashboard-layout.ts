export const defaultChartIds = [
  "builtin:enrolment",
  "builtin:assessment",
  "builtin:courses",
  "builtin:enrolment-trend",
  "builtin:employment",
  "builtin:placements",
];
export type LayoutChange = {
  id: string;
  action: "pin" | "move" | "remove";
  target?: string;
  placement?: "before" | "replace";
};

/** Moving removes the source first; replacing also removes the destination. */
export function changeLayout(items: string[], change: LayoutChange) {
  const { id, action, target, placement } = change;
  if (action === "remove") return items.filter((item) => item !== id);
  if (id === target) return items;
  if (target && !items.includes(target))
    throw new Error("Destination changed. Please try again.");
  const next = items.filter((item) => item !== id);
  const index = target ? next.indexOf(target) : next.length;
  next.splice(index, target && placement === "replace" ? 1 : 0, id);
  if (next.length > 100)
    throw new Error("Please remove a chart before adding another.");
  return next;
}
