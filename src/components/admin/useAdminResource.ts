"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * خواندن یک منبع از API در پنل ادمین، با وضعیت بارگذاری و خطا.
 *
 * قرینه‌ی `useResource` مینی‌اپ است ولی نمی‌تواند همان باشد: آن یکی با توکن
 * `x-tg-auth` کار می‌کند و روی ۴۰۱ خودش را با initData تازه می‌کند. ادمین
 * کوکی دارد و initData ندارد، پس ۴۰۱ اینجا یعنی نشست ادمین تمام شده — چیزی
 * که باید دیده شود، نه بی‌صدا دوباره تلاش شود.
 *
 * قاعده‌ی react-hooks/set-state-in-effect فقط همین‌جا خاموش می‌شود: گرفتن
 * داده هنگام mount ذاتا یعنی setState از داخل افکت. با متمرکز کردنش، به‌جای
 * یک استثنا در هر تب ادمین، یک استثنای مستند در یک فایل داریم.
 */
export function useAdminResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(path);
      const j = await r.json();
      // خطا بلعیده نمی‌شود: کد خطای سرور تا رابط بالا می‌آید، وگرنه کاربر
      // فقط یک فهرست خالی می‌بیند و نمی‌داند چرا.
      if (!j?.ok) throw new Error(String(j?.error ?? `http_${r.status}`));
      setData(j as T);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  }, [path]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { data, error, reload: load };
}
