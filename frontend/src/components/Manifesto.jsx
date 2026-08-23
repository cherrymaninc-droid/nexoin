import { useLanguage } from "@/context/LanguageContext";
import { Reveal, SectionTag } from "@/components/Reveal";

export const Manifesto = () => {
  const { t } = useLanguage();
  return (
    <section id="manifesto" data-testid="manifesto-section" className="relative bg-white py-24 md:py-36 border-t border-black/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="mb-16 md:mb-24 max-w-3xl">
          <Reveal>
            <SectionTag>{t.manifesto.tag}</SectionTag>
          </Reveal>
          <Reveal i={1}>
            <h2 className="mt-5 font-display font-extrabold tracking-tighter text-4xl md:text-6xl lg:text-7xl leading-[0.95] text-[#0a0a0a]">
              {t.manifesto.title}
            </h2>
          </Reveal>
        </div>

        <div className="grid md:grid-cols-2 border-t border-l border-black/10">
          {t.manifesto.chapters.map((c, i) => (
            <Reveal
              key={c.n}
              i={i}
              testId={`manifesto-chapter-${i}`}
              className="group relative border-b border-r border-black/10 p-8 md:p-12 min-h-[280px] flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute -right-4 -top-6 font-display font-extrabold text-[7rem] md:text-[9rem] leading-none text-black/[0.04] group-hover:text-[#0044ff]/20 transition-colors duration-500 select-none">
                {c.n}
              </div>
              <span className="font-mono-tech text-xs text-[#0044ff] relative z-10">CH.{c.n}</span>
              <div className="relative z-10">
                <h3 className="font-display font-bold tracking-tight text-2xl md:text-3xl text-[#0a0a0a]">{c.title}</h3>
                <p className="mt-4 text-zinc-600 leading-relaxed max-w-md">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
