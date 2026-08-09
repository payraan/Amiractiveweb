"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/tg/api";

/**
 * خواندن یک منبع از API با وضعیت بارگذاری و خطا.
 *
 * هر صفحه‌ی مینی‌اپ دقیقا همین سه حالت را دارد (در حال آمدن / خطا / داده)،
 * پس یک‌جا نوشته شده تا در هر صفحه تکرار نشود و رفتارشان یکسان بماند.
 *
 * قاعده‌ی react-hooks/set-state-in-effect فقط همین‌جا خاموش می‌شود: گرفتن
 * داده هنگام mount ذاتا یعنی setState از داخل افکت، و در App Router جایگزینی
 * ندارد چون توکن مینی‌اپ فقط سمت کلاینت وجود دارد. با متمرکز کردنش، به‌جای
 * یک استثنا در هر صفحه، یک استثنای مستند در یک فایل داریم.
 */
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const j = await api<T>(path);
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  }, [path]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const reload = useCallback(() => {
    setData(null);
    setError(null);
    load();
  }, [load]);

  return { data, error, reload };
}
