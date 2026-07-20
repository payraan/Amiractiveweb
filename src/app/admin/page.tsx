import type { Metadata } from "next";
import AdminPanel from "@/components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "مدیریت | امیراکتیو",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="min-h-screen">
      <AdminPanel />
    </main>
  );
}
