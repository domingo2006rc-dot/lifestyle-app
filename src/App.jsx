import { useState, useEffect, useRef } from "react";

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const SK = "lifestyle-app-v1";
const defaultData = {
  splits: [], history: [], foodLibrary: [], recipes: [], dailyLogs: {}, coachHistory: [],
};
const load = () => { try { const r = localStorage.getItem(SK); return r ? { ...defaultData, ...JSON.parse(r) } : defaultData; } catch { return defaultData; } };
const save = (d) => { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} };

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const SECTIONS = { HOME: "home", GYM: "gym", NUTRITION: "nutrition", COACH: "coach" };
const GYM_VIEWS = { HOME: "home", BUILD: "build", WORKOUT: "workout", SESSION_ACTIVE: "active", HISTORY: "history", SESSION_DETAIL: "detail" };
const NUT_VIEWS = { HOME: "home", FOOD_LIB: "library", ADD_FOOD: "add_food", RECIPES: "recipes", ADD_RECIPE: "add_recipe", LOG_MEAL: "log_meal" };
const TODAY = () => new Date().toISOString().split("T")[0];
const MACRO_TARGETS = { calories: 2200, protein: 145, carbs: 180, fat: 70, sodium: 2300 };

// ─── API CALL ─────────────────────────────────────────────────────────────────
const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callClaude(messages, system) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 1000,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't respond right now.";
}

async function scanNutritionLabel(base64Image, mediaType) {
  // Groq doesn't support vision, so return null and let user fill manually
  return null;
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(load);
  const [section, setSection] = useState(SECTIONS.HOME);

  const update = (fn) => setData(prev => { const next = typeof fn === "function" ? fn(prev) : fn; save(next); return next; });

  useEffect(() => { save(data); }, [data]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Mono','Courier New',monospace", color: "#e5e5e5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 16px 18px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s; }
        .card:hover { border-color: #333; }
        textarea { resize: none; }
      `}</style>

      {section === SECTIONS.HOME && <HomeScreen setSection={setSection} data={data} />}
      {section === SECTIONS.GYM && <GymSection data={data} update={update} onBack={() => setSection(SECTIONS.HOME)} />}
      {section === SECTIONS.NUTRITION && <NutritionSection data={data} update={update} onBack={() => setSection(SECTIONS.HOME)} />}
      {section === SECTIONS.COACH && <CoachSection data={data} update={update} onBack={() => setSection(SECTIONS.HOME)} />}
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ setSection, data }) {
  const today = TODAY();
  const [selectedDay, setSelectedDay] = useState(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const log = data.dailyLogs[today] || { items: [] };
  const totals = calcTotals(log.items);
  const lastSession = data.history[0];

  const activeDays = new Set([
    ...Object.keys(data.dailyLogs).filter(d => data.dailyLogs[d]?.items?.length > 0),
    ...data.history.map(s => s.date.split("T")[0]),
  ]);

  if (selectedDay) {
    const dayLog = data.dailyLogs[selectedDay] || { items: [] };
    const dayTotals = calcTotals(dayLog.items);
    const daySessions = data.history.filter(s => s.date.split("T")[0] === selectedDay);
    const label = new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
    return (
      <div style={{ padding: "36px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button style={{ background: "none", border: "1px solid #222", borderRadius: 8, color: "#e5e5e5", padding: "6px 12px", cursor: "pointer", fontSize: 14 }} onClick={() => setSelectedDay(null)}>←</button>
          <div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em" }}>{label.toUpperCase()}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, lineHeight: 1 }}>DAY SUMMARY</div>
          </div>
        </div>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 12 }}>NUTRITION</div>
          {dayLog.items.length === 0 ? <div style={{ fontSize: 12, color: "#444" }}>Nothing logged</div> : (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[{label:"KCAL",val:Math.round(dayTotals.calories),color:"#f97316"},{label:"PRO",val:`${Math.round(dayTotals.protein)}g`,color:"#3b82f6"},{label:"CARBS",val:`${Math.round(dayTotals.carbs)}g`,color:"#10b981"},{label:"FAT",val:`${Math.round(dayTotals.fat)}g`,color:"#a855f7"}].map(m=>(
                <div key={m.label} style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:m.color }}>{m.val}</div>
                  <div style={{ fontSize:9, color:"#555" }}>{m.label}</div>
                </div>
              ))}
            </div>
            {dayLog.items.map(item=>(
              <div key={item.id} style={{ borderTop:"1px solid #1a1a1a", paddingTop:8, marginTop:8, display:"flex", justifyContent:"space-between" }}>
                <div style={{ fontSize:12 }}>{item.name}{item.servings!==1&&<span style={{color:"#555"}}> ×{item.servings}</span>}</div>
                <div style={{ fontSize:11, color:"#555" }}>{Math.round(item.calories)} kcal</div>
              </div>
            ))}
          </>)}
        </div>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 12 }}>WORKOUTS</div>
          {daySessions.length === 0 ? <div style={{ fontSize:12, color:"#444" }}>No sessions logged</div> : daySessions.map(session=>(
            <div key={session.id} style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>{session.splitName}</div>
                {session.duration&&<div style={{ fontSize:11, color:"#555" }}>{fmt(session.duration)}</div>}
              </div>
              {session.exercises.map(ex=>(
                <div key={ex.id} style={{ marginBottom:8 }}>
                  <div style={{ fontSize:11, color:"#888", marginBottom:4, letterSpacing:"0.05em" }}>{ex.name.toUpperCase()}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {ex.sets.filter(s=>s.done).map((set,i)=>(
                      <div key={set.id} style={{ background:"#1a1a1a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                        {set.weight?`${set.weight}×${set.reps}`:`${set.reps} reps`}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { year, month } = calMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const prevMonth = () => setCalMonth(c => c.month===0?{year:c.year-1,month:11}:{...c,month:c.month-1});
  const nextMonth = () => setCalMonth(c => c.month===11?{year:c.year+1,month:0}:{...c,month:c.month+1});

  return (
    <div style={{ padding: "36px 20px 60px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#555" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 52, lineHeight: 1, marginTop: 2 }}>MY DAY</div>
      </div>
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#555", marginBottom: 14 }}>TODAY'S MACROS</div>
        <MacroBar label="Calories" val={totals.calories} target={MACRO_TARGETS.calories} color="#f97316" unit="" />
        <MacroBar label="Protein" val={totals.protein} target={MACRO_TARGETS.protein} color="#3b82f6" unit="g" />
        <MacroBar label="Carbs" val={totals.carbs} target={MACRO_TARGETS.carbs} color="#10b981" unit="g" />
        <MacroBar label="Fat" val={totals.fat} target={MACRO_TARGETS.fat} color="#a855f7" unit="g" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <BigCard icon="🏋️" label="GYM" sub={lastSession ? lastSession.splitName : "No sessions yet"} accent="#f97316" onClick={() => setSection(SECTIONS.GYM)} />
        <BigCard icon="🥗" label="NUTRITION" sub={`${Math.round(totals.calories)} kcal today`} accent="#10b981" onClick={() => setSection(SECTIONS.NUTRITION)} />
      </div>
      <div onClick={() => setSection(SECTIONS.COACH)} style={{ background: "linear-gradient(135deg, #1a1a1a, #111)", border: "1px solid #2a2a2a", borderRadius: 14, padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 28 }}>🧠</div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.05em" }}>COACH</div>
          <div style={{ fontSize: 11, color: "#555" }}>Brutally honest. Always available.</div>
        </div>
      </div>
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:20, padding:"0 8px" }} onClick={prevMonth}>‹</button>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:"0.08em" }}>{monthLabel.toUpperCase()}</div>
          <button style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:20, padding:"0 8px" }} onClick={nextMonth}>›</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:6 }}>
          {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{ textAlign:"center", fontSize:10, color:"#444", paddingBottom:4 }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const day=i+1;
            const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday=dateStr===today;
            const isFuture=dateStr>today;
            const hasWorkout=data.history.some(s=>s.date.split("T")[0]===dateStr);
            const hasNutrition=data.dailyLogs[dateStr]?.items?.length>0;
            const hasData=hasWorkout||hasNutrition;
            return (
              <div key={day} onClick={()=>!isFuture&&hasData&&setSelectedDay(dateStr)} style={{ aspectRatio:"1", borderRadius:8, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:hasData&&!isFuture?"pointer":"default", background:isToday?"#f97316":hasData?"#1a1a1a":"transparent", border:isToday?"none":hasData?"1px solid #2a2a2a":"none", transition:"background 0.15s" }}>
                <div style={{ fontSize:12, color:isToday?"#fff":isFuture?"#2a2a2a":hasData?"#e5e5e5":"#555", fontWeight:isToday?600:400 }}>{day}</div>
                {hasData&&!isToday&&(
                  <div style={{ display:"flex", gap:2, marginTop:2 }}>
                    {hasWorkout&&<div style={{ width:4, height:4, borderRadius:"50%", background:"#f97316" }}/>}
                    {hasNutrition&&<div style={{ width:4, height:4, borderRadius:"50%", background:"#10b981" }}/>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:14, justifyContent:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#555" }}><div style={{ width:6, height:6, borderRadius:"50%", background:"#f97316" }}/> Workout</div>
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#555" }}><div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981" }}/> Nutrition</div>
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, val, target, color, unit }) {
  const pct = Math.min((val / target) * 100, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "#666" }}>{label}</span>
        <span style={{ color: "#e5e5e5" }}>{Math.round(val)}{unit} <span style={{ color: "#444" }}>/ {target}{unit}</span></span>
      </div>
      <div style={{ height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function BigCard({ icon, label, sub, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#111", border: `1px solid #222`, borderTop: `3px solid ${accent}`, borderRadius: 14, padding: "18px 16px", cursor: "pointer" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

// ─── GYM SECTION ─────────────────────────────────────────────────────────────
function GymSection({ data, update, onBack }) {
  const [view, setView] = useState(GYM_VIEWS.HOME);
  const [activeSplit, setActiveSplit] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [buildSplit, setBuildSplit] = useState(null);
  const [detailSession, setDetailSession] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const restRef = useRef(null);
  const elapsedRef = useRef(null);

  useEffect(() => {
    if (sessionStart) {
      elapsedRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    }
    return () => clearInterval(elapsedRef.current);
  }, [sessionStart]);

  useEffect(() => {
    if (restTimer) {
      setRestLeft(120);
      clearInterval(restRef.current);
      restRef.current = setInterval(() => {
        setRestLeft(prev => {
          if (prev <= 1) { clearInterval(restRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (view === GYM_VIEWS.HOME) return (
    <Screen onBack={onBack} title="GYM">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ActionCard icon="▶" label="Start Workout" sub="Pick a split and go" onClick={() => setView(GYM_VIEWS.WORKOUT)} accent="#f97316" />
        <ActionCard icon="＋" label="Build Split" sub="Create a new workout split" onClick={() => { setBuildSplit({ name: "", exercises: [] }); setView(GYM_VIEWS.BUILD); }} accent="#3b82f6" />
        <ActionCard icon="◷" label="History" sub="View past sessions" onClick={() => setView(GYM_VIEWS.HISTORY)} accent="#a855f7" />
      </div>
      {data.splits.length > 0 && <>
        <SectionLabel>MY SPLITS</SectionLabel>
        {data.splits.map(split => (
          <div key={split.id} className="card" style={{ display: "flex", alignItems: "center" }} onClick={() => { setActiveSplit(split); setView(GYM_VIEWS.WORKOUT); }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{split.name}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{split.exercises.length} exercises</div>
            </div>
            <div style={{ color: "#333" }}>›</div>
          </div>
        ))}
      </>}
    </Screen>
  );

  if (view === GYM_VIEWS.BUILD) {
    const addEx = () => setBuildSplit(s => ({ ...s, exercises: [...s.exercises, { id: Date.now(), name: "", defaultSets: 3 }] }));
    const removeEx = (id) => setBuildSplit(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== id) }));
    const updateEx = (id, field, val) => setBuildSplit(s => ({ ...s, exercises: s.exercises.map(e => e.id === id ? { ...e, [field]: val } : e) }));
    const save = () => {
      if (!buildSplit.name.trim() || !buildSplit.exercises.length) return;
      update(d => ({ ...d, splits: [...d.splits, { ...buildSplit, id: Date.now() }] }));
      setView(GYM_VIEWS.HOME);
    };
    return (
      <Screen onBack={() => setView(GYM_VIEWS.HOME)} title="BUILD SPLIT">
        <Input placeholder="Split name (e.g. Push Day)" value={buildSplit.name} onChange={e => setBuildSplit(s => ({ ...s, name: e.target.value }))} />
        <SectionLabel>EXERCISES</SectionLabel>
        {buildSplit.exercises.map((ex, i) => (
          <div key={ex.id} className="card" style={{ flexDirection: "column", gap: 10, display: "flex" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#555", width: 18 }}>{i + 1}</span>
              <Input placeholder="Exercise name" value={ex.name} onChange={e => updateEx(ex.id, "name", e.target.value)} style={{ margin: 0, flex: 1 }} />
              <button style={S.deleteBtn} onClick={() => removeEx(ex.id)}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 26 }}>
              <span style={{ fontSize: 11, color: "#555" }}>Sets:</span>
              {[2, 3, 4, 5].map(n => <button key={n} style={{ ...S.pill, background: ex.defaultSets === n ? "#f97316" : "#1a1a1a", color: ex.defaultSets === n ? "#fff" : "#555", border: "none", cursor: "pointer" }} onClick={() => updateEx(ex.id, "defaultSets", n)}>{n}</button>)}
            </div>
          </div>
        ))}
        <button style={S.ghostBtn} onClick={addEx}>＋ Add Exercise</button>
        <button style={{ ...S.primaryBtn, marginTop: 12, opacity: (!buildSplit.name.trim() || !buildSplit.exercises.length) ? 0.4 : 1 }} onClick={save}>Save Split</button>
      </Screen>
    );
  }

  if (view === GYM_VIEWS.WORKOUT && !activeSplit) return (
    <Screen onBack={() => setView(GYM_VIEWS.HOME)} title="START WORKOUT">
      {!data.splits.length ? <EmptyState icon="📋" msg="No splits yet" sub="Build one first" /> : <>
        <SectionLabel>PICK A SPLIT</SectionLabel>
        {data.splits.map(split => (
          <div key={split.id} className="card" style={{ display: "flex", alignItems: "center" }} onClick={() => { setActiveSplit(split); }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{split.name}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{split.exercises.length} exercises</div>
            </div>
            <div style={{ color: "#333" }}>›</div>
          </div>
        ))}
      </>}
    </Screen>
  );

  if (view === GYM_VIEWS.WORKOUT && activeSplit && !activeSession) {
    const session = {
      id: Date.now(), splitId: activeSplit.id, splitName: activeSplit.name,
      date: new Date().toISOString(),
      exercises: activeSplit.exercises.map(ex => ({ id: ex.id, name: ex.name, sets: Array.from({ length: ex.defaultSets }, (_, i) => ({ id: i, reps: "", weight: "", done: false })) })),
    };
    setActiveSession(session);
    setSessionStart(Date.now());
    setView(GYM_VIEWS.SESSION_ACTIVE);
    return null;
  }

  if (view === GYM_VIEWS.SESSION_ACTIVE && activeSession) {
    const updateSet = (exId, setId, field, val) => setActiveSession(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, [field]: val } : st) } : ex) }));
    const toggleSet = (exId, setId) => {
      setActiveSession(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, done: !st.done } : st) } : ex) }));
      setRestTimer(Date.now());
    };
    const addSet = (exId) => setActiveSession(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: [...ex.sets, { id: Date.now(), reps: "", weight: "", done: false }] } : ex) }));
    const finish = () => {
      update(d => ({ ...d, history: [{ ...activeSession, duration: elapsed }, ...d.history] }));
      setActiveSession(null); setActiveSplit(null); setSessionStart(null); setElapsed(0);
      clearInterval(restRef.current); clearInterval(elapsedRef.current);
      setView(GYM_VIEWS.HOME);
    };
    const done = activeSession.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
    const total = activeSession.exercises.reduce((a, ex) => a + ex.sets.length, 0);

    return (
      <Screen onBack={() => { setActiveSession(null); setActiveSplit(null); setSessionStart(null); setElapsed(0); setView(GYM_VIEWS.HOME); }} title={activeSplit.name}>
        {/* Timers row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>SESSION</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#e5e5e5" }}>{formatTime(elapsed)}</div>
          </div>
          <div style={{ flex: 1, background: restLeft > 0 ? "#1a1108" : "#111", border: `1px solid ${restLeft > 0 ? "#f9731640" : "#222"}`, borderRadius: 10, padding: "12px 16px", textAlign: "center", transition: "all 0.3s" }}>
            <div style={{ fontSize: 9, color: restLeft > 0 ? "#f97316" : "#555", letterSpacing: "0.1em" }}>REST</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: restLeft > 0 ? "#f97316" : "#333" }}>{formatTime(restLeft)}</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 6 }}>
          <span>{done}/{total} sets</span><span>{Math.round((done / total) * 100) || 0}%</span>
        </div>
        <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, background: "linear-gradient(90deg,#f97316,#a855f7)", transition: "width 0.3s" }} />
        </div>

        {activeSession.exercises.map(ex => (
          <div key={ex.id} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 10 }}>{ex.name.toUpperCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 36px", gap: 6, marginBottom: 6 }}>
              {["#", "WEIGHT", "REPS", ""].map(h => <div key={h} style={{ fontSize: 9, color: "#444", letterSpacing: "0.08em" }}>{h}</div>)}
            </div>
            {ex.sets.map((set, i) => (
              <div key={set.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 36px", gap: 6, marginBottom: 6, opacity: set.done ? 0.45 : 1, transition: "opacity 0.2s" }}>
                <div style={{ fontSize: 11, color: "#555", display: "flex", alignItems: "center" }}>{i + 1}</div>
                <input style={S.setInput} placeholder="0" value={set.weight} onChange={e => updateSet(ex.id, set.id, "weight", e.target.value)} type="number" />
                <input style={S.setInput} placeholder="0" value={set.reps} onChange={e => updateSet(ex.id, set.id, "reps", e.target.value)} type="number" />
                <button style={{ ...S.checkBtn, background: set.done ? "#22c55e" : "#1a1a1a", border: set.done ? "none" : "1px solid #333" }} onClick={() => toggleSet(ex.id, set.id)}>{set.done ? "✓" : ""}</button>
              </div>
            ))}
            <button style={{ ...S.ghostBtn, fontSize: 11, padding: "6px 12px", marginTop: 2 }} onClick={() => addSet(ex.id)}>+ set</button>
          </div>
        ))}
        <button style={{ ...S.primaryBtn, marginTop: 8 }} onClick={finish}>Finish — {formatTime(elapsed)}</button>
      </Screen>
    );
  }

  if (view === GYM_VIEWS.HISTORY) return (
    <Screen onBack={() => setView(GYM_VIEWS.HOME)} title="HISTORY">
      {!data.history.length ? <EmptyState icon="📊" msg="No sessions yet" sub="Complete a workout to see it here" /> : <>
        <SectionLabel>PAST SESSIONS</SectionLabel>
        {data.history.map(session => (
          <div key={session.id} className="card" style={{ display: "flex", alignItems: "center" }} onClick={() => { setDetailSession(session); setView(GYM_VIEWS.SESSION_DETAIL); }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{session.splitName}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                {new Date(session.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {session.duration ? ` · ${formatTime(session.duration)}` : ""}
                {" · "}{session.exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0)} sets
              </div>
            </div>
            <div style={{ color: "#333" }}>›</div>
          </div>
        ))}
      </>}
    </Screen>
  );

  if (view === GYM_VIEWS.SESSION_DETAIL && detailSession) return (
    <Screen onBack={() => { setDetailSession(null); setView(GYM_VIEWS.HISTORY); }} title={detailSession.splitName}>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 20 }}>
        {new Date(detailSession.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        {detailSession.duration ? ` · ${formatTime(detailSession.duration)}` : ""}
      </div>
      {detailSession.exercises.map(ex => (
        <div key={ex.id} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 10 }}>{ex.name.toUpperCase()}</div>
          <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr", gap: 6, marginBottom: 6 }}>
            {["#", "WEIGHT", "REPS"].map(h => <div key={h} style={{ fontSize: 9, color: "#444" }}>{h}</div>)}
          </div>
          {ex.sets.filter(s => s.done).map((set, i) => (
            <div key={set.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#555" }}>{i + 1}</div>
              <div style={{ fontSize: 13 }}>{set.weight || "—"}</div>
              <div style={{ fontSize: 13 }}>{set.reps || "—"}</div>
            </div>
          ))}
        </div>
      ))}
    </Screen>
  );

  return null;
}

// ─── NUTRITION SECTION ────────────────────────────────────────────────────────
function NutritionSection({ data, update, onBack }) {
  const [view, setView] = useState(NUT_VIEWS.HOME);
  const [newFood, setNewFood] = useState(null);
  const [newRecipe, setNewRecipe] = useState(null);
  const [logTarget, setLogTarget] = useState(null); // food or recipe to log

  const today = TODAY();
  const log = data.dailyLogs[today] || { items: [] };
  const totals = calcTotals(log.items);

  const addToLog = (item, servings) => {
    const entry = {
      id: Date.now(), name: item.name, servings,
      calories: item.calories * servings,
      protein: item.protein * servings,
      carbs: item.carbs * servings,
      fat: item.fat * servings,
      sodium: (item.sodium || 0) * servings,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
    update(d => ({ ...d, dailyLogs: { ...d.dailyLogs, [today]: { items: [...(d.dailyLogs[today]?.items || []), entry] } } }));
  };

  const removeFromLog = (id) => {
    update(d => ({ ...d, dailyLogs: { ...d.dailyLogs, [today]: { items: d.dailyLogs[today].items.filter(i => i.id !== id) } } }));
  };

  if (view === NUT_VIEWS.HOME) return (
    <Screen onBack={onBack} title="NUTRITION">
      {/* Daily totals */}
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 12 }}>TODAY</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "KCAL", val: Math.round(totals.calories), target: MACRO_TARGETS.calories, color: "#f97316" },
            { label: "PRO", val: Math.round(totals.protein), target: MACRO_TARGETS.protein, color: "#3b82f6" },
            { label: "CARBS", val: Math.round(totals.carbs), target: MACRO_TARGETS.carbs, color: "#10b981" },
            { label: "FAT", val: Math.round(totals.fat), target: MACRO_TARGETS.fat, color: "#a855f7" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 9, color: "#555" }}>{m.label}</div>
              <div style={{ fontSize: 9, color: "#333" }}>/{m.target}</div>
            </div>
          ))}
        </div>
        <MacroBar label="Sodium" val={totals.sodium} target={MACRO_TARGETS.sodium} color="#ef4444" unit="mg" />
      </div>

      {/* Log today */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionLabel style={{ margin: 0 }}>TODAY'S LOG</SectionLabel>
        <button style={{ ...S.ghostBtn, width: "auto", padding: "6px 14px", fontSize: 11 }} onClick={() => setView(NUT_VIEWS.LOG_MEAL)}>+ Add</button>
      </div>
      {log.items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "#444", fontSize: 12 }}>Nothing logged yet today</div>
      ) : (
        log.items.map(item => (
          <div key={item.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name} {item.servings !== 1 && <span style={{ color: "#555", fontSize: 11 }}>×{item.servings}</span>}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{Math.round(item.calories)} kcal · {Math.round(item.protein)}g P · {item.time}</div>
            </div>
            <button style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 16, padding: 4 }} onClick={() => removeFromLog(item.id)}>✕</button>
          </div>
        ))
      )}

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <ActionCard icon="🗂" label="Food Library" sub={`${data.foodLibrary.length} items saved`} onClick={() => setView(NUT_VIEWS.FOOD_LIB)} accent="#3b82f6" />
        <ActionCard icon="🍳" label="Recipes" sub={`${data.recipes.length} recipes saved`} onClick={() => setView(NUT_VIEWS.RECIPES)} accent="#10b981" />
      </div>
    </Screen>
  );

  if (view === NUT_VIEWS.LOG_MEAL) return (
    <LogMealView
      data={data}
      onBack={() => setView(NUT_VIEWS.HOME)}
      onLog={(item, servings) => { addToLog(item, servings); setView(NUT_VIEWS.HOME); }}
    />
  );

  if (view === NUT_VIEWS.FOOD_LIB) return (
    <Screen onBack={() => setView(NUT_VIEWS.HOME)} title="FOOD LIBRARY">
      <button style={{ ...S.primaryBtn, marginBottom: 16 }} onClick={() => { setNewFood({ name: "", calories: "", protein: "", carbs: "", fat: "", sodium: "" }); setView(NUT_VIEWS.ADD_FOOD); }}>＋ Add Food Item</button>
      {!data.foodLibrary.length ? <EmptyState icon="🥦" msg="No items yet" sub="Add foods you eat regularly" /> :
        data.foodLibrary.map(food => (
          <div key={food.id} className="card" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{food.name}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                {food.calories} kcal · {food.protein}g protein · per serving
              </div>
            </div>
            <button style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontSize: 12, padding: 4 }}
              onClick={() => { setLogTarget({ ...food, type: "food" }); setView(NUT_VIEWS.LOG_MEAL); }}>LOG</button>
          </div>
        ))
      }
    </Screen>
  );

  if (view === NUT_VIEWS.ADD_FOOD) return (
    <AddFoodView
      newFood={newFood}
      setNewFood={setNewFood}
      onBack={() => setView(NUT_VIEWS.FOOD_LIB)}
      onSave={() => {
        if (!newFood.name.trim()) return;
        update(d => ({ ...d, foodLibrary: [...d.foodLibrary, { ...newFood, id: Date.now(), calories: +newFood.calories, protein: +newFood.protein, carbs: +newFood.carbs, fat: +newFood.fat, sodium: +newFood.sodium }] }));
        setView(NUT_VIEWS.FOOD_LIB);
      }}
    />
  );

  if (view === NUT_VIEWS.RECIPES) return (
    <Screen onBack={() => setView(NUT_VIEWS.HOME)} title="RECIPES">
      <button style={{ ...S.primaryBtn, marginBottom: 16 }} onClick={() => { setNewRecipe({ name: "", ingredients: [] }); setView(NUT_VIEWS.ADD_RECIPE); }}>＋ Build Recipe</button>
      {!data.recipes.length ? <EmptyState icon="🍳" msg="No recipes yet" sub="Combine foods into saved meals" /> :
        data.recipes.map(recipe => {
          const t = calcTotals(recipe.ingredients);
          return (
            <div key={recipe.id} className="card" style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{recipe.name}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{Math.round(t.calories)} kcal · {Math.round(t.protein)}g P · {recipe.ingredients.length} items</div>
              </div>
              <button style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontSize: 12, padding: 4 }}
                onClick={() => { addToLog({ ...recipe, calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, sodium: t.sodium }, 1); }}>LOG</button>
            </div>
          );
        })
      }
    </Screen>
  );

  if (view === NUT_VIEWS.ADD_RECIPE) return (
    <AddRecipeView
      data={data}
      newRecipe={newRecipe}
      setNewRecipe={setNewRecipe}
      onBack={() => setView(NUT_VIEWS.RECIPES)}
      onSave={(recipe) => {
        update(d => ({ ...d, recipes: [...d.recipes, { ...recipe, id: Date.now() }] }));
        setView(NUT_VIEWS.RECIPES);
      }}
    />
  );

  return null;
}

function LogMealView({ data, onBack, onLog }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [servings, setServings] = useState(1);
  const allItems = [
    ...data.foodLibrary.map(f => ({ ...f, type: "food" })),
    ...data.recipes.map(r => { const t = calcTotals(r.ingredients); return { ...r, ...t, type: "recipe" }; }),
  ];
  const filtered = allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  if (selected) return (
    <Screen onBack={() => setSelected(null)} title="LOG ITEM">
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>{selected.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["Calories", Math.round(selected.calories * servings)], ["Protein", `${Math.round(selected.protein * servings)}g`], ["Carbs", `${Math.round(selected.carbs * servings)}g`], ["Fat", `${Math.round(selected.fat * servings)}g`]].map(([l, v]) => (
            <div key={l} style={{ background: "#1a1a1a", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: "#555" }}>{l}</div>
              <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Servings</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <button style={{ ...S.checkBtn, background: "#1a1a1a", border: "1px solid #333", fontSize: 18 }} onClick={() => setServings(s => Math.max(0.5, s - 0.5))}>−</button>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, flex: 1, textAlign: "center" }}>{servings}</div>
        <button style={{ ...S.checkBtn, background: "#1a1a1a", border: "1px solid #333", fontSize: 18 }} onClick={() => setServings(s => s + 0.5)}>＋</button>
      </div>
      <button style={S.primaryBtn} onClick={() => onLog(selected, servings)}>Add to Today's Log</button>
    </Screen>
  );

  return (
    <Screen onBack={onBack} title="ADD TO LOG">
      <Input placeholder="Search foods & recipes..." value={search} onChange={e => setSearch(e.target.value)} />
      {!allItems.length ? <EmptyState icon="🥗" msg="No foods saved yet" sub="Add items to your food library first" /> :
        filtered.map(item => (
          <div key={item.id} className="card" style={{ display: "flex", alignItems: "center" }} onClick={() => { setSelected(item); setServings(1); }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{Math.round(item.calories)} kcal · {Math.round(item.protein)}g P</div>
            </div>
            <div style={{ fontSize: 10, color: "#555", background: "#1a1a1a", borderRadius: 6, padding: "3px 8px" }}>{item.type}</div>
          </div>
        ))
      }
    </Screen>
  );
}

function AddRecipeView({ data, newRecipe, setNewRecipe, onBack, onSave }) {
  const [search, setSearch] = useState("");
  const filtered = data.foodLibrary.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const addIngredient = (food) => {
    setNewRecipe(r => ({ ...r, ingredients: [...r.ingredients, { ...food, servings: 1, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, sodium: food.sodium || 0 }] }));
  };
  const removeIngredient = (id) => setNewRecipe(r => ({ ...r, ingredients: r.ingredients.filter(i => i.id !== id) }));
  const updateServings = (id, servings) => {
    const s = Math.max(0.5, servings);
    setNewRecipe(r => ({
      ...r, ingredients: r.ingredients.map(i => i.id === id ? {
        ...i, servings: s,
        calories: data.foodLibrary.find(f => f.id === id)?.calories * s || i.calories,
        protein: data.foodLibrary.find(f => f.id === id)?.protein * s || i.protein,
        carbs: data.foodLibrary.find(f => f.id === id)?.carbs * s || i.carbs,
        fat: data.foodLibrary.find(f => f.id === id)?.fat * s || i.fat,
        sodium: (data.foodLibrary.find(f => f.id === id)?.sodium || 0) * s,
      } : i)
    }));
  };
  const totals = calcTotals(newRecipe.ingredients);

  return (
    <Screen onBack={onBack} title="BUILD RECIPE">
      <Input placeholder="Recipe name (e.g. Breakfast Bowl)" value={newRecipe.name} onChange={e => setNewRecipe(r => ({ ...r, name: e.target.value }))} />

      {newRecipe.ingredients.length > 0 && <>
        <SectionLabel>INGREDIENTS</SectionLabel>
        {newRecipe.ingredients.map(ing => (
          <div key={ing.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{ing.name}</div>
              <div style={{ fontSize: 11, color: "#555" }}>{Math.round(ing.calories)} kcal</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button style={{ ...S.checkBtn, width: 28, height: 28, background: "#1a1a1a", border: "1px solid #333", fontSize: 14 }} onClick={() => updateServings(ing.id, ing.servings - 0.5)}>−</button>
              <span style={{ fontSize: 13, minWidth: 24, textAlign: "center" }}>{ing.servings}</span>
              <button style={{ ...S.checkBtn, width: 28, height: 28, background: "#1a1a1a", border: "1px solid #333", fontSize: 14 }} onClick={() => updateServings(ing.id, ing.servings + 0.5)}>＋</button>
            </div>
            <button style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: 14 }} onClick={() => removeIngredient(ing.id)}>✕</button>
          </div>
        ))}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-around" }}>
          {[["KCAL", Math.round(totals.calories)], ["PRO", `${Math.round(totals.protein)}g`], ["CARBS", `${Math.round(totals.carbs)}g`], ["FAT", `${Math.round(totals.fat)}g`]].map(([l, v]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18 }}>{v}</div>
              <div style={{ fontSize: 9, color: "#555" }}>{l}</div>
            </div>
          ))}
        </div>
      </>}

      <SectionLabel>ADD FROM LIBRARY</SectionLabel>
      <Input placeholder="Search foods..." value={search} onChange={e => setSearch(e.target.value)} />
      {!data.foodLibrary.length ? <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: "12px 0" }}>Add foods to your library first</div> :
        filtered.map(food => (
          <div key={food.id} className="card" style={{ display: "flex", alignItems: "center" }} onClick={() => addIngredient(food)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{food.name}</div>
              <div style={{ fontSize: 11, color: "#555" }}>{food.calories} kcal · {food.protein}g P per serving</div>
            </div>
            <div style={{ color: "#f97316", fontSize: 18 }}>＋</div>
          </div>
        ))
      }

      <button style={{ ...S.primaryBtn, marginTop: 8, opacity: (!newRecipe.name.trim() || !newRecipe.ingredients.length) ? 0.4 : 1 }}
        onClick={() => { if (!newRecipe.name.trim() || !newRecipe.ingredients.length) return; onSave(newRecipe); }}>
        Save Recipe
      </button>
    </Screen>
  );
}

// ─── COACH SECTION ────────────────────────────────────────────────────────────
function CoachSection({ data, update, onBack }) {
  const [messages, setMessages] = useState(data.coachHistory || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const today = TODAY();
  const log = data.dailyLogs[today] || { items: [] };
  const totals = calcTotals(log.items);
  const lastSession = data.history[0];

  const systemPrompt = `You are a personal fitness and nutrition coach inside a lifestyle tracking app. Your client's profile:
- Name: Domingo, 19 years old, 65.8kg
- Goal: Lean and athletic — visible abs, defined muscles, NOT bulky
- Training: Push Pull Legs split, training at apartment gym
- Daily targets: ~2200 calories, 145g protein, 180g carbs, 70g fat, under 2300mg sodium
- Today's intake so far: ${Math.round(totals.calories)} kcal, ${Math.round(totals.protein)}g protein, ${Math.round(totals.carbs)}g carbs, ${Math.round(totals.fat)}g fat
- Last workout: ${lastSession ? `${lastSession.splitName} on ${new Date(lastSession.date).toLocaleDateString()}` : "No sessions logged yet"}
- Food logged today: ${log.items.map(i => i.name).join(", ") || "Nothing yet"}

Be brutally honest. Don't sugarcoat. If something is going to slow his progress, say it directly. Keep responses concise and actionable. You know his full context — reference it naturally. Help him get to his goal as efficiently as possible.`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const reply = await callClaude(updated, systemPrompt);
      const final = [...updated, { role: "assistant", content: reply }];
      setMessages(final);
      update(d => ({ ...d, coachHistory: final }));
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Something went wrong. Try again." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0a" }}>
      {/* Header */}
      <div style={{ padding: "28px 20px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button style={{ background: "none", border: "1px solid #222", borderRadius: 8, color: "#e5e5e5", padding: "6px 12px", cursor: "pointer", fontSize: 14 }} onClick={onBack}>←</button>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, lineHeight: 1 }}>COACH</div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>Brutally honest. Always available.</div>
        </div>
      </div>

      {/* Context strip */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", gap: 16, flexShrink: 0, overflowX: "auto" }}>
        {[
          { label: "TODAY", val: `${Math.round(totals.calories)} kcal`, color: "#f97316" },
          { label: "PROTEIN", val: `${Math.round(totals.protein)}g`, color: "#3b82f6" },
          { label: "LAST SESSION", val: lastSession ? lastSession.splitName : "None", color: "#a855f7" },
        ].map(s => (
          <div key={s.label} style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em" }}>{s.label}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 10px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 14, color: "#555" }}>Ask me anything</div>
            <div style={{ fontSize: 11, color: "#333", marginTop: 6 }}>Nutrition, training, progress — I know your data.</div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {["Is what I ate today enough protein?", "Should I eat before training?", "Am I on track for my goals?"].map(q => (
                <button key={q} style={{ background: "#111", border: "1px solid #222", borderRadius: 10, color: "#888", padding: "10px 14px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", textAlign: "left" }} onClick={() => setInput(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{
              maxWidth: "82%", padding: "12px 14px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: msg.role === "user" ? "#f97316" : "#141414",
              border: msg.role === "assistant" ? "1px solid #222" : "none",
              fontSize: 13, lineHeight: 1.6, color: msg.role === "user" ? "#fff" : "#e5e5e5",
            }}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "12px 12px 12px 2px", padding: "12px 16px", fontSize: 18, letterSpacing: 4 }}>
              <span style={{ animation: "pulse 1s infinite" }}>•••</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px 24px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 10, flexShrink: 0 }}>
        <textarea
          style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: 10, color: "#e5e5e5", padding: "12px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", minHeight: 44, maxHeight: 120 }}
          placeholder="Ask your coach..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
        />
        <button style={{ ...S.primaryBtn, width: 44, padding: 0, flexShrink: 0, fontSize: 18, opacity: (!input.trim() || loading) ? 0.4 : 1 }} onClick={send}>↑</button>
      </div>
    </div>
  );
}

// ─── ADD FOOD VIEW ────────────────────────────────────────────────────────────
function AddFoodView({ newFood, setNewFood, onBack, onSave }) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleImage = async (file) => {
    if (!file) return;
    setScanError("");
    setScanning(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setPreview(e.target.result);
      try {
        const result = await scanNutritionLabel(base64, mediaType);
        if (result) {
          setNewFood(f => ({
            ...f,
            name: result.name || f.name,
            calories: result.calories ?? f.calories,
            protein: result.protein ?? f.protein,
            carbs: result.carbs ?? f.carbs,
            fat: result.fat ?? f.fat,
            sodium: result.sodium ?? f.sodium,
          }));
        } else {
          setScanError("Couldn't read the label. Fill in manually.");
        }
      } catch {
        setScanError("Scan failed. Fill in manually.");
      }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const fields = [
    { key: "name", label: "Product name", type: "text" },
    { key: "calories", label: "Calories (per serving)", type: "number" },
    { key: "protein", label: "Protein g (per serving)", type: "number" },
    { key: "carbs", label: "Carbs g (per serving)", type: "number" },
    { key: "fat", label: "Fat g (per serving)", type: "number" },
    { key: "sodium", label: "Sodium mg (per serving)", type: "number" },
  ];

  return (
    <Screen onBack={onBack} title="ADD FOOD">
      <div
        style={{ background: "#111", border: "2px dashed #333", borderRadius: 12, padding: "20px 16px", textAlign: "center", cursor: "pointer", marginBottom: 16 }}
        onClick={() => !scanning && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />
        {scanning ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13, color: "#f97316" }}>Reading label...</div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>This takes a few seconds</div>
          </>
        ) : preview ? (
          <>
            <img src={preview} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} alt="label" />
            <div style={{ fontSize: 11, color: "#10b981" }}>✓ Label scanned — review fields below</div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>Tap to scan again</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 13, color: "#e5e5e5" }}>Scan Nutrition Label</div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Take a photo and fields auto-fill</div>
          </>
        )}
      </div>

      {scanError && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 12, textAlign: "center" }}>{scanError}</div>}

      <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 12 }}>— OR FILL MANUALLY</div>

      {fields.map(f => (
        <Input key={f.key} placeholder={f.label} type={f.type} value={newFood[f.key]} onChange={e => setNewFood(fd => ({ ...fd, [f.key]: e.target.value }))} />
      ))}

      <button style={{ ...S.primaryBtn, opacity: !String(newFood.name || "").trim() ? 0.4 : 1 }} onClick={onSave}>Save Food</button>
    </Screen>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcTotals(items = []) {
  return items.reduce((a, i) => ({ calories: a.calories + (i.calories || 0), protein: a.protein + (i.protein || 0), carbs: a.carbs + (i.carbs || 0), fat: a.fat + (i.fat || 0), sodium: a.sodium + (i.sodium || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0 });
}

function Screen({ children, onBack, title }) {
  return (
    <div style={{ padding: "28px 20px 80px", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button style={{ background: "none", border: "1px solid #222", borderRadius: 8, color: "#e5e5e5", padding: "6px 12px", cursor: "pointer", fontSize: 14 }} onClick={onBack}>←</button>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: "0.05em" }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function ActionCard({ icon, label, sub, onClick, accent }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${accent}`, display: "flex", alignItems: "center", gap: 14 }} onClick={onClick}>
      <div style={{ fontSize: 18, width: 28 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ color: "#333" }}>›</div>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#444", margin: "20px 0 10px", ...style }}>— {children}</div>;
}

function Input({ placeholder, value, onChange, type = "text", style }) {
  return <input type={type} style={{ background: "#111", border: "1px solid #222", borderRadius: 8, color: "#e5e5e5", padding: "12px 14px", fontSize: 13, width: "100%", marginBottom: 10, fontFamily: "inherit", outline: "none", ...style }} placeholder={placeholder} value={value} onChange={onChange} />;
}

function EmptyState({ icon, msg, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#444" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{msg}</div>
      {sub && <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const S = {
  primaryBtn: { background: "#f97316", border: "none", borderRadius: 10, color: "#fff", padding: "14px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit", letterSpacing: "0.05em" },
  ghostBtn: { background: "none", border: "1px solid #222", borderRadius: 8, color: "#666", padding: "10px 16px", fontSize: 13, cursor: "pointer", width: "100%", fontFamily: "inherit" },
  deleteBtn: { background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, padding: "4px 8px" },
  setInput: { background: "#111", border: "1px solid #222", borderRadius: 8, color: "#e5e5e5", padding: "10px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", textAlign: "center" },
  checkBtn: { width: 36, height: 36, borderRadius: 8, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" },
  pill: { borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  input: { background: "#111", border: "1px solid #222", borderRadius: 8, color: "#e5e5e5", padding: "12px 14px", fontSize: 13, width: "100%", marginBottom: 10, fontFamily: "inherit", outline: "none" },
};
