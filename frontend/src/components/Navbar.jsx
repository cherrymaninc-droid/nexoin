import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { scrollToId } from "@/hooks/useSmoothScroll";

const Wordmark = ({ className = "" }) => (
  <span className={`font-display font-extrabold tracking-tight leading-none ${className}`}>
    NEXOIN
    <span className="text-[#0044ff]">.</span>
  </span>
);

export const Navbar = () => {
  const { t, lang, setLang, langs } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goSection = (id) => {
    setOpen(false);
    if (pathname !== "/") {
      navigate("/#" + id);
      return;
    }
    scrollToId(id);
  };

  const goContact = () => {
    setOpen(false);
    navigate("/contact");
  };

  const goCareers = () => {
    setOpen(false);
    navigate("/careers");
  };

  const scrollItems = [
    { id: "services", label: t.nav.services },
    { id: "manifesto", label: t.nav.manifesto },
    { id: "network", label: t.nav.network },
  ];

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-500 ${
        scrolled ? "bg-[#f4f3ef]/80 backdrop-blur-xl border-b border-black/10" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="text-2xl text-[#0a0a0a] hover:opacity-70 transition-opacity">
          <Wordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-9 font-mono-tech text-xs uppercase tracking-widest text-zinc-600">
          {scrollItems.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => goSection(item.id)}
              className="relative hover:text-[#0a0a0a] transition-colors duration-300 group"
            >
              {item.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#0044ff] transition-all duration-300 group-hover:w-full" />
            </button>
          ))}
          <button
            data-testid="nav-careers"
            onClick={goCareers}
            className="relative hover:text-[#0a0a0a] transition-colors duration-300 group"
          >
            {t.nav.careers}
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#0044ff] transition-all duration-300 group-hover:w-full" />
          </button>
          <button
            data-testid="nav-contact"
            onClick={goContact}
            className="relative hover:text-[#0a0a0a] transition-colors duration-300 group"
          >
            {t.nav.contact}
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#0044ff] transition-all duration-300 group-hover:w-full" />
          </button>
        </nav>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden sm:flex items-center gap-1 font-mono-tech text-xs">
            {langs.map((l) => (
              <button
                key={l}
                data-testid={`lang-${l}`}
                onClick={() => setLang(l)}
                className={`px-1.5 py-1 uppercase transition-colors duration-200 ${
                  lang === l ? "text-[#0a0a0a]" : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <Link
            to="/quote"
            data-testid="nav-quote-btn"
            className="hidden md:inline-flex items-center gap-2 bg-[#0a0a0a] text-white px-5 py-2.5 font-mono-tech text-xs uppercase tracking-widest hover:bg-[#0044ff] transition-colors duration-300"
          >
            {t.nav.quote}
            <ArrowUpRight size={14} />
          </Link>

          <button
            data-testid="mobile-menu-toggle"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden text-[#0a0a0a] p-1"
            aria-label="Menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden bg-white border-b border-black/10"
          >
            <div className="px-6 py-8 flex flex-col gap-6">
              {scrollItems.map((item) => (
                <button
                  key={item.id}
                  data-testid={`mobile-nav-${item.id}`}
                  onClick={() => goSection(item.id)}
                  className="text-left font-display text-3xl text-[#0a0a0a]"
                >
                  {item.label}
                </button>
              ))}
              <button
                data-testid="mobile-nav-careers"
                onClick={goCareers}
                className="text-left font-display text-3xl text-[#0a0a0a]"
              >
                {t.nav.careers}
              </button>
              <button
                data-testid="mobile-nav-contact"
                onClick={goContact}
                className="text-left font-display text-3xl text-[#0a0a0a]"
              >
                {t.nav.contact}
              </button>
              <Link
                to="/quote"
                data-testid="mobile-nav-quote"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center gap-2 bg-[#0044ff] text-white px-5 py-3 font-mono-tech text-xs uppercase tracking-widest w-max"
              >
                {t.nav.quote} <ArrowUpRight size={14} />
              </Link>
              <div className="flex items-center gap-4 pt-2 font-mono-tech text-sm">
                {langs.map((l) => (
                  <button
                    key={l}
                    data-testid={`mobile-lang-${l}`}
                    onClick={() => setLang(l)}
                    className={`uppercase ${lang === l ? "text-[#0044ff]" : "text-zinc-500"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export { Wordmark };
