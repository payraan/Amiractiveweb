"use client";

import { haptic } from "@/components/tg/telegram";
import {
  IconMarkets,
  IconTrade,
  IconPulse,
  IconChallenge,
  IconWallet,
  IconProfile,
} from "@/components/tg/icons";

export type TabId =
  | "markets"
  | "trade"
  | "pulse"
  | "challenge"
  | "wallet"
  | "profile";

// شش تب روی عرض موبایل تنگ است، پس برچسب‌ها کوتاه نگه داشته شده‌اند و نوار
// خودش اسکرول افقی می‌گیرد — بهتر از منوی «بیشتر» که یک لمس اضافه می‌خواهد و
// تب‌های پشتش عملا دیده نمی‌شوند.
const TABS: {
  id: TabId;
  label: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  { id: "markets", label: "بازار ایران", Icon: IconMarkets },
  { id: "trade", label: "ترید", Icon: IconTrade },
  { id: "pulse", label: "نبض بازار", Icon: IconPulse },
  { id: "challenge", label: "پراپ", Icon: IconChallenge },
  { id: "wallet", label: "کیف پول", Icon: IconWallet },
  { id: "profile", label: "پروفایل", Icon: IconProfile },
];

export default function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    // ثابت پایین صفحه، با احترام به ناحیه‌ی امن آیفون — بدون آن، نوار زیر
    // نوار خانه‌ی آیفون گیر می‌کند و نصف دکمه‌ها قابل زدن نیست.
    // در حالت Fullscreen، تلگرام پایین صفحه را هم اشغال می‌کند؛ tg-safe-bottom
    // هر سه منبعِ ناحیه‌ی امن را با هم حساب می‌کند.
    <nav className="tg-safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line/80 bg-ink/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => {
          const on = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id !== active) haptic.tap();
                onChange(id);
              }}
              className="relative flex min-w-[62px] flex-1 shrink-0 flex-col items-center gap-1.5 pb-2.5 pt-3"
            >
              {/* نشانگر تب فعال بالای آیکون — خوانا بدون شلوغ‌کردن */}
              <span
                className={`absolute inset-x-4 top-0 h-[3px] rounded-full transition ${
                  on ? "bg-gold" : "bg-transparent"
                }`}
              />
              <Icon
                className={`h-[26px] w-[26px] transition ${
                  on ? "text-gold" : "text-muted"
                }`}
              />
              <span
                className={`text-[11px] transition ${
                  on ? "font-bold text-gold" : "text-muted"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
