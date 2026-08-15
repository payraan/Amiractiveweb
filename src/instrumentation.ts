import { type Instrumentation } from "next";
import { log } from "@/lib/log";

// ═══ گرفتن خطاهای سرور ═══════════════════════════════════════
//
// ── چرا این فایل ──
// تا امروز خطای هر روتی که خودمان صریح `catch` نکرده بودیم، در چاه
// می‌رفت: کاربر ۵۰۰ می‌گرفت و ما هیچ‌وقت نمی‌فهمیدیم. برای پلتفرمی که پول
// جابه‌جا می‌کند یعنی ممکن است هفته‌ها یک روت خراب باشد و تنها نشانه‌اش
// «کار نکرد»ِ کاربر باشد.
//
// `onRequestError` قلاب رسمی Next است و **هر** خطای سمت سرور را می‌گیرد،
// بدون اینکه لازم باشد تک‌تک روت‌ها را دست بزنیم.
//
// ⚠️ مسیر و متد لاگ می‌شوند ولی **بدنه و هدر نه**. بدنه‌ی یک درخواست
// برداشت آدرس کیف پول دارد و هدرش کوکی نشست — لاگی که این‌ها را داشته
// باشد، خودش یک نشت است.

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;

  log.error("server.unhandled", {
    err: message,
    digest,
    // استک کوتاه می‌شود: چند خط اول جای واقعی خطا را می‌گویند و بقیه
    // فقط لاگ را پر می‌کنند.
    stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
