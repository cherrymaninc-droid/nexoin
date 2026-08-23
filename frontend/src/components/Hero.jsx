import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const lineReveal = {
  hidden: { y: "110%" },
  visible: (i) => ({
    y: "0%",
    transition: { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 + i * 0.12 },
  }),
};

const Line = ({ children, i, accent }) => (
  <span className="block overflow-hidden">
    <motion.span
      custom={i}
      variants={lineReveal}
      initial="hidden"
      animate="visible"
      className={`block ${accent ? "text-[#0044ff]" : "text-[#0a0a0a]"}`}
    >
      {children}
    </motion.span>
  </span>
);

export const Hero = ({ heroImg }) => {
  const { t } = useLanguage();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const overlayY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  return (
    <section ref={ref} data-testid="hero-section" className="relative min-h-screen w-full overflow-hidden bg-[#f4f3ef]">
      {/* Parallax background image */}
      <motion.div style={{ y: imgY }} className="absolute inset-0 -z-10 scale-110">
        <img
          src={heroImg}
          alt=""
          className="h-full w-full object-cover object-center opacity-25 grayscale contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f4f3ef]/50 via-[#f4f3ef]/70 to-[#f4f3ef]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f4f3ef] via-[#f4f3ef]/20 to-transparent" />
      </motion.div>

      <motion.div
        style={{ y: overlayY }}
        className="max-w-[1400px] mx-auto px-6 md:px-10 pt-40 md:pt-52 pb-16 min-h-screen flex flex-col justify-between"
      >
        <div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            data-testid="hero-tag"
            className="font-mono-tech text-xs md:text-sm uppercase tracking-[0.35em] text-zinc-600 flex items-center gap-3"
          >
            <span className="inline-block h-1.5 w-1.5 bg-[#0044ff]" />
            {t.hero.tag}
          </motion.p>

          <h1 className="mt-8 font-display font-extrabold tracking-tighter leading-[0.92] text-[15vw] md:text-[9.5vw] lg:text-[8.5vw]">
            <Line i={0}>{t.hero.line1}</Line>
            <Line i={1}>{t.hero.line2}</Line>
            <Line i={2} accent>
              {t.hero.line3}
            </Line>
          </h1>
        </div>

        <div className="grid md:grid-cols-12 gap-8 items-end">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.9 }}
            data-testid="hero-intro"
            className="md:col-span-6 lg:col-span-5 text-zinc-700 text-base md:text-lg leading-relaxed"
          >
            {t.hero.intro}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.05 }}
            className="md:col-span-6 lg:col-span-7 flex flex-col md:items-end gap-6"
          >
            <Link
              to="/quote"
              data-testid="hero-cta"
              className="group inline-flex items-center gap-3 bg-[#0044ff] text-white px-8 py-4 font-mono-tech text-xs uppercase tracking-widest hover:bg-[#0a0a0a] transition-colors duration-300"
            >
              {t.hero.cta}
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Link>
            <span className="hidden md:flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">
              <ArrowDown size={13} className="animate-bounce" />
              {t.hero.scroll}
            </span>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
