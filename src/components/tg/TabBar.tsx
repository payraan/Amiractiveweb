"use client";

import { haptic } from "@/components/tg/telegram";

export type TabId = "markets" | "trade" | "wallet" | "profile";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "markets", label: "بازار ایران", icon: "🇮🇷" },
  { id: "trade", label: "ترید", icon: "📈" },
  { id: "wallet", label: "کیف پول", icon: "👛" },
  { id: "profile", label: "پروفایل", icon: "👤" },
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
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (t.id !== active) haptic.tap();
                onChange(t.id);
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition ${
                on ? "text-gold" : "text-muted"
              }`}
            >
              <span className={`text-lg leading-none ${on ? "" : "opacity-60"}`}>
                {t.icon}
              </span>
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
