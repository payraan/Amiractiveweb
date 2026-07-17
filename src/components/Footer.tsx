import Link from "next/link";
import type { ReactNode } from "react";
import { LINKS, SOCIALS } from "@/config/site";

const ICONS: Record<string, ReactNode> = {
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M21.9 4.6l-3.1 14.7c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8L18.2 6.7c.4-.3-.1-.5-.6-.2L6.9 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5L20.6 3.1c.8-.3 1.6.2 1.3 1.5z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L2.2 3h6.4l4.4 5.9L17.5 3zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10 9.2l5 2.8-5 2.8V9.2z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const QUICK_LINKS = [
  { href: "#results", label: "نتایج زنده" },
  { href: "#bot", label: "ربات معامله‌گر" },
  { href: "#broker", label: "بروکر" },
  { href: "#academy", label: "آکادمی" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <span
            className="font-mono text-sm font-bold tracking-[0.3em] text-cream"
            dir="ltr"
          >
            AM<span className="text-gold">I</span>RACTIVE
          </span>
          <p className="mt-4 text-xs leading-6 text-muted">
            امیراکتیو از ۲۰۱۷ در بازارهای مالی فعال است؛ با یک اصل ساده:
            به‌جای وعده، اثبات زنده.
          </p>
          <div className="mt-5 flex items-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition hover:border-gold hover:text-gold"
              >
                {ICONS[s.id]}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold">دسترسی سریع</h3>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-muted">
            {QUICK_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition hover:text-cream">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">قوانین</h3>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-muted">
            <li>
              <Link href="#" className="transition hover:text-cream">
                قوانین و مقررات
              </Link>
            </li>
            <li>
              <Link href="#" className="transition hover:text-cream">
                افشای ریسک
              </Link>
            </li>
            <li>
              <Link href="#faq" className="transition hover:text-cream">
                پرسش‌های متداول
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">در ارتباط باشید</h3>
          <p className="mt-4 text-xs leading-6 text-muted">
            تحلیل‌ها و نتایج، اول از همه در کانال تلگرام منتشر می‌شود.
          </p>
          <a
            href={LINKS.telegramChannel}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block rounded-xl bg-gold py-3 text-center font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
          >
            عضویت در کانال تلگرام
          </a>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-center text-[11px] text-muted md:flex-row md:text-start">
          <span>© ۲۰۲۶ امیراکتیو — تمام حقوق محفوظ است.</span>
          <span>
            معامله در بازارهای مالی با ریسک همراه است؛ عملکرد گذشته
            تضمین‌کننده‌ی نتایج آینده نیست.
          </span>
        </div>
      </div>
    </footer>
  );
}
