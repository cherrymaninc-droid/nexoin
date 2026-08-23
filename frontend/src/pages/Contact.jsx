import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { ArrowUpRight, Mail, Phone, MapPin, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COPY = {
  en: {
    tag: "Contact",
    title: "Let's talk freight.",
    desc: "Questions, partnerships or press — reach the NEXOIN desk directly, or send a message and we'll come back to you.",
    reach: "Reach us",
    fields: { name: "Your name", email: "Email", company: "Company", message: "Message" },
    submit: "Send message",
    submitting: "Sending…",
    success: "Message sent. We'll be in touch shortly.",
    error: "Something went wrong. Please try again.",
    locations: "Locations",
  },
  fr: {
    tag: "Contact",
    title: "Parlons transport.",
    desc: "Questions, partenariats ou presse — contactez directement l'équipe NEXOIN, ou envoyez un message et nous vous répondrons.",
    reach: "Nous joindre",
    fields: { name: "Votre nom", email: "E-mail", company: "Entreprise", message: "Message" },
    submit: "Envoyer le message",
    submitting: "Envoi…",
    success: "Message envoyé. Nous vous recontactons rapidement.",
    error: "Une erreur est survenue. Veuillez réessayer.",
    locations: "Implantations",
  },
  de: {
    tag: "Kontakt",
    title: "Sprechen wir über Fracht.",
    desc: "Fragen, Partnerschaften oder Presse — erreichen Sie das NEXOIN-Team direkt oder senden Sie uns eine Nachricht.",
    reach: "Kontakt",
    fields: { name: "Ihr Name", email: "E-Mail", company: "Unternehmen", message: "Nachricht" },
    submit: "Nachricht senden",
    submitting: "Senden…",
    success: "Nachricht gesendet. Wir melden uns in Kürze.",
    error: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    locations: "Standorte",
  },
};

const fieldCls =
  "bg-transparent border-0 border-b border-black/15 rounded-none px-0 h-12 text-[#0a0a0a] placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:border-[#0044ff] transition-colors";

const telHref = (phone) => "tel:" + (phone || "").replace(/[^+\d]/g, "");

const empty = { name: "", email: "", company: "", message: "" };

export default function Contact() {
  const { lang } = useLanguage();
  const { settings } = useSettings();
  const c = COPY[lang] || COPY.en;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/contacts`, { ...form, language: lang });
      setDone(true);
      toast.success(c.success);
      setForm(empty);
    } catch (err) {
      toast.error(c.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f4f3ef] text-[#0a0a0a] min-h-screen">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-6 md:px-10 pt-36 md:pt-48 pb-24">
        <div className="max-w-3xl">
          <span className="font-mono-tech text-xs uppercase tracking-[0.3em] text-[#0044ff]">{c.tag}</span>
          <h1 className="mt-6 font-display font-extrabold tracking-tighter text-5xl md:text-7xl leading-[0.92]">
            {c.title}
          </h1>
          <p className="mt-8 text-zinc-600 text-base md:text-lg leading-relaxed">{c.desc}</p>
        </div>

        <div className="mt-16 grid lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Info */}
          <div className="lg:col-span-4">
            <h2 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-6">{c.reach}</h2>
            <div className="space-y-5">
              <a
                data-testid="contact-email"
                href={`mailto:${settings.contact_email}`}
                className="flex items-center gap-3 text-lg font-display font-bold hover:text-[#0044ff] transition-colors"
              >
                <Mail size={18} className="text-[#0044ff]" /> {settings.contact_email}
              </a>
              <a
                data-testid="contact-phone"
                href={telHref(settings.contact_phone)}
                className="flex items-center gap-3 text-lg font-display font-bold hover:text-[#0044ff] transition-colors"
              >
                <Phone size={18} className="text-[#0044ff]" /> {settings.contact_phone}
              </a>
              <div className="pt-4 border-t border-black/10">
                <div className="flex items-center gap-2 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
                  <MapPin size={13} className="text-[#0044ff]" /> {c.locations}
                </div>
                <p data-testid="contact-locations" className="font-mono-tech text-sm text-zinc-700">{settings.contact_locations}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-8 lg:border-l border-black/10 lg:pl-16">
            {done ? (
              <motion.div
                data-testid="contact-success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-[30vh] flex flex-col items-start justify-center gap-6"
              >
                <div className="h-16 w-16 bg-[#0044ff] text-white flex items-center justify-center">
                  <Check size={28} />
                </div>
                <p className="font-display font-bold text-3xl md:text-4xl max-w-md leading-tight">{c.success}</p>
              </motion.div>
            ) : (
              <form onSubmit={submit} data-testid="contact-form" className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                <Field label={c.fields.name} required>
                  <Input data-testid="c-name" required value={form.name} onChange={set("name")} className={fieldCls} />
                </Field>
                <Field label={c.fields.email} required>
                  <Input data-testid="c-email" type="email" required value={form.email} onChange={set("email")} className={fieldCls} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={c.fields.company}>
                    <Input data-testid="c-company" value={form.company} onChange={set("company")} className={fieldCls} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={c.fields.message} required>
                    <Textarea
                      data-testid="c-message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={set("message")}
                      className="bg-transparent border-0 border-b border-black/15 rounded-none px-0 text-[#0a0a0a] placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:border-[#0044ff] resize-none"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    data-testid="contact-submit-btn"
                    disabled={loading}
                    className="group inline-flex items-center gap-3 bg-[#0044ff] text-white px-8 py-4 font-mono-tech text-xs uppercase tracking-widest hover:bg-[#0a0a0a] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? c.submitting : c.submit}
                    <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

const Field = ({ label, required, children }) => (
  <div className="flex flex-col gap-2">
    <Label className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">
      {label} {required && <span className="text-[#0044ff]">*</span>}
    </Label>
    {children}
  </div>
);
