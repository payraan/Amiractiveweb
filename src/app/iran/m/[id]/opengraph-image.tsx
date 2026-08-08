import { readFile } from "fs/promises";
import path from "path";
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { ensureIrTables, impliedPct } from "@/lib/iran";

// فونت فارسی برای رندر تصویر لازم است و باید *ثابت* باشد، نه متغیر.
// رندرکننده (Satori) نه woff2 می‌خواند، نه فونت پیش‌فرضش حروف فارسی را شکل
// می‌دهد، و نه فونت متغیر را می‌فهمد. این فایل یک نمونه‌ی ثابتِ وزن ۷۰۰ است
// که از همان estedad-vf.woff2 پروژه ساخته شده.
let fontCache: Buffer | null = null;
async function persianFont(): Promise<Buffer> {
  if (!fontCache) {
    fontCache = await readFile(
      path.join(process.cwd(), "src/fonts/vazirmatn-700.ttf")
    );
  }
  return fontCache;
}

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "بازار ایران نارمون";

// تصویر پیش‌نمایش لینک — همان چیزی که در تلگرام و توییتر دیده می‌شود.
// عمدا فقط چند عدد بزرگ دارد: در فید، متن ریز خوانده نمی‌شود.
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let question = "بازار ایران";
  let yes = 50;
  let volume = 0;
  let bettors = 0;

  try {
    const n = Number(id);
    if (Number.isInteger(n)) {
      await ensureIrTables();
      const pool = await db();
      const { rows } = await pool.query(
        `SELECT question, yes_total, no_total, bettors
           FROM ir_markets WHERE id=$1 AND status <> 'pending'`,
        [n]
      );
      if (rows[0]) {
        question = rows[0].question;
        const y = Number(rows[0].yes_total);
        const no = Number(rows[0].no_total);
        yes = impliedPct(y, no);
        volume = y + no;
        bettors = rows[0].bettors;
      }
    }
  } catch {
    /* تصویر پیش‌نمایش هرگز نباید صفحه را بشکند — با مقدار پیش‌فرض ادامه بده */
  }

  const no = Math.round((100 - yes) * 10) / 10;
  const q = question.replace(/\u200c/g, "");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0c 0%, #16161c 100%)",
          color: "#f4f1e8",
          padding: 64,
          justifyContent: "space-between",
          fontFamily: "Vazirmatn",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, color: "#e8c46a" }}>
            NARMOON
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#8b8b94",
              border: "1px solid #2a2a32",
              borderRadius: 999,
              padding: "8px 22px",
            }}
          >
            بازار ایران
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: q.length > 70 ? 44 : 54,
            lineHeight: 1.4,
            fontWeight: 700,
            maxWidth: 1050,
          }}
        >
          {q}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* نوار اجماع */}
          <div style={{ display: "flex", width: "100%", height: 34, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", width: `${yes}%`, background: "rgba(62,207,142,0.55)" }} />
            <div style={{ display: "flex", flex: 1, background: "rgba(229,72,77,0.5)" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <div style={{ display: "flex", fontSize: 40, color: "#3ecf8e", fontWeight: 700 }}>
              بله {yes}%
            </div>
            <div style={{ display: "flex", fontSize: 40, color: "#e5484d", fontWeight: 700 }}>
              خیر {no}%
            </div>
          </div>

          <div style={{ display: "flex", gap: 40, marginTop: 26, fontSize: 24, color: "#8b8b94" }}>
            <div style={{ display: "flex" }}>حجم استخر ${volume.toFixed(2)}</div>
            <div style={{ display: "flex" }}>{bettors} شرکت کننده</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Vazirmatn",
          data: await persianFont(),
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
