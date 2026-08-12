import { createHash } from "crypto";
import { base58Decode, tronAddressShapeValid } from "@/lib/wallet-rules";

// اعتبارسنجی کامل آدرس برداشت — فقط سرور.
//
// چرا جدا از wallet-rules.ts: چک‌سام به SHA-256 نیاز دارد و crypto نود در
// مرورگر نیست. فرم‌ها چک شکلی را می‌گیرند (بازخورد فوری)، ولی حرف آخر اینجا
// زده می‌شود.
//
// چرا اصلا مهم است: برداشت تنها عمل برگشت‌ناپذیر پلتفرم است. آدرس غلط یعنی
// تتر کاربر برای همیشه گم می‌شود و ما هیچ راهی برای برگرداندنش نداریم.

/**
 * چک‌سام Base58Check آدرس ترون: چهار بایت آخر باید با چهار بایت اول
 * SHA256(SHA256(۲۱ بایت اول)) یکی باشد.
 *
 * این همان لایه‌ای است که «یک حرف اشتباه تایپ‌شده» را می‌گیرد — آدرسی که
 * شکلش کاملا درست است ولی متعلق به هیچ‌کس نیست.
 */
export function tronAddressValid(addr: string): boolean {
  const a = addr.trim();
  if (!tronAddressShapeValid(a)) return false;
  const raw = base58Decode(a);
  if (!raw) return false;

  const sum = createHash("sha256")
    .update(createHash("sha256").update(raw.subarray(0, 21)).digest())
    .digest();

  for (let i = 0; i < 4; i++) {
    if (sum[i] !== raw[21 + i]) return false;
  }
  return true;
}

/** حرف آخر روی آدرس مقصد، بر اساس شبکه‌ی درگاه. */
export function withdrawAddressValid(addr: string, network: string): boolean {
  const n = network.trim().toUpperCase();
  if (n === "TRON" || n === "TRC20") return tronAddressValid(addr);
  // شبکه‌ی ناشناخته: همان چک قدیمی، تا تغییر شبکه‌ی درگاه برداشت را قفل نکند.
  return addr.trim().length >= 20;
}
