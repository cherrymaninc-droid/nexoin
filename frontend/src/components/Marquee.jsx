import { useLanguage } from "@/context/LanguageContext";

export const Marquee = () => {
  const { t } = useLanguage();
  const items = [...t.marquee, ...t.marquee];
  return (
    <section data-testid="marquee" className="border-y border-black/10 bg-[#0a0a0a] py-8 overflow-hidden">
      <div className="nx-marquee-track">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center">
            {items.map((word, i) => (
              <span key={`${dup}-${i}`} className="flex items-center">
                <span className="font-display font-light text-3xl md:text-5xl text-white px-8 whitespace-nowrap">
                  {word}
                </span>
                <span className="h-2 w-2 rounded-full bg-[#0044ff]" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};
