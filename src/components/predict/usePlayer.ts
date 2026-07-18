"use client";

import { useCallback, useEffect, useState } from "react";

export type Player = {
  id: number;
  displayName: string;
  totalPoints: number;
  streak: number;
};

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [predicted, setPredicted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/predict/me", { cache: "no-store" });
      const j = await res.json();
      setPlayer(j.player ?? null);
      setPredicted(j.predicted ?? []);
    } catch {
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { player, predicted, loading, refresh, setPredicted };
}

const ERRORS: Record<string, string> = {
  bad_username: "نام کاربری باید حداقل ۳ کاراکتر و فقط حروف انگلیسی، عدد و _ باشد.",
  weak_password: "رمز عبور باید حداقل ۶ کاراکتر باشد.",
  username_taken: "این نام کاربری قبلاً ثبت شده است.",
  not_found: "کاربری با این مشخصات پیدا نشد.",
  bad_credentials: "نام کاربری یا رمز عبور اشتباه است.",
  already_predicted: "شما امروز برای این دارایی پیش‌بینی ثبت کرده‌اید.",
  round_closed: "مهلت پیش‌بینی امروز به پایان رسیده است.",
  not_authed: "برای ثبت پیش‌بینی ابتدا وارد شوید.",
  bad_guess: "لطفاً یک عدد معتبر وارد کنید.",
};

export function errorText(code: string | undefined): string {
  return (code && ERRORS[code]) || "خطایی رخ داد. دوباره تلاش کنید.";
}
