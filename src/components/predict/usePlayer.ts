"use client";

import { useCallback, useEffect, useState } from "react";

export type Player = {
  id: number;
  displayName: string;
  totalPoints: number;
  streak: number;
  credits: number;
};

export type PredictedKey = { asset: string; timeframe: string };

export type GameResult = {
  asset: string;
  timeframe: string;
  guess: number;
  settlePrice: number | null;
  errorPct: number | null;
  points: number | null;
};

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [predicted, setPredicted] = useState<PredictedKey[]>([]);
  const [freeRemaining, setFreeRemaining] = useState<Record<string, number>>({});
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/predict/me", { cache: "no-store" });
      const j = await res.json();
      setPlayer(j.player ?? null);
      setPredicted(j.predicted ?? []);
      setFreeRemaining(j.freeRemaining ?? {});
      setResults(j.results ?? []);
    } catch {
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/predict/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setPlayer(null);
    setPredicted([]);
    setFreeRemaining({});
  }, []);

  return { player, predicted, freeRemaining, results, loading, refresh, logout, setPlayer };
}

const ERRORS: Record<string, string> = {
  bad_username: "نام کاربری باید حداقل ۳ کاراکتر و فقط حروف انگلیسی، عدد و _ باشد.",
  weak_password: "رمز عبور باید حداقل ۶ کاراکتر باشد.",
  username_taken: "این نام کاربری قبلاً ثبت شده است.",
  not_found: "کاربری با این مشخصات پیدا نشد.",
  bad_credentials: "نام کاربری یا رمز عبور اشتباه است.",
  already_predicted: "شما برای این راند پیش‌بینی ثبت کرده‌اید.",
  round_closed: "مهلت این راند به پایان رسیده است.",
  market_closed: "بازار طلا در تعطیلات آخر هفته بسته است.",
  no_round: "راند فعالی برای این دارایی وجود ندارد.",
  not_authed: "برای ثبت پیش‌بینی ابتدا وارد شوید.",
  bad_guess: "لطفاً یک عدد معتبر وارد کنید.",
  insufficient_credits: "کردیت کافی ندارید. برای تایم‌فریم‌های کوتاه‌تر کردیت لازم است.",
  daily_limit: "سقف مجاز این تایم‌فریم برای امروز پر شده است.",
};

export function errorText(code: string | undefined): string {
  return (code && ERRORS[code]) || "خطایی رخ داد. دوباره تلاش کنید.";
}
