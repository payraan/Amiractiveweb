/** مونوگرام نارمون — N دوتنه: ساقه و قطر طلایی، ساقه‌ی راست کرم. */
export default function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 112 100"
      className={className}
      role="img"
      aria-label="Narmoon"
    >
      <path
        d="M20 88 L30 12 L48 12 L38 88 Z M32 12 L50 12 L82 88 L64 88 Z"
        fill="var(--color-gold)"
      />
      <path d="M78 88 L88 12 L106 12 L96 88 Z" fill="var(--color-cream)" />
    </svg>
  );
}
