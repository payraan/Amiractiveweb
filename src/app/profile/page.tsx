import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ProfilePanel from "@/components/predict/ProfilePanel";

export const metadata: Metadata = {
  title: "پنل کاربری | نارمون",
  description:
    "کارنامه‌ی پیش‌بینی، سود و زیان، کیف پول، تاریخچه‌ی تراکنش‌ها و جایگاه رتبه‌ی شما در نارمون.",
};

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 md:px-6">
        <ProfilePanel />
      </main>
      <Footer />
    </>
  );
}
