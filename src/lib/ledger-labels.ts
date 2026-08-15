// برچسب فارسی هر نوع تراکنش دفترکل — یک منبع برای سایت، مینی‌اپ و ربات.
//
// این نگاشت در چهار جا کپی شده بود و هر کپی چند نوع را جا انداخته بود، پس
// همان ردیف در سایت «کارمزد ایجاد بازار» و در ربات `ir_propose_fee` دیده
// می‌شد. کلید ترجمه‌نشده به کاربر، بدترین حالت است: نه معنایی دارد و نه
// خطایی می‌دهد که کسی متوجهش شود.
//
// عمدا هیچ ایمپورتی ندارد تا کامپوننت‌های "use client" هم بتوانند بخوانندش.
//
// ⚠️ هر `kind` تازه‌ای که به `moveFunds` داده می‌شود باید همین‌جا هم اضافه
// شود. فهرست فعلی از خود کد درآمده است:
//   deposit · withdraw_hold · withdraw_refund · ir_bet · ir_payout ·
//   ir_refund · ir_propose_fee · ir_propose_refund · ir_boost ·
//   credit_purchase ·
//   admin_adjust

export const LEDGER_LABEL: Record<string, string> = {
  deposit: "واریز",
  withdraw_hold: "برداشت",
  withdraw_refund: "برگشت برداشت",
  ir_bet: "ثبت پیش‌بینی (بازار ایران)",
  ir_payout: "پاداش پیش‌بینی موفق",
  ir_refund: "بازگشت مبلغ پیش‌بینی",
  ir_propose_fee: "کارمزد ایجاد بازار",
  ir_boost: "بوست بازار",
  ir_propose_refund: "برگشت هزینه‌ی ساخت بازار",
  credit_purchase: "خرید MOON",
  admin_adjust: "اصلاح سیستمی",
};

/**
 * برچسب یک تراکنش. نوع ناشناخته کلید خام را برنمی‌گرداند، چون کاربر نباید
 * `ir_propose_fee` ببیند؛ یک عبارت عمومی بی‌ضرر بهتر است.
 */
export function ledgerLabel(kind: string): string {
  return LEDGER_LABEL[kind] ?? "تراکنش";
}
