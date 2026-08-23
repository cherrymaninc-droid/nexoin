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
  hero: "https://static.prod-images.emergentagent.com/jobs/2d80bc58-a5d4-4a6f-ac9c-71d83914dbad/images/157ec583c00e282fc35c604ea94f031499ba86565fee2ae5c10607a845f8e01f.jpeg",
  truck: "https://static.prod-images.emergentagent.com/jobs/2d80bc58-a5d4-4a6f-ac9c-71d83914dbad/images/85a8fd185a858f444157f85da358f0579b5ee04491066f9021f40c6e0f01167f.jpeg",
  van: "https://static.prod-images.emergentagent.com/jobs/2d80bc58-a5d4-4a6f-ac9c-71d83914dbad/images/e672e39e91b7ed3dbe18494920f5ed120235ccc81f33bf8253647ec15dfcfe56.jpeg",
  highway: "https://images.pexels.com/photos/33707847/pexels-photo-33707847.jpeg",
};

const Stats = () => {
  const { t } = useLanguage();
  return (
    <section data-testid="stats-strip" className="bg-white border-b border-black/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-black/10 border-x border-black/10">
        {t.stats.map((s, i) => (
          <Reveal key={i} i={i} className="py-10 md:py-14 px-6 text-center md:text-left">
            <div className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl text-[#0a0a0a]">{s.value}</div>
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
        <Stats />
        <Services imgA={IMAGES.truck} imgB={IMAGES.van} />
        <Manifesto />
        <Network networkImg={IMAGES.highway} />
      </main>
      <Footer />
    </div>
  );
}
