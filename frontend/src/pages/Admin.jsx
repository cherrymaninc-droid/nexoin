import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { RefreshCw, ArrowLeft, Mail, Phone, MapPin, Package, Search, Settings, Save, Pencil, Trash2, X, LogOut, Lock, Download, LayoutDashboard, Users, Truck, FileText, Briefcase, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/context/SettingsContext";
import { CrudSection, CLIENT_FIELDS, CLIENT_COLUMNS, VEHICLE_FIELDS, VEHICLE_COLUMNS, USER_FIELDS, USER_COLUMNS } from "@/pages/AdminEntities";
import { Wordmark } from "@/components/Navbar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TOKEN_KEY = "nexoin-admin-token";
const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } });

const STATUSES = ["new", "contacted", "closed"];
const STATUS_STYLE = {
  new: "bg-[#0044ff] text-white",
  contacted: "bg-amber-400 text-black",
  closed: "bg-zinc-300 text-zinc-700",
};

const EDIT_FIELDS = [
  ["company", "Company"],
  ["name", "Contact name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["origin", "Origin"],
  ["destination", "Destination"],
  ["cargoType", "Cargo type"],
  ["weight", "Weight (kg)"],
  ["frequency", "Frequency"],
];

export default function Admin() {
  const [tab, setTab] = useState("dashboard");
  const [quotes, setQuotes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const role = me?.role;
  const isAdmin = role === "admin";
  const canManage = role === "admin" || role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await axios.get(`${API}/auth/me`, authHeaders());
      setMe(meRes.data);
      const [qs, cs, as, st] = await Promise.all([axios.get(`${API}/quotes`, authHeaders()), axios.get(`${API}/contacts`, authHeaders()), axios.get(`${API}/applications`, authHeaders()), axios.get(`${API}/dashboard`, authHeaders())]);
      setQuotes(qs.data);
      setContacts(cs.data);
      setApplications(as.data);
      setStats(st.data);
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = "en";
    if (token) load();
  }, [load, token]);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/quotes/${id}`, { status }, authHeaders());
      setQuotes((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
      toast.success(`Marked as ${status}`);
    } catch (e) {
      toast.error("Update failed");
    }
  };

  const deleteQuote = async (id) => {
    if (!window.confirm("Delete this request permanently?")) return;
    try {
      await axios.delete(`${API}/quotes/${id}`, authHeaders());
      setQuotes((prev) => prev.filter((x) => x.id !== id));
      toast.success("Request deleted");
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const deleteContact = async (id) => {
    if (!window.confirm("Delete this enquiry permanently?")) return;
    try {
      await axios.delete(`${API}/contacts/${id}`, authHeaders());
      setContacts((prev) => prev.filter((x) => x.id !== id));
      toast.success("Enquiry deleted");
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const deleteApplication = async (id) => {
    if (!window.confirm("Delete this application permanently?")) return;
    try {
      await axios.delete(`${API}/applications/${id}`, authHeaders());
      setApplications((prev) => prev.filter((x) => x.id !== id));
      toast.success("Application deleted");
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const downloadCv = async (x) => {
    try {
      const res = await axios.get(`${API}/applications/cv/${x.cv_path}`, { ...authHeaders(), responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = x.cv_filename || "cv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Download failed");
    }
  };

  const saveEdit = async (form) => {
    try {
      const { data } = await axios.put(`${API}/quotes/${form.id}`, form, authHeaders());
      setQuotes((prev) => prev.map((x) => (x.id === form.id ? data : x)));
      setEditing(null);
      toast.success("Request updated");
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

  if (!token) {
    return <AdminLogin onSuccess={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f3ef] text-[#0a0a0a]">
      <header className="border-b border-black/10 bg-white sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-2xl" data-testid="admin-logo">
              <Wordmark />
            </Link>
            <span className="hidden sm:inline font-mono-tech text-[11px] uppercase tracking-[0.3em] text-zinc-500">/ Console</span>
          </div>
          <div className="flex items-center gap-4">
            {me && (
              <span data-testid="admin-current-user" className="hidden md:inline font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">
                {me.name} · <span className="text-[#0044ff]">{me.role}</span>
              </span>
            )}
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
            <button
              data-testid="admin-logout"
              onClick={logout}
              className="inline-flex items-center gap-2 font-mono-tech text-xs uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 md:py-14">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-10 border-b border-black/10 overflow-x-auto">
          {[
            ["dashboard", "Dashboard"],
            ["quotes", `Quotes (${quotes.length})`],
            ["clients", "Clients"],
            ["vehicles", "Vehicles"],
            ["contacts", `Enquiries (${contacts.length})`],
            ["applications", `Applications (${applications.length})`],
            ...(isAdmin ? [["team", "Team"], ["settings", "Settings"]] : []),
          ].map(([k, label]) => (
            <button
              key={k}
              data-testid={`admin-tab-${k}`}
              onClick={() => setTab(k)}
              className={`px-5 py-3 whitespace-nowrap font-mono-tech text-[11px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
                tab === k ? "border-[#0044ff] text-[#0a0a0a]" : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <DashboardOverview stats={stats} loading={loading} onGo={setTab} me={me} />}

        {tab === "team" && isAdmin && (
          <CrudSection endpoint="users" title="Team." columns={USER_COLUMNS} fields={USER_FIELDS} onChanged={load} />
        )}

        {tab === "settings" && isAdmin && <SettingsPanel />}

        {tab === "quotes" && (
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h1 className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl">Quote requests.</h1>
                <p className="mt-3 font-mono-tech text-xs uppercase tracking-widest text-zinc-500">
                  {quotes.length} total · {counts.new || 0} new · {counts.contacted || 0} contacted · {counts.closed || 0} closed
                </p>
              </div>
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
                          <span className="flex items-center gap-2"><Phone size={12} /> {x.phone}</span>
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
                      <p className="mt-3 font-mono-tech text-[10px] text-zinc-400">{new Date(x.created_at).toLocaleString()}</p>
                    </div>

                    <div className="md:col-span-3 md:border-l border-black/10 md:pl-6 flex flex-col gap-2">
                      <span className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Status</span>
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
                      <div className="flex gap-2 mt-2">
                        {canManage && <>
                        <button
                          data-testid={`admin-edit-${x.id}`}
                          onClick={() => setEditing(x)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 hover:border-[#0044ff] hover:text-[#0044ff] transition-colors"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          data-testid={`admin-delete-${x.id}`}
                          onClick={() => deleteQuote(x.id)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 text-red-500 hover:border-red-500 transition-colors"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                        </>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "clients" && (
          <CrudSection endpoint="clients" title="Clients." columns={CLIENT_COLUMNS} fields={CLIENT_FIELDS} readOnly={!canManage} />
        )}

        {tab === "vehicles" && (
          <CrudSection endpoint="vehicles" title="Vehicles." columns={VEHICLE_COLUMNS} fields={VEHICLE_FIELDS} readOnly={!canManage} />
        )}

        {tab === "contacts" && (
          <>
            <h1 className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl mb-8">Enquiries.</h1>
            {loading ? (
              <div className="py-24 text-center font-mono-tech text-sm text-zinc-500">Loading…</div>
            ) : contacts.length === 0 ? (
              <div data-testid="admin-contacts-empty" className="py-24 text-center font-mono-tech text-sm text-zinc-500 border border-dashed border-black/15">
                No enquiries yet.
              </div>
            ) : (
              <div className="grid gap-4" data-testid="admin-contacts-list">
                {contacts.map((x) => (
                  <div key={x.id} data-testid={`admin-contact-${x.id}`} className="bg-white border border-black/10 p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display font-bold text-xl tracking-tight">{x.name}</h3>
                        <span className="font-mono-tech text-[11px] text-zinc-400 uppercase">{(x.language || "en").toUpperCase()}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono-tech text-xs text-zinc-600">
                        <a href={`mailto:${x.email}`} className="flex items-center gap-2 hover:text-[#0044ff]"><Mail size={12} /> {x.email}</a>
                        {x.company ? <span>{x.company}</span> : null}
                      </div>
                      <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{x.message}</p>
                      <p className="mt-3 font-mono-tech text-[10px] text-zinc-400">{new Date(x.created_at).toLocaleString()}</p>
                    </div>
                    {canManage && <button
                      data-testid={`admin-contact-delete-${x.id}`}
                      onClick={() => deleteContact(x.id)}
                      className="self-start inline-flex items-center gap-2 px-4 py-2 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 text-red-500 hover:border-red-500 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "applications" && (
          <>
            <h1 className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl mb-8">Applications.</h1>
            {loading ? (
              <div className="py-24 text-center font-mono-tech text-sm text-zinc-500">Loading…</div>
            ) : applications.length === 0 ? (
              <div data-testid="admin-applications-empty" className="py-24 text-center font-mono-tech text-sm text-zinc-500 border border-dashed border-black/15">
                No applications yet.
              </div>
            ) : (
              <div className="grid gap-4" data-testid="admin-applications-list">
                {applications.map((x) => (
                  <div key={x.id} data-testid={`admin-application-${x.id}`} className="bg-white border border-black/10 p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 font-mono-tech text-[10px] uppercase tracking-widest bg-[#0044ff] text-white">{x.role}</span>
                        <span className="font-mono-tech text-[11px] text-zinc-400 uppercase">{(x.language || "en").toUpperCase()}</span>
                      </div>
                      <h3 className="mt-3 font-display font-bold text-xl tracking-tight">{x.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono-tech text-xs text-zinc-600">
                        <a href={`mailto:${x.email}`} className="flex items-center gap-2 hover:text-[#0044ff]"><Mail size={12} /> {x.email}</a>
                        {x.phone ? <span className="flex items-center gap-2"><Phone size={12} /> {x.phone}</span> : null}
                      </div>
                      {x.message ? <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{x.message}</p> : null}
                      <p className="mt-3 font-mono-tech text-[10px] text-zinc-400">{new Date(x.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {x.cv_path ? (
                        <button data-testid={`admin-application-cv-${x.id}`} onClick={() => downloadCv(x)} className="inline-flex items-center gap-2 px-4 py-2 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 hover:border-[#0044ff] hover:text-[#0044ff] transition-colors">
                        <Download size={12} /> CV
                      </button>
                      ) : null}
                      <button data-testid={`admin-application-delete-${x.id}`} onClick={() => deleteApplication(x.id)} className={`inline-flex items-center gap-2 px-4 py-2 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 text-red-500 hover:border-red-500 transition-colors ${canManage ? "" : "hidden"}`}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editing ? <EditModal quote={editing} onClose={() => setEditing(null)} onSave={saveEdit} /> : null}
    </div>
  );
}

function DashboardOverview({ stats, loading, onGo, me }) {
  if (loading || !stats) {
    return <div className="py-24 text-center font-mono-tech text-sm text-zinc-500">Loading overview…</div>;
  }

  const cards = [
    { key: "clients", label: "Clients", icon: Users, value: stats.clients, sub: `${stats.clients_active} active`, go: "clients" },
    { key: "vehicles", label: "Vehicles", icon: Truck, value: stats.vehicles, sub: `${stats.vehicles_available} available`, go: "vehicles" },
    { key: "quotes", label: "Quote requests", icon: FileText, value: stats.quotes, sub: `${stats.quotes_new} new`, go: "quotes" },
    { key: "applications", label: "Applications", icon: Briefcase, value: stats.applications, sub: `${stats.contacts} enquiries`, go: "applications" },
  ];

  return (
    <div data-testid="admin-dashboard">
      <div className="flex items-center gap-3 mb-10">
        <LayoutDashboard size={24} className="text-[#0044ff]" />
        <div>
          <h1 className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl leading-none">Overview.</h1>
          {me && <p className="mt-2 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">Welcome back, {me.name} · {me.role}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
        {cards.map((c) => (
          <button
            key={c.key}
            data-testid={`dashboard-card-${c.key}`}
            onClick={() => onGo(c.go)}
            className="group text-left bg-white border border-black/10 p-6 md:p-8 hover:border-[#0044ff] transition-colors"
          >
            <div className="flex items-start justify-between">
              <c.icon size={20} className="text-[#0044ff]" />
              <ArrowUpRight size={16} className="text-zinc-300 group-hover:text-[#0044ff] transition-colors" />
            </div>
            <div className="mt-6 font-display font-extrabold tracking-tighter text-5xl">{c.value}</div>
            <div className="mt-2 font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">{c.label}</div>
            <div className="mt-1 font-mono-tech text-[11px] text-[#0044ff]">{c.sub}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-black/10 p-6 md:p-8" data-testid="dashboard-recent-quotes">
          <h2 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-6">Recent quote requests</h2>
          {(!stats.recent_quotes || stats.recent_quotes.length === 0) ? (
            <p className="font-mono-tech text-xs text-zinc-400">No quotes yet.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {stats.recent_quotes.map((x, i) => (
                <div key={i} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-base truncate">{x.company || x.name}</p>
                    <p className="font-mono-tech text-[11px] text-zinc-500 truncate">{x.origin} → {x.destination}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 font-mono-tech text-[10px] uppercase tracking-widest ${STATUS_STYLE[x.status] || ""}`}>{x.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/10 p-6 md:p-8" data-testid="dashboard-recent-clients">
          <h2 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-6">Recent clients</h2>
          {(!stats.recent_clients || stats.recent_clients.length === 0) ? (
            <p className="font-mono-tech text-xs text-zinc-400">No clients yet.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {stats.recent_clients.map((x, i) => (
                <div key={i} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-base truncate">{x.company_name}</p>
                    <p className="font-mono-tech text-[11px] text-zinc-500 truncate">{x.contact_person || x.email}</p>
                  </div>
                  <span className="shrink-0 font-mono-tech text-[10px] uppercase tracking-widest text-zinc-400">{x.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditModal({ quote, onClose, onSave }) {
  const [form, setForm] = useState(quote);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 bg-black/40 overflow-y-auto" data-testid="admin-edit-modal">
      <div className="bg-white border border-black/10 w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h3 className="font-display font-bold text-xl">Edit request</h3>
          <button data-testid="admin-edit-cancel" onClick={onClose} className="text-zinc-500 hover:text-[#0a0a0a]">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-x-6 gap-y-5 max-h-[65vh] overflow-y-auto">
          {EDIT_FIELDS.map(([k, label]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">{label}</label>
              <input
                data-testid={`edit-${k}`}
                value={form[k] || ""}
                onChange={set(k)}
                className="bg-transparent border-0 border-b border-black/15 h-10 text-sm focus:outline-none focus:border-[#0044ff] transition-colors"
              />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">Status</label>
            <select
              data-testid="edit-status"
              value={form.status}
              onChange={set("status")}
              className="bg-transparent border-0 border-b border-black/15 h-10 text-sm focus:outline-none focus:border-[#0044ff]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">Message</label>
            <textarea
              data-testid="edit-message"
              rows={3}
              value={form.message || ""}
              onChange={set("message")}
              className="bg-transparent border border-black/15 p-3 text-sm focus:outline-none focus:border-[#0044ff] resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3">
          <button data-testid="admin-edit-close" onClick={onClose} className="px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 hover:border-[#0a0a0a]">
            Cancel
          </button>
          <button
            data-testid="admin-edit-save"
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-2.5 font-mono-tech text-[11px] uppercase tracking-widest hover:bg-[#0044ff] transition-colors"
          >
            <Save size={13} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      onSuccess(data.token);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-[#f4f3ef] text-[#0a0a0a] flex items-center justify-center px-6">
      <form onSubmit={submit} data-testid="admin-login-form" className="w-full max-w-sm">
        <div className="font-display font-extrabold tracking-tight text-3xl mb-2">NEXOIN<span className="text-[#0044ff]">.</span></div>
        <p className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500 mb-8">Console — restricted access</p>
        <label className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">Email</label>
        <input
          data-testid="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          className="w-full bg-transparent border-0 border-b border-black/15 h-12 mt-2 mb-6 text-[#0a0a0a] focus:outline-none focus:border-[#0044ff]"
        />
        <label className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">Password</label>
        <input
          data-testid="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-0 border-b border-black/15 h-12 mt-2 text-[#0a0a0a] focus:outline-none focus:border-[#0044ff]"
        />
        <button
          type="submit"
          data-testid="admin-login-btn"
          disabled={loading}
          className="mt-8 w-full inline-flex items-center justify-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 font-mono-tech text-[11px] uppercase tracking-widest hover:bg-[#0044ff] transition-colors disabled:opacity-60"
        >
          <Lock size={13} /> {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}

function SettingsPanel() {
  const { settings, setSettings } = useSettings();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/settings`, form, authHeaders());
      setSettings({ ...data });
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    ["notification_email", "Notification email (where alerts are sent)"],
    ["contact_email", "Public contact email"],
    ["contact_phone", "Public phone"],
    ["contact_locations", "Locations (optional — shown in footer)"],
  ];

  return (
    <div data-testid="admin-settings" className="bg-white border border-black/10 p-6 md:p-8 mb-12">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={16} className="text-[#0044ff]" />
        <h2 className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">Site settings</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
        {rows.map(([k, label]) => (
          <div key={k} className="flex flex-col gap-2">
            <label className="font-mono-tech text-[11px] uppercase tracking-widest text-zinc-500">{label}</label>
            <input
              data-testid={`settings-${k}`}
              value={form[k] || ""}
              onChange={set(k)}
              className="bg-transparent border-0 border-b border-black/15 h-11 text-[#0a0a0a] text-sm focus:outline-none focus:border-[#0044ff] transition-colors"
            />
          </div>
        ))}
      </div>
      <button
        data-testid="settings-save"
        onClick={save}
        disabled={saving}
        className="mt-8 inline-flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-3 font-mono-tech text-[11px] uppercase tracking-widest hover:bg-[#0044ff] transition-colors disabled:opacity-60"
      >
        <Save size={14} /> {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
