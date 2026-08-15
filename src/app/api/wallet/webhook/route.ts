import { NextResponse } from "next/server";
import { webhookTokenValid, verifyDeposit } from "@/lib/zovix";
import { creditDeposit } from "@/lib/deposit-sync";

export const dynamic = "force-dynamic";

// ── وبهوک درگاه ──────────────────────────────────────────────
//
// ⚠️ در پلن رایگانِ درگاه، وبهوک اصلا فعال نیست و این روت هرگز صدا زده
// نمی‌شود. مسیر واقعیِ امروزِ واریز، خواندن دوره‌ای است
// (`lib/deposit-sync.ts` + `/api/wallet/reconcile` روی کرون). این روت
// نگه داشته شده چون اگر پلن ارتقا پیدا کند بدون تغییر کار می‌کند، و شارژ
// آنی از شارژ ۱۵ دقیقه‌ای بهتر است.
//
// سه لایه‌ی محافظت، چون درگاه امضای وبهوک ندارد:
//
//  ۱. توکن مخفی در مسیر (?t=...) — آدرس وبهوک حدس‌زدنی نیست.
//  ۲. تأیید متقابل — پیش از هر واریز، خودمان از API درگاه می‌پرسیم که
//     این txid واقعا وجود دارد، SUCCESS است و مبلغش چقدر است. مبلغِ
//     معتبر همان است که API می‌گوید، نه آنچه در بدنه‌ی وبهوک آمده.
//  ۳. یکتاسازی روی txid — داخل `creditDeposit`، مشترک با خواندن دوره‌ای.
//
// طبق مستندات، ابتدا DEPOSIT_INITIAL با وضعیت PENDING_CONFIRM می‌آید و
// بعد DEPOSIT_DONE با SUCCESS. فقط دومی شارژ می‌کند.

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!webhookTokenValid(searchParams.get("t"))) {
    // ⚠️ اگر ZOVIX_WEBHOOK_TOKEN ست نشده باشد، همه‌ی وبهوک‌ها اینجا رد
    // می‌شوند. لاگ می‌گذاریم تا این حالت بی‌صدا نماند.
    console.warn("[wallet-webhook] توکن نامعتبر یا ست‌نشده — وبهوک رد شد");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const type = String(body.type ?? "");
  const status = String(body.status ?? "");
  const txid = String(body.txid ?? "");

  // همیشه 200 برمی‌گردانیم تا درگاه تلاش دوباره نکند، مگر خطای واقعی.
  if (type !== "DEPOSIT" || !txid) {
    console.log(`[wallet-webhook] نادیده: type=${type} txid=${txid || "-"}`);
    return NextResponse.json({ ok: true, ignored: true });
  }
  // مرحله‌ی اول فقط اعلان است، شارژ نمی‌کند.
  if (status !== "SUCCESS") {
    return NextResponse.json({ ok: true, pending: true });
  }

  // ── تأیید متقابل: منبع حقیقت، API درگاه است نه بدنه‌ی وبهوک ──
  const check = await verifyDeposit(txid);
  if (!check.ok) {
    // نتوانستیم تأیید کنیم — عمدا شارژ نمی‌کنیم و ۵۰۰ می‌دهیم تا درگاه
    // دوباره بفرستد.
    console.error(`[wallet-webhook] تأیید ${txid} شکست خورد: ${check.error}`);
    return NextResponse.json(
      { ok: false, error: "verify_failed" },
      { status: 500 }
    );
  }

  const row = check.data.find((d) => d.txid === txid);
  if (!row) {
    // درگاه این txid را نمی‌شناسد. یا جعلی است، یا هنوز ثبت نشده — در هر
    // دو حالت شارژ نمی‌کنیم، ولی بی‌صدا هم ردش نمی‌کنیم: خواندن دوره‌ای
    // بعدا همین را می‌بیند اگر واقعی باشد.
    console.warn(`[wallet-webhook] ${txid} در API درگاه پیدا نشد — شارژ نشد`);
    return NextResponse.json({ ok: true, ignored: "not_confirmed" });
  }

  const r = await creditDeposit(row);
  if (!r.ok) {
    if (r.reason === "duplicate") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (r.reason.startsWith("error:")) {
      return NextResponse.json(
        { ok: false, error: "server_error" },
        { status: 500 }
      );
    }
    console.warn(`[wallet-webhook] ${txid} شارژ نشد: ${r.reason}`);
    return NextResponse.json({ ok: true, ignored: r.reason });
  }

  return NextResponse.json({ ok: true, credited: r.credited });
}
