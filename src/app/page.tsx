import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Ticker from "@/components/Ticker";
import Results from "@/components/Results";
import Bot from "@/components/Bot";
import Broker from "@/components/Broker";
import Faq from "@/components/Faq";
import ArenaSection from "@/components/ArenaSection";
import MarketPulseSection from "@/components/MarketPulseSection";
import Legal from "@/components/Legal";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <CandleField />
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <ArenaSection />
        <MarketPulseSection />
        <Results />
        <Bot />
        <Broker />
        <Faq />
        <Legal />
      </main>
      <Footer />
    </>
  );
}
