"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import FloatingSupport from "@/components/FloatingSupport";
import Logo from "@/components/Logo";

const TELEGRAM = "https://t.me/CashflowFactorys";

type Leaf = { href: string; label: string; desc?: string };
type Group = { label: string; children: Leaf[] };
type NavItem = Leaf | Group;

function isGroup(i: NavItem): i is Group {
  return (i as Group).children !== undefined;
}

// ۵ آیتم اصلیِ بالا: چهار موردِ اینجا + «ورود» (دکمه سمت راست). تلگرام CTA است.
// سه بازیِ اصلی مستقیم و بدون زیرمنو می‌آیند تا هویت پلتفرم روی خودِ
// پیش‌بینی بماند. ربات و بروکر و بقیه به «بیشتر» منتقل شده‌اند چون
// محصولات جانبی‌اند، نه پیام اصلی.
const NAV: NavItem[] = [
  { href: "/trade", label: "ترید" },
  { href: "/predict", label: "نبض بازار" },
  { href: "/iran", label: "بازار ایران" },
  {
    label: "بیشتر",
    children: [
      { href: "/challenge", label: "چلنج پراپ", desc: "قوانین و مسیر دریافت حساب" },
      { href: "/bot", label: "ربات معامله‌گر", desc: "اکسپرت اسکلپر متاتریدر ۵" },
      { href: "/results", label: "نتایج زنده", desc: "کارنامه‌ی مستقل در Myfxbook" },
      { href: "/broker", label: "بروکر (کارگزاری)", desc: "بروکر همکار" },
      { href: "/#academy", label: "آکادمی", desc: "مقالات و آموزش" },
      { href: "/referral", label: "دعوت دوستان", desc: "کد دعوت و پاداش کردیتی" },
    ],
  },
];

function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M21.9 4.6l-3.1 14.7c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8L18.2 6.7c.4-.3-.1-.5-.6-.2L6.9 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5L20.6 3.1c.8-.3 1.6.2 1.3 1.5z" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3 w-3 opacity-70 transition-transform duration-200 group-hover:rotate-180"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /** لینک‌های لنگردار (#) حالت فعال ندارند؛ فقط مسیرهای واقعی. */
  const isActive = (href: string) => {
    if (href.startsWith("/#") || href === "/#") return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const groupActive = (g: Group) => g.children.some((c) => isActive(c.href));

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

          {/* منوی دسکتاپ — ۴ آیتم + ورود، زیرمنوها با هاور/فوکوس */}
          <div className="hidden items-center gap-1 text-[13px] text-muted lg:flex">
            {NAV.map((item) =>
              isGroup(item) ? (
                <div key={item.label} className="group relative">
                  <button
                    type="button"
                    className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 transition ${
                      groupActive(item)
                        ? "bg-raised font-bold text-cream shadow-[inset_0_0_0_1px_rgba(232,196,106,0.28)]"
                        : "hover:text-cream"
                    }`}
                    aria-haspopup="true"
                  >
                    {item.label}
                    <Chevron />
                  </button>

                  <div className="invisible absolute start-1/2 top-full z-50 -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 rtl:translate-x-1/2">
                    <div className="min-w-[248px] rounded-2xl border border-line bg-ink/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          className="block rounded-xl px-3 py-2.5 transition hover:bg-raised"
                        >
                          <span
                            className={`block text-[13px] font-bold ${
                              isActive(c.href) ? "text-gold" : "text-cream"
                            }`}
                          >
                            {c.label}
                          </span>
                          {c.desc && (
                            <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                              {c.desc}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${
                    isActive(item.href)
                      ? "bg-raised font-bold text-cream shadow-[inset_0_0_0_1px_rgba(232,196,106,0.28)]"
                      : "hover:text-cream"
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          {/* سمت راست: ورود + تلگرام (دسکتاپ) و دکمه‌ی منو (موبایل) */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={`hidden rounded-full px-4 py-2 text-sm transition lg:block ${
                isActive("/login")
                  ? "bg-raised font-bold text-cream"
                  : "text-muted hover:text-cream"
              }`}
            >
              ورود
            </Link>

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

        {/* منوی موبایل — گروه‌ها به‌صورت بخش‌های عنوان‌دار */}
        <div
          className={`fixed inset-0 z-30 overflow-y-auto bg-ink/95 backdrop-blur-md transition-opacity duration-300 lg:hidden ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex min-h-full flex-col justify-between px-6 pb-10 pt-28">
            <div className="flex flex-col gap-6">
              {NAV.map((item, gi) =>
                isGroup(item) ? (
                  <div
                    key={item.label}
                    className={`transition-all duration-500 ${
                      open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    }`}
                    style={{ transitionDelay: open ? `${120 + gi * 60}ms` : "0ms" }}
                  >
                    <span className="mb-1 block font-mono text-[11px] uppercase tracking-widest text-muted">
                      {item.label}
                    </span>
                    <div className="flex flex-col">
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className={`border-b border-line py-3.5 font-display text-xl font-extrabold ${
                            isActive(c.href) ? "text-gold" : "text-cream"
                          }`}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`border-b border-line py-3.5 font-display text-2xl font-extrabold transition-all duration-500 ${
                      isActive(item.href) ? "text-gold" : "text-cream"
                    } ${open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
                    style={{ transitionDelay: open ? `${120 + gi * 60}ms` : "0ms" }}
                  >
                    {item.label}
                  </Link>
                )
              )}

              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={`border-b border-line py-3.5 font-display text-2xl font-extrabold transition-all duration-500 ${
                  isActive("/login") ? "text-gold" : "text-cream"
                } ${open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
                style={{ transitionDelay: open ? "360ms" : "0ms" }}
              >
                ورود
              </Link>
            </div>

            <a
              href={TELEGRAM}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={`mt-8 flex items-center justify-center gap-2 rounded-xl bg-gold py-4 font-display font-extrabold text-ink transition-all duration-500 ${
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
              style={{ transitionDelay: open ? "420ms" : "0ms" }}
            >
              <TgIcon />
              ورود به کانال تلگرام
            </a>
          </div>
        </div>
      </header>

      <FloatingSupport />
    </>
  );
}
