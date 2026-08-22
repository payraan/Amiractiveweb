import { NextResponse } from "next/server";
import { getCuratedMarkets } from "@/lib/poly";
import { translationsFor } from "@/lib/translate";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await getCuratedMarkets();
  const publicMarkets = markets.map(({ yesToken: _t, ...rest }) => rest);

  // عنوان فارسی اگر ترجمه‌اش آماده باشد. همین فراخوان، عنوان‌های تازه را هم
  // در صف ترجمه ثبت می‌کند، پس بازار جدید خودبه‌خود وارد صف می‌شود.
  //
  // ⚠️ شکست ترجمه نباید فهرست بازارها را از بین ببرد: بازارِ بی‌عنوان از
  // بازارِ انگلیسی بدتر است، و اینجا تنها جایی است که این تصمیم گرفته می‌شود.
  let fa = new Map<string, string>();
  try {
    // زمینه‌ی هر پرسش، عنوان رویدادش است. بدون آن، پرسشی مثل
    // «Game 3: Ends in a day?» حتی به انگلیسی هم مبهم است.
    const hints = new Map<string, string>();
    for (const m of publicMarkets) {
      if (m.eventTitle && m.eventTitle !== m.question) {
        hints.set(m.question, m.eventTitle);
      }
    }
    fa = await translationsFor(
      [
        ...publicMarkets.map((m) => m.question),
        ...publicMarkets.map((m) => m.eventTitle).filter(Boolean),
      ],
      hints
    );
  } catch {
    /* بدون ترجمه ادامه می‌دهیم */
  }

  const withFa = publicMarkets.map((m) => ({
    ...m,
    questionFa: fa.get(m.question.trim()) ?? null,
    eventTitleFa: m.eventTitle ? (fa.get(m.eventTitle.trim()) ?? null) : null,
  }));

  return NextResponse.json(
    { ok: true, markets: withFa },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
