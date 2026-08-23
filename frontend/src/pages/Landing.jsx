import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { Services } from "@/components/Services";
import { Manifesto } from "@/components/Manifesto";
import { Network } from "@/components/Network";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { useLanguage } from "@/context/LanguageContext";
import { scrollToId } from "@/hooks/useSmoothScroll";

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1571989928541-674d0cf46c4a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800",
  truck: "https://images.pexels.com/photos/1267325/pexels-photo-1267325.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=1200",
  van: "https://images.pexels.com/photos/19871521/pexels-photo-19871521.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=1200",
  highway: "https://images.pexels.com/photos/27732803/pexels-photo-27732803.jpeg?auto=compress&cs=tinysrgb&dpr=2&w=1600",
};

const Pillars = () => {
  const { t } = useLanguage();
  return (
    <section data-testid="pillars-strip" className="bg-white border-b border-black/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-black/10 border-x border-black/10">
        {t.pillars.map((p, i) => (
          <Reveal key={i} i={i} className="py-10 md:py-14 px-6">
            <div className="font-display font-bold tracking-tight text-2xl md:text-3xl text-[#0a0a0a]">{p.title}</div>
            <div className="mt-3 text-zinc-600 text-sm leading-relaxed">{p.text}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export default function Landing() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace("#", "");
      setTimeout(() => scrollToId(id), 400);
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="bg-[#f4f3ef]">
      <Navbar />
      <main>
        <Hero heroImg={IMAGES.hero} />
        <Marquee />
        <Pillars />
        <Services imgA={IMAGES.truck} imgB={IMAGES.van} />
        <Manifesto />
        <Network networkImg={IMAGES.highway} />
      </main>
      <Footer />
    </div>
  );
}
