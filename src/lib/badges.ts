// نشان‌های نارمون.
//
// این فایل عمدا هیچ وابستگی سمت‌سروری ندارد تا هم API و هم کامپوننت کلاینت
// از یک تعریف واحد بخوانند و شرط‌ها هرگز از هم جدا نیفتند.
//
// دو قاعده که رعایت شده‌اند:
//  ۱. هر نشان باید از داده‌ی واقعی موجود قابل سنجش باشد. نشانی که معیارش را
//     نمی‌توانیم بسنجیم ساخته نمی‌شود.
//  ۲. هیچ نشانی با پول به دست نمی‌آید. خرید MOON نشان نمی‌آورد — همان اصلی
//     که کل امتیازدهی پلتفرم رویش بنا شده.

export type Tier = "bronze" | "silver" | "gold" | "legend";

export type BadgeDef = {
  id: string;
  icon: string;
  label: string;
  desc: string;
  tier: Tier;
  /** آیا کسب شده؟ */
  earned: (s: BadgeStats) => boolean;
  /** پیشرفت بر حسب درصد (۰ تا ۱۰۰) — برای نشان‌های شمارشی. اگر ندهی فقط باز/بسته است. */
  progress?: (s: BadgeStats) => number;
};

/** همان اعدادی که پنل کاربری از سرور می‌گیرد. */
export type BadgeStats = {
  totalPreds: number;
  accuracy: number | null;
  activeDays: number;
  streak: number;
  points: number;
  percentile: number;
  deposited: number;
  irWon: number;
  irLost: number;
  irNet: number;
  irStaked: number;
  marketsCreated: number;
  challengesPassed: number;
  telegramLinked: boolean;
};

export const TIER_STYLE: Record<Tier, { ring: string; text: string; label: string }> = {
  bronze: { ring: "border-[#a1703a]/50 bg-[#a1703a]/10", text: "text-[#c98f4e]", label: "برنزی" },
  silver: { ring: "border-[#9aa4b2]/50 bg-[#9aa4b2]/10", text: "text-[#b9c2ce]", label: "نقره‌ای" },
  gold: { ring: "border-gold/50 bg-gold/10", text: "text-gold", label: "طلایی" },
  legend: { ring: "border-[#a855f7]/50 bg-[#a855f7]/10", text: "text-[#c78bff]", label: "افسانه‌ای" },
};

const pct = (v: number, target: number) => (target <= 0 ? 0 : (v / target) * 100);

export const BADGES: BadgeDef[] = [
  // ── شروع ──
  {
    id: "first",
    icon: "🎯",
    label: "اولین قدم",
    desc: "اولین پیش‌بینی‌ات را ثبت کردی",
    tier: "bronze",
    earned: (s) => s.totalPreds >= 1,
  },
  {
    id: "funded",
    icon: "💧",
    label: "کیف پول فعال",
    desc: "اولین واریز تتر",
    tier: "bronze",
    earned: (s) => s.deposited > 0,
  },
  {
    id: "linked",
    icon: "🔗",
    label: "حساب تأییدشده",
    desc: "تلگرامت را وصل کردی",
    tier: "bronze",
    earned: (s) => s.telegramLinked,
  },

  // ── پشتکار ──
  {
    id: "ten",
    icon: "📈",
    label: "ده‌تایی",
    desc: "۱۰ پیش‌بینی ثبت‌شده",
    tier: "bronze",
    earned: (s) => s.totalPreds >= 10,
    progress: (s) => pct(s.totalPreds, 10),
  },
  {
    id: "hundred",
    icon: "🏛️",
    label: "صدتایی",
    desc: "۱۰۰ پیش‌بینی ثبت‌شده",
    tier: "silver",
    earned: (s) => s.totalPreds >= 100,
    progress: (s) => pct(s.totalPreds, 100),
  },
  {
    id: "thousand",
    icon: "🌋",
    label: "هزارتایی",
    desc: "۱۰۰۰ پیش‌بینی ثبت‌شده",
    tier: "legend",
    earned: (s) => s.totalPreds >= 1000,
    progress: (s) => pct(s.totalPreds, 1000),
  },
  {
    id: "week",
    icon: "🔥",
    label: "هفت روز پیاپی",
    desc: "استریک ۷ روزه",
    tier: "bronze",
    earned: (s) => s.streak >= 7,
    progress: (s) => pct(s.streak, 7),
  },
  {
    id: "month",
    icon: "☄️",
    label: "سی روز پیاپی",
    desc: "استریک ۳۰ روزه بدون وقفه",
    tier: "gold",
    earned: (s) => s.streak >= 30,
    progress: (s) => pct(s.streak, 30),
  },
  {
    id: "regular",
    icon: "🗓️",
    label: "همیشه حاضر",
    desc: "۵۰ روز فعال",
    tier: "silver",
    earned: (s) => s.activeDays >= 50,
    progress: (s) => pct(s.activeDays, 50),
  },

  // ── دقت ──
  {
    id: "sharp",
    icon: "🎪",
    label: "تیزبین",
    desc: "دقت بالای ۶۰٪ با حداقل ۳۰ پیش‌بینی",
    tier: "silver",
    earned: (s) => s.totalPreds >= 30 && (s.accuracy ?? 0) >= 60,
  },
  {
    id: "oracle",
    icon: "🔮",
    label: "پیشگو",
    desc: "دقت بالای ۷۰٪ با حداقل ۱۰۰ پیش‌بینی",
    tier: "gold",
    earned: (s) => s.totalPreds >= 100 && (s.accuracy ?? 0) >= 70,
  },
  {
    id: "mind",
    icon: "🧠",
    label: "هوش جمعی",
    desc: "دقت بالای ۷۵٪ با حداقل ۳۰۰ پیش‌بینی",
    tier: "legend",
    earned: (s) => s.totalPreds >= 300 && (s.accuracy ?? 0) >= 75,
  },

  // ── رتبه ──
  {
    id: "top50",
    icon: "🪜",
    label: "نیمه‌ی بالا",
    desc: "بالاتر از ۵۰٪ پیش‌بین‌ها",
    tier: "bronze",
    earned: (s) => s.percentile >= 50,
    progress: (s) => pct(s.percentile, 50),
  },
  {
    id: "top10",
    icon: "👑",
    label: "ده درصد برتر",
    desc: "بالاتر از ۹۰٪ پیش‌بین‌ها",
    tier: "gold",
    earned: (s) => s.percentile >= 90,
    progress: (s) => pct(s.percentile, 90),
  },
  {
    id: "top1",
    icon: "💫",
    label: "یک درصد",
    desc: "بالاتر از ۹۹٪ پیش‌بین‌ها",
    tier: "legend",
    earned: (s) => s.percentile >= 99,
    progress: (s) => pct(s.percentile, 99),
  },

  // ── بازار ایران ──
  {
    id: "irwin",
    icon: "🏆",
    label: "اولین برد",
    desc: "یک شرط برنده در بازار ایران",
    tier: "bronze",
    earned: (s) => s.irWon >= 1,
  },
  {
    id: "profitable",
    icon: "💎",
    label: "سودده",
    desc: "سود خالص مثبت در بازار ایران",
    tier: "silver",
    earned: (s) => s.irNet > 0,
  },
  {
    id: "whale",
    icon: "🐋",
    label: "نهنگ",
    desc: "بیش از ۱۰۰۰ تتر حجم شرط",
    tier: "gold",
    earned: (s) => s.irStaked >= 1000,
    progress: (s) => pct(s.irStaked, 1000),
  },
  {
    id: "streakwin",
    icon: "⚡",
    label: "دست داغ",
    desc: "۱۰ شرط برنده در بازار ایران",
    tier: "gold",
    earned: (s) => s.irWon >= 10,
    progress: (s) => pct(s.irWon, 10),
  },

  // ── سازندگی ──
  {
    id: "creator",
    icon: "✍️",
    label: "سازنده",
    desc: "اولین بازار تأییدشده‌ات",
    tier: "silver",
    earned: (s) => s.marketsCreated >= 1,
  },
  {
    id: "architect",
    icon: "🏗️",
    label: "معمار بازار",
    desc: "۱۰ بازار تأییدشده ساختی",
    tier: "gold",
    earned: (s) => s.marketsCreated >= 10,
    progress: (s) => pct(s.marketsCreated, 10),
  },

  // ── چلنج ──
  {
    id: "funded_trader",
    icon: "🛡️",
    label: "قبول در چلنج",
    desc: "یک چلنج پراپ را پاس کردی",
    tier: "gold",
    earned: (s) => s.challengesPassed >= 1,
  },
  {
    id: "veteran",
    icon: "🎖️",
    label: "کهنه‌کار",
    desc: "سه چلنج پراپ پاس‌شده",
    tier: "legend",
    earned: (s) => s.challengesPassed >= 3,
    progress: (s) => pct(s.challengesPassed, 3),
  },
];

export const MAX_SHOWCASE = 3;

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/** فقط نشان‌هایی که واقعا کسب شده‌اند می‌توانند روی پروفایل بنشینند. */
export function sanitizeShowcase(ids: string[], stats: BadgeStats): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const b = badgeById(id);
    if (!b || seen.has(id) || !b.earned(stats)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_SHOWCASE) break;
  }
  return out;
}
