import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import PredictTicker from "@/components/PredictTicker";
import Ticker from "@/components/Ticker";
import TradeSection from "@/components/TradeSection";
import ArenaSection from "@/components/ArenaSection";
import MarketPulseSection from "@/components/MarketPulseSection";
import ComboSection from "@/components/ComboSection";
import Faq from "@/components/Faq";
import Legal from "@/components/Legal";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <CandleField />
      <Nav />
      <main>
        <Hero />
        <PredictTicker variant="volume" />
        <TradeSection />
        <ArenaSection />
        <PredictTicker variant="ending" reverse />
        <MarketPulseSection />
        <ComboSection />
        <Ticker />
        <Faq />
        <Legal />
      </main>
      <Footer />
    </>
  );
}
