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

const IMAGES = {
  hero: "https://images.pexels.com/photos/27508769/pexels-photo-27508769.jpeg",
  port: "https://images.unsplash.com/photo-1590497008432-598f04441de8",
  warehouse: "https://images.pexels.com/photos/36398150/pexels-photo-36398150.jpeg",
  highway: "https://images.pexels.com/photos/33707847/pexels-photo-33707847.jpeg",
};

const Stats = () => {
  const { t } = useLanguage();
  return (
    <section data-testid="stats-strip" className="bg-[#070707] border-b border-white/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 border-x border-white/10">
        {t.stats.map((s, i) => (
          <Reveal key={i} i={i} className="py-10 md:py-14 px-6 text-center md:text-left">
            <div className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl text-white">{s.value}</div>
            <div className="mt-2 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">{s.label}</div>
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
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 300);
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="bg-[#070707]">
      <Navbar />
      <main>
        <Hero heroImg={IMAGES.hero} />
        <Marquee />
        <Stats />
        <Services imgA={IMAGES.warehouse} imgB={IMAGES.port} />
        <Manifesto />
        <Network networkImg={IMAGES.highway} />
      </main>
      <Footer />
    </div>
  );
}
