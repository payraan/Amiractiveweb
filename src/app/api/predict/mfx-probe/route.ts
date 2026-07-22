import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// تشخیص موقت اتصال Myfxbook — GET /api/predict/mfx-probe با هدر x-settle-key
export async function GET(req: Request) {
  const key = process.env.SETTLE_KEY;
  if (!key || req.headers.get("x-settle-key") !== key) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;
  const accountId = process.env.MYFXBOOK_ACCOUNT_ID;

  const out: Record<string, unknown> = {
    hasEmail: Boolean(email),
    hasPassword: Boolean(password),
    accountId: accountId ?? null,
  };

  if (!email || !password) {
    out.verdict = "متغیرهای محیطی MYFXBOOK_EMAIL یا MYFXBOOK_PASSWORD تنظیم نشده‌اند.";
    return NextResponse.json(out);
  }

  try {
    const loginUrl = `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(
      email
    )}&password=${encodeURIComponent(password)}`;
    const lr = await fetch(loginUrl, { cache: "no-store" });
    out.loginStatus = lr.status;
    const lj = await lr.json();
    out.loginError = lj?.error ?? null;
    out.loginMessage = lj?.message ?? null;

    const session = lj?.session;
    if (!session) {
      out.verdict = "ورود به Myfxbook ناموفق بود — ایمیل یا رمز عبور را بررسی کنید.";
      return NextResponse.json(out);
    }
    out.gotSession = true;

    const accUrl = `https://www.myfxbook.com/api/get-my-accounts.json?session=${session}`;
    const ar = await fetch(accUrl, { cache: "no-store" });
    const aj = await ar.json();
    out.accountsError = aj?.error ?? null;
    const accounts = Array.isArray(aj?.accounts) ? aj.accounts : [];
    out.accountsFound = accounts.length;
    out.accounts = accounts.map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      gain: a.gain,
      drawdown: a.drawdown,
      balance: a.balance,
      profitFactor: a.profitFactor,
      lastUpdateDate: a.lastUpdateDate,
    }));

    const match = accounts.find(
      (a: Record<string, unknown>) => String(a.id) === String(accountId)
    );
    out.matchedConfiguredAccount = Boolean(match);
    if (!match && accounts.length) {
      out.verdict =
        "ورود موفق بود اما MYFXBOOK_ACCOUNT_ID با هیچ حسابی مطابقت ندارد — id درست را از فهرست بالا بردارید.";
    } else if (match) {
      out.verdict = "اتصال سالم است؛ دیتای زنده باید نمایش داده شود.";
    }
  } catch (err) {
    out.fetchError = err instanceof Error ? err.message : "failed";
    out.verdict = "درخواست به Myfxbook از سرور شکست خورد.";
  }

  return NextResponse.json(out);
}
