"use client";

import { useEffect, useState } from "react";
import {
  JALALI_MONTHS,
  instantToJalali,
  isValidJalali,
  jalaliMonthDays,
  jalaliToInstant,
  toEnglishDigits,
  toJalali,
  toPersianDigits,
} from "@/lib/jalali";

/**
 * ورودی تاریخ و ساعت با تقویم شمسی — و معادل میلادی زنده.
 *
 * چرا نه input[type=datetime-local]: آن فقط میلادی است و کاربر ایرانی باید
 * تاریخ را در ذهنش تبدیل کند. اینجا پیش‌فرض شمسی است، ارقام فارسی هم قبول
 * می‌شود، و هر لحظه معادل طرف مقابل زیرش نوشته می‌شود.
 *
 * مقدار خروجی همیشه ISO است تا سرور و دیتابیس دست‌نخورده بمانند.
 */
export default function JalaliDateTime({
  value,
  onChange,
}: {
  value: string; // ISO یا ""
  onChange: (iso: string) => void;
}) {
  const [mode, setMode] = useState<"jalali" | "gregorian">("jalali");
  const [y, setY] = useState("");
  const [m, setM] = useState("");
  const [d, setD] = useState("");
  const [hh, setHh] = useState("22");
  const [mi, setMi] = useState("00");
  const [greg, setGreg] = useState("");

  // مقدار اولیه: اگر از بیرون ISO آمد، فیلدهای شمسی را پر کن
  useEffect(() => {
    if (!value) return;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return;
    const j = instantToJalali(dt);
    if (!j) return;
    setY(String(j.y));
    setM(String(j.m));
    setD(String(j.d));
    setHh(String(j.hh).padStart(2, "0"));
    setMi(String(j.mi).padStart(2, "0"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // حالت شمسی → ISO
  useEffect(() => {
    if (mode !== "jalali") return;
    const jy = Number(toEnglishDigits(y));
    const jm = Number(toEnglishDigits(m));
    const jd = Number(toEnglishDigits(d));
    const h = Number(toEnglishDigits(hh));
    const mn = Number(toEnglishDigits(mi));
    if (!y || !m || !d) {
      onChange("");
      return;
    }
    const inst = jalaliToInstant(jy, jm, jd, h || 0, mn || 0);
    onChange(inst ? inst.toISOString() : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, m, d, hh, mi, mode]);

  // حالت میلادی → ISO
  useEffect(() => {
    if (mode !== "gregorian") return;
    if (!greg) {
      onChange("");
      return;
    }
    // datetime-local بدون منطقه است؛ آن را تهران فرض می‌کنیم
    const [datePart, timePart] = greg.split("T");
    const [gy, gm, gd] = datePart.split("-").map(Number);
    const [h, mn] = (timePart ?? "00:00").split(":").map(Number);
    const utc = Date.UTC(gy, gm - 1, gd, h, mn) - (3 * 60 + 30) * 60_000;
    const inst = new Date(utc);
    onChange(Number.isNaN(inst.getTime()) ? "" : inst.toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greg, mode]);

  const jy = Number(toEnglishDigits(y));
  const jm = Number(toEnglishDigits(m));
  const jd = Number(toEnglishDigits(d));
  const filled = Boolean(y && m && d);
  const validJalali = filled && isValidJalali(jy, jm, jd);
  const maxDay = jm >= 1 && jm <= 12 && jy > 1200 ? jalaliMonthDays(jy, jm) : 31;

  // متن معادل — هر حالت، معادل طرف مقابل را نشان می‌دهد
  let equivalent = "";
  if (mode === "jalali" && validJalali) {
    const inst = jalaliToInstant(jy, jm, jd, Number(toEnglishDigits(hh)) || 0, Number(toEnglishDigits(mi)) || 0);
    if (inst) {
      equivalent = `معادل میلادی: ${inst.toLocaleDateString("en-GB", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "short",
        day: "numeric",
      })} — ${inst.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Tehran",
        hour: "2-digit",
        minute: "2-digit",
      })} به وقت تهران`;
    }
  } else if (mode === "gregorian" && greg) {
    const [datePart] = greg.split("T");
    const [gy, gm, gd] = datePart.split("-").map(Number);
    if (gy && gm && gd) {
      const j = toJalali(gy, gm, gd);
      equivalent = `معادل شمسی: ${toPersianDigits(j.d)} ${JALALI_MONTHS[j.m - 1]} ${toPersianDigits(j.y)}`;
    }
  }

  const inputCls =
    "no-zoom rounded-xl border border-line bg-ink/50 px-3 py-2.5 text-sm text-cream outline-none transition focus:border-gold/60";

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-lg border border-line bg-ink/40 p-1">
        {(
          [
            { id: "jalali", label: "شمسی" },
            { id: "gregorian", label: "میلادی" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`no-zoom flex-1 rounded py-1.5 text-[11px] font-bold transition ${
              mode === t.id ? "bg-gold text-ink" : "text-muted hover:text-cream"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "jalali" ? (
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="روز"
            value={d}
            onChange={(e) => setD(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 2))}
            className={`${inputCls} w-[68px] text-center font-mono`}
          />
          <select
            value={m}
            onChange={(e) => setM(e.target.value)}
            className={`${inputCls} min-w-[112px] flex-1`}
          >
            <option value="">ماه</option>
            {JALALI_MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="سال"
            value={y}
            onChange={(e) => setY(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 4))}
            className={`${inputCls} w-[84px] text-center font-mono`}
          />
          <div className="flex items-center gap-1" dir="ltr">
            <input
              type="text"
              inputMode="numeric"
              value={hh}
              onChange={(e) => setHh(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 2))}
              className={`${inputCls} w-[52px] text-center font-mono`}
            />
            <span className="text-muted">:</span>
            <input
              type="text"
              inputMode="numeric"
              value={mi}
              onChange={(e) => setMi(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 2))}
              className={`${inputCls} w-[52px] text-center font-mono`}
            />
          </div>
        </div>
      ) : (
        <input
          type="datetime-local"
          value={greg}
          onChange={(e) => setGreg(e.target.value)}
          dir="ltr"
          className={`${inputCls} w-full font-mono`}
        />
      )}

      {equivalent && (
        <p className="mt-2 rounded-lg border border-line bg-ink/30 px-3 py-2 text-[11px] text-muted">
          {equivalent}
        </p>
      )}

      {filled && !validJalali && mode === "jalali" && (
        <p className="mt-2 text-[11px] text-loss">
          این تاریخ وجود ندارد
          {jm >= 1 && jm <= 12 && jy > 1200
            ? ` — ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)} فقط ${toPersianDigits(maxDay)} روز دارد.`
            : "."}
        </p>
      )}
    </div>
  );
}
