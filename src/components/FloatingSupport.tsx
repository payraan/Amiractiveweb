"use client";

const SUPPORT = "https://t.me/Amiractive_support";

/** دکمه‌ی شناور پشتیبانی — همیشه یک کلیک فاصله. */
export default function FloatingSupport() {
  return (
    <a
      href={SUPPORT}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="پشتیبانی ۲۴ ساعته در تلگرام"
      className="group fixed bottom-5 start-5 z-40 flex items-center gap-0 overflow-hidden rounded-full border border-gold/30 bg-surface/80 py-3 ps-3 pe-3 backdrop-blur transition-all duration-300 hover:gap-2 hover:border-gold/70 hover:pe-5 hover:shadow-[0_0_28px_rgba(232,196,106,0.18)]"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-gold">
        <path d="M21.9 4.6l-3.1 14.7c-.2 1-.8 1.2-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8L18.2 6.7c.4-.3-.1-.5-.6-.2L6.9 13.3l-4.6-1.4c-1-.3-1-1 .2-1.5L20.6 3.1c.8-.3 1.6.2 1.3 1.5z" />
      </svg>
      <span className="max-w-0 whitespace-nowrap text-xs text-cream opacity-0 transition-all duration-300 group-hover:max-w-[8rem] group-hover:opacity-100">
        پشتیبانی
      </span>
    </a>
  );
}
