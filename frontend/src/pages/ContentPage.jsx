import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/context/LanguageContext";
import { legalContent } from "@/pages/legalContent";

export default function ContentPage({ pageKey }) {
  const { lang } = useLanguage();
  const c = (legalContent[lang] || legalContent.en)[pageKey];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pageKey]);

  return (
    <div className="bg-[#f4f3ef] text-[#0a0a0a] min-h-screen">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-6 md:px-10 pt-36 md:pt-48 pb-24" data-testid={`content-${pageKey}`}>
        <div className="max-w-3xl">
          <span className="font-mono-tech text-xs uppercase tracking-[0.3em] text-[#0044ff]">{c.tag}</span>
          <h1 className="mt-6 font-display font-extrabold tracking-tighter text-5xl md:text-7xl leading-[0.92]">{c.title}</h1>
          <p className="mt-8 text-zinc-600 text-base md:text-lg leading-relaxed">{c.intro}</p>
        </div>

        <div className="mt-16 border-t border-black/10 max-w-3xl">
          {c.sections.map((s, i) => (
            <div key={i} className="py-8 border-b border-black/10">
              <h2 className="font-display font-bold tracking-tight text-xl md:text-2xl">{s.h}</h2>
              <p className="mt-3 text-zinc-600 leading-relaxed">{s.p}</p>
            </div>
          ))}
        </div>

        {c.note ? (
          <p className="mt-8 max-w-3xl font-mono-tech text-[11px] uppercase tracking-widest text-zinc-400">{c.note}</p>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
