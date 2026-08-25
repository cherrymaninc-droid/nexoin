import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Plus, Pencil, Trash2, X, Search, Save } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = "nexoin-admin-token";
const AH = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } });

export function CrudSection({ endpoint, title, columns, fields, searchKeys, readOnly = false, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/${endpoint}`, AH());
      setItems(data);
    } catch (e) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    try {
      if (form.id) {
        const { data } = await axios.put(`${API}/${endpoint}/${form.id}`, form, AH());
        setItems((p) => p.map((x) => (x.id === form.id ? data : x)));
      } else {
        const { data } = await axios.post(`${API}/${endpoint}`, form, AH());
        setItems((p) => [data, ...p]);
      }
      setEditing(null);
      toast.success("Saved");
      onChanged && onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete permanently?")) return;
    try {
      await axios.delete(`${API}/${endpoint}/${id}`, AH());
      setItems((p) => p.filter((x) => x.id !== id));
      toast.success("Deleted");
      onChanged && onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Delete failed");
    }
  };

  const filtered = items.filter((x) =>
    !q || (searchKeys || columns.map((c) => c.key)).some((k) => `${x[k] || ""}`.toLowerCase().includes(q.toLowerCase()))
  );

  const emptyForm = fields.reduce((a, f) => ({ ...a, [f.key]: f.default || "" }), {});

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-display font-extrabold tracking-tighter text-4xl md:text-6xl">{title}</h1>
          <p className="mt-3 font-mono-tech text-xs uppercase tracking-widest text-zinc-500">{items.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input data-testid={`${endpoint}-search`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="bg-white border border-black/10 pl-9 pr-4 h-11 w-52 text-sm focus:outline-none focus:border-[#0044ff]" />
          </div>
          <button data-testid={`${endpoint}-add`} onClick={() => setEditing(emptyForm)}
            className={`inline-flex items-center gap-2 bg-[#0044ff] text-white px-5 h-11 font-mono-tech text-[11px] uppercase tracking-widest hover:bg-[#0a0a0a] transition-colors ${readOnly ? "hidden" : ""}`}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center font-mono-tech text-sm text-zinc-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div data-testid={`${endpoint}-empty`} className="py-24 text-center font-mono-tech text-sm text-zinc-500 border border-dashed border-black/15">Nothing here yet.</div>
      ) : (
        <div className="bg-white border border-black/10 overflow-x-auto">
          <table className="w-full text-sm" data-testid={`${endpoint}-table`}>
            <thead>
              <tr className="border-b border-black/10 text-left font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">
                {columns.map((c) => <th key={c.key} className="px-5 py-3 font-medium">{c.label}</th>)}
                {!readOnly && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} data-testid={`${endpoint}-row-${x.id}`} className="border-b border-black/5 hover:bg-black/[0.02]">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-4">
                      {c.badge ? (
                        <span className="px-2 py-1 font-mono-tech text-[10px] uppercase tracking-widest bg-zinc-100 border border-black/10">{x[c.key] || "—"}</span>
                      ) : (c.render ? c.render(x) : (x[c.key] || "—"))}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button data-testid={`${endpoint}-edit-${x.id}`} onClick={() => setEditing(x)} className="text-zinc-500 hover:text-[#0044ff] p-1.5"><Pencil size={15} /></button>
                      <button data-testid={`${endpoint}-delete-${x.id}`} onClick={() => remove(x.id)} className="text-zinc-500 hover:text-red-500 p-1.5"><Trash2 size={15} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? <EntityModal title={title} fields={fields} initial={editing} onClose={() => setEditing(null)} onSave={save} endpoint={endpoint} /> : null}
    </div>
  );
}

function EntityModal({ title, fields, initial, onClose, onSave, endpoint }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 bg-black/40 overflow-y-auto" data-testid={`${endpoint}-modal`}>
      <div className="bg-white border border-black/10 w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h3 className="font-display font-bold text-xl">{form.id ? "Edit" : "Add"} — {title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-[#0a0a0a]"><X size={20} /></button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-x-6 gap-y-5 max-h-[65vh] overflow-y-auto">
          {fields.map((f) => (
            <div key={f.key} className={`flex flex-col gap-1.5 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
              <label className="font-mono-tech text-[10px] uppercase tracking-widest text-zinc-500">{f.label}{f.required ? " *" : ""}</label>
              {f.type === "select" ? (
                <select data-testid={`${endpoint}-f-${f.key}`} value={form[f.key] || ""} onChange={set(f.key)} className="bg-transparent border-0 border-b border-black/15 h-10 text-sm focus:outline-none focus:border-[#0044ff]">
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea data-testid={`${endpoint}-f-${f.key}`} rows={3} value={form[f.key] || ""} onChange={set(f.key)} className="bg-transparent border border-black/15 p-3 text-sm focus:outline-none focus:border-[#0044ff] resize-none" />
              ) : (
                <input data-testid={`${endpoint}-f-${f.key}`} type={f.type || "text"} value={form[f.key] || ""} onChange={set(f.key)} className="bg-transparent border-0 border-b border-black/15 h-10 text-sm focus:outline-none focus:border-[#0044ff]" />
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-black/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 font-mono-tech text-[11px] uppercase tracking-widest border border-black/15 hover:border-[#0a0a0a]">Cancel</button>
          <button data-testid={`${endpoint}-save`} onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 bg-[#0a0a0a] text-white px-6 py-2.5 font-mono-tech text-[11px] uppercase tracking-widest hover:bg-[#0044ff] transition-colors">
            <Save size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

export const CLIENT_FIELDS = [
  { key: "company_name", label: "Company name", required: true },
  { key: "contact_person", label: "Contact person" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone" },
  { key: "vat_number", label: "VAT number" },
  { key: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
  { key: "address", label: "Address", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];
export const CLIENT_COLUMNS = [
  { key: "company_name", label: "Company" },
  { key: "contact_person", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status", badge: true },
];

export const VEHICLE_FIELDS = [
  { key: "make", label: "Make", required: true },
  { key: "model", label: "Model" },
  { key: "registration", label: "Registration" },
  { key: "vin", label: "VIN" },
  { key: "year", label: "Year" },
  { key: "vehicle_type", label: "Type" },
  { key: "cargo_capacity", label: "Cargo capacity" },
  { key: "max_weight", label: "Max weight (kg)" },
  { key: "mileage", label: "Mileage (km)" },
  { key: "inspection_expiry", label: "Inspection expiry", type: "date" },
  { key: "insurance_expiry", label: "Insurance expiry", type: "date" },
  { key: "assigned_driver", label: "Assigned driver" },
  { key: "status", label: "Status", type: "select", options: ["available", "in_use", "maintenance", "inactive"], default: "available" },
  { key: "notes", label: "Notes", type: "textarea" },
];
export const VEHICLE_COLUMNS = [
  { key: "make", label: "Vehicle", render: (x) => `${x.make} ${x.model || ""}`.trim() },
  { key: "registration", label: "Reg." },
  { key: "vehicle_type", label: "Type" },
  { key: "assigned_driver", label: "Driver" },
  { key: "status", label: "Status", badge: true },
];

export const USER_FIELDS = [
  { key: "name", label: "Full name", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "role", label: "Role", type: "select", options: ["admin", "manager", "employee"], default: "employee" },
  { key: "status", label: "Status", type: "select", options: ["active", "disabled"], default: "active" },
  { key: "password", label: "Password (blank = keep unchanged)", type: "password" },
];
export const USER_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role", badge: true },
  { key: "status", label: "Status", badge: true },
];
