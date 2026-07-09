import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  titleAccent,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  /** Optional trailing part of the title rendered in italic gray, editorial-style. */
  titleAccent?: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-12 max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-4xl leading-[1.02] tracking-[-0.02em] text-ink sm:text-5xl">
        {title}
        {titleAccent && <em className="text-[#6F6F6F]"> {titleAccent}</em>}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-[#6F6F6F]">{description}</p>
      )}
    </div>
  );
}
