import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { Reveal } from "@/components/Reveal";

const telHref = (phone) => "tel:" + (phone || "").replace(/[^+\d]/g, "");

export const Footer = () => {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const year = new Date().getFullYear();

  return (
    <footer id="contact" data-testid="footer" className="relative bg-[#0a0a0a] text-white border-t border-black/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-28 border-b border-white/10">
        <div className="grid md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-8">
            <Reveal>
              <h2 className="font-display font-extrabold tracking-tighter text-4xl md:text-7xl leading-[0.95] text-white">
                {t.footer.cta}
              </h2>
            </Reveal>
            <Reveal i={1}>
              <p className="mt-5 text-zinc-400 text-lg">{t.footer.ctaDesc}</p>
            </Reveal>
          </div>
          <div className="md:col-span-4 md:flex md:justify-end">
            <Link
              to="/quote"
              data-testid="footer-quote-btn"
              className="group inline-flex items-center gap-3 bg-[#0044ff] text-white px-8 py-4 font-mono-tech text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors duration-300"
            >
              {t.footer.quote}
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-16 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="font-display font-extrabold tracking-tight text-3xl text-white">
            NEXOIN<span className="text-[#0044ff]">.</span>
          </div>
          <p className="mt-3 font-mono-tech text-xs uppercase tracking-[0.3em] text-zinc-500">{t.footer.descriptor}</p>
        </div>

        <div className="md:col-span-2">
          <h4 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-4">{t.footer.cols.company}</h4>
          <ul className="space-y-3 text-zinc-300 text-sm">
            <li><a href="#services" className="hover:text-white transition-colors">{t.footer.links.about}</a></li>
            <li><a href="#network" className="hover:text-white transition-colors">{t.footer.links.careers}</a></li>
            <li><a href="#manifesto" className="hover:text-white transition-colors">{t.footer.links.press}</a></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h4 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-4">{t.footer.cols.legal}</h4>
          <ul className="space-y-3 text-zinc-300 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">{t.footer.links.terms}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{t.footer.links.privacy}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{t.footer.links.imprint}</a></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h4 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-4">{t.footer.cols.contact}</h4>
          <ul className="space-y-3 text-zinc-300 text-sm font-mono-tech">
            <li>
              <a data-testid="footer-email" href={`mailto:${settings.contact_email}`} className="hover:text-[#0044ff] transition-colors">
                {settings.contact_email}
              </a>
            </li>
            <li>
              <a data-testid="footer-phone" href={telHref(settings.contact_phone)} className="hover:text-[#0044ff] transition-colors">
                {settings.contact_phone}
              </a>
            </li>
            <li data-testid="footer-locations" className="text-zinc-500">{settings.contact_locations}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">
          <span>© {year} NEXOIN — {t.footer.rights}</span>
          <span>B2B TRANSPORT · EUROPE</span>
        </div>
      </div>
    </footer>
  );
};
