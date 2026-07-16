"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TELEGRAM = "https://t.me/CashflowFactorys";

const links = [
  { href: "#results", label: "نتایج زنده" },
  { href: "#bot", label: "ربات معامله‌گر" },
  { href: "#broker", label: "بروکر" },
  { href: "#academy", label: "آکادمی" },
];

function CandleI() {
  return (
    <svg
      viewBox="0 0 8 22"
      className="mx-[2px] inline-block h-[0.95em] w-auto fill-gold"
      aria-hidden="true"
    >
      <rect x="3.25" y="0" width="1.5" height="22" rx="0.75" />
      <rect x="1" y="6" width="6" height="10" rx="1" />
    </svg>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="relative z-50 flex items-center font-mono text-sm font-bold tracking-[0.3em] text-cream"
          dir="ltr"
        >
          AM
          <CandleI />
          RACTIVE
        </Link>

        <div className="hidden items-center gap-8 text-sm text-muted md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-cream">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg border border-gold/40 px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-ink md:block"
          >
            تلگرام
          </a>

          <button
            type="button"
            aria-label="منو"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="relative z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-ink/60 backdrop-blur md:hidden"
          >
            <span
              className={`absolute h-[1.5px] w-5 bg-cream transition-all duration-300 ${
                open ? "rotate-45" : "-translate-y-[5px]"
              }`}
            />
            <span
              className={`absolute h-[1.5px] w-5 bg-cream transition-all duration-300 ${
                open ? "-rotate-45" : "translate-y-[5px]"
              }`}
            />
          </button>
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-40 bg-ink/95 backdrop-blur-md transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col justify-between px-6 pb-10 pt-28">
          <div className="flex flex-col gap-1">
            {links.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`border-b border-line py-4 font-display text-2xl font-extrabold text-cream transition-all duration-500 ${
                  open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
                style={{ transitionDelay: open ? `${120 + i * 60}ms` : "0ms" }}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <a
            href={TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={`rounded-xl bg-gold py-4 text-center font-display font-extrabold text-ink transition-all duration-500 ${
              open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            style={{ transitionDelay: open ? "360ms" : "0ms" }}
          >
            ورود به کانال تلگرام
          </a>
        </div>
      </div>
    </header>
  );
}
