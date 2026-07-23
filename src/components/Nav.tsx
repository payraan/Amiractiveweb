"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FloatingSupport from "@/components/FloatingSupport";
import Logo from "@/components/Logo";

const TELEGRAM = "https://t.me/CashflowFactorys";

const links: { href: string; label: string; muted?: boolean }[] = [
  { href: "/trade", label: "ترید" },
  { href: "/arena", label: "پیش‌بینی" },
  { href: "/predict", label: "نبض بازار" },
  { href: "/combos", label: "کمبو" },
  { href: "/#bot", label: "ربات معامله‌گر" },
  { href: "/#results", label: "نتایج زنده" },
  { href: "/#broker", label: "بروکر" },
  { href: "/#academy", label: "آکادمی", muted: true },
  { href: "/referral", label: "دعوت دوستان", muted: true },
  { href: "/login", label: "ورود", muted: true },
];


function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M21.9 4.6l-3.1 14.7c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8L18.2 6.7c.4-.3-.1-.5-.6-.2L6.9 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5L20.6 3.1c.8-.3 1.6.2 1.3 1.5z" />
    </svg>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /** لینک‌های لنگردار (#) حالت فعال ندارند؛ فقط مسیرهای واقعی. */
  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 md:px-5 md:pt-4">
      <nav className="relative z-50 mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-line bg-ink/70 px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <Link
          href="/"
          className="relative z-50 flex items-center font-mono text-sm font-bold tracking-[0.3em] text-cream"
          dir="ltr"
          aria-label="NARMOON"
        >
          <Logo className="h-7 w-auto" />
          <span className="ms-2.5">NARMOON</span>
        </Link>

        <div className="hidden items-center gap-1 text-[13px] text-muted lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${
                isActive(l.href)
                  ? "bg-raised font-bold text-cream shadow-[inset_0_0_0_1px_rgba(232,196,106,0.28)]"
                  : `hover:text-cream ${l.muted ? "text-muted/70" : ""}`
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-lg border border-gold/40 px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-ink lg:flex"
          >
            <TgIcon />
            تلگرام
          </a>

          <button
            type="button"
            aria-label="منو"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="relative z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-ink/60 backdrop-blur lg:hidden"
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
        className={`fixed inset-0 z-30 bg-ink/95 backdrop-blur-md transition-opacity duration-300 lg:hidden ${
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
                className={`border-b border-line py-4 font-display text-2xl font-extrabold transition-all duration-500 ${
                  isActive(l.href) ? "text-gold" : "text-cream"
                } ${open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
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
            className={`flex items-center justify-center gap-2 rounded-xl bg-gold py-4 font-display font-extrabold text-ink transition-all duration-500 ${
              open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            style={{ transitionDelay: open ? "360ms" : "0ms" }}
          >
            <TgIcon />
            ورود به کانال تلگرام
          </a>
        </div>
      </div>
    </header>

    {/* پشتیبانی در تمام صفحات — نو روی همه‌ی صفحات رندر می‌شود */}
    <FloatingSupport />
    </>
  );
}
