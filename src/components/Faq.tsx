"use client";

import { useEffect, useRef, useState } from "react";
import { FAQS } from "@/config/site";

const schema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function Faq() {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState(0);

  const rv = (extra = "") =>
    `transition-all duration-700 ease-out ${
      inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    } ${extra}`;

  return (
    <section
      id="faq"
      className="relative mx-auto max-w-4xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div ref={ref}>
        <span className={rv("font-mono text-[11px] tracking-[0.4em] text-gold")} dir="ltr">
          FAQ
        </span>

        <h2
          className={rv("mt-4 font-display text-3xl font-black md:text-4xl")}
          style={{ transitionDelay: "80ms" }}
        >
          پرسش‌های متداول
        </h2>

        <div className="mt-10 flex flex-col gap-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={rv("rounded-2xl border border-line bg-surface/40")}
                style={{ transitionDelay: `${140 + i * 50}ms` }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5"
                >
                  <span
                    className={`text-start text-sm font-bold transition-colors md:text-base ${
                      isOpen ? "text-gold" : "text-cream"
                    }`}
                  >
                    {f.q}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-45 text-gold" : "text-muted"
                    }`}
                  >
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </button>

                <div
                  className="grid transition-[grid-template-rows] duration-500 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-sm leading-8 text-muted">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
