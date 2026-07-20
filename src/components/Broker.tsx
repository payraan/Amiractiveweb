"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const BROKERS = [
  {
    id: "gtc",
    name: "GTC FX",
    tag: "TRUSTED · REGULATED · GLOBAL",
    logo: "/brokers/gtc.webp",
    href: "https://web.mygtc.app/login/register?ref=AZ6AM62S",
  },
  {
    id: "otet",
    name: "Otet Markets",
    tag: "OTET GROUP LTD",
    logo: "/brokers/otet.png",
    href: "https://my.otetmarkets.com/register?partner=0199aa70-7cb4-7129-a9c0-03f4d56a44f6",
  },
];

function useInView(threshold = 0.15) {
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

export default function Broker() {
  const { ref, inView } = useInView();
  const rv = (extra = "") =>
    `transition-all duration-700 ease-out ${
      inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
    } ${extra}`;

  return (
    <section
      id="broker"
      className="relative mx-auto max-w-6xl scroll-mt-10 px-6 py-24 md:py-28"
    >
      <div ref={ref}>
        <span className={rv("font-mono text-[11px] tracking-[0.4em] text-gold")} dir="ltr">
          BROKERS · IB PARTNERS
        </span>

        <h2
          className={rv("mt-4 font-display text-3xl font-black md:text-4xl")}
          style={{ transitionDelay: "80ms" }}
        >
          بروکر خود را انتخاب کنید
        </h2>

        <p
          className={rv("mt-4 max-w-2xl leading-8 text-muted")}
          style={{ transitionDelay: "160ms" }}
        >
          برای فعال‌سازی ربات با شرایط ویژه، از طریق یکی از بروکرهای معرفی ما
          ثبت‌نام کنید.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {BROKERS.map((b, i) => (
            <a
              key={b.id}
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className={rv("no-zoom group")}
              style={{ transitionDelay: `${240 + i * 100}ms` }}
            >
              <div className="broker-card relative overflow-hidden rounded-2xl border border-line bg-surface/50 p-8 transition-all duration-500 hover:border-gold/50">
                {/* ambient gold sweep on hover */}
                <div className="pointer-events-none absolute -inset-x-10 -top-24 h-40 rotate-12 bg-gradient-to-r from-transparent via-gold/10 to-transparent opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100" />

                {/* index number watermark */}
                <span
                  className="pointer-events-none absolute left-6 top-4 font-mono text-6xl font-black text-line/60"
                  dir="ltr"
                >
                  0{i + 1}
                </span>

                {/* logo on a clean light plate */}
                <div className="relative flex h-28 items-center justify-center rounded-xl bg-cream/95 px-8 shadow-inner transition-transform duration-500 group-hover:scale-[1.02]">
                  <Image
                    src={b.logo}
                    alt={b.name}
                    width={220}
                    height={80}
                    className="max-h-16 w-auto object-contain"
                  />
                </div>

                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <h3 className="font-display text-xl font-extrabold">{b.name}</h3>
                    <span
                      className="mt-1 block font-mono text-[10px] tracking-[0.25em] text-muted"
                      dir="ltr"
                    >
                      {b.tag}
                    </span>
                  </div>

                  <span className="flex items-center gap-2 rounded-xl bg-gold px-5 py-3 font-display text-sm font-extrabold text-ink transition-all duration-300 group-hover:bg-gold-deep group-hover:gap-3">
                    ثبت‌نام
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="h-4 w-4"
                    >
                      <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <p
          className={rv("mt-6 text-center text-[11px] text-muted")}
          style={{ transitionDelay: "480ms" }}
        >
          پس از ثبت‌نام، برای فعال‌سازی ربات با پشتیبانی در تلگرام در تماس باشید.
        </p>
      </div>
    </section>
  );
}
