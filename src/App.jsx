import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const CATS = [
  { id: "food",       name: "Food",        icon: "🍽️",  color: "#F97316" },
  { id: "fruits",     name: "Fruits",      icon: "🍎",  color: "#22C55E" },
  { id: "diver",      name: "Diver",       icon: "🤿",  color: "#06B6D4" },
  { id: "diver_x",    name: "Diver X",     icon: "💫",  color: "#A855F7" },
  { id: "body_staff", name: "Body Staff",  icon: "💪",  color: "#06D6D6" },
  { id: "rosa_fee",   name: "Rosa Fee",    icon: "🌹",  color: "#EC4899" },
  { id: "kids_fee",   name: "Kids Fee",    icon: "🧒",  color: "#EAB308" },
  { id: "car_fee",    name: "Car Fee",     icon: "🚗",  color: "#64748B" },
  { id: "parent_fee", name: "Parent Fee",  icon: "👨‍👩‍👦",  color: "#84CC16" },
  { id: "home_fee",   name: "Home Fee",    icon: "🏠",  color: "#10B981" },
  { id: "unexpected", name: "Unexpected",  icon: "⚡",  color: "#EF4444" },
  { id: "financial",  name: "Financial",   icon: "💰",  color: "#F59E0B" },
  { id: "trip_fee",   name: "Trip",        icon: "✈️",  color: "#3B82F6" },
  { id: "study_fee",  name: "Study",       icon: "📚",  color: "#8B5CF6" },
];

const MONTHS   = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS     = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const NAV_ORDER = ["home", "calendar", "history", "reports", "settings"];

const today  = () => new Date().toISOString().split("T")[0];
const mKey   = d  => d.toISOString().slice(0, 7);
const yKey   = d  => String(d.getFullYear());
const getCat = id => CATS.find(c => c.id === id) || CATS[0];
const total  = arr => arr.filter(e => e.category !== "financial").reduce((s, e) => s + e.amount, 0);

async function sheetsSync(url, action, payload) {
  if (!url) return { success: false, message: "No script URL provided" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) return { success: false, message: `Network error ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { success: data.success !== false, message: data.message || data.error || "" };
  } catch (e) {
    return { success: false, message: e.message || "Sync failed" };
  }
}

// ─────────────────────────────────────────────────────────────
//  AnimatedNumber — counts up/down when value changes
// ─────────────────────────────────────────────────────────────
function AnimatedNumber({ value, format, duration = 700 }) {
  const [display, setDisplay] = useState(value);
  const rafRef      = useRef(null);
  const prevValRef  = useRef(value);

  useEffect(() => {
    const from = prevValRef.current;
    const to   = value;
    prevValRef.current = to;
    if (from === to) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const tick = now => {
      const t  = Math.min((now - start) / duration, 1);
      const e  = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplay(from + (to - from) * e);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <>{format(display)}</>;
}

// ─────────────────────────────────────────────────────────────
//  Motion variants
// ─────────────────────────────────────────────────────────────
// Change 9 — Page transition: Add subtle blur on exit for depth
const pageVariants = {
  enter: dir => ({ x: dir * 44, opacity: 0, filter: "blur(0px)" }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: dir => ({ x: -dir * 28, opacity: 0, filter: "blur(4px)" }),
};
const pageTransition = { type: "spring", stiffness: 300, damping: 30 };

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};
const listItem = {
  hidden: { opacity: 0, x: -18 },
  show:   { opacity: 1, x: 0, transition: { type: "spring", stiffness: 340, damping: 26 } },
};

const gridContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};
const gridItem = {
  hidden: { opacity: 0, scale: 0.78, y: 8 },
  show:   { opacity: 1, scale: 1,    y: 0, transition: { type: "spring", stiffness: 380, damping: 22 } },
};

const springSheet = { type: "spring", stiffness: 300, damping: 30 };

// Bottom sheet drawer — spring animated, dynamically centers as desktop dialog on widescreen
const BottomSheet = ({ show, onClose, title, sub, isMobile, K, children }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        key="bottom-sheet-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
          justifyContent: isMobile ? "flex-end" : "center",
          alignItems: "center",
          padding: isMobile ? 0 : 20
        }}
      >
        <motion.div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            backdropFilter: "blur(8px)",
            zIndex: 301
          }}
        />
        <motion.div
          initial={isMobile ? { y: "100%" } : { scale: 0.9, y: 20, opacity: 0 }}
          animate={isMobile ? { y: 0 } : { scale: 1, y: 0, opacity: 1 }}
          exit={isMobile ? { y: "100%" } : { scale: 0.95, y: 15, opacity: 0 }}
          transition={springSheet}
          style={{
            background: K.card,
            borderRadius: isMobile ? "32px 32px 0 0" : 28,
            maxHeight: isMobile ? "88vh" : "90dvh",
            width: isMobile ? "100%" : 440,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: isMobile ? "0 -12px 60px rgba(0,0,0,.6)" : "0 20px 60px rgba(0,0,0,.5)",
            zIndex: 302,
            border: isMobile ? "none" : `1px solid ${K.border}`,
            position: "relative"
          }}
        >
          {/* Pill handle */}
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 8px", flexShrink: 0 }}>
              <div style={{ width: 48, height: 5, borderRadius: 3, background: K.border }}/>
            </div>
          )}
          {/* Header */}
          {title && (
            <div style={{ padding: "20px 24px 20px", borderBottom: `1px solid ${K.border}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: K.text }}>{title}</div>
                {sub && <div style={{ fontSize: 14, color: K.sub, marginTop: 4 }}>{sub}</div>}
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  width: 48, height: 48, borderRadius: 16,
                  border: `1px solid ${K.border}`, background: K.card2,
                  color: K.sub, cursor: "pointer", fontSize: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</motion.button>
            </div>
          )}
          <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", flex: 1 }}>
            {children}
            <div style={{ height: 20 }}/>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─────────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [expenses,   setExpenses]   = useState([]);
  const [currency,   setCurrency]   = useState("DA");
  const [page,       setPage]       = useState("home");
  const [direction,  setDirection]  = useState(0);
  const [dark,       setDark]       = useState(true);
  const [modal,      setModal]      = useState(false);
  const [selCat,     setSelCat]     = useState(null);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState({ name: "", amount: "", notes: "", date: today() });
  const [delId,      setDelId]      = useState(null);
  const [toast,      setToast]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [calDate,    setCalDate]    = useState(new Date());
  const [calDay,     setCalDay]     = useState(today());
  const [calView,    setCalView]    = useState("month");
  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState("all");
  const [drawer,     setDrawer]     = useState(null);
  const [scriptUrl,  setScriptUrl]  = useState("");
  const [gsOn,       setGsOn]       = useState(false);
  const [gsBusy,     setGsBusy]     = useState(false);
  const [urlDraft,   setUrlDraft]   = useState("");
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 1024);
  const [reportCat,    setReportCat]   = useState(null);
  const [reportDay,    setReportDay]   = useState(null);
  const [reportPeriod, setReportPeriod] = useState("month");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const prevPageRef = useRef("home");

  // ── Navigate with direction tracking ─────────────────────
  const navigate = useCallback(to => {
    const fromIdx = NAV_ORDER.indexOf(prevPageRef.current);
    const toIdx   = NAV_ORDER.indexOf(to);
    setDirection(toIdx > fromIdx ? 1 : -1);
    prevPageRef.current = to;
    setPage(to);
  }, []);

  // ── Persist ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const r = localStorage.getItem("exp_v4"); if (r) setExpenses(JSON.parse(r));
      const c = localStorage.getItem("exp_cfg4"); if (c) { const p = JSON.parse(c); setDark(p.dark ?? true); setCurrency(p.currency ?? "DA"); }
      const u = localStorage.getItem("exp_gsurl"); if (u) { setScriptUrl(u); setUrlDraft(u); setGsOn(true); }
    } catch {}
    // Simulated realistic initialization loading time
    setTimeout(() => setLoading(false), 800);
  }, []);

  const persist = useCallback(data => {
    try { localStorage.setItem("exp_v4", JSON.stringify(data)); } catch {}
  }, []);

  const capitalizeFirst = str => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const sym = currency === "DA" ? "DA" : currency === "USD" ? "$" : "€";
  const money = n => {
    if (currency === "DA") return n >= 1000 ? `DA ${(n / 1000).toFixed(1)}k` : `DA ${n.toFixed(2)}`;
    if (n >= 1000) return sym + (n / 1000).toFixed(1) + "k";
    return sym + n.toFixed(2);
  };
  const moneyFull = n => {
    if (currency === "DA") return `DA ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
    if (currency === "USD") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);
  };

  const toast$ = useCallback((msg, bad = false) => {
    setToast({ msg, bad }); setTimeout(() => setToast(null), 2600);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────
  const saveExp = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.amount || isNaN(+form.amount)) return;
    setSaving(true);
    try {
      const d = new Date(form.date + "T12:00:00");
      let next;
      if (editId) {
        const u = {
          ...expenses.find(e => e.id === editId), ...form,
          amount: +form.amount, category: selCat.id, currency,
          ts: new Date().toISOString(), day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear()
        };
        next = expenses.map(e => e.id === editId ? u : e);
        if (gsOn) {
          const sync = await sheetsSync(scriptUrl, "update", { expense: u });
          if (!sync.success) toast$("Saved locally. Sheets sync failed.", true);
          else toast$("Updated ✓");
        } else { toast$("Updated ✓"); }
      } else {
        const ex = {
          id: Date.now().toString(), name: form.name.trim(),
          amount: +form.amount, notes: form.notes.trim(), date: form.date,
          category: selCat.id, currency, ts: new Date().toISOString(),
          day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear()
        };
        next = [ex, ...expenses];
        if (gsOn) {
          const sync = await sheetsSync(scriptUrl, "add", { expense: ex });
          if (!sync.success) toast$("Saved locally. Sheets sync failed.", true);
          else toast$("Saved ✓");
        } else { toast$("Saved ✓"); }
      }
      setExpenses(next); persist(next); closeModal();
    } finally { setSaving(false); }
  };

  const delExp = id => {
    const next = expenses.filter(e => e.id !== id);
    setExpenses(next); persist(next); setDelId(null);
    if (gsOn) sheetsSync(scriptUrl, "delete", { id });
    toast$("Deleted", true);
  };

  const closeModal = () => {
    setModal(false); setSelCat(null); setEditId(null);
    setForm({ name: "", amount: "", notes: "", date: today() });
  };
  const openAdd  = (cat, date) => { setSelCat(cat); setForm({ name: "", amount: "", notes: "", date: date || today() }); setModal(true); };
  const openEdit = ex => { setSelCat(getCat(ex.category)); setForm({ name: ex.name, amount: String(ex.amount), notes: ex.notes || "", date: ex.date }); setEditId(ex.id); setModal(true); };

  const restoreSheets = async () => {
    if (!scriptUrl) return; setGsBusy(true);
    try {
      const r = await fetch(scriptUrl + "?v=" + Date.now());
      const d = await r.json();
      if (d.expenses) { setExpenses(d.expenses); persist(d.expenses); toast$(`Restored ${d.expenses.length} ✓`); }
    } catch { toast$("Restore failed", true); }
    setGsBusy(false);
  };

  const connectGs = async () => {
    if (!urlDraft.trim()) return;
    const candidate = urlDraft.trim();
    if (!candidate.startsWith("https://")) { toast$("Enter a valid Apps Script URL", true); return; }
    setGsBusy(true);
    try {
      const res  = await fetch(`${candidate}?v=${Date.now()}`);
      if (!res.ok) throw new Error(`Network error ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.expenses)) throw new Error(data?.error || "Invalid script URL");
      localStorage.setItem("exp_gsurl", candidate);
      setScriptUrl(candidate); setGsOn(true); toast$("Connected ✓");
    } catch { toast$("Connect failed", true); }
    setGsBusy(false);
  };
  const disconnectGs = () => {
    localStorage.removeItem("exp_gsurl");
    setScriptUrl(""); setGsOn(false); toast("Disconnected");
  };

  // ── Derived ───────────────────────────────────────────────
  const now      = new Date();
  const todayExp = expenses.filter(e => e.date === today());
  const ws       = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0, 0, 0, 0);
  const weekExp  = expenses.filter(e => new Date(e.date) >= ws);
  const monthExp = expenses.filter(e => e.date.startsWith(mKey(now)));
  const yearExp  = expenses.filter(e => e.date.startsWith(yKey(now)));

  const catTotals = useMemo(() =>
    CATS.map(c => ({ ...c, total: total(expenses.filter(e => e.category === c.id)) }))
        .sort((a, b) => b.total - a.total), [expenses]);

  const monthlyBar = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return { month: MONTHS[d.getMonth()], v: +total(expenses.filter(e => e.date.startsWith(mKey(d)))).toFixed(2) };
  }), [expenses]);

  const pieData = catTotals.filter(c => c.total > 0).slice(0, 6);

  const filtered = useMemo(() => {
    let r = [...expenses];
    if (search) r = r.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      getCat(e.category).name.toLowerCase().includes(search.toLowerCase()) ||
      e.date.includes(search));
    if (filterCat !== "all") r = r.filter(e => e.category === filterCat);
    return r.sort((a, b) => new Date(b.ts || b.date) - new Date(a.ts || a.date));
  }, [expenses, search, filterCat]);

  const calGrid = useMemo(() => {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const g = Array(first).fill(null);
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const ex = expenses.filter(e => e.date === ds);
      g.push({ day: d, ds, tot: total(ex), count: ex.length });
    }
    return g;
  }, [expenses, calDate]);

  const reportExpenses = useMemo(() => {
    if (reportPeriod === "week") return weekExp;
    if (reportPeriod === "month") return monthExp;
    if (reportPeriod === "year") return yearExp;
    return expenses;
  }, [reportPeriod, weekExp, monthExp, yearExp, expenses]);

  const reportCatTotals = useMemo(() =>
    CATS.map(c => ({
      ...c,
      total: total(reportExpenses.filter(e => e.category === c.id)),
      exps: reportExpenses.filter(e => e.category === c.id)
    })).sort((a, b) => b.total - a.total)
  , [reportExpenses]);

  const reportDailyBreakdown = useMemo(() => {
    const byDate = {};
    reportExpenses.forEach(ex => {
      if (!byDate[ex.date]) byDate[ex.date] = [];
      byDate[ex.date].push(ex);
    });
    return Object.entries(byDate)
      .map(([date, exps]) => ({ date, exps, total: total(exps), count: exps.length }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [reportExpenses]);

  // ── Theme ─────────────────────────────────────────────────
  const K = {
    bg:      dark ? "#07090F" : "#F0F2F8",
    card:    dark ? "#0F1520" : "#FFFFFF",
    card2:   dark ? "#18202E" : "#F5F7FC",
    border:  dark ? "#1E2A3E" : "#DDE3F0",
    text:    dark ? "#EEF2FF" : "#0C1020",
    sub:     dark ? "#6B7A99" : "#6B7A99",
    accent:  "#6366F1",
    amber:   "#F59E0B",
    green:   "#22C55E",
    red:     "#EF4444",
  };

  // ── Shared components ─────────────────────────────────────

  // Animated expense row
  // Change 8 — ExpRow: Color-tinted press ripple + icon hover with category color
  const ExpRow = ({ ex, onEdit, onDel, index = 0 }) => {
    const cat = getCat(ex.category);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
        whileTap={{ background: `${cat.color}10` }}
        transition={{ delay: Math.min(index * 0.045, 0.28), type: "spring", stiffness: 340, damping: 26 }}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderBottom: `1px solid ${K.border}`, transition: "background 0.2s ease" }}
      >
        {/* Big icon bubble */}
        <motion.div
          whileHover={{ scale: 1.15, rotate: 8, backgroundColor: `${cat.color}35`, boxShadow: `0 8px 20px ${cat.color}25` }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          style={{
            width: 60, height: 60, borderRadius: 20,
            background: cat.color + "25",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, flexShrink: 0,
          }}>{cat.icon}</motion.div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: K.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <span style={{ background: cat.color + "20", color: cat.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {cat.name}
            </span>
            <span style={{ fontSize: 13, color: K.sub }}>{ex.date}</span>
          </div>
          {ex.notes && <div style={{ fontSize: 13, color: K.sub, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.notes}</div>}
        </div>

        {/* Amount + actions stacked */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: cat.color }}>{moneyFull(ex.amount)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              onClick={onEdit}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              style={{
                width: 44, height: 44, borderRadius: 14,
                border: "none", background: K.accent + "22", color: K.accent,
                cursor: "pointer", fontSize: 20, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>✏️</motion.button>
            <motion.button
              onClick={onDel}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.88 }}
              style={{
                width: 44, height: 44, borderRadius: 14,
                border: "none", background: K.red + "22", color: K.red,
                cursor: "pointer", fontSize: 20, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>🗑️</motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Section header
  const SecLabel = ({ children, right }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 20px 12px" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: K.sub, letterSpacing: 1.2 }}>{children}</span>
      {right && <span style={{ fontSize: 14, fontWeight: 900, color: K.accent }}>{right}</span>}
    </div>
  );

  // White card wrapper
  const Card = ({ children, style = {} }) => (
    <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 24, ...style }}>
      {children}
    </div>
  );



  // ════════════════════════════════════════════════════════
  //  PAGE: HOME
  // ════════════════════════════════════════════════════════
  const PageHome = () => {
    const periods = [
      { label: "Today",      icon: "📅", exps: todayExp, color: "#6366F1" },
      { label: "This Week",  icon: "📆", exps: weekExp,  color: "#06B6D4" },
      { label: "This Month", icon: "🗓️", exps: monthExp, color: "#F59E0B" },
      { label: "This Year",  icon: "📊", exps: yearExp,  color: "#22C55E" },
    ];

    return (
      <div style={{
        overflowY: "auto",
        height: "100%",
        WebkitOverflowScrolling: "touch",
        paddingBottom: isMobile ? 110 : 40,
        paddingTop: isMobile ? 0 : 10
      }}>
        {isMobile ? (
          <>
            {/* ── Hero Banner ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.93, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ type: "spring", stiffness: 240, damping: 20, delay: 0.05 }}
              style={{
                margin: "16px 16px 0",
                background: "linear-gradient(145deg,#6366F1 0%,#7C3AED 100%)",
                borderRadius: 30, padding: "30px 26px 26px",
                position: "relative", overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, background: "rgba(255,255,255,.06)" }}/>
              <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: 60, background: "rgba(255,255,255,.04)" }}/>

              {gsOn && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22C55E" }}/>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,.65)", fontWeight: 600 }}>Synced with Google Sheets</span>
                </div>
              )}
              <div style={{ fontSize: 15, color: "rgba(255,255,255,.7)", marginBottom: 10, fontWeight: 600 }}>Total This Month</div>

              <div style={{ display: "inline-block", position: "relative", padding: "4px 8px" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 12, border: "2px dashed rgba(255,255,255,0.4)", animation: "rotationSweep 12s linear infinite" }}/>
                <div style={{ fontSize: 48, fontWeight: 900, color: "#FFF", letterSpacing: -1, lineHeight: 1 }}>
                  <AnimatedNumber value={total(monthExp)} format={money} />
                </div>
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,.55)", marginTop: 12 }}>{monthExp.length} transactions</div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                {[{ l: "Today", v: todayExp }, { l: "Year", v: yearExp }].map(({ l, v }) => (
                  <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.13)", borderRadius: 20, padding: "16px 18px" }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginBottom: 8, fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#FFF" }}>
                      <AnimatedNumber value={total(v)} format={money} />
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginTop: 4 }}>{v.length} items</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── Period tap-cards ────────────────────── */}
            <SecLabel>TAP TO SEE EXPENSES</SecLabel>
            <motion.div
              variants={gridContainer}
              initial="hidden"
              animate="show"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "0 16px" }}
            >
              {periods.map(p => (
                <motion.button
                  key={p.label}
                  variants={gridItem}
                  whileHover={{ y: -5, scale: 1.02, boxShadow: `0 12px 32px ${p.color}22` }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setDrawer({ title: p.label, sub: `${p.exps.length} transactions · ${moneyFull(total(p.exps))}`, exps: p.exps })}
                  style={{
                    background: K.card, border: `1.5px solid ${K.border}`,
                    borderRadius: 24, padding: "22px 18px",
                    textAlign: "left", cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 14 }}>{p.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: p.color, letterSpacing: .8, marginBottom: 8 }}>{p.label.toUpperCase()}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: K.text, lineHeight: 1 }}>{money(total(p.exps))}</div>
                  <div style={{ fontSize: 13, color: K.sub, marginTop: 8 }}>{p.exps.length} transactions</div>
                </motion.button>
              ))}
            </motion.div>

            {/* ── Quick add grid ──────────────────────── */}
            <SecLabel>QUICK ADD</SecLabel>
            <motion.div
              variants={gridContainer}
              initial="hidden"
              animate="show"
              style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "0 16px" }}
            >
              {CATS.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  variants={gridItem}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => openAdd(cat)}
                  style={{
                    background: K.card, border: `1.5px solid ${K.border}`,
                    borderRadius: 22, padding: "20px 6px 16px",
                    textAlign: "center", cursor: "pointer",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 10,
                  }}
                >
                  <div style={{ fontSize: 38, animation: `floatingEmoji 3.5s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}>
                    {cat.icon}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, lineHeight: 1.3, textAlign: "center" }}>{cat.name}</div>
                </motion.button>
              ))}
            </motion.div>

            {/* ── Recent ──────────────────────────────── */}
            {expenses.length > 0 && <>
              <SecLabel right={`${expenses.length} total`}>RECENT</SecLabel>
              <Card style={{ margin: "0 16px", overflow: "hidden" }}>
                <AnimatePresence initial={false}>
                  {expenses.slice(0, 5).map((ex, i) => (
                    <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => openEdit(ex)} onDel={() => setDelId(ex.id)}/>
                  ))}
                </AnimatePresence>
              </Card>
            </>}
          </>
        ) : (
          /* ── WIDESCREEN DOUBLE COLUMN DASHBOARD ────────────────── */
          <div style={{ display: "grid", gridTemplateColumns: "1.10fr 1fr", gap: 30, alignItems: "start" }}>
            {/* Left Dashboard Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                style={{
                  background: "linear-gradient(145deg,#6366F1 0%,#7C3AED 100%)",
                  borderRadius: 28, padding: "34px 30px",
                  position: "relative", overflow: "hidden",
                  boxShadow: "0 12px 40px rgba(99,102,241,0.22)"
                }}
              >
                <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, background: "rgba(255,255,255,.06)" }}/>
                <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: 60, background: "rgba(255,255,255,.04)" }}/>

                {gsOn && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22C55E" }}/>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,.65)", fontWeight: 600 }}>Synced with Google Sheets</span>
                  </div>
                )}
                <div style={{ fontSize: 15, color: "rgba(255,255,255,.75)", marginBottom: 12, fontWeight: 600 }}>Total Spent This Month</div>

                <div style={{ display: "inline-block", position: "relative", padding: "4px 8px" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 12, border: "2px dashed rgba(255,255,255,0.45)", animation: "rotationSweep 15s linear infinite" }}/>
                  <div style={{ fontSize: 52, fontWeight: 900, color: "#FFF", letterSpacing: -1, lineHeight: 1 }}>
                    <AnimatedNumber value={total(monthExp)} format={money} />
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", marginTop: 14 }}>{monthExp.length} transactions in this billing cycle</div>

                <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
                  {[{ l: "Today's Spent", v: todayExp }, { l: "This Year's Total", v: yearExp }].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.14)", borderRadius: 22, padding: "18px 20px" }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginBottom: 8, fontWeight: 700 }}>{l.toUpperCase()}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: "#FFF" }}>
                        <AnimatedNumber value={total(v)} format={money} />
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>{v.length} ledger entries</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div>
                <SecLabel>PERIOD OVERVIEW METRICS</SecLabel>
                <motion.div
                  variants={gridContainer}
                  initial="hidden"
                  animate="show"
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
                >
                  {periods.map(p => (
                    <motion.button
                      key={p.label}
                      variants={gridItem}
                      whileHover={{ y: -6, scale: 1.02, boxShadow: `0 14px 34px ${p.color}25`, borderColor: p.color }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setDrawer({ title: p.label, sub: `${p.exps.length} transactions · ${moneyFull(total(p.exps))}`, exps: p.exps })}
                      style={{
                        background: K.card, border: `1.5px solid ${K.border}`,
                        borderRadius: 24, padding: "24px 20px",
                        textAlign: "left", cursor: "pointer",
                        transition: "border-color 0.25s ease, box-shadow 0.25s ease"
                      }}
                    >
                      <div style={{ fontSize: 42, marginBottom: 14 }}>{p.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: p.color, letterSpacing: 1.2, marginBottom: 8 }}>{p.label.toUpperCase()}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: K.text, lineHeight: 1 }}>{money(total(p.exps))}</div>
                      <div style={{ fontSize: 13, color: K.sub, marginTop: 8 }}>{p.exps.length} transactions</div>
                    </motion.button>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Right Dashboard Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div>
                <SecLabel>QUICK CATEGORY ADD</SecLabel>
                <motion.div
                  variants={gridContainer}
                  initial="hidden"
                  animate="show"
                  style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}
                >
                  {CATS.map((cat, i) => (
                    <motion.button
                      key={cat.id}
                      variants={gridItem}
                      whileHover={{ scale: 1.08, y: -4, borderColor: cat.color, boxShadow: `0 8px 20px ${cat.color}20` }}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => openAdd(cat)}
                      style={{
                        background: K.card, border: `1.5px solid ${K.border}`,
                        borderRadius: 22, padding: "20px 6px 16px",
                        textAlign: "center", cursor: "pointer",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", gap: 10,
                        transition: "border-color 0.22s, box-shadow 0.22s"
                      }}
                    >
                      <div style={{ fontSize: 38, animation: `floatingEmoji 3.5s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}>
                        {cat.icon}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: K.sub, lineHeight: 1.3, textAlign: "center" }}>{cat.name}</div>
                    </motion.button>
                  ))}
                </motion.div>
              </div>

              {expenses.length > 0 && (
                <div>
                  <SecLabel right={`${expenses.length} entries total`}>RECENT TRANSACTIONS</SecLabel>
                  <Card style={{ overflow: "hidden", maxHeight: 420, overflowY: "auto" }}>
                    <AnimatePresence initial={false}>
                      {expenses.slice(0, 7).map((ex, i) => (
                        <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => openEdit(ex)} onDel={() => setDelId(ex.id)}/>
                      ))}
                    </AnimatePresence>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: CALENDAR
  // ════════════════════════════════════════════════════════
  const PageCalendar = () => {
    const dayExps = expenses.filter(e => e.date === calDay);
    const monExps = expenses.filter(e => e.date.startsWith(mKey(calDate)));
    const yrExps  = expenses.filter(e => e.date.startsWith(yKey(calDate)));
    const shown   = calView === "day" ? dayExps : calView === "month" ? monExps : yrExps;

    const prevM = () => { const d = new Date(calDate); d.setMonth(d.getMonth() - 1); setCalDate(d); };
    const nextM = () => { const d = new Date(calDate); d.setMonth(d.getMonth() + 1); setCalDate(d); };
    const prevY = () => { const d = new Date(calDate); d.setFullYear(d.getFullYear() - 1); setCalDate(d); };
    const nextY = () => { const d = new Date(calDate); d.setFullYear(d.getFullYear() + 1); setCalDate(d); };

    const yrBreak = Array.from({ length: 12 }, (_, i) => {
      const key = `${calDate.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
      const ex = expenses.filter(e => e.date.startsWith(key));
      return { month: MONTHS[i], key, tot: total(ex), count: ex.length };
    });

    const grouped = {};
    [...shown].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(ex => {
      if (!grouped[ex.date]) grouped[ex.date] = [];
      grouped[ex.date].push(ex);
    });

    const renderCalControlsAndGrid = () => (
      <>
        <div style={{ padding: "20px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={prevM} style={{ width: 52, height: 52, borderRadius: 18, border: `1px solid ${K.border}`, background: K.card2, color: K.text, cursor: "pointer", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</motion.button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: K.text }}>{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</div>
            <div style={{ fontSize: 15, color: K.amber, fontWeight: 700, marginTop: 4 }}>
              <AnimatedNumber value={total(monExps)} format={moneyFull} />
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={nextM} style={{ width: 52, height: 52, borderRadius: 18, border: `1px solid ${K.border}`, background: K.card2, color: K.text, cursor: "pointer", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>›</motion.button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "0 14px 10px" }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: K.sub, padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", padding: "0 10px 18px", gap: 4 }}>
          {calGrid.map((cell, i) => {
            if (!cell) return <div key={`e${i}`}/>;
            const isTod = cell.ds === today();
            const isSel = cell.ds === calDay;
            const has   = cell.tot > 0;
            return (
              <motion.button
                key={cell.ds}
                whileTap={{ scale: 0.85 }}
                onClick={() => { setCalDay(cell.ds); setCalView("day"); }}
                style={{
                  aspectRatio: "1", borderRadius: 14, border: "none",
                  background: isSel ? K.accent : isTod ? K.accent + "35" : has ? K.card2 : "transparent",
                  outline: isTod && !isSel ? `2px solid ${K.accent}` : "none",
                  outlineOffset: "-2px",
                  cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 2, padding: 3,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: isTod || isSel ? 900 : 500, color: isSel ? "#FFF" : K.text, lineHeight: 1 }}>{cell.day}</div>
                {has && <div style={{ fontSize: 9, color: isSel ? "rgba(255,255,255,.8)" : K.amber, fontWeight: 700, lineHeight: 1 }}>${cell.tot.toFixed(0)}</div>}
                {has && !isSel && <div style={{ width: 5, height: 5, borderRadius: 3, background: K.accent }}/>}
              </motion.button>
            );
          })}
        </div>
      </>
    );

    const renderYearGrid = () => (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={prevY} style={{ width: 52, height: 52, borderRadius: 18, border: `1px solid ${K.border}`, background: K.card2, color: K.text, cursor: "pointer", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</motion.button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: K.text }}>{calDate.getFullYear()}</div>
            <div style={{ fontSize: 15, color: K.amber, fontWeight: 700, marginTop: 4 }}>
              Total: <AnimatedNumber value={total(yrExps)} format={moneyFull} />
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={nextY} style={{ width: 52, height: 52, borderRadius: 18, border: `1px solid ${K.border}`, background: K.card2, color: K.text, cursor: "pointer", fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>›</motion.button>
        </div>
        <motion.div
          variants={gridContainer}
          initial="hidden"
          animate="show"
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}
        >
          {yrBreak.map(({ month, key, tot, count }) => {
            const isCur = key === mKey(new Date());
            return (
              <motion.button
                key={key}
                variants={gridItem}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => { const d = new Date(calDate); d.setMonth(MONTHS.indexOf(month)); setCalDate(d); setCalView("month"); }}
                style={{
                  background: isCur ? K.accent + "22" : K.card2,
                  border: `2px solid ${isCur ? K.accent : K.border}`,
                  borderRadius: 18, padding: "16px 8px", cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: isCur ? K.accent : K.text }}>{month}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: K.amber, marginTop: 6 }}>{money(tot)}</div>
                <div style={{ fontSize: 11, color: K.sub, marginTop: 3 }}>{count} items</div>
              </motion.button>
            );
          })}
        </motion.div>
      </>
    );

    const renderCalTransactionsList = () => (
      <>
        {shown.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: K.sub, fontSize: 16 }}>No items recorded</div>
        ) : (
          <Card style={{ overflow: "hidden", maxHeight: 520, overflowY: "auto" }}>
            {Object.keys(grouped).map(dateStr => (
              <div key={dateStr}>
                <div style={{ background: K.card2, padding: "8px 20px", fontSize: 12, fontWeight: 800, color: K.sub, borderBottom: `1px solid ${K.border}` }}>
                  {dateStr === today() ? "TODAY" : dateStr}
                </div>
                {grouped[dateStr].map((ex, i) => (
                  <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => openEdit(ex)} onDel={() => setDelId(ex.id)}/>
                ))}
              </div>
            ))}
          </Card>
        )}
      </>
    );

    return (
      <div style={{
        overflowY: "auto",
        height: "100%",
        WebkitOverflowScrolling: "touch",
        paddingBottom: isMobile ? 110 : 40,
        paddingTop: isMobile ? 0 : 10
      }}>
        {/* View switcher */}
        <div style={{ padding: isMobile ? "16px 16px 12px" : "16px 0 20px" }}>
          <div style={{ display: "flex", background: K.card2, borderRadius: 22, padding: 6, gap: 4, border: `1px solid ${K.border}` }}>
            {[[ "day", "📅 Day" ], [ "month", "🗓️ Month" ], [ "year", "📊 Year" ]].map(([v, l]) => (
              <motion.button
                key={v}
                onClick={() => setCalView(v)}
                whileTap={{ scale: 0.95 }}
                style={{
                  flex: 1, padding: "15px 0", borderRadius: 16, border: "none",
                  background: "transparent",
                  color: calView === v ? "#FFF" : K.sub,
                  cursor: "pointer", fontSize: 15, fontWeight: 800,
                  position: "relative", zIndex: 1
                }}
              >
                {calView === v && (
                  <motion.div
                    layoutId="cal-view-pill"
                    style={{ position: "absolute", inset: 0, borderRadius: 16, background: K.accent, zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  />
                )}
                {l}
              </motion.button>
            ))}
          </div>
        </div>

        {isMobile ? (
          <>
            {calView !== "year" && (
              <Card style={{ margin: "0 16px 16px", overflow: "hidden" }}>
                {renderCalControlsAndGrid()}
              </Card>
            )}
            {calView === "year" && (
              <Card style={{ margin: "0 16px 16px", padding: "20px 16px" }}>
                {renderYearGrid()}
              </Card>
            )}
            <SecLabel>{calView.toUpperCase()} TRANSACTIONS ({shown.length})</SecLabel>
            {renderCalTransactionsList()}
          </>
        ) : (
          /* ── WIDESCREEN SIDE-BY-SIDE CALENDAR ───────────────────── */
          <div style={{ display: "grid", gridTemplateColumns: "1.10fr 1fr", gap: 30, alignItems: "start" }}>
            {/* Left Column: Interactive Grid */}
            <div>
              {calView !== "year" ? (
                <Card style={{ overflow: "hidden" }}>
                  {renderCalControlsAndGrid()}
                </Card>
              ) : (
                <Card style={{ padding: "24px 20px" }}>
                  {renderYearGrid()}
                </Card>
              )}
            </div>

            {/* Right Column: Ledger transaction logs list */}
            <div>
              <SecLabel style={{ paddingTop: 0 }}>{calView.toUpperCase()} TRANSACTIONS ({shown.length})</SecLabel>
              {renderCalTransactionsList()}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: HISTORY (SEARCH / FILTER)
  // ════════════════════════════════════════════════════════
  const PageHistory = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", paddingTop: isMobile ? 0 : 10 }}>
      {/* Big search bar */}
      <div style={{ padding: isMobile ? "16px 16px 12px" : "16px 0 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", background: K.card, border: `1.5px solid ${K.border}`, borderRadius: 20, padding: "0 20px", gap: 14 }}>
          <span style={{ fontSize: 26, color: K.sub }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses…" style={{ flex: 1, padding: "18px 0", background: "transparent", border: "none", outline: "none", color: K.text, fontSize: 17, fontFamily: "inherit" }}/>
          {search && (
            <motion.button whileTap={{ scale: 0.85, rotate: 90 }} onClick={() => setSearch("")} style={{ background: "none", border: "none", color: K.sub, cursor: "pointer", fontSize: 22, padding: 0 }} >✕</motion.button>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      <div style={{ padding: isMobile ? "0 16px 14px" : "0 0 14px", overflowX: "auto", display: "flex", gap: 10, WebkitOverflowScrolling: "touch", flexShrink: 0 }}>
        {[{ id: "all", name: "All", icon: "🗂️", color: K.accent }, ...CATS].map(c => {
          const active = filterCat === c.id;
          const col = c.id === "all" ? K.accent : (getCat(c.id)?.color || K.accent);
          return (
            <motion.button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              style={{
                flexShrink: 0, padding: "12px 18px", borderRadius: 26,
                border: `1.5px solid ${active ? col : K.border}`,
                background: active ? col + "25" : K.card,
                color: active ? col : K.sub,
                cursor: "pointer", fontSize: 14, fontWeight: 700,
                whiteSpace: "nowrap", display: "flex", gap: 8, alignItems: "center",
              }}
            >
              <span style={{ fontSize: 20 }}>{c.icon}</span>{c.name}
            </motion.button>
          );
        })}
      </div>

      {/* Count + total */}
      <div style={{ padding: isMobile ? "0 20px 12px" : "0 10px 12px", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, color: K.sub, fontWeight: 600 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 17, fontWeight: 900, color: K.accent }}>
          <AnimatedNumber value={total(filtered)} format={moneyFull} />
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: isMobile ? 110 : 40 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: K.sub, fontSize: 17 }}>No expenses found</div>
        ) : (
          <Card style={{ margin: isMobile ? "0 16px" : "0", overflow: "hidden" }}>
            <AnimatePresence initial={false}>
              {filtered.map((ex, i) => <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => openEdit(ex)} onDel={() => setDelId(ex.id)}/>)}
            </AnimatePresence>
          </Card>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════
  //  PAGE: REPORTS
  // ════════════════════════════════════════════════════════
  const PageReports = () => {
    const periodOptions = [
      { id: "week",  label: "Week",     icon: "📆" },
      { id: "month", label: "Month",    icon: "🗓️" },
      { id: "year",  label: "Year",     icon: "📊" },
      { id: "all",   label: "All Time", icon: "🌐" },
    ];
    const rTotal = total(reportExpenses);

    const DayRow = ({ date, dayExps, dayTotal, count }) => {
      const isToday = date === today();
      const maxT = Math.max(...reportDailyBreakdown.map(d => d.total), 1);
      const barPct = (dayTotal / maxT) * 100;
      const dateObj = new Date(date + "T12:00:00");
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum  = dateObj.getDate();
      const monName = MONTHS[dateObj.getMonth()];
      const topCats = [...new Set(dayExps.map(e => e.category))].slice(0, 4).map(getCat);
      return (
        <motion.div
          variants={listItem}
          whileHover={{ x: 5, boxShadow: `0 8px 28px rgba(0,0,0,.12)`, borderColor: K.accent + "55" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setReportDay({ date, exps: dayExps, total: dayTotal })}
          style={{
            background: K.card, border: `1.5px solid ${isToday ? K.accent + "60" : K.border}`,
            borderRadius: 20, padding: "14px 18px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 14,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          <motion.div
            whileHover={{ scale: 1.08 }}
            style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: isToday ? K.accent : K.card2,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800, color: isToday ? "rgba(255,255,255,.7)" : K.sub }}>{dayName}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: isToday ? "#FFF" : K.text, lineHeight: 1.1 }}>{dayNum}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? "rgba(255,255,255,.6)" : K.sub }}>{monName}</div>
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 7 }}>
              {topCats.map(cat => (
                <span key={cat.id} style={{ fontSize: 15, width: 26, height: 26, borderRadius: 8, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{cat.icon}</span>
              ))}
              {dayExps.length > 4 && <span style={{ fontSize: 11, fontWeight: 700, color: K.sub, alignSelf: "center", marginLeft: 2 }}>+{dayExps.length - 4}</span>}
            </div>
            <div style={{ width: "100%", height: 5, background: K.border, borderRadius: 4, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barPct}%` }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: "100%", background: isToday ? K.accent : K.accent + "88", borderRadius: 4 }}
              />
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: K.text }}>{money(dayTotal)}</div>
            <div style={{ fontSize: 11, color: K.sub, marginTop: 2 }}>{count} items</div>
          </div>
          <motion.span
            animate={{ x: [0, 3, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            style={{ fontSize: 16, color: K.sub, opacity: 0.4, flexShrink: 0 }}
          >›</motion.span>
        </motion.div>
      );
    };

    const CatRow = ({ c, catIdx, rTotal: rt }) => {
      const pct = rt > 0 ? (c.total / rt) * 100 : 0;
      return (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: catIdx * 0.04, type: "spring", stiffness: 320, damping: 26 }}
          whileHover={{ backgroundColor: `${c.color}0C`, x: 2 }}
          whileTap={{ scale: 0.99, backgroundColor: `${c.color}18` }}
          onClick={() => setReportCat(c)}
          style={{ padding: "14px 20px", borderBottom: catIdx < reportCatTotals.filter(x => x.total > 0).length - 1 ? `1px solid ${K.border}` : "none", cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <motion.div
                whileHover={{ scale: 1.25, rotate: 12 }}
                transition={{ type: "spring", stiffness: 400, damping: 14 }}
                style={{ width: 40, height: 40, borderRadius: 13, background: c.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}
              >{c.icon}</motion.div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: K.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: K.sub, marginTop: 1 }}>{c.exps.length} entries</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: K.text }}>{moneyFull(c.total)}</div>
                <div style={{ fontSize: 12, color: c.color, marginTop: 2, fontWeight: 700 }}>{pct.toFixed(1)}%</div>
              </div>
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut", delay: catIdx * 0.12 }}
                style={{ fontSize: 16, color: K.sub, opacity: 0.45 }}
              >›</motion.span>
            </div>
          </div>
          <div style={{ width: "100%", height: 7, background: K.border, borderRadius: 5, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct, 3)}%` }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: catIdx * 0.05 }}
              style={{ height: "100%", background: `linear-gradient(90deg, ${c.color}cc, ${c.color})`, borderRadius: 5, position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", animation: "shimmerSweep 1.8s infinite", width: "50%" }} />
            </motion.div>
          </div>
        </motion.div>
      );
    };

    return (
      <div style={{ overflowY: "auto", height: "100%", WebkitOverflowScrolling: "touch", paddingBottom: isMobile ? 110 : 40, paddingTop: isMobile ? 0 : 10 }}>
        {/* ── Period selector ── */}
        <div style={{ padding: isMobile ? "12px 16px 14px" : "0 0 18px" }}>
          <div style={{ display: "flex", background: K.card2, borderRadius: 22, padding: 5, gap: 4, border: `1px solid ${K.border}` }}>
            {periodOptions.map(({ id, label, icon }) => (
              <motion.button
                key={id}
                onClick={() => setReportPeriod(id)}
                whileTap={{ scale: 0.93 }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 16, border: "none", background: "transparent", color: reportPeriod === id ? "#FFF" : K.sub, cursor: "pointer", fontSize: 13, fontWeight: 800, position: "relative", zIndex: 1 }}
              >
                {reportPeriod === id && (
                  <motion.div
                    layoutId="report-period-pill"
                    style={{ position: "absolute", inset: 0, borderRadius: 16, background: K.accent, zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{icon} {label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <motion.div
          variants={gridContainer}
          initial="hidden"
          animate="show"
          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, padding: isMobile ? "0 16px 4px" : "0 0 4px" }}
        >
          {[
            { l: "Period Total",  v: rTotal,                                                    icon: "💰", c: "#6366F1" },
            { l: "Transactions",  v: reportExpenses.length,                                      icon: "📋", c: "#22C55E", raw: true },
            { l: "Daily Avg",     v: reportDailyBreakdown.length > 0 ? rTotal / reportDailyBreakdown.length : 0, icon: "📅", c: "#F59E0B" },
            { l: "Top Category",  v: reportCatTotals[0]?.total || 0, icon: reportCatTotals[0]?.icon || "🏆", c: "#EF4444", sub: reportCatTotals[0]?.name },
          ].map((s, i) => (
            <motion.div
              key={i}
              variants={gridItem}
              whileHover={{ y: -7, scale: 1.03, boxShadow: `0 14px 32px ${s.c}22` }}
              style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 24, padding: 20 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <motion.span
                  animate={{ rotate: [0, 6, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4 + i, ease: "easeInOut" }}
                  style={{ fontSize: 28, display: "inline-block" }}
                >{s.icon}</motion.span>
                <span style={{ fontSize: 11, fontWeight: 800, color: s.c, background: s.c + "18", padding: "4px 8px", borderRadius: 10 }}>{s.l.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: K.text, marginTop: 14 }}>
                {s.raw ? s.v : <AnimatedNumber value={s.v} format={money} />}
              </div>
              <div style={{ fontSize: 12, color: K.sub, marginTop: 4 }}>{s.sub || (s.raw ? "entries" : "spent")}</div>
            </motion.div>
          ))}
        </motion.div>

        {isMobile ? (
          <>
            {total(expenses) > 0 && (
              <>
                <SecLabel>6-MONTH TREND</SecLabel>
                <Card style={{ margin: "0 16px", padding: "20px 14px 10px 0" }}>
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <BarChart data={monthlyBar}>
                        <XAxis dataKey="month" stroke={K.sub} fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke={K.sub} fontSize={11} tickLine={false} axisLine={false} width={35}/>
                        <Tooltip cursor={{ fill: K.card2, opacity: 0.5 }} contentStyle={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, color: K.text }}/>
                        <Bar dataKey="v" fill={K.accent} radius={[6, 6, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            )}

            <SecLabel>CATEGORY BREAKDOWN <span style={{ color: K.sub, fontSize: 10, fontWeight: 600, letterSpacing: 0 }}>· tap for details</span></SecLabel>
            <div style={{ padding: "0 16px" }}>
              <Card style={{ overflow: "hidden", padding: "4px 0" }}>
                {reportCatTotals.map((c, i) => c.total > 0 && <CatRow key={c.id} c={c} catIdx={i} rTotal={rTotal} />)}
                {reportCatTotals.every(c => c.total === 0) && <div style={{ padding: "40px 0", textAlign: "center", color: K.sub, fontSize: 16 }}>No data yet</div>}
              </Card>
            </div>

            {reportDailyBreakdown.length > 0 && (
              <>
                <SecLabel>DAILY BREAKDOWN <span style={{ color: K.sub, fontSize: 10, fontWeight: 600, letterSpacing: 0 }}>· tap for details</span></SecLabel>
                <div style={{ padding: "0 16px" }}>
                  <motion.div variants={listContainer} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {reportDailyBreakdown.map(({ date, exps: de, total: dt, count }) => (
                      <DayRow key={date} date={date} dayExps={de} dayTotal={dt} count={count} />
                    ))}
                  </motion.div>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.10fr 1fr", gap: 30, marginTop: 20, alignItems: "start" }}>
            <div>
              {total(expenses) > 0 && (
                <>
                  <SecLabel style={{ paddingTop: 0 }}>6-MONTH TREND</SecLabel>
                  <Card style={{ padding: "26px 20px 14px 0" }}>
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart data={monthlyBar}>
                          <XAxis dataKey="month" stroke={K.sub} fontSize={12} tickLine={false} axisLine={false}/>
                          <YAxis stroke={K.sub} fontSize={11} tickLine={false} axisLine={false} width={40}/>
                          <Tooltip cursor={{ fill: K.card2, opacity: 0.5 }} contentStyle={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, color: K.text }}/>
                          <Bar dataKey="v" fill={K.accent} radius={[6, 6, 0, 0]} maxBarSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </>
              )}
              {reportDailyBreakdown.length > 0 && (
                <>
                  <SecLabel>DAILY BREAKDOWN</SecLabel>
                  <motion.div variants={listContainer} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {reportDailyBreakdown.slice(0, 20).map(({ date, exps: de, total: dt, count }) => (
                      <DayRow key={date} date={date} dayExps={de} dayTotal={dt} count={count} />
                    ))}
                  </motion.div>
                </>
              )}
            </div>
            <div>
              <SecLabel style={{ paddingTop: 0 }}>CATEGORY BREAKDOWN</SecLabel>
              <Card style={{ overflow: "hidden", padding: "4px 0" }}>
                {reportCatTotals.map((c, i) => c.total > 0 && <CatRow key={c.id} c={c} catIdx={i} rTotal={rTotal} />)}
                {reportCatTotals.every(c => c.total === 0) && <div style={{ padding: "40px 0", textAlign: "center", color: K.sub, fontSize: 16 }}>No data yet</div>}
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  //  PAGE: SETTINGS
  // ════════════════════════════════════════════════════════
  const PageSettings = () => (
    <div style={{
      overflowY: "auto",
      height: "100%",
      WebkitOverflowScrolling: "touch",
      paddingBottom: isMobile ? 110 : 40,
      paddingTop: isMobile ? 0 : 10
    }}>
      {/* Google Sheets */}
      <SecLabel style={isMobile ? {} : { paddingTop: 0 }}>GOOGLE SHEETS SYNC</SecLabel>
      <Card style={{ margin: isMobile ? "0 16px" : "0 0 20px", overflow: "hidden" }}>
        {gsOn ? (
          <>
            <div style={{ padding: "22px 22px", display: "flex", alignItems: "center", gap: 18, borderBottom: `1px solid ${K.border}`, background: K.green + "0E" }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: K.green + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>✅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: K.green }}>Connected</div>
                <div style={{ fontSize: 12, color: K.sub, marginTop: 4, wordBreak: "break-all", lineHeight: 1.5 }}>{scriptUrl.slice(0, 55)}…</div>
              </div>
            </div>
            <div style={{ padding: "18px 22px", display: "flex", gap: 12 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} onClick={restoreSheets} disabled={gsBusy} style={{ flex: 1, padding: "16px", borderRadius: 18, border: `1.5px solid ${K.accent}`, background: K.accent + "22", color: K.accent, cursor: "pointer", fontSize: 15, fontWeight: 800 }}>
                {gsBusy ? "Syncing…" : "⬇️ Restore from Sheets"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} onClick={disconnectGs} style={{ flex: 1, padding: "16px", borderRadius: 18, border: `1.5px solid ${K.red}`, background: K.red + "22", color: K.red, cursor: "pointer", fontSize: 15, fontWeight: 800 }}>
                Disconnect
              </motion.button>
            </div>
          </>
        ) : (
          <div style={{ padding: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: K.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>📊</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: K.text }}>Connect Google Sheets</div>
                <div style={{ fontSize: 13, color: K.sub, marginTop: 4 }}>Auto-sync every expense</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: K.sub, letterSpacing: .8, marginBottom: 10 }}>APPS SCRIPT URL</div>
            <input value={urlDraft} onChange={e => setUrlDraft(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" style={{ width: "100%", padding: "18px", borderRadius: 18, border: `1.5px solid ${K.border}`, background: K.card2, color: K.text, fontSize: 15, boxSizing: "border-box", outline: "none", fontFamily: "inherit", marginBottom: 16 }}/>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={connectGs} style={{ width: "100%", padding: "18px", borderRadius: 18, border: "none", background: K.accent, color: "#FFF", cursor: "pointer", fontSize: 17, fontWeight: 900 }}>
              🔗 Connect
            </motion.button>
          </div>
        )}
      </Card>

      {/* Preferences */}
      <SecLabel>PREFERENCES</SecLabel>
      <Card style={{ margin: isMobile ? "0 16px" : "0 0 20px", padding: "6px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px solid ${K.border}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: K.text }}>Dark Mode</div>
            <div style={{ fontSize: 13, color: K.sub, marginTop: 3 }}>Switch absolute theme styling</div>
          </div>
          <motion.button onClick={() => { const d = !dark; setDark(d); localStorage.setItem("exp_cfg4", JSON.stringify({ dark: d, currency })); }} whileTap={{ scale: 0.88 }} style={{ width: 64, height: 38, borderRadius: 20, background: dark ? K.accent : K.border, border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 4, justifyContent: dark ? "flex-end" : "flex-start" }}>
            <motion.div layout style={{ width: 30, height: 30, borderRadius: 15, background: "#FFF", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
          </motion.button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: K.text }}>Primary Currency</div>
            <div style={{ fontSize: 13, color: K.sub, marginTop: 3 }}>Switch context dynamic symbols</div>
          </div>
          <select value={currency} onChange={e => { const c = e.target.value; setCurrency(c); localStorage.setItem("exp_cfg4", JSON.stringify({ dark, currency: c })); }} style={{ padding: "10px 14px", borderRadius: 12, background: K.card2, color: K.text, border: `1.5px solid ${K.border}`, fontWeight: 700, outline: "none" }}>
            <option value="DA">DA (د.ج)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </Card>

      {/* App Statistics Information */}
      <SecLabel>SYSTEM STATISTICS</SecLabel>
      <Card style={{ margin: isMobile ? "0 16px" : "0 0 20px", padding: "4px 22px 18px" }}>
        {[
          { l: "Total Registered Items", v: expenses.length },
          { l: "Gross Account Turnout", v: moneyFull(total(expenses)) },
          { l: "Categories used", v: `${catTotals.filter(c => c.total > 0).length} of ${CATS.length}` },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: i < 2 ? `1px solid ${K.border}` : "none" }}>
            <span style={{ fontSize: 16, color: K.sub }}>{r.l}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: K.text }}>{r.v}</span>
          </div>
        ))}
      </Card>
    </div>
  );

  // ── Nav ───────────────────────────────────────────────────
  const NAV = [
    { id: "home",     icon: "🏠", label: "Home" },
    { id: "calendar", icon: "📅", label: "Calendar" },
    { id: "history",  icon: "🔍", label: "Search" },
    { id: "reports",  icon: "📈", label: "Reports" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];
  const titles = { home: "Expenses Tracker", calendar: "Calendar", history: "History", reports: "Reports", settings: "Settings" };

  const renderPage = () => {
    // Change 3 — Loading screen: Animated spinner
    if (loading) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: K.sub, gap: 16 }}>
        <div className="loading-spinner" style={{ width: 44, height: 44, border: `4px solid ${K.border}`, borderTop: `4px solid ${K.accent}`, borderRadius: "50%", animation: "spinnerRotate 0.9s linear infinite" }} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.5 }}>Loading Workspace…</span>
      </div>
    );
    switch (page) {
      case "home": return <PageHome/>;
      case "calendar": return <PageCalendar/>;
      case "history": return <PageHistory/>;
      case "reports": return <PageReports/>;
      case "settings": return <PageSettings/>;
      default: return null;
    }
  };

  // ── Expense drawer (period detail) ────────────────────────
  const drawerGrouped = {};
  if (drawer) {
    [...(drawer.exps || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(ex => {
      if (!drawerGrouped[ex.date]) drawerGrouped[ex.date] = [];
      drawerGrouped[ex.date].push(ex);
    });
  }

  // ════════════════════════════════════════════════════════
  //  ROOT RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div style={{
      width: "100%", maxWidth: isMobile ? 480 : 1240, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: isMobile ? "column" : "row", background: K.bg,
      backgroundImage: `radial-gradient(circle at 20% 10%, rgba(99,102,241,.22) 0%, transparent 26%), radial-gradient(circle at 75% 15%, rgba(16,185,129,.16) 0%, transparent 28%), radial-gradient(circle at 80% 80%, rgba(236,72,153,.12) 0%, transparent 24%)`,
      fontFamily: "'DM Sans','SF Pro Display',system-ui,sans-serif", color: K.text, position: "relative", overflow: "hidden",
    }}>
      {/* ── Widescreen Glassmorphic Left Sidebar Navigation ── */}
      {!isMobile && (
        <div style={{
          width: 280,
          background: K.card,
          borderRight: `1px solid ${K.border}`,
          backdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
          padding: "34px 24px",
          zIndex: 100,
          flexShrink: 0,
          position: "relative"
        }}>
          {/* Logo / Brand Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 44, padding: "0 8px" }}>
            <span style={{ fontSize: 36, filter: "drop-shadow(0 4px 10px rgba(99,102,241,0.3))" }}>💰</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: K.text, letterSpacing: -0.6 }}>Daily Budget</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: K.accent, letterSpacing: 1.5, marginTop: 1 }}>EXPENSES LEDGER</div>
            </div>
          </div>

          {/* Nav Items Link Stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            {NAV.map(n => {
              const active = page === n.id;
              return (
                <motion.button
                  key={n.id}
                  onClick={() => navigate(n.id)}
                  whileHover={{ x: 6 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: "16px 20px",
                    borderRadius: 18,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    position: "relative",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-sliding-glow-desktop"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 18,
                        background: `${K.accent}15`,
                        border: `1.5px solid ${K.accent}30`,
                        boxShadow: `0 4px 20px ${K.accent}12`,
                        zIndex: 0
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span style={{ fontSize: 24, position: "relative", zIndex: 1 }}>{n.icon}</span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: active ? 800 : 600,
                    color: active ? K.accent : K.sub,
                    position: "relative",
                    zIndex: 1,
                    transition: "color 0.28s"
                  }}>
                    {n.label}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Quick Info Sidebar Widget */}
          <div style={{ borderTop: `1px solid ${K.border}`, paddingTop: 24, paddingLeft: 8 }}>
            <div style={{ fontSize: 11, color: K.sub, fontWeight: 800, letterSpacing: 1.2 }}>MONTH'S BUDGET TURNOUT</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: K.text, marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
              <AnimatedNumber value={total(monthExp)} format={money} />
            </div>
          </div>
        </div>
      )}

      {/* ── Right Side Main Canvas Dashboard Viewport ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        height: "100%"
      }}>
        {/* ── Ambient blobs + Pulse Dots ──────────────────── */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "10%", left: "-12%", width: 260, height: 260, borderRadius: "50%", background: "rgba(99,102,241,.22)", filter: "blur(40px)", animation: "blobMove 18s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", top: "20%", right: "-8%", width: 200, height: 200, borderRadius: "50%", background: "rgba(16,185,129,.14)", filter: "blur(35px)", animation: "blobMoveAlt 14s ease-in-out infinite alternate" }} />
          
          <div style={{ position: "absolute", top: "15%", left: "45%", width: 6, height: 6, borderRadius: "50%", background: K.accent, opacity: 0.4, animation: "staggeredPulse 3s infinite ease-in-out" }} />
          <div style={{ position: "absolute", top: "55%", left: "15%", width: 8, height: 8, borderRadius: "50%", background: K.amber, opacity: 0.3, animation: "staggeredPulse 3s infinite ease-in-out", animationDelay: "0.7s" }} />
          <div style={{ position: "absolute", top: "40%", right: "20%", width: 7, height: 7, borderRadius: "50%", background: K.green, opacity: 0.3, animation: "staggeredPulse 3s infinite ease-in-out", animationDelay: "1.4s" }} />
          <div style={{ position: "absolute", top: "75%", right: "35%", width: 9, height: 9, borderRadius: "50%", background: K.red, opacity: 0.25, animation: "staggeredPulse 3s infinite ease-in-out", animationDelay: "2.1s" }} />
        </div>

        {/* ── Top App Bar Header ────────────────────────── */}
        <div style={{ padding: isMobile ? "20px 20px 10px" : "34px 40px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: K.sub, letterSpacing: 1.5, textTransform: "uppercase" }}>{isMobile ? "Dashboard" : "Expenses Tracker"}</div>
            <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 900, color: K.text, marginTop: 2 }}>{titles[page]}</div>
          </div>
          <motion.button onClick={() => { const d = !dark; setDark(d); localStorage.setItem("exp_cfg4", JSON.stringify({ dark: d, currency })); }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} style={{ width: 52, height: 52, borderRadius: 18, background: K.card, border: `1px solid ${K.border}`, color: K.text, cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,.05)", zIndex: 12 }}>
            {dark ? "🌙" : "☀️"}
          </motion.button>
        </div>

        {/* ── Viewport Area Layout Switcher ──────────────── */}
        <div style={{ flex: 1, position: "relative", zIndex: 10, padding: isMobile ? "0" : "0 40px" }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={page}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={pageTransition}
              style={{ width: "100%", height: "100%", position: "absolute" }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Floating Action Button (FAB) ─────────────── */}
        <AnimatePresence>
          {page !== "settings" && !loading && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.2 }}
              style={{ position: "absolute", bottom: isMobile ? 96 : 36, right: isMobile ? 24 : 40, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", animation: "fabBreathing 4s ease-in-out infinite" }}
            >
              <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "rgba(99,102,241,0.35)", pointerEvents: "none", animation: "pulseRingOne 2.6s cubic-bezier(0.215, 0.610, 0.355, 1) infinite" }} />
              <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "rgba(124,58,237,0.25)", pointerEvents: "none", animation: "pulseRingTwo 2.6s cubic-bezier(0.215, 0.610, 0.355, 1) infinite", animationDelay: "1.3s" }} />

              <motion.button
                onClick={() => openAdd(CATS[0])}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.88, rotate: 45 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                style={{
                  width: 68, height: 68, borderRadius: 34, border: "none",
                  background: "linear-gradient(145deg,#6366F1,#7C3AED)", color: "#FFF",
                  fontSize: 36, cursor: "pointer", boxShadow: "0 8px 30px rgba(99,102,241,.6)",
                  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, position: "relative", zIndex: 2
                }}
              >+</motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom navigation (MOBILE ONLY) ─────────────────────────────── */}
        {isMobile && (
          <div style={{
            background: K.card, borderTop: `1px solid ${K.border}`, display: "flex", flexShrink: 0,
            paddingBottom: "max(12px, env(safe-area-inset-bottom,12px))", zIndex: 11, position: "relative"
          }}>
            {NAV.map(n => {
              const active = page === n.id;
              return (
                <motion.button
                  key={n.id}
                  onClick={() => navigate(n.id)}
                  whileTap={{ scale: 0.88 }}
                  style={{
                    flex: 1, padding: "14px 4px 10px", border: "none", background: "transparent",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, position: "relative",
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-sliding-glow"
                      style={{ position: "absolute", inset: "6px 8px", borderRadius: 16, background: `${K.accent}15`, border: `1px solid ${K.accent}30`, boxShadow: `0 0 16px ${K.accent}15`, zIndex: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <motion.div
                    animate={{ scale: active ? 1.15 : 1, y: active ? -1 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    style={{ fontSize: 24, position: "relative", zIndex: 1 }}
                  >
                    {n.icon}
                  </motion.div>
                  <div style={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? K.accent : K.sub, position: "relative", zIndex: 1 }}>
                    {n.label}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Toast Overlay Notice Status Banner ──────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            style={{
              position: "absolute", top: 90, left: "50%", transform: "translateX(-50%)",
              background: toast.bad ? K.red : K.green, color: "#FFF",
              padding: "14px 28px", borderRadius: 28, fontSize: 16, fontWeight: 800,
              zIndex: 600, whiteSpace: "nowrap", boxShadow: "0 10px 40px rgba(0,0,0,.35)",
              overflow: "hidden"
            }}
          >
            {toast.msg}
            {/* Change 6 — Toast: Add countdown progress bar */}
            <div style={{ position: "absolute", bottom: 0, left: 0, height: 4, background: "rgba(255,255,255,0.45)", animation: "toastCountdown 2.6s linear forwards" }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Detail Drawer ─────────────────────── */}
      <BottomSheet
        show={!!reportCat}
        onClose={() => setReportCat(null)}
        title={reportCat ? `${reportCat.icon} ${reportCat.name}` : ""}
        sub={reportCat ? `${reportCat.exps.length} transactions · ${moneyFull(reportCat.total)}` : ""}
        isMobile={isMobile} K={K}
      >
        <div style={{ padding: "8px 16px 0" }}>
          {reportCat && (() => {
            const grouped = {};
            [...reportCat.exps].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(ex => {
              if (!grouped[ex.date]) grouped[ex.date] = [];
              grouped[ex.date].push(ex);
            });
            const dates = Object.keys(grouped);
            return dates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: K.sub, fontSize: 16 }}>No transactions</div>
            ) : dates.map(dateStr => (
              <div key={dateStr} style={{ marginBottom: 14 }}>
                <div style={{ background: K.card2, padding: "8px 18px", fontSize: 12, fontWeight: 800, color: K.sub, borderRadius: 12, marginBottom: 6 }}>
                  {dateStr === today() ? "TODAY" : dateStr}
                </div>
                <Card style={{ overflow: "hidden" }}>
                  {grouped[dateStr].map((ex, i) => (
                    <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => { setReportCat(null); openEdit(ex); }} onDel={() => { setReportCat(null); setDelId(ex.id); }}/>
                  ))}
                </Card>
              </div>
            ));
          })()}
        </div>
      </BottomSheet>

      {/* ── Day Detail Drawer ───────────────────────────── */}
      <BottomSheet
        show={!!reportDay}
        onClose={() => setReportDay(null)}
        title={reportDay ? new Date(reportDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ""}
        sub={reportDay ? `${reportDay.exps.length} transactions · ${moneyFull(reportDay.total)}` : ""}
        isMobile={isMobile} K={K}
      >
        <div style={{ padding: "8px 16px 0" }}>
          {reportDay && (() => {
            const dayCats = CATS.map(c => ({
              ...c,
              total: total(reportDay.exps.filter(e => e.category === c.id)),
              exps: reportDay.exps.filter(e => e.category === c.id)
            })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
            return (
              <>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: K.sub, letterSpacing: 1, marginBottom: 12 }}>CATEGORY BREAKDOWN</div>
                  <motion.div variants={gridContainer} initial="hidden" animate="show" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {dayCats.map((c, i) => (
                      <motion.div
                        key={c.id}
                        variants={gridItem}
                        whileHover={{ scale: 1.04, y: -3 }}
                        style={{ background: c.color + "18", border: `1.5px solid ${c.color}35`, borderRadius: 18, padding: "14px 10px", textAlign: "center" }}
                      >
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 2.5 + i * 0.3, ease: "easeInOut" }}
                          style={{ fontSize: 26 }}
                        >{c.icon}</motion.div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: c.color, marginTop: 6 }}>{c.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: K.text, marginTop: 4 }}>{money(c.total)}</div>
                        <div style={{ fontSize: 11, color: K.sub, marginTop: 2 }}>{c.exps.length} items</div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: K.sub, letterSpacing: 1, marginBottom: 10 }}>ALL TRANSACTIONS</div>
                <Card style={{ overflow: "hidden", marginBottom: 8 }}>
                  <AnimatePresence>
                    {[...reportDay.exps].sort((a, b) => new Date(b.ts || b.date) - new Date(a.ts || a.date)).map((ex, i) => (
                      <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => { setReportDay(null); openEdit(ex); }} onDel={() => { setReportDay(null); setDelId(ex.id); }}/>
                    ))}
                  </AnimatePresence>
                </Card>
              </>
            );
          })()}
        </div>
      </BottomSheet>

      {/* ── Period Item Sheet Detail Overlay ────────────── */}
      <BottomSheet show={!!drawer} onClose={() => setDrawer(null)} title={drawer?.title} sub={drawer?.sub} isMobile={isMobile} K={K}>
        <div style={{ padding: "8px 16px 0" }}>
          {drawer && Object.keys(drawerGrouped).length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: K.sub, fontSize: 16 }}>No transactions found</div>
          ) : (
            Object.keys(drawerGrouped).map(dateStr => (
              <div key={dateStr} style={{ marginBottom: 14 }}>
                <div style={{ background: K.card2, padding: "8px 18px", fontSize: 12, fontWeight: 800, color: K.sub, borderRadius: 12, marginBottom: 6 }}>
                  {dateStr === today() ? "TODAY" : dateStr}
                </div>
                <Card style={{ overflow: "hidden" }}>
                  {drawerGrouped[dateStr].map((ex, i) => (
                    <ExpRow key={ex.id} ex={ex} index={i} onEdit={() => { setDrawer(null); openEdit(ex); }} onDel={() => delExp(ex.id)}/>
                  ))}
                </Card>
              </div>
            ))
          )}
        </div>
      </BottomSheet>

      {/* ── Transaction Delete Confirmation ─────────────── */}
      <BottomSheet show={!!delId} onClose={() => setDelId(null)} title="Confirm Deletion" sub="This operation cannot be undone." isMobile={isMobile} K={K}>
        <div style={{ padding: "10px 24px" }}>
          <div style={{ fontSize: 16, color: K.text, lineHeight: 1.5, marginBottom: 24 }}>Are you sure you want to permanently discard this transaction entry records from your account file ledger?</div>
          <div style={{ display: "flex", gap: 14 }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setDelId(null)} style={{ flex: 1, padding: "18px", borderRadius: 18, border: `1.5px solid ${K.border}`, background: K.card2, color: K.text, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Cancel</motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => delExp(delId)} style={{ flex: 1, padding: "18px", borderRadius: 18, border: "none", background: K.red, color: "#FFF", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Delete Entry</motion.button>
          </div>
        </div>
      </BottomSheet>

      {/* ── ADD / EDIT MODAL — spring bottom sheet ─────────── */}
      <BottomSheet show={modal} onClose={closeModal} title={editId ? "Edit Expense" : "Add Expense"} sub={editId ? "Modify transaction fields" : "Create new spending transaction record entry"} isMobile={isMobile} K={K}>
        {/* Category Horizontal Filter Chips Grid Selector */}
        {!editId && (
          <div style={{ padding: "12px 24px 4px", overflowX: "auto", display: "flex", gap: 10, WebkitOverflowScrolling: "touch" }}>
            {CATS.map(c => (
              <motion.button
                key={c.id}
                onClick={() => setSelCat(c)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                style={{
                  flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 76,
                  padding: "14px 16px", borderRadius: 20, border: `2.5px solid ${c.id === selCat?.id ? c.color : K.border}`,
                  background: c.id === selCat?.id ? c.color + "22" : K.card2, cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 30 }}>{c.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.id === selCat?.id ? c.color : K.sub, whiteSpace: "nowrap" }}>{c.name}</span>
              </motion.button>
            ))}
          </div>
        )}
        {/* Fields */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px", WebkitOverflowScrolling: "touch" }}>
          {[
            { label: "EXPENSE NAME", key: "name", type: "text", ph: `e.g. ${selCat?.id === "food" ? "Lunch" : "Description"}` },
            { label: `AMOUNT (${currency})`, key: "amount", type: "number", ph: "0.00" },
            { label: "DATE", key: "date", type: "date", ph: "" },
            { label: "NOTES", key: "notes", type: "text", ph: "Optional details…" },
          ].map((f, fi) => (
            <motion.div key={f.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: fi * 0.06, type: "spring", stiffness: 320, damping: 26 }} style={{ marginBottom: 20 }} >
              <div style={{ fontSize: 12, fontWeight: 800, color: K.sub, letterSpacing: .8, marginBottom: 10 }}>{f.label}</div>
              <input type={f.type} value={f.key === "date" ? form[f.key] : form[f.key]} placeholder={f.ph} onChange={e => setForm({ ...form, [f.key]: f.key === "name" ? capitalizeFirst(e.target.value) : e.target.value })} style={{ width: "100%", padding: "18px 18px", borderRadius: 18, border: `1.5px solid ${K.border}`, background: K.card2, color: K.text, fontSize: 17, boxSizing: "border-box", outline: "none", fontFamily: "inherit", transition: "border 0.2s" }} required />
            </motion.div>
          ))}

          {/* Action buttons CTA control triggers */}
          <motion.button disabled={saving} onClick={saveExp} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} style={{ width: "100%", padding: "18px", borderRadius: 18, border: "none", background: "linear-gradient(145deg,#6366F1,#7C3AED)", color: "#FFF", fontSize: 18, fontWeight: 900, cursor: "pointer", marginTop: 10, boxShadow: "0 8px 24px rgba(99,102,241,.3)" }}>
            {saving ? "Saving Ledger Entry…" : editId ? "💾 Save Updates" : "✨ Create Transaction Entry"}
          </motion.button>
        </div>
      </BottomSheet>

      {/* ── Global Custom Advanced CSS Effects Layer Setup ──── */}
      {/* Change 10 — Injecting keyframes for custom advanced behaviors */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { margin:0; overscroll-behavior:none; touch-action:pan-y; }
        input,button,select,textarea { font-family:inherit; }
        input[type=text], input[type=number], input[type=date], select { font-size:max(16px,1em) !important; transition: border-color 0.22s ease, box-shadow 0.22s ease !important; }
        input[type=text]:focus, input[type=number]:focus, input[type=date]:focus, select:focus { border-color: ${K.accent} !important; box-shadow: 0 0 0 4px ${K.accent}20 !important; }
        input[type=date]::-webkit-calendar-picker-indicator { filter:${dark ? "invert(1)" : "none"}; opacity:.7; cursor:pointer; }
        ::-webkit-scrollbar { display:none; }
        
        @keyframes blobMove {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(12px, -18px) scale(1.08); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes blobMoveAlt {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 16px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }

        @keyframes spinnerRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes floatingEmoji {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        @keyframes shimmerSweep {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }

        @keyframes toastCountdown {
          0% { width: 100%; }
          100% { width: 0%; }
        }

        @keyframes rotationSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes fabBreathing {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }

        @keyframes pulseRingOne {
          0% { transform: scale(0.95); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        @keyframes pulseRingTwo {
          0% { transform: scale(0.95); opacity: 0.6; }
          100% { transform: scale(1.45); opacity: 0; }
        }

        @keyframes staggeredPulse {
          0% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.4); opacity: 0.6; box-shadow: 0 0 12px currentColor; }
          100% { transform: scale(1); opacity: 0.2; }
        }
      `}</style>

    </div>
  );
}