import Link from "next/link";

const SUPPORT = "https://t.me/Amiractive_support";
const CHANNEL = "https://t.me/CashflowFactorys";
const INSTAGRAM = "https://www.instagram.com/amiractive";
const X_URL = "https://x.com/amiractive4";
const YOUTUBE = "https://www.youtube.com/@amiractivee";

const QUICK: { href: string; label: string }[] = [
  { href: "/trade", label: "ترید" },
  { href: "/arena", label: "پیش‌بینی" },
  { href: "/predict", label: "نبض بازار" },
  { href: "/combos", label: "کمبو" },
  { href: "/#bot", label: "ربات معامله‌گر" },
  { href: "/#results", label: "نتایج زنده" },
  { href: "/#broker", label: "بروکر" },
  { href: "/referral", label: "دعوت دوستان" },
];

const LEGAL: { href: string; label: string }[] = [
  { href: "/#terms", label: "قوانین و مقررات" },
  { href: "/#terms", label: "افشای ریسک" },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-line bg-surface/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <span className="font-display text-lg font-black tracking-wide" dir="ltr">
            NARM<span className="text-gold">O</span>ON
          </span>
          <p className="mt-3 text-xs leading-6 text-muted">
            بازار پیش‌بینی فارسی: روی رویدادهای واقعی جهان پیش‌بینی کنید، بر
            اساس مهارت امتیاز بگیرید و حساب پراپ بگیرید.
          </p>
          <a
            href={CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-xl bg-gold px-5 py-2.5 font-display text-sm font-extrabold text-ink transition hover:bg-gold-deep"
          >
            عضویت در کانال تلگرام
          </a>
        </div>

        <div>
          <h3 className="text-sm font-bold">دسترسی سریع</h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            {QUICK.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-xs text-muted transition hover:text-gold"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">قوانین و پشتیبانی</h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            {LEGAL.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-xs text-muted transition hover:text-gold"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={SUPPORT}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted transition hover:text-gold"
              >
                پشتیبانی ۲۴ ساعته
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">شبکه‌های اجتماعی</h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <a href={CHANNEL} target="_blank" rel="noopener noreferrer" className="text-xs text-muted transition hover:text-gold">
                گروه تلگرام
              </a>
            </li>
            <li>
              <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="text-xs text-muted transition hover:text-gold">
                اینستاگرام
              </a>
            </li>
            <li>
              <a href={YOUTUBE} target="_blank" rel="noopener noreferrer" className="text-xs text-muted transition hover:text-gold">
                یوتیوب
              </a>
            </li>
            <li>
              <a href={X_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-muted transition hover:text-gold" dir="ltr">
                X / توییتر
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-[10px] leading-5 text-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} نارمون — همه‌ی حقوق محفوظ است.</span>
          <span>
            معامله در بازارهای مالی ریسک بالایی دارد؛ پیش از هر تصمیم،{" "}
            <Link href="/#terms" className="text-gold transition hover:text-gold-deep">
              افشای ریسک
            </Link>{" "}
            را بخوانید.
          </span>
        </div>
      </div>
    </footer>
  );
}
