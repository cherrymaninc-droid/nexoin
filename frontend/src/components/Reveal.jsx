import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 },
  }),
};

export const Reveal = ({ children, i = 0, className = "", testId }) => (
  <motion.div
    data-testid={testId}
    variants={fadeUp}
    custom={i}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-80px" }}
    className={className}
  >
    {children}
  </motion.div>
);

export const SectionTag = ({ children }) => (
  <span className="font-mono-tech text-xs uppercase tracking-[0.3em] text-[#0044ff]">{children}</span>
);
