import { Quote } from "lucide-react";
import type { Testimonial } from "@/types";
import { SectionHeading } from "@/components/ui/section-heading";
import { VideoBackground } from "@/components/media/video-background";
import { cn } from "@/lib/utils";

export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <section className="relative overflow-hidden py-24" aria-labelledby="testimonials-heading">
      <VideoBackground
        src="/media/testimonials.mp4"
        overlayClassName="bg-gradient-to-b from-black/70 via-black/55 to-black/70"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Donor stories"
          title="People who give,"
          titleAccent="in their own words"
          className="[&_p]:!text-white/90 [&_h2]:text-white [&_h2_em]:!text-white/70"
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t) => (
            <figure
              key={t.id}
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl backdrop-blur"
            >
              <Quote className="mb-4 h-6 w-6 text-accent-500" aria-hidden />
              <blockquote className="flex-1 text-sm leading-relaxed text-ink">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-edge pt-4">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full font-display text-sm text-white",
                    t.avatarColor,
                  )}
                >
                  {t.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{t.name}</span>
                  <span className="block text-xs text-ink-muted">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
