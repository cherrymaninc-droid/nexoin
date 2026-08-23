import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Reveal, SectionTag } from "@/components/Reveal";

export const Network = ({ networkImg }) => {
  const { t } = useLanguage();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <section id="network" data-testid="network-section" className="relative bg-[#f4f3ef] py-24 md:py-36 border-t border-black/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <Reveal>
              <SectionTag>{t.network.tag}</SectionTag>
            </Reveal>
            <Reveal i={1}>
              <h2 className="mt-5 font-display font-extrabold tracking-tighter text-4xl md:text-6xl leading-[0.95] text-[#0a0a0a]">
                {t.network.title}
              </h2>
            </Reveal>
            <Reveal i={2}>
              <p className="mt-6 text-zinc-600 text-base md:text-lg leading-relaxed max-w-md">{t.network.desc}</p>
            </Reveal>

            <Reveal i={3}>
              <ul data-testid="network-hubs" className="mt-10 grid grid-cols-2 gap-x-6 border-t border-black/10">
                {t.network.hubs.map((hub, i) => (
                  <li
                    key={hub}
                    className="flex items-center gap-3 py-4 border-b border-black/10 font-mono-tech text-sm text-zinc-700"
                  >
                    <span className="text-[#0044ff] text-xs">{String(i + 1).padStart(2, "0")}</span>
                    {hub}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div ref={ref} className="lg:col-span-7 relative aspect-[16/12] overflow-hidden border border-black/10">
            <motion.img
              style={{ y }}
              src={networkImg}
              alt=""
              className="absolute inset-0 h-[130%] w-full object-cover grayscale contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-[#0044ff]/20" />
            <div className="absolute top-6 left-6 font-mono-tech text-[11px] uppercase tracking-widest text-white/80">
              France &#8644; Germany
            </div>
            <div className="absolute bottom-6 right-6 font-display font-extrabold text-3xl text-white">
              NEXOIN<span className="text-[#0044ff]">.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
