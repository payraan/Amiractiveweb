import CandleField from "@/components/CandleField";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Ticker from "@/components/Ticker";
import Results from "@/components/Results";
import Bot from "@/components/Bot";

export default function Home() {
  return (
    <>
      <CandleField />
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <Results />
        <Bot />
      </main>
    </>
  );
}
