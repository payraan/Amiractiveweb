"use client";

import { webApp } from "@/components/tg/telegram";

// کلاینت API مینی‌اپ.
//
// توکن نشست یک ساعت اعتبار دارد ولی کاربر ممکن است اپ را ساعت‌ها باز نگه
// دارد. به‌جای اینکه ناگهان همه‌چیز ۴۰۱ شود، اولین ۴۰۱ باعث ورود دوباره با
// initData و تکرار همان درخواست می‌شود — initData همیشه در دسترس است، پس
// این برای کاربر نامرئی است.
//
// توکن فقط در حافظه می‌ماند؛ نه localStorage، نه کوکی.

let token: string | null = null;
let refreshing: Promise<string | null> | null = null;

export function currentToken() {
  return token;
}

export type AuthedPlayer = {
  id: number;
  displayName: string;
  credits: number;
  usdtBalance: number;
};

export type AuthResult =
  | {
      ok: true;
      player: AuthedPlayer;
      created: boolean;
      startParam: string | null;
      needsTerms: boolean;
      needsTour: boolean;
    }
  | { ok: false; error: string };

/** ورود با initData. همان چیزی که توکن را می‌سازد یا تازه می‌کند. */
export async function authenticate(): Promise<AuthResult> {
  const initData = webApp()?.initData;
  if (!initData) return { ok: false, error: "no_init_data" };

  const res = await fetch("/api/tg/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  const j = await res.json();
  if (!j.ok) {
    token = null;
    return { ok: false, error: String(j.error ?? "auth_failed") };
  }
  token = j.token;
  return {
    ok: true,
    player: j.player,
    created: Boolean(j.created),
    startParam: j.startParam ?? null,
    // fail-closed نیست و نباید باشد: اگر سرور این فیلدها را نفرستد،
    // دروازه بسته می‌ماند و کاربر پشت مودالی گیر می‌کند که راه بازش نیست.
    needsTerms: Boolean(j.needsTerms),
    needsTour: Boolean(j.needsTour),
  };
}

/** ورود دوباره — چند درخواست هم‌زمان فقط یک بار ورود را راه می‌اندازند. */
function refresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = authenticate()
      .then((r) => (r.ok ? token : null))
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number
  ) {
    super(code);
  }
}

/**
 * درخواست احراز‌شده به همان API سایت.
 *
 * هیچ روت اختصاصی مینی‌اپی وجود ندارد: این‌ها دقیقا همان مسیرهایی‌اند که
 * سایت استفاده می‌کند. منطق پولی یکی است و یکی می‌ماند.
 */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { retry?: boolean }
): Promise<T> {
  if (!token) await refresh();

  const call = () =>
    fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "x-tg-auth": token } : {}),
        ...init?.headers,
      },
    });

  let res = await call();
  if (res.status === 401 && init?.retry !== false) {
    await refresh();
    res = await call();
  }

  const j = await res.json().catch(() => null);
  if (!res.ok || (j && j.ok === false)) {
    throw new ApiError(String(j?.error ?? `http_${res.status}`), res.status);
  }
  return j as T;
}
