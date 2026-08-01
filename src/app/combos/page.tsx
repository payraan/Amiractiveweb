import { redirect } from "next/navigation";

// کمبو به‌عنوان تب داخل پنل ترید ادغام شد.
export default function CombosRedirect() {
  redirect("/trade?tab=combo");
}
