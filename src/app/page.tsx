import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import PredictTicker from "@/components/PredictTicker";
import Ticker from "@/components/Ticker";
import TradeSection from "@/components/TradeSection";
import MarketPulseSection from "@/components/MarketPulseSection";
import ComboSection from "@/components/ComboSection";
import PropSection from "@/components/PropSection";
import Faq from "@/components/Faq";
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
        <PredictTicker variant="ending" reverse />
        <MarketPulseSection />
        <PredictTicker variant="volume" />
        <ComboSection />
        <PredictTicker variant="ending" reverse />
        <PropSection />
        <Ticker />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
