// اتصال زنده به Myfxbook — سمت سرور، با کش سنگین.
// سرور ما لاگین می‌کند و دیتا را می‌کشد؛ کاربر ایرانی مستقیم به Myfxbook وصل نمی‌شود.
// ایمیل/پسورد فقط از متغیرهای محیطی خوانده می‌شوند.

const BASE = "https://www.myfxbook.com/api";
const UA = { "User-Agent": "Mozilla/5.0" };

// حساب واقعی MONEX
const ACCOUNT_ID = process.env.MYFXBOOK_ACCOUNT_ID || "12121235";

export type MyfxStats = {
  gain: number;
  monthly: number;
  drawdown: number;
  balance: number;
  profit: number;
  profitFactor: number;
  deposits: number;
  currency: string;
  demo: boolean;
  lastUpdate: string;
  server: string;
};

export type EquityPoint = { date: string; growth: number; balance: number };

export type MyfxData = {
  ok: boolean;
  stats: MyfxStats | null;
  equity: EquityPoint[];
  monthly: { label: string; value: number }[];
  fetchedAt: number;
};

// ── session cache (Myfxbook sessions last ~1 month, IP-bound) ──
let sessionCache: { session: string; ts: number } | null = null;
const SESSION_TTL = 20 * 60 * 1000; // refresh session every 20 min to be safe

async function getSession(): Promise<string | null> {
  if (sessionCache && Date.now() - sessionCache.ts < SESSION_TTL) {
    return sessionCache.session;
  }
  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;
  if (!email || !password) return null;

  const res = await fetch(
    `${BASE}/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    { headers: UA, cache: "no-store" }
  );
  const j = await res.json();
  if (j.error || !j.session) return null;
  sessionCache = { session: j.session, ts: Date.now() };
  return j.session;
}

// ── data cache ──
let dataCache: { data: MyfxData; ts: number } | null = null;
const DATA_TTL = 5 * 60 * 1000; // 5 min

function monthLabelFa(mm: number): string {
  // میلادی → برچسب کوتاه فارسی ماه میلادی
  const names = [
    "ژان", "فور", "مار", "آپر", "مه", "ژوئن",
    "ژوئی", "اوت", "سپت", "اکت", "نوا", "دسا",
  ];
  return names[mm - 1] ?? String(mm);
}

export async function getMyfxData(): Promise<MyfxData> {
  if (dataCache && Date.now() - dataCache.ts < DATA_TTL) return dataCache.data;

  const empty: MyfxData = {
    ok: false,
    stats: null,
    equity: [],
    monthly: [],
    fetchedAt: Date.now(),
  };

  try {
    const session = await getSession();
    if (!session) {
      if (dataCache) return dataCache.data;
      return empty;
    }

    // accounts → find MONEX
    const accRes = await fetch(`${BASE}/get-my-accounts.json?session=${session}`, {
      headers: UA,
      cache: "no-store",
    });
    const acc = await accRes.json();
    if (acc.error) {
      // session may have died early — clear it so next call re-logs in
      sessionCache = null;
      if (dataCache) return dataCache.data;
      return empty;
    }

    const list: Record<string, unknown>[] = acc.accounts ?? [];
    const a =
      list.find((x) => String(x.id) === String(ACCOUNT_ID)) ?? list[0];
    if (!a) {
      if (dataCache) return dataCache.data;
      return empty;
    }

    const stats: MyfxStats = {
      gain: Number(a.gain) || 0,
      monthly: Number(a.monthly) || 0,
      drawdown: Number(a.drawdown) || 0,
      balance: Number(a.balance) || 0,
      profit: Number(a.profit) || 0,
      profitFactor: Number(a.profitFactor) || 0,
      deposits: Number(a.deposits) || 0,
      currency: String(a.currency ?? "USD"),
      demo: Boolean(a.demo),
      lastUpdate: String(a.lastUpdateDate ?? ""),
      server: String((a.server as { name?: string })?.name ?? ""),
    };

    // daily data → equity curve + monthly aggregation
    const end = new Date().toISOString().slice(0, 10);
    const dailyRes = await fetch(
      `${BASE}/get-data-daily.json?session=${session}&id=${a.id}&start=2024-01-01&end=${end}`,
      { headers: UA, cache: "no-store" }
    );
    const daily = await dailyRes.json();

    const equity: EquityPoint[] = [];
    const monthlyMap = new Map<string, number>();

    if (!daily.error && Array.isArray(daily.dataDaily)) {
      for (const row of daily.dataDaily) {
        // each row is an array with one point object
        const pt = Array.isArray(row) ? row[0] : row;
        if (!pt) continue;
        const date = String(pt.date ?? "");
        const growth = Number(pt.growthEquity) || 0;
        const balance = Number(pt.balance) || 0;
        equity.push({ date, growth, balance });

        // date format MM/DD/YYYY → month key
        const [mm, , yyyy] = date.split("/");
        if (mm && yyyy) {
          const key = `${yyyy}-${mm}`;
          monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (Number(pt.profit) || 0));
        }
      }
    }

    // monthly % approximation from profit / deposits
    const monthly = Array.from(monthlyMap.entries())
      .sort()
      .map(([key, profitSum]) => {
        const mm = Number(key.split("-")[1]);
        const pct = stats.deposits ? (profitSum / stats.deposits) * 100 : 0;
        return { label: monthLabelFa(mm), value: Number(pct.toFixed(2)) };
      });

    const data: MyfxData = {
      ok: true,
      stats,
      equity,
      monthly,
      fetchedAt: Date.now(),
    };
    dataCache = { data, ts: Date.now() };
    return data;
  } catch {
    if (dataCache) return dataCache.data;
    return empty;
  }
}
