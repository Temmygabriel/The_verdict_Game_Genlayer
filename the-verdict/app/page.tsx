"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, createAccount, studionet } from "@genlayer/js";

// ─────────────────────────────────────────────────────────────────────────────
//  🔧 CONFIG — EDIT THIS AFTER DEPLOYING YOUR CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0xCb6D4253887506727EdA59553Da26923065f8016";
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 4000;

// ─── TYPES ───────────────────────────────────────────────────────────────────
type GameStatus = "waiting" | "arguing" | "judging" | "finished";

interface RoundHistory {
  round: number;
  topic: string;
  arguments: Record<string, string>;
  winner: string;
  verdict: string;
}

interface GameState {
  game_id: number;
  status: GameStatus;
  players: string[];
  scores: Record<string, number>;
  current_round: number;
  current_topic: string;
  arguments: Record<string, string>;
  round_winner: string | null;
  round_verdict: string | null;
  game_winner: string | null;
  history: RoundHistory[];
}

type Screen =
  | "home"
  | "create"
  | "join"
  | "lobby"
  | "game"
  | "gameOver";

// ─── GENLAYER CLIENT HELPERS ──────────────────────────────────────────────────
function makeClient() {
  const account = createAccount();
  return { client: createClient({ chain: studionet, account }), account };
}

async function readContract(gameId: number): Promise<GameState | null> {
  try {
    const { client } = makeClient();
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: "get_game",
      args: [gameId],
    });
    const raw = result as string;
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

async function readGameCount(): Promise<number> {
  try {
    const { client } = makeClient();
    const result = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: "get_game_count",
      args: [],
    });
    return Number(result);
  } catch {
    return 0;
  }
}

async function writeContract(fn: string, args: unknown[]): Promise<boolean> {
  try {
    const { client } = makeClient();
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: fn,
      args,
      leaderOnly: true,
    });
    await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
      retries: 60,
      interval: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── FLOATING BACKGROUND ─────────────────────────────────────────────────────
function GavelBg() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
          opacity: 0.4,
        }}
      />
      {["⚖️", "🎭", "🔨", "👨‍⚖️", "💥", "🃏", "⚡", "🎪"].map((sym, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            fontSize: `${1.5 + (i % 3) * 0.8}rem`,
            opacity: 0.07,
            left: `${[8, 88, 22, 70, 45, 15, 80, 55][i]}%`,
            top: `${[15, 10, 65, 20, 75, 45, 55, 35][i]}%`,
            animation: `float${i % 3} ${6 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.7}s`,
          }}
        >
          {sym}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TheVerdict() {
  const [screen, setScreen] = useState<Screen>("home");
  const [playerName, setPlayerName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [gameId, setGameId] = useState<number | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myArgument, setMyArgument] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [lastResult, setLastResult] = useState<{
    winner: string;
    verdict: string;
    topic: string;
    round: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [charCount, setCharCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevHistoryLen = useRef<number>(0);

  // ─── POLLING ───────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!gameId) return;
    const state = await readContract(gameId);
    if (!state) return;

    if (state.history.length > prevHistoryLen.current) {
      const latest = state.history[state.history.length - 1];
      prevHistoryLen.current = state.history.length;
      setLastResult({
        winner: latest.winner,
        verdict: latest.verdict,
        topic: latest.topic,
        round: latest.round,
      });
      setShowRoundResult(true);
      setSubmitted(false);
      setMyArgument("");
    }

    if (state.status === "finished" && state.game_winner) {
      if (pollRef.current) clearInterval(pollRef.current);
    }

    setGameState(state);
  }, [gameId]);

  useEffect(() => {
    if (gameId && (screen === "lobby" || screen === "game")) {
      poll();
      pollRef.current = setInterval(poll, POLL_INTERVAL);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [gameId, screen, poll]);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.status === "arguing" && screen === "lobby") setScreen("game");
    if (gameState.status === "finished") setScreen("gameOver");
  }, [gameState, screen]);

  // ─── ACTIONS ───────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!playerName.trim()) return;
    setLoading(true);
    setLoadingMsg("Summoning the courtroom...");
    setErrorMsg("");
    try {
      const countBefore = await readGameCount();
      const ok = await writeContract("create_game", [playerName.trim()]);
      if (!ok) throw new Error("Transaction failed");
      const newId = countBefore + 1;
      setGameId(newId);
      setScreen("lobby");
      prevHistoryLen.current = 0;
    } catch {
      setErrorMsg("Failed to create game. Check your connection.");
    }
    setLoading(false);
  }

  async function handleJoin() {
    const id = parseInt(joinId);
    if (!playerName.trim() || isNaN(id)) return;
    setLoading(true);
    setLoadingMsg("Entering the courtroom...");
    setErrorMsg("");
    try {
      const state = await readContract(id);
      if (!state) throw new Error("Game not found");
      if (state.status !== "waiting") throw new Error("Game already started");
      if (state.players.includes(playerName.trim()))
        throw new Error("That name is already taken in this game");
      const ok = await writeContract("join_game", [id, playerName.trim()]);
      if (!ok) throw new Error("Transaction failed");
      setGameId(id);
      prevHistoryLen.current = state.history.length;
      const newState = await readContract(id);
      if (newState) setGameState(newState);
      setScreen("game");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to join game");
    }
    setLoading(false);
  }

  async function handleSubmitArgument() {
    if (!myArgument.trim() || !gameState || !gameId) return;
    setLoading(true);
    setLoadingMsg("Filing your argument with the court...");
    setErrorMsg("");
    try {
      const ok = await writeContract("submit_argument", [
        gameId,
        playerName.trim(),
        myArgument.trim(),
      ]);
      if (!ok) throw new Error("Transaction failed");
      setSubmitted(true);
      setLoadingMsg("Waiting for the other player... 🕐");
    } catch {
      setErrorMsg("Failed to submit. Try again.");
    }
    setLoading(false);
  }

  function dismissRoundResult() {
    setShowRoundResult(false);
  }

  function reset() {
    setScreen("home");
    setPlayerName("");
    setJoinId("");
    setGameId(null);
    setGameState(null);
    setMyArgument("");
    setLoading(false);
    setSubmitted(false);
    setShowRoundResult(false);
    setLastResult(null);
    prevHistoryLen.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:         #0d0a07;
          --surface:    #151009;
          --card:       #1c1508;
          --border:     #2e2010;
          --amber:      #f59e0b;
          --amber-dim:  #b45309;
          --amber-pale: #fef3c7;
          --red:        #ef4444;
          --green:      #22c55e;
          --white:      #faf6f0;
          --muted:      #78614a;
        }

        html, body { height: 100%; background: var(--bg); color: var(--white); }

        #verdict-root {
          min-height: 100vh;
          font-family: 'Syne', sans-serif;
          background: var(--bg);
          background-image:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245,158,11,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 90% 80%, rgba(251,146,60,0.06) 0%, transparent 60%);
          position: relative;
          overflow-x: hidden;
        }

        @keyframes float0 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-18px) rotate(5deg)} }
        @keyframes float1 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-12px) rotate(-4deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-22px) rotate(8deg)} }

        @keyframes fadeUp  { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes verdict-in {
          from{opacity:0;transform:scale(0.7) rotate(-4deg)}
          to{opacity:1;transform:scale(1) rotate(0deg)}
        }
        @keyframes pulse-amber {
          0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.4)}
          50%{box-shadow:0 0 0 12px rgba(245,158,11,0)}
        }

        .screen { animation: fadeUp 0.5s ease both; }

        .title-huge {
          font-family:'Bebas Neue',sans-serif;
          font-size: clamp(5rem,16vw,11rem);
          line-height: 0.88;
          letter-spacing: 0.02em;
          color: var(--amber);
          text-shadow: 0 0 80px rgba(245,158,11,0.3), 4px 4px 0 rgba(0,0,0,0.5);
        }

        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
        }
        .card-glow { box-shadow: 0 0 40px rgba(245,158,11,0.08), 0 20px 60px rgba(0,0,0,0.5); }

        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 0.85rem 2rem;
          border: none; border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 1rem; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
          text-transform: uppercase; letter-spacing: 0.06em;
          position: relative; overflow: hidden;
        }
        .btn::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,0); transition:background 0.2s; }
        .btn:hover::after { background:rgba(255,255,255,0.08); }
        .btn:active { transform:scale(0.97); }

        .btn-primary  { background:var(--amber); color:#0d0a07; animation:pulse-amber 2.5s ease infinite; }
        .btn-secondary{ background:transparent; color:var(--amber); border:1.5px solid var(--amber-dim); }
        .btn-ghost    { background:rgba(255,255,255,0.05); color:var(--muted); border:1px solid var(--border); }
        .btn:disabled { opacity:0.4; cursor:not-allowed; animation:none; }
        .btn-lg       { padding:1.1rem 2.8rem; font-size:1.15rem; border-radius:12px; }
        .btn-sm       { padding:0.5rem 1.2rem; font-size:0.85rem; border-radius:8px; }

        .input {
          width:100%; background:rgba(255,255,255,0.04);
          border:1.5px solid var(--border); border-radius:10px;
          padding:0.85rem 1.1rem;
          font-family:'Syne',sans-serif; font-size:1rem; color:var(--white);
          transition:border-color 0.2s,box-shadow 0.2s; outline:none;
        }
        .input:focus { border-color:var(--amber-dim); box-shadow:0 0 0 3px rgba(245,158,11,0.12); }
        .input::placeholder { color:var(--muted); }

        .textarea {
          width:100%; min-height:130px; resize:vertical;
          background:rgba(255,255,255,0.04);
          border:1.5px solid var(--border); border-radius:10px;
          padding:1rem 1.1rem;
          font-family:'DM Mono',monospace; font-size:0.95rem; color:var(--white); line-height:1.6;
          transition:border-color 0.2s,box-shadow 0.2s; outline:none;
        }
        .textarea:focus { border-color:var(--amber-dim); box-shadow:0 0 0 3px rgba(245,158,11,0.12); }
        .textarea::placeholder { color:var(--muted); }

        .tag {
          display:inline-block; padding:0.25rem 0.75rem; border-radius:999px;
          font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
        }
        .tag-amber { background:rgba(245,158,11,0.15); color:var(--amber); border:1px solid rgba(245,158,11,0.25); }
        .tag-green { background:rgba(34,197,94,0.15);  color:var(--green); border:1px solid rgba(34,197,94,0.25); }
        .tag-red   { background:rgba(239,68,68,0.15);  color:var(--red);   border:1px solid rgba(239,68,68,0.25); }

        .loader {
          width:24px; height:24px;
          border:3px solid rgba(245,158,11,0.2); border-top-color:var(--amber);
          border-radius:50%; animation:spin 0.8s linear infinite; display:inline-block;
        }

        .score-pip { width:14px; height:14px; border-radius:50%; border:2px solid var(--amber-dim); transition:all 0.3s; }
        .score-pip.filled { background:var(--amber); border-color:var(--amber); }

        .topic-banner {
          background:linear-gradient(135deg,rgba(245,158,11,0.12) 0%,rgba(251,146,60,0.06) 100%);
          border:1px solid rgba(245,158,11,0.2); border-left:4px solid var(--amber);
          border-radius:12px; padding:1.5rem 1.75rem;
        }

        .verdict-overlay {
          position:fixed; inset:0; z-index:100;
          background:rgba(0,0,0,0.85); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center; padding:1rem;
          animation:fadeIn 0.3s ease both;
        }
        .verdict-card {
          width:100%; max-width:520px;
          background:var(--card); border:2px solid var(--amber-dim); border-radius:20px;
          padding:2.5rem; text-align:center;
          animation:verdict-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
          box-shadow:0 0 80px rgba(245,158,11,0.2), 0 40px 80px rgba(0,0,0,0.6);
        }

        .history-item {
          border-left:3px solid var(--border); padding-left:1rem; transition:border-color 0.2s;
        }
        .history-item:hover { border-left-color:var(--amber-dim); }

        .waiting-dot {
          display:inline-block; width:8px; height:8px;
          border-radius:50%; background:var(--amber); animation:bounce 1s ease infinite;
        }

        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:var(--surface); }
        ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:var(--amber-dim); }
      `}</style>

      <div id="verdict-root">
        <GavelBg />
        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── HOME ─────────────────────────────────────── */}
          {screen === "home" && (
            <div className="screen" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem", textAlign:"center", gap:"2.5rem" }}>
              <div>
                <p style={{ fontFamily:"'DM Mono',monospace", color:"var(--amber)", letterSpacing:"0.2em", fontSize:"0.8rem", marginBottom:"1rem", textTransform:"uppercase", opacity:0.8 }}>
                  ⚖️ GenLayer Party Game
                </p>
                <div className="title-huge">THE<br />VERDICT</div>
                <p style={{ marginTop:"1.5rem", fontSize:"1.15rem", color:"var(--amber-pale)", opacity:0.7, maxWidth:400, margin:"1.5rem auto 0", lineHeight:1.6 }}>
                  Two players. One absurd statement.<br />The AI is judge. May the best argument win.
                </p>
              </div>

              <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", justifyContent:"center", maxWidth:680 }}>
                {[
                  { n:"1", title:"Get a wild topic",    body:"The AI generates a ridiculous debate statement" },
                  { n:"2", title:"Argue your side",     body:"Submit the most unhinged argument you can think of" },
                  { n:"3", title:"AI Judge decides",    body:"The most creative, chaotic argument wins the round" },
                ].map((s) => (
                  <div key={s.n} className="card" style={{ flex:"1 1 180px", minWidth:160, textAlign:"left" }}>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.5rem", color:"var(--amber)", lineHeight:1, marginBottom:"0.5rem" }}>{s.n}</div>
                    <div style={{ fontWeight:700, marginBottom:"0.3rem", fontSize:"0.9rem" }}>{s.title}</div>
                    <div style={{ fontSize:"0.82rem", color:"var(--muted)", lineHeight:1.5 }}>{s.body}</div>
                  </div>
                ))}
              </div>

              <div className="card card-glow" style={{ width:"100%", maxWidth:400, display:"flex", flexDirection:"column", gap:"1rem" }}>
                <label style={{ fontSize:"0.82rem", color:"var(--muted)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Your Name</label>
                <input className="input" placeholder="e.g. ChaosAgent42" value={playerName} onChange={(e) => setPlayerName(e.target.value)} maxLength={24} />
                <div style={{ display:"flex", gap:"0.75rem" }}>
                  <button className="btn btn-primary btn-lg" style={{ flex:1 }} disabled={!playerName.trim()} onClick={() => setScreen("create")}>⚡ Create Game</button>
                  <button className="btn btn-secondary btn-lg" style={{ flex:1 }} disabled={!playerName.trim()} onClick={() => setScreen("join")}>🚪 Join Game</button>
                </div>
                {errorMsg && <div className="tag tag-red" style={{ textAlign:"center", padding:"0.5rem" }}>{errorMsg}</div>}
              </div>

              <p style={{ fontSize:"0.72rem", color:"var(--muted)", fontFamily:"'DM Mono',monospace" }}>
                Powered by GenLayer · AI consensus on-chain
              </p>
            </div>
          )}

          {/* ── CREATE ───────────────────────────────────── */}
          {screen === "create" && (
            <div className="screen" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem", gap:"2rem" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"4rem", marginBottom:"0.5rem" }}>⚖️</div>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3.5rem", color:"var(--amber)", letterSpacing:"0.04em" }}>Open a Courtroom</h2>
                <p style={{ color:"var(--muted)", marginTop:"0.5rem" }}>
                  A new game will be created for <strong style={{ color:"var(--amber-pale)" }}>{playerName}</strong>
                </p>
              </div>

              <div className="card card-glow" style={{ width:"100%", maxWidth:420, display:"flex", flexDirection:"column", gap:"1.5rem" }}>
                <div style={{ background:"rgba(245,158,11,0.06)", border:"1px dashed rgba(245,158,11,0.2)", borderRadius:10, padding:"1.2rem", display:"flex", flexDirection:"column", gap:"0.6rem" }}>
                  {["AI generates a fresh absurd topic","You wait in the lobby for your opponent","First to 3 rounds wins the Verdict!"].map((t) => (
                    <div key={t} style={{ display:"flex", alignItems:"center", gap:"0.6rem", fontSize:"0.88rem", color:"var(--amber-pale)" }}>
                      <span style={{ color:"var(--amber)" }}>→</span> {t}
                    </div>
                  ))}
                </div>
                {errorMsg && <div className="tag tag-red" style={{ padding:"0.5rem", textAlign:"center" }}>{errorMsg}</div>}
                <div style={{ display:"flex", gap:"0.75rem" }}>
                  <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setErrorMsg(""); setScreen("home"); }}>← Back</button>
                  <button className="btn btn-primary" style={{ flex:2 }} disabled={loading} onClick={handleCreate}>
                    {loading ? <><span className="loader" style={{ width:18, height:18 }} /> {loadingMsg}</> : "⚡ Create Game"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── JOIN ─────────────────────────────────────── */}
          {screen === "join" && (
            <div className="screen" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem", gap:"2rem" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"4rem", marginBottom:"0.5rem" }}>🚪</div>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3.5rem", color:"var(--amber)" }}>Enter Courtroom</h2>
                <p style={{ color:"var(--muted)", marginTop:"0.5rem" }}>Ask your opponent for their Game ID</p>
              </div>

              <div className="card card-glow" style={{ width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:"1.2rem" }}>
                <label style={{ fontSize:"0.8rem", color:"var(--muted)", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase" }}>Game ID</label>
                <input className="input" type="number" placeholder="e.g. 42" value={joinId} onChange={(e) => setJoinId(e.target.value)} style={{ fontSize:"1.4rem", textAlign:"center" }} />
                {errorMsg && <div className="tag tag-red" style={{ padding:"0.5rem", textAlign:"center" }}>{errorMsg}</div>}
                <div style={{ display:"flex", gap:"0.75rem" }}>
                  <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setErrorMsg(""); setScreen("home"); }}>← Back</button>
                  <button className="btn btn-primary" style={{ flex:2 }} disabled={loading || !joinId} onClick={handleJoin}>
                    {loading ? <><span className="loader" style={{ width:18, height:18 }} /> {loadingMsg}</> : "🚪 Join Game"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── LOBBY ────────────────────────────────────── */}
          {screen === "lobby" && gameId && (
            <div className="screen" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem", gap:"2rem", textAlign:"center" }}>
              <div style={{ fontSize:"4rem", animation:"bounce 1.4s ease infinite" }}>⏳</div>
              <div>
                <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3rem", color:"var(--amber)" }}>Waiting for Opponent</h2>
                <p style={{ color:"var(--muted)", marginTop:"0.5rem" }}>Share your Game ID with a friend to start</p>
              </div>

              <div className="card card-glow" style={{ width:"100%", maxWidth:360, display:"flex", flexDirection:"column", gap:"1rem", alignItems:"center" }}>
                <p style={{ fontSize:"0.8rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 }}>Your Game ID</p>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"5rem", color:"var(--amber)", letterSpacing:"0.1em", lineHeight:1, textShadow:"0 0 40px rgba(245,158,11,0.4)" }}>
                  {gameId}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(String(gameId))}>
                  📋 Copy ID
                </button>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", color:"var(--muted)", fontSize:"0.85rem" }}>
                {[0, 0.2, 0.4].map((d) => <span key={d} className="waiting-dot" style={{ animationDelay:`${d}s` }} />)}
                <span style={{ marginLeft:"0.5rem" }}>Checking for opponent every 4 seconds</span>
              </div>
            </div>
          )}

          {/* ── GAME ─────────────────────────────────────── */}
          {screen === "game" && gameState && (
            <div className="screen" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", padding:"1.5rem 1rem", gap:"1.5rem", maxWidth:700, margin:"0 auto" }}>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"0.5rem" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.8rem", color:"var(--amber)", letterSpacing:"0.04em" }}>THE VERDICT</div>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                  <span className="tag tag-amber">Round {gameState.current_round}</span>
                  <span className="tag" style={{ background:"rgba(255,255,255,0.05)", color:"var(--muted)", border:"1px solid var(--border)" }}>Game #{gameId}</span>
                </div>
              </div>

              {/* Scoreboard */}
              <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap" }}>
                {gameState.players.map((p) => {
                  const score = gameState.scores[p] || 0;
                  const isMe = p === playerName;
                  return (
                    <div key={p} className="card" style={{ flex:"1 1 200px", display:"flex", flexDirection:"column", gap:"0.6rem", alignItems:"center", border: isMe ? "1px solid rgba(245,158,11,0.4)" : "1px solid var(--border)", background: isMe ? "rgba(245,158,11,0.06)" : "var(--card)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                        <span style={{ fontWeight:700, fontSize:"0.95rem" }}>{p}</span>
                        {isMe && <span className="tag tag-amber">You</span>}
                      </div>
                      <div style={{ display:"flex", gap:"6px" }}>
                        {Array.from({ length:3 }).map((_,i) => (
                          <div key={i} className={`score-pip ${i < score ? "filled" : ""}`} />
                        ))}
                      </div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2.2rem", color:"var(--amber)", lineHeight:1 }}>{score}</div>
                    </div>
                  );
                })}
              </div>

              {/* Topic */}
              <div className="topic-banner">
                <p style={{ fontSize:"0.75rem", color:"var(--amber)", textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, marginBottom:"0.6rem" }}>🎭 Today's Absurd Statement</p>
                <p style={{ fontSize:"1.15rem", fontWeight:700, color:"var(--white)", lineHeight:1.5 }}>"{gameState.current_topic}"</p>
              </div>

              {/* Sides */}
              {gameState.players.length === 2 && (
                <div style={{ display:"flex", gap:"0.5rem", justifyContent:"center", flexWrap:"wrap" }}>
                  <div className="tag tag-green" style={{ padding:"0.3rem 0.8rem" }}>{gameState.players[0]} argues FOR ✅</div>
                  <div className="tag tag-red"   style={{ padding:"0.3rem 0.8rem" }}>{gameState.players[1]} argues AGAINST ❌</div>
                </div>
              )}

              {/* Argument box */}
              {!submitted ? (
                <div className="card" style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <label style={{ fontSize:"0.82rem", color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Your Argument</label>
                    <span style={{ fontSize:"0.75rem", color: charCount > 280 ? "var(--red)" : "var(--muted)", fontFamily:"'DM Mono',monospace" }}>{charCount}/300</span>
                  </div>
                  <textarea className="textarea" placeholder="Make it weird. Make it funny. Logic is optional. Chaos is encouraged..." value={myArgument} maxLength={300}
                    onChange={(e) => { setMyArgument(e.target.value); setCharCount(e.target.value.length); }} />
                  {errorMsg && <div className="tag tag-red" style={{ padding:"0.5rem" }}>{errorMsg}</div>}
                  <button className="btn btn-primary" disabled={!myArgument.trim() || loading} onClick={handleSubmitArgument}>
                    {loading ? <><span className="loader" style={{ width:18, height:18 }} /> {loadingMsg}</> : "🔨 File with the Court"}
                  </button>
                </div>
              ) : (
                <div className="card" style={{ textAlign:"center", display:"flex", flexDirection:"column", gap:"1rem", alignItems:"center", background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.15)" }}>
                  <div style={{ fontSize:"2.5rem" }}>📜</div>
                  <p style={{ fontWeight:700, color:"var(--amber-pale)" }}>Argument filed!</p>
                  <p style={{ color:"var(--muted)", fontSize:"0.9rem" }}>Waiting for the other player to submit...</p>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {[0,0.2,0.4].map((d) => <span key={d} className="waiting-dot" style={{ animationDelay:`${d}s` }} />)}
                  </div>
                </div>
              )}

              {/* Round history */}
              {gameState.history.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                  <p style={{ fontSize:"0.78rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 }}>Previous Rounds</p>
                  {[...gameState.history].reverse().map((h) => (
                    <div key={h.round} className="history-item" style={{ display:"flex", flexDirection:"column", gap:"0.3rem" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", color:"var(--muted)" }}>Round {h.round}</span>
                        <span className="tag tag-amber" style={{ fontSize:"0.7rem" }}>🏆 {h.winner}</span>
                      </div>
                      <p style={{ fontSize:"0.82rem", color:"var(--amber-pale)", fontStyle:"italic" }}>"{h.verdict}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GAME OVER ─────────────────────────────────── */}
          {screen === "gameOver" && gameState && (
            <div className="screen" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem", gap:"2rem", textAlign:"center" }}>
              <div style={{ fontSize:"6rem", animation:"bounce 0.8s ease infinite" }}>
                {gameState.game_winner === playerName ? "🏆" : "😭"}
              </div>

              <div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(3rem,10vw,5.5rem)", color: gameState.game_winner === playerName ? "var(--amber)" : "var(--muted)", lineHeight:1 }}>
                  {gameState.game_winner === playerName ? "You Win!" : `${gameState.game_winner} Wins!`}
                </div>
                <p style={{ color:"var(--muted)", marginTop:"0.5rem" }}>
                  {gameState.game_winner === playerName ? "The court has spoken. Your chaos reigns supreme." : "The court has spoken. Better luck next time."}
                </p>
              </div>

              <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap" }}>
                {gameState.players.map((p) => (
                  <div key={p} className="card" style={{ minWidth:140, display:"flex", flexDirection:"column", alignItems:"center", gap:"0.5rem", border: p === gameState.game_winner ? "1px solid var(--amber)" : "1px solid var(--border)" }}>
                    <span style={{ fontWeight:700 }}>{p}</span>
                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3.5rem", color: p === gameState.game_winner ? "var(--amber)" : "var(--muted)", lineHeight:1 }}>
                      {gameState.scores[p] || 0}
                    </div>
                    <span style={{ fontSize:"0.75rem", color:"var(--muted)" }}>rounds won</span>
                  </div>
                ))}
              </div>

              {gameState.history.length > 0 && (
                <div className="card" style={{ width:"100%", maxWidth:520, display:"flex", flexDirection:"column", gap:"0.75rem", maxHeight:240, overflowY:"auto" }}>
                  <p style={{ fontSize:"0.78rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 }}>Match History</p>
                  {gameState.history.map((h) => (
                    <div key={h.round} className="history-item">
                      <div style={{ display:"flex", gap:"0.5rem", alignItems:"center", marginBottom:"0.2rem" }}>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:"0.72rem", color:"var(--muted)" }}>Round {h.round}</span>
                        <span className="tag tag-amber" style={{ fontSize:"0.7rem" }}>🏆 {h.winner}</span>
                      </div>
                      <p style={{ fontSize:"0.78rem", color:"var(--amber-pale)", fontStyle:"italic" }}>"{h.verdict}"</p>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-primary btn-lg" onClick={reset}>⚡ Play Again</button>
            </div>
          )}

          {/* ── ROUND RESULT OVERLAY ─────────────────────── */}
          {showRoundResult && lastResult && (
            <div className="verdict-overlay" onClick={dismissRoundResult}>
              <div className="verdict-card" onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize:"3rem", marginBottom:"0.5rem" }}>
                  {lastResult.winner === playerName ? "🏆" : "💀"}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem", color:"var(--muted)", letterSpacing:"0.15em", marginBottom:"0.25rem" }}>
                  Round {lastResult.round} Verdict
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3rem", color:"var(--amber)", lineHeight:1, marginBottom:"1rem" }}>
                  {lastResult.winner === playerName ? "You Win This Round!" : `${lastResult.winner} Wins!`}
                </div>
                <div style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:12, padding:"1.2rem", marginBottom:"1.5rem" }}>
                  <p style={{ fontSize:"0.72rem", color:"var(--amber)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"0.5rem", fontWeight:700 }}>⚖️ The Judge Declares</p>
                  <p style={{ fontStyle:"italic", color:"var(--amber-pale)", lineHeight:1.6, fontSize:"0.95rem" }}>"{lastResult.verdict}"</p>
                </div>
                <button className="btn btn-primary" onClick={dismissRoundResult} style={{ width:"100%" }}>
                  {gameState?.status === "finished" ? "See Final Results →" : "Next Round →"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
