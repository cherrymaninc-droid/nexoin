import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { ArrowUpRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/context/LanguageContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COPY = {
  en: {
    tag: "Careers",
    title: "Grow with a new transport company.",
    desc: "NEXOIN is just getting started, and we're building our team and our partner network. If you're a driver, a subcontractor with your own vehicles, or someone who knows B2B road transport, we'd like to hear from you.",
    pitchTitle: "Who we're looking for",
    pitches: [
      "Drivers for regular European routes and express runs.",
      "Owner-operators and subcontractors with their own trucks or 3.5t vans.",
      "Dispatch and operations people who understand cross-border transport.",
    ],
    formTitle: "Apply spontaneously",
    fields: { name: "Your name", email: "Email", phone: "Phone", role: "You are a…", message: "Tell us about yourself" },
    roles: ["Driver", "Owner-operator / Subcontractor", "Dispatch / Operations", "Other"],
    submit: "Send application",
    submitting: "Sending…",
    success: "Application received. We'll be in touch.",
    error: "Something went wrong. Please try again.",
  },
  fr: {
    tag: "Carrières",
    title: "Grandissez avec une jeune entreprise de transport.",
    desc: "NEXOIN débute et construit son équipe et son réseau de partenaires. Que vous soyez chauffeur, sous-traitant avec vos propres véhicules ou connaisseur du transport routier B2B, nous serions ravis d'échanger avec vous.",
    pitchTitle: "Qui nous recherchons",
    pitches: [
      "Chauffeurs pour des lignes régulières européennes et des courses express.",
      "Artisans et sous-traitants disposant de leurs propres camions ou fourgons 3,5 t.",
      "Profils exploitation / dispatch qui maîtrisent le transport transfrontalier.",
    ],
    formTitle: "Candidature spontanée",
    fields: { name: "Votre nom", email: "E-mail", phone: "Téléphone", role: "Vous êtes…", message: "Parlez-nous de vous" },
    roles: ["Chauffeur", "Artisan / Sous-traitant", "Exploitation / Dispatch", "Autre"],
    submit: "Envoyer la candidature",
    submitting: "Envoi…",
    success: "Candidature reçue. Nous vous recontactons.",
    error: "Une erreur est survenue. Veuillez réessayer.",
  },
  de: {
    tag: "Karriere",
    title: "Wachsen Sie mit einem jungen Transportunternehmen.",
    desc: "NEXOIN fängt gerade an und baut Team und Partnernetzwerk auf. Ob Fahrer, Subunternehmer mit eigenen Fahrzeugen oder Kenner des B2B-Straßentransports — wir freuen uns, von Ihnen zu hören.",
    pitchTitle: "Wen wir suchen",
    pitches: [
      "Fahrer für regelmäßige europäische Linien und Expressfahrten.",
      "Selbstfahrer und Subunternehmer mit eigenen Lkw oder 3,5-t-Transportern.",
      "Disposition / Betrieb mit Erfahrung im grenzüberschreitenden Verkehr.",
    ],
    formTitle: "Initiativbewerbung",
    fields: { name: "Ihr Name", email: "E-Mail", phone: "Telefon", role: "Sie sind…", message: "Erzählen Sie uns von sich" },
    roles: ["Fahrer", "Selbstfahrer / Subunternehmer", "Disposition / Betrieb", "Sonstiges"],
    submit: "Bewerbung senden",
    submitting: "Senden…",
    success: "Bewerbung erhalten. Wir melden uns bei Ihnen.",
    error: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
  },
};

const fieldCls =
  "bg-transparent border-0 border-b border-black/15 rounded-none px-0 h-12 text-[#0a0a0a] placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:border-[#0044ff] transition-colors";

const empty = { name: "", email: "", phone: "", role: "", message: "" };

export default function Careers() {
  const { lang } = useLanguage();
  const c = COPY[lang] || COPY.en;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/applications`, { ...form, language: lang });
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
          <h1 className="mt-6 font-display font-extrabold tracking-tighter text-5xl md:text-7xl leading-[0.92]">{c.title}</h1>
          <p className="mt-8 text-zinc-600 text-base md:text-lg leading-relaxed">{c.desc}</p>
        </div>

        <div className="mt-16 grid lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-5">
            <h2 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-6">{c.pitchTitle}</h2>
            <ul className="border-t border-black/10">
              {c.pitches.map((p, i) => (
                <li key={i} className="flex gap-4 py-5 border-b border-black/10">
                  <span className="font-mono-tech text-xs text-[#0044ff] pt-1">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-zinc-700 leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7 lg:border-l border-black/10 lg:pl-16">
            <h2 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-8">{c.formTitle}</h2>
            {done ? (
              <motion.div data-testid="careers-success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-[30vh] flex flex-col items-start justify-center gap-6">
                <div className="h-16 w-16 bg-[#0044ff] text-white flex items-center justify-center"><Check size={28} /></div>
                <p className="font-display font-bold text-3xl md:text-4xl max-w-md leading-tight">{c.success}</p>
              </motion.div>
            ) : (
              <form onSubmit={submit} data-testid="careers-form" className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                <Field label={c.fields.name} required>
                  <Input data-testid="a-name" required value={form.name} onChange={set("name")} className={fieldCls} />
                </Field>
                <Field label={c.fields.email} required>
                  <Input data-testid="a-email" type="email" required value={form.email} onChange={set("email")} className={fieldCls} />
                </Field>
                <Field label={c.fields.phone}>
                  <Input data-testid="a-phone" value={form.phone} onChange={set("phone")} className={fieldCls} />
                </Field>
                <Field label={c.fields.role} required>
                  <Select value={form.role} onValueChange={set("role")}>
                    <SelectTrigger data-testid="a-role" className={fieldCls}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="bg-white border-black/10 text-[#0a0a0a]">
                      {c.roles.map((o) => (
                        <SelectItem key={o} value={o} className="focus:bg-[#0044ff] focus:text-white">{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={c.fields.message}>
                    <Textarea data-testid="a-message" rows={4} value={form.message} onChange={set("message")}
                      className="bg-transparent border-0 border-b border-black/15 rounded-none px-0 text-[#0a0a0a] placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:border-[#0044ff] resize-none" />
                  </Field>
                </div>
                <div className="sm:col-span-2 pt-2">
                  <button type="submit" data-testid="careers-submit-btn" disabled={loading}
                    className="group inline-flex items-center gap-3 bg-[#0044ff] text-white px-8 py-4 font-mono-tech text-xs uppercase tracking-widest hover:bg-[#0a0a0a] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed">
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
