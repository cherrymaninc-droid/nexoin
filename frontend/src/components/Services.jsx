import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Reveal, SectionTag } from "@/components/Reveal";

export const Services = ({ imgA, imgB }) => {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);

  return (
    <section id="services" data-testid="services-section" className="relative bg-[#070707] py-24 md:py-36">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-12 gap-6 items-end mb-16 md:mb-24">
          <div className="md:col-span-8">
            <Reveal>
              <SectionTag>{t.services.tag}</SectionTag>
            </Reveal>
            <Reveal i={1}>
              <h2 className="mt-5 font-display font-extrabold tracking-tighter text-4xl md:text-6xl lg:text-7xl leading-[0.95] text-white max-w-4xl">
                {t.services.title}
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          {/* Accordion list */}
          <div className="lg:col-span-7 border-t border-white/10">
            {t.services.items.map((item, i) => {
              const isActive = active === i;
              return (
                <div key={item.n} className="border-b border-white/10">
                  <button
                    data-testid={`service-item-${i}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => setActive(i)}
                    className="w-full py-7 md:py-9 flex items-start gap-6 text-left group"
                  >
                    <span className="font-mono-tech text-sm text-[#0044ff] pt-2 w-8 shrink-0">{item.n}</span>
                    <span className="flex-1">
                      <span
                        className={`font-display font-bold tracking-tight text-2xl md:text-4xl transition-colors duration-300 ${
                          isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                        }`}
                      >
                        {item.title}
                      </span>
                      <motion.span
                        initial={false}
                        animate={{ height: isActive ? "auto" : 0, opacity: isActive ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="block overflow-hidden"
                      >
                        <span className="block pt-4 max-w-xl text-zinc-400 text-base leading-relaxed">
                          {item.desc}
                        </span>
                      </motion.span>
                    </span>
                    <Plus
                      size={22}
                      className={`shrink-0 mt-2 text-zinc-500 transition-transform duration-300 ${
                        isActive ? "rotate-45 text-[#0044ff]" : ""
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Clipped image frames */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Reveal className="relative aspect-[4/5] overflow-hidden border border-white/10">
              <motion.img
                key={active}
                initial={{ scale: 1.12, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                src={active % 2 === 0 ? imgA : imgB}
                alt=""
                className="h-full w-full object-cover grayscale contrast-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070707]/70 to-transparent" />
              <div className="absolute bottom-4 left-4 font-mono-tech text-[11px] uppercase tracking-widest text-white/70">
                NEXOIN / {t.services.items[active].n}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
};
