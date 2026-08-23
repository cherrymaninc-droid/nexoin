import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { Wordmark } from "@/components/Navbar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const empty = {
  company: "",
  name: "",
  email: "",
  phone: "",
  origin: "",
  destination: "",
  cargoType: "",
  weight: "",
  frequency: "",
  message: "",
};

const fieldCls =
  "bg-transparent border-0 border-b border-black/15 rounded-none px-0 h-12 text-[#0a0a0a] placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:border-[#0044ff] transition-colors";

export default function Quote() {
  const { t, lang, setLang, langs } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/quotes`, { ...form, language: lang });
      setDone(true);
      toast.success(t.quote.success);
      setForm(empty);
      setTimeout(() => navigate("/"), 2600);
    } catch (err) {
      toast.error(t.quote.error);
    } finally {
      setLoading(false);
    }
  };

  const F = t.quote.fields;

  return (
    <div className="min-h-screen bg-[#f4f3ef] text-[#0a0a0a]">
      {/* Minimal top bar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#f4f3ef]/80 backdrop-blur-xl border-b border-black/10">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
          <Link to="/" data-testid="quote-logo" className="text-2xl">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1 font-mono-tech text-xs">
              {langs.map((l) => (
                <button
                  key={l}
                  data-testid={`quote-lang-${l}`}
                  onClick={() => setLang(l)}
                  className={`px-1.5 py-1 uppercase transition-colors ${lang === l ? "text-[#0a0a0a]" : "text-zinc-400 hover:text-zinc-700"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Link
              to="/"
              data-testid="quote-back"
              className="inline-flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest text-zinc-600 hover:text-[#0a0a0a] transition-colors"
            >
              <ArrowLeft size={14} /> {t.quote.back}
            </Link>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 max-w-[1400px] mx-auto">
        {/* Sticky left */}
        <div className="lg:col-span-5 px-6 md:px-10 pt-32 lg:pt-40 pb-10 lg:pb-20">
          <div className="lg:sticky lg:top-40">
            <span className="font-mono-tech text-xs uppercase tracking-[0.3em] text-[#0044ff]">{t.quote.tag}</span>
            <h1 className="mt-6 font-display font-extrabold tracking-tighter text-5xl md:text-7xl leading-[0.92]">
              {t.quote.title}
            </h1>
            <p className="mt-8 text-zinc-600 text-base md:text-lg leading-relaxed max-w-md">{t.quote.desc}</p>
            <div className="mt-10 font-mono-tech text-sm text-zinc-500">
              ops@nexoin.eu · +32 10 000 000
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-7 px-6 md:px-10 pt-8 lg:pt-40 pb-24 lg:border-l border-black/10">
          {done ? (
            <motion.div
              data-testid="quote-success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="min-h-[40vh] flex flex-col items-start justify-center gap-6"
            >
              <div className="h-16 w-16 bg-[#0044ff] text-white flex items-center justify-center">
                <Check size={28} />
              </div>
              <p className="font-display font-bold text-3xl md:text-4xl max-w-md leading-tight">{t.quote.success}</p>
            </motion.div>
          ) : (
            <form onSubmit={submit} data-testid="quote-form" className="grid sm:grid-cols-2 gap-x-8 gap-y-8 lg:max-w-2xl">
              <Field label={F.company} required>
                <Input data-testid="q-company" required value={form.company} onChange={set("company")} className={fieldCls} />
              </Field>
              <Field label={F.name} required>
                <Input data-testid="q-name" required value={form.name} onChange={set("name")} className={fieldCls} />
              </Field>
              <Field label={F.email} required>
                <Input data-testid="q-email" type="email" required value={form.email} onChange={set("email")} className={fieldCls} />
              </Field>
              <Field label={F.phone}>
                <Input data-testid="q-phone" value={form.phone} onChange={set("phone")} className={fieldCls} />
              </Field>
              <Field label={F.origin} required>
                <Input data-testid="q-origin" required value={form.origin} onChange={set("origin")} className={fieldCls} />
              </Field>
              <Field label={F.destination} required>
                <Input data-testid="q-destination" required value={form.destination} onChange={set("destination")} className={fieldCls} />
              </Field>
              <Field label={F.cargoType} required>
                <Select value={form.cargoType} onValueChange={set("cargoType")}>
                  <SelectTrigger data-testid="q-cargo" className={fieldCls}>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-black/10 text-[#0a0a0a]">
                    {t.quote.cargoOptions.map((o) => (
                      <SelectItem key={o} value={o} className="focus:bg-[#0044ff] focus:text-white">
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={F.weight}>
                <Input data-testid="q-weight" type="number" min="0" value={form.weight} onChange={set("weight")} className={fieldCls} />
              </Field>
              <Field label={F.frequency}>
                <Select value={form.frequency} onValueChange={set("frequency")}>
                  <SelectTrigger data-testid="q-frequency" className={fieldCls}>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-black/10 text-[#0a0a0a]">
                    {t.quote.freqOptions.map((o) => (
                      <SelectItem key={o} value={o} className="focus:bg-[#0044ff] focus:text-white">
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label={F.message}>
                  <Textarea
                    data-testid="q-message"
                    rows={4}
                    value={form.message}
                    onChange={set("message")}
                    className="bg-transparent border-0 border-b border-black/15 rounded-none px-0 text-[#0a0a0a] placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:border-[#0044ff] resize-none"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2 pt-4">
                <button
                  type="submit"
                  data-testid="quote-submit-btn"
                  disabled={loading}
                  className="group inline-flex items-center gap-3 bg-[#0044ff] text-white px-8 py-4 font-mono-tech text-xs uppercase tracking-widest hover:bg-[#0a0a0a] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? t.quote.submitting : t.quote.submit}
                  <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
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
