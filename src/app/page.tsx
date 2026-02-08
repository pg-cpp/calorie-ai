"use client";

import { useEffect, useMemo, useState } from "react";

type MacroTotal = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

type AnalyzeResult = {
  items?: any[];
  total: MacroTotal;
  assumptions?: string[];
};

type LogEntry = {
  id: string;
  ts: number;
  name: string;
  portion: string;
  imageName?: string;
  result: AnalyzeResult;
};

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function storageKeyForToday() {
  return `calorie_log_${dayKey()}`;
}

function loadTodayEntries(): LogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(storageKeyForToday());
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

function saveTodayEntries(entries: LogEntry[]) {
  localStorage.setItem(storageKeyForToday(), JSON.stringify(entries));
}

function sumTotals(entries: LogEntry[]): MacroTotal {
  return entries.reduce(
    (acc, e) => {
      acc.kcal += Number(e.result.total?.kcal ?? 0);
      acc.protein_g += Number(e.result.total?.protein_g ?? 0);
      acc.carb_g += Number(e.result.total?.carb_g ?? 0);
      acc.fat_g += Number(e.result.total?.fat_g ?? 0);
      return acc;
    },
    { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 }
  );
}

function round1(n: any) {
  const x = Number(n ?? 0);
  return Math.round(x * 10) / 10;
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [mealTag, setMealTag] = useState<"Breakfast" | "Lunch" | "Dinner" | "Snack">("Lunch");
  const [targetKcal, setTargetKcal] = useState(2300);

  const [image, setImage] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    setEntries(loadTodayEntries());
  }, []);

  const todayTotal = useMemo(() => sumTotals(entries), [entries]);
  const kcalProgress = Math.min(100, (Number(todayTotal.kcal || 0) / Math.max(1, Number(targetKcal || 1))) * 100);

  async function handleAnalyze() {
    setErr("");
    setResult(null);

    if (!image) {
      setErr("Please choose a food photo first.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("portion", `${mealTag}: ${portion}`.trim());
      fd.append("image", image);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Analyze failed");
      }

      // normalize numbers (sometimes model returns strings)
      const normalized: AnalyzeResult = {
        items: Array.isArray(data.items) ? data.items : [],
        assumptions: Array.isArray(data.assumptions) ? data.assumptions : [],
        total: {
          kcal: Number(data.total?.kcal ?? 0),
          protein_g: Number(data.total?.protein_g ?? 0),
          carb_g: Number(data.total?.carb_g ?? 0),
          fat_g: Number(data.total?.fat_g ?? 0),
        },
      };

      setResult(normalized);
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function addToToday() {
    if (!result) return;

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      name: name || "",
      portion: `${mealTag}: ${portion}`.trim(),
      imageName: image?.name,
      result,
    };

    const updated = [entry, ...entries];
    setEntries(updated);
    saveTodayEntries(updated);

    // reset input, keep name
    setPortion("");
    setImage(null);
    setResult(null);
    setErr("");
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveTodayEntries(updated);
  }

  return (
    <main className="wrap">
      <style jsx global>{`
        :root { color-scheme: light; }
        body { margin: 0; background: #fafafa; }
        .wrap {
          max-width: 1100px;
          margin: 28px auto;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          padding: 20px;
        }
        .title { margin: 0 0 6px 0; font-size: 28px; }
        .subtitle { margin: 0 0 14px 0; opacity: 0.75; }
        .grid {
          display: grid;
          gap: 14px;
          grid-template-columns: 1.3fr 1fr;
          align-items: stretch;
          margin-top: 14px;
        }
        @media (max-width: 900px) {
          .grid { grid-template-columns: 1fr; }
        }
        .card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 1px 6px rgba(0,0,0,0.04);
        }
        h2 { margin: 0 0 10px 0; font-size: 18px; }
        h3 { margin: 0 0 10px 0; font-size: 16px; }
        label { display: grid; gap: 6px; font-size: 14px; }
        input, select, button {
          font-size: 14px;
        }
        input, select {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #e2e2e2;
          background: #fff;
        }
        button {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #111;
          background: #111;
          color: #fff;
          cursor: pointer;
        }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .muted { opacity: 0.6; }
        .stats4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        @media (max-width: 520px) {
          .stats4 { grid-template-columns: repeat(2, 1fr); }
        }
        .barOuter { height: 12px; background: #f1f1f1; border-radius: 999px; }
        .barInner { height: 100%; border-radius: 999px; background: #111; }
      `}</style>
      <h1 className="title">Calorie Calculator — V1</h1>
      <p className="subtitle">Analyze a photo → Add to today → Track today totals (saved in your browser).</p>

      <section className="grid">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Today total</h2>

          <div className="stats4">
            <Stat label="kcal" value={Math.round(todayTotal.kcal)} />
            <Stat label="protein (g)" value={round1(todayTotal.protein_g)} />
            <Stat label="carb (g)" value={round1(todayTotal.carb_g)} />
            <Stat label="fat (g)" value={round1(todayTotal.fat_g)} />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <strong>Calories target</strong>
              <span style={{ opacity: 0.75 }}>
                {Math.round(todayTotal.kcal)} / {Math.round(targetKcal)} kcal
              </span>
            </div>
            <div className="barOuter">
              <div className="barInner" style={{ width: `${kcalProgress}%` }} />
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ opacity: 0.8 }}>Target kcal:</label>
              <input
                type="number"
                value={targetKcal}
                onChange={(e) => setTargetKcal(Number(e.target.value || 0))}
                style={{ width: 120 }}
              />
              <span style={{ opacity: 0.6 }}>(V1: manual)</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Analyze</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAnalyze();
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Meal
              <select value={mealTag} onChange={(e) => setMealTag(e.target.value as any)} style={{ width: "100%" }}>
                <option>Breakfast</option>
                <option>Lunch</option>
                <option>Dinner</option>
                <option>Snack</option>
              </select>
            </label>

            <label>
              Portion / Weight info (e.g., 150g rice + 200g chicken)
              <input value={portion} onChange={(e) => setPortion(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Food photo
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
            </label>

            <button type="submit" disabled={loading} style={{ padding: 10 }}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>

            {err && <p style={{ color: "crimson", margin: 0 }}>{err}</p>}
          </form>

          {result && (
            <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
              <h3 style={{ marginTop: 0 }}>Analysis result</h3>

              <div className="stats4">
                <Stat label="kcal" value={Math.round(result.total.kcal)} />
                <Stat label="protein (g)" value={round1(result.total.protein_g)} />
                <Stat label="carb (g)" value={round1(result.total.carb_g)} />
                <Stat label="fat (g)" value={round1(result.total.fat_g)} />
              </div>

              <button onClick={addToToday} style={{ padding: 10, marginTop: 12, width: "100%" }}>
                Add to today
              </button>

              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer" }}>Show full JSON</summary>
                <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 8 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Today entries ({entries.length})</h2>

        {entries.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No entries yet. Analyze a photo and add it.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {entries.map((e) => (
              <div
                key={e.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <strong>{fmtTime(e.ts)}</strong>
                    <span style={{ opacity: 0.75 }}>{e.portion || "(no portion)"}</span>
                    {e.imageName && <span style={{ opacity: 0.5 }}>({e.imageName})</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 8 }}>
                    <Stat label="kcal" value={Math.round(e.result.total.kcal)} />
                    <Stat label="P(g)" value={round1(e.result.total.protein_g)} />
                    <Stat label="C(g)" value={round1(e.result.total.carb_g)} />
                    <Stat label="F(g)" value={round1(e.result.total.fat_g)} />
                  </div>

                  {Array.isArray(e.result.items) && e.result.items.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer" }}>Items</summary>
                      <ul style={{ marginTop: 8 }}>
                        {e.result.items.slice(0, 10).map((it: any, idx: number) => (
                          <li key={idx}>
                            {it.name} — {Math.round(Number(it.kcal ?? 0))} kcal
                            {it.estimated_grams ? `, ~${Math.round(Number(it.estimated_grams))}g` : ""}{" "}
                            <span style={{ opacity: 0.6 }}>{it.confidence ? `(${it.confidence})` : ""}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>

                <button onClick={() => deleteEntry(e.id)} style={{ padding: "8px 10px" }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 14 }} className="muted">
        V1 stores data in your browser only. Next step (V2): login + database + history across devices.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 750 }}>{value}</div>
    </div>
  );
}