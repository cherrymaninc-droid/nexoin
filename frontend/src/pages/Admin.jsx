import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { RefreshCw, ArrowLeft, Mail, Phone, MapPin, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/Navbar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUSES = ["new", "contacted", "closed"];
const STATUS_STYLE = {
  new: "bg-[#0044ff] text-white",
  contacted: "bg-amber-400 text-black",
  closed: "bg-zinc-300 text-zinc-700",
};

export default function Admin() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/quotes`);
      setQuotes(data);
    } catch (e) {
      toast.error("Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = "en";
    load();
  }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/quotes/${id}`, { status });
      setQuotes((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
      toast.success(`Marked as ${status}`);
    } catch (e) {
      toast.error("Update failed");
    }
  };

  const filtered = quotes.filter((x) => {
    const okStatus = filter === "all" || x.status === filter;
    const hay = `${x.company} ${x.name} ${x.email} ${x.origin} ${x.destination}`.toLowerCase();
    return okStatus && hay.includes(q.toLowerCase());
  });

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: quotes.filter((x) => x.status === s).length }), {});

  return (
    <div className="min-h-screen bg-[#f4f3ef] text-[#0a0a0a]">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-2xl" data-testid="admin-logo">
              <Wordmark />
            </Link>
            <span className="hidden sm:inline font-mono-tech text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              / Quotes Console
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              data-testid="admin-refresh"
              onClick={load}
              className="inline-flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest text-zinc-600 hover:text-[#0a0a0a] transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest text-zinc-600 hover:text-[#0a0a0a] transition-colors"
            >
              <ArrowLeft size={14} /> Site
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl">Incoming requests.</h1>
            <p className="mt-3 font-mono-tech text-xs uppercase tracking-widest text-zinc-500">
              {quotes.length} total · {counts.new || 0} new · {counts.contacted || 0} contacted · {counts.closed || 0} closed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                data-testid="admin-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="bg-white border border-black/10 rounded-none pl-9 pr-4 h-11 w-56 text-sm focus:outline-none focus:border-[#0044ff] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              data-testid={`admin-filter-${s}`}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 font-mono-tech text-[11px] uppercase tracking-widest border transition-colors ${
                filter === s ? "bg-[#0a0a0a] text-white border-[#0a0a0a]" : "bg-transparent text-zinc-600 border-black/15 hover:border-[#0a0a0a]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-24 text-center font-mono-tech text-sm text-zinc-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div data-testid="admin-empty" className="py-24 text-center font-mono-tech text-sm text-zinc-500 border border-dashed border-black/15">
            No requests found.
          </div>
        ) : (
          <div className="grid gap-4" data-testid="admin-quotes-list">
            {filtered.map((x) => (
              <div
                key={x.id}
                data-testid={`admin-quote-${x.id}`}
                className="bg-white border border-black/10 p-6 md:p-8 grid md:grid-cols-12 gap-6 hover:border-[#0044ff]/40 transition-colors"
              >
                <div className="md:col-span-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 font-mono-tech text-[10px] uppercase tracking-widest ${STATUS_STYLE[x.status]}`}>
                      {x.status}
                    </span>
                    <span className="font-mono-tech text-[11px] text-zinc-400 uppercase">{(x.language || "en").toUpperCase()}</span>
                  </div>
                  <h3 className="mt-3 font-display font-bold text-2xl tracking-tight">{x.company}</h3>
                  <p className="text-zinc-600 text-sm mt-1">{x.name}</p>
                  <div className="mt-3 space-y-1.5 font-mono-tech text-xs text-zinc-600">
                    <a href={`mailto:${x.email}`} className="flex items-center gap-2 hover:text-[#0044ff]">
                      <Mail size={12} /> {x.email}
                    </a>
                    {x.phone ? (
                      <span className="flex items-center gap-2">
                        <Phone size={12} /> {x.phone}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="md:col-span-5 md:border-l border-black/10 md:pl-6">
                  <div className="flex items-center gap-2 font-mono-tech text-xs text-zinc-500 uppercase tracking-widest">
                    <MapPin size={12} className="text-[#0044ff]" /> Route
                  </div>
                  <p className="mt-2 text-lg font-display font-bold">
                    {x.origin} <span className="text-[#0044ff]">→</span> {x.destination}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono-tech text-xs text-zinc-600">
                    <span className="flex items-center gap-2"><Package size={12} /> {x.cargoType || "—"}</span>
                    {x.weight ? <span>{x.weight} kg</span> : null}
                    {x.frequency ? <span>{x.frequency}</span> : null}
                  </div>
                  {x.message ? <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{x.message}</p> : null}
                  <p className="mt-3 font-mono-tech text-[10px] text-zinc-400">
                    {new Date(x.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="md:col-span-3 md:border-l border-black/10 md:pl-6 flex flex-col gap-2">
                  <span className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Set status</span>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      data-testid={`admin-set-${s}-${x.id}`}
                      onClick={() => updateStatus(x.id, s)}
                      disabled={x.status === s}
                      className={`px-4 py-2 text-left font-mono-tech text-[11px] uppercase tracking-widest border transition-colors ${
                        x.status === s
                          ? "bg-[#0a0a0a] text-white border-[#0a0a0a] cursor-default"
                          : "border-black/15 text-zinc-700 hover:border-[#0044ff] hover:text-[#0044ff]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
