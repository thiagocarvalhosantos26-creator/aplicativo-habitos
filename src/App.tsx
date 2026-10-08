import { useEffect, useRef, useState } from "react";
import {
  clock,
  confirmSet,
  createSession,
  finish,
  isTrainingDay,
  localDate,
  nextTraining,
  reconcile,
  remaining,
  splitSets,
  validate,
  type Config,
  type RecordEntry,
} from "./domain";
import {
  defaults,
  loadData,
  saveResult,
  writeData,
  type Data,
  type ReadResult,
} from "./storage";
import { Modal } from "./Modal";
import { DishesCard, DishesSettings, DishesHistory } from "./DishesView";
import { markDishes, undoDishes } from "./dishes";
import { usePwaUpdate } from "./usePwaUpdate";
const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
export function App() {
  const [initial] = useState(() => loadData());
  const [readFailure, setReadFailure] = useState<Extract<
    ReadResult,
    { ok: false }
  > | null>(initial.ok ? null : initial);
  const blocked = useRef(!initial.ok);
  const [data, setData] = useState(initial.ok ? initial.data : defaults());
  const dataRef = useRef(data);
  const [error, setError] = useState("");
  const [writeError, setWriteError] = useState("");
  const pendingWrite = useRef<Data | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [view, setView] = useState<
    "home" | "config" | "dishes-config" | "history" | "workout"
  >("home");
  const [now, setNow] = useState(Date.now());
  const [amount, setAmount] = useState("");
  const [summary, setSummary] = useState<RecordEntry | null>(null);
  const [confirm, setConfirm] = useState<"partial" | "discard" | null>(null);
  const [historyHabit, setHistoryHabit] = useState<"flexoes" | "dishes">(
    "flexoes",
  );
  const lastUndo = useRef(-Infinity);
  const update = usePwaUpdate(!!data.active || !!readFailure || !!writeError);
  function commit(next: Data) {
    if (blocked.current) return false;
    try {
      writeData(next);
      dataRef.current = next;
      setData(next);
      setError("");
      setWriteError("");
      pendingWrite.current = null;
      return true;
    } catch {
      pendingWrite.current = next;
      setWriteError(
        "Não foi possível salvar neste dispositivo. Libere espaço ou permita o armazenamento e tente novamente.",
      );
      return false;
    }
  }
  function retryRead() {
    const result = loadData();
    if (!result.ok) {
      blocked.current = true;
      setReadFailure(result);
      return;
    }
    blocked.current = false;
    dataRef.current = result.data;
    setData(result.data);
    setReadFailure(null);
    setWriteError("");
    pendingWrite.current = null;
    setView("home");
  }
  function resetData() {
    const next = defaults();
    try {
      // The only write permitted while reading is blocked is this explicit reset.
      writeData(next);
      blocked.current = false;
      dataRef.current = next;
      setData(next);
      setReadFailure(null);
      setWriteError("");
      pendingWrite.current = null;
      setResetOpen(false);
      setView("home");
    } catch {
      setResetOpen(false);
      setWriteError(
        "Não foi possível redefinir os dados. O registro anterior não foi apagado. Tente novamente quando o armazenamento estiver disponível.",
      );
    }
  }
  function downloadRaw() {
    if (readFailure?.raw === null || !readFailure) return;
    const url = URL.createObjectURL(
      new Blob([readFailure.raw], { type: "application/json;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "flexoes-recuperacao.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      const d = dataRef.current;
      if (d.active && !blocked.current && !pendingWrite.current) {
        const active = reconcile(d.active, time);
        if (active !== d.active) commit({ ...d, active });
      }
    };
    const timer = window.setInterval(tick, 250);
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pageshow", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const s = data.active;
  const index = s?.done.length ?? 0;
  useEffect(() => {
    setAmount(s ? String(s.plan[s.done.length] ?? 0) : "");
  }, [s?.id, index]);
  const lastConfirm = useRef(0);
  function complete() {
    const time = Date.now();
    if (time - lastConfirm.current < 500) return;
    const d = dataRef.current;
    const session = d.active;
    if (!session || session.phase !== "ready") return;
    const n = Number(amount);
    if (amount.trim() === "" || !Number.isInteger(n) || n < 0 || n > 10000) {
      setError("Informe um inteiro entre 0 e 10.000 para esta série.");
      return;
    }
    lastConfirm.current = time;
    const active = confirmSet(session, n);
    if (active.done.length === active.plan.length) {
      const result = finish(active);
      if (commit(saveResult(d, result))) {
        setSummary(result);
        setView("home");
      }
    } else commit({ ...d, active });
  }
  function endSession(discard: boolean) {
    const d = dataRef.current;
    if (!d.active) return;
    const result = finish(d.active);
    if (commit(discard ? { ...d, active: null } : saveResult(d, result))) {
      setConfirm(null);
      setView("home");
      if (!discard) setSummary(result);
    } else setConfirm(null);
  }
  const c = data.config;
  const today = localDate(new Date(now));
  const next = nextTraining(c, today);
  const training = isTrainingDay(c, today);
  return (
    <div className="app">
      <header>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("home");
          }}
          className="brand"
          data-focus-fallback
        >
          <span className="brand-icon">↗</span> seu ritmo
          <span className="brand-dot">.</span>
        </a>
        <span className="eyebrow">UM DIA DE CADA VEZ</span>
      </header>
      <main>
        {update.available && (
          <section
            className="notice update-notice"
            aria-label="Atualização disponível"
          >
            <b>Uma atualização está disponível.</b>
            <p>
              {data.active
                ? "Conclua ou encerre o treino antes de atualizar. Sua sessão continuará salva."
                : "Carregue a nova versão quando estiver pronto. Seus dados serão mantidos."}
            </p>
            <button
              className="secondary"
              disabled={!!data.active || !!readFailure || !!writeError}
              onClick={() => void update.apply()}
            >
              Carregar atualização
            </button>
          </section>
        )}
        {update.failure && (
          <p className="notice" role="alert">
            {update.failure}
          </p>
        )}
        {readFailure && (
          <section className="card recovery" aria-labelledby="recovery-title">
            <h1 id="recovery-title">Vamos proteger seus dados.</h1>
            <p role="alert">
              Não foi possível ler ou validar os registros locais. Nenhum treino
              ou configuração será salvo enquanto isso não for resolvido.
            </p>
            <button className="primary" onClick={retryRead}>
              Tentar novamente
            </button>
            <button
              className="secondary"
              disabled={readFailure.raw === null}
              onClick={downloadRaw}
            >
              Baixar dados para recuperação
            </button>
            {readFailure.raw === null && (
              <p>
                O navegador não disponibilizou o conteúdo salvo para download.
              </p>
            )}
            <p>
              Se preferir começar de novo, a redefinição apagará a configuração,
              a sessão em andamento e todo o histórico deste aplicativo.
            </p>
            <button className="text-button" onClick={() => setResetOpen(true)}>
              Redefinir dados locais
            </button>
          </section>
        )}
        {writeError && (
          <div className="notice" role="alert">
            <p>{writeError}</p>
            {!readFailure && (
              <button
                className="secondary"
                onClick={() => {
                  const pending = pendingWrite.current;
                  const previous = dataRef.current.active;
                  if (pending && commit(pending)) {
                    setView("home");
                    const result = pending.history.find(
                      (r) => r.id === previous?.id,
                    );
                    if (result) setSummary(result);
                  }
                }}
              >
                Tentar salvar novamente
              </button>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="notice">
            {error}
          </div>
        )}
        {!readFailure && view === "home" && (
          <>
            <div className="intro">
              <span className="eyebrow">
                {new Date(now).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <h1>
                Pequenos passos.
                <br />
                Mais força.
              </h1>
              <p>Seu próximo movimento começa aqui.</p>
            </div>
            <section className="hero">
              <div className="hero-top">
                <span className="tag">SEU HÁBITO</span>
                <span className="exercise-icon" aria-hidden="true">
                  ↗
                </span>
              </div>
              <h2>Flexões</h2>
              <p>Consistência, uma série de cada vez.</p>
              <div className="goal">
                <strong>{c.total}</strong>
                <span>
                  flexões
                  <br />
                  por treino
                </span>
              </div>
              <div className="hero-stats">
                <span>
                  <b>{splitSets(c.total, c.perSet).length} séries</b>até{" "}
                  {c.perSet} flexões cada
                </span>
                <span>
                  <b>{clock(c.rest * 1000)}</b>de descanso
                </span>
              </div>
              <button
                className="primary light"
                onClick={() => {
                  if (s) {
                    setView("workout");
                    return;
                  }
                  if (
                    commit({ ...dataRef.current, active: createSession(c) })
                  ) {
                    setSummary(null);
                    setView("workout");
                  }
                }}
              >
                {s ? "Retomar treino" : "Iniciar treino"} <span>→</span>
              </button>
              {s && <small>Você tem uma sessão em andamento.</small>}
            </section>
            <section className="schedule">
              <span className="status-dot" />
              <div>
                <h3>
                  {training
                    ? "Hoje é dia de treino"
                    : today < c.start
                      ? "Seu planejamento começa em breve"
                      : "Hoje é dia de descanso"}
                </h3>
                <p>
                  {next
                    ? `Próximo treino planejado: ${dateLabel(next)}`
                    : "Configure seus dias de treino."}
                </p>
              </div>
            </section>
            <p className="aside">
              {c.mode === "cycle"
                ? `1 dia de treino · ${c.restDays} ${c.restDays === 1 ? "dia" : "dias"} de descanso`
                : c.weekdays.map((d) => days[d]).join(" · ")}
              <br />
              Você pode treinar em qualquer dia, sem mudar o planejamento.
            </p>
            <div className="quick-links">
              <button onClick={() => setView("config")}>
                <span>⚙</span>Configuração <span>→</span>
              </button>
              <button
                onClick={() => {
                  setHistoryHabit("flexoes");
                  setView("history");
                }}
              >
                <span>◷</span>Histórico <span>→</span>
              </button>
            </div>
            <DishesCard
              data={data.dishes}
              date={today}
              onMark={() => {
                const d = dataRef.current;
                const dishes = markDishes(d.dishes);
                if (dishes !== d.dishes) commit({ ...d, dishes });
              }}
              onUndo={() => {
                const time = Date.now();
                if (time - lastUndo.current < 1000) return;
                const d = dataRef.current;
                const dishes = undoDishes(d.dishes, localDate(new Date(time)));
                if (dishes !== d.dishes && commit({ ...d, dishes }))
                  lastUndo.current = time;
              }}
              onSettings={() => setView("dishes-config")}
              onHistory={() => {
                setHistoryHabit("dishes");
                setView("history");
              }}
            />
            <details className="install">
              <summary>Adicionar à Tela de Início do iPhone</summary>
              <p>
                No Safari, toque em Compartilhar e depois em “Adicionar à Tela
                de Início”. Após o primeiro carregamento completo, o aplicativo
                funciona offline.
              </p>
            </details>
          </>
        )}
        {!readFailure && view === "config" && (
          <>
            <Back onClick={() => setView("home")} />
            <h1>Seu planejamento</h1>
            <span className="eyebrow">FLEXÕES</span>
            <p>
              Ajuste o treino ao seu ritmo. Uma sessão em andamento mantém sua
              configuração original.
            </p>
            <Settings
              config={c}
              onSave={(config) => {
                if (commit({ ...dataRef.current, config })) setView("home");
              }}
            />
          </>
        )}
        {!readFailure && view === "dishes-config" && (
          <>
            <Back onClick={() => setView("home")} />
            <h1>Lavar as vasilhas</h1>
            <p>Organize a rotina da casa, no seu ritmo.</p>
            <DishesSettings
              config={data.dishes.config}
              onSave={(config) => {
                const d = dataRef.current;
                if (commit({ ...d, dishes: { ...d.dishes, config } }))
                  setView("home");
              }}
            />
          </>
        )}
        {!readFailure && view === "history" && (
          <>
            <Back onClick={() => setView("home")} />
            <h1>Seu histórico</h1>
            <label className="history-filter">
              Hábito
              <select
                value={historyHabit}
                onChange={(e) =>
                  setHistoryHabit(e.target.value as "flexoes" | "dishes")
                }
              >
                <option value="flexoes">Flexões</option>
                <option value="dishes">Lavar as vasilhas</option>
              </select>
            </label>
            {historyHabit === "dishes" ? (
              <DishesHistory data={data.dishes} />
            ) : (
              <>
                <p>Flexões · Cada série conta.</p>
                {data.history.length === 0 ? (
                  <section className="card">
                    <h2>Seu primeiro passo vem aí</h2>
                    <p>Os treinos salvos aparecerão aqui.</p>
                  </section>
                ) : (
                  data.history.map((r) => (
                    <details className="card history" key={r.id}>
                      <summary>
                        <div>
                          <b>
                            {new Date(r.started).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </b>
                          <span className="pill">{r.status}</span>
                        </div>
                        <p>
                          {r.total} flexões · {r.done.length} séries ·{" "}
                          {clock(r.duration)}
                        </p>
                      </summary>
                      <p>Meta prevista: {r.goal} flexões</p>
                      <ol>
                        {r.done.map((n, i) => (
                          <li key={i}>
                            Série {i + 1}: {n} flexões (previstas: {r.plan[i]})
                          </li>
                        ))}
                      </ol>
                      <small>ID: {r.id}</small>
                    </details>
                  ))
                )}
              </>
            )}
          </>
        )}
        {!readFailure && view === "workout" && s && (
          <>
            <Back
              onClick={() => setView("home")}
              label="Voltar e manter sessão"
            />
            <span className="eyebrow">TREINO DE FLEXÕES</span>
            <h1>
              {s.phase === "rest"
                ? "Respire. Recupere."
                : "Vamos à próxima série."}
            </h1>
            <section className="card workout">
              <div className="row">
                <b>
                  Série {Math.min(index + 1, s.plan.length)} de {s.plan.length}
                </b>
                <span>
                  {s.done.reduce((a, b) => a + b, 0)} / {s.goal} flexões
                </span>
              </div>
              <progress value={index} max={s.plan.length} />
              {s.phase === "rest" ? (
                <>
                  <span className="eyebrow">
                    {s.pausedMs !== null
                      ? "DESCANSO PAUSADO"
                      : "TEMPO DE DESCANSO"}
                  </span>
                  <div
                    className="timer"
                    role="timer"
                    aria-label="Tempo restante"
                  >
                    {clock(remaining(s, now))}
                  </div>
                  <p>A próxima série tem {s.plan[index]} flexões.</p>
                  <button
                    className="primary"
                    onClick={() => {
                      const d = dataRef.current;
                      const a = d.active;
                      if (!a || a.phase !== "rest") return;
                      commit({
                        ...d,
                        active:
                          a.pausedMs === null
                            ? { ...a, pausedMs: remaining(a), endsAt: null }
                            : {
                                ...a,
                                endsAt: Date.now() + a.pausedMs,
                                pausedMs: null,
                              },
                      });
                    }}
                  >
                    {s.pausedMs === null
                      ? "Pausar descanso"
                      : "Continuar descanso"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      commit({
                        ...dataRef.current,
                        active: {
                          ...s,
                          phase: "ready",
                          endsAt: null,
                          pausedMs: null,
                        },
                      })
                    }
                  >
                    Pular descanso
                  </button>
                </>
              ) : (
                <>
                  <div className="reps">{s.plan[index]}</div>
                  <p>flexões nesta série</p>
                  <label>
                    Quantidade realmente realizada
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="1"
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <button className="primary" onClick={complete}>
                    Concluir série ✓
                  </button>
                </>
              )}
              <small>Tempo de sessão: {clock(now - s.started)}</small>
            </section>
            <div className="session-actions">
              <button
                className="secondary"
                onClick={() => setConfirm("partial")}
              >
                Encerrar e salvar parcial
              </button>
              <button
                className="text-button"
                onClick={() => setConfirm("discard")}
              >
                Descartar sessão
              </button>
            </div>
          </>
        )}
      </main>
      <footer>
        Os dados ficam neste dispositivo e podem ser perdidos se os dados do
        navegador forem apagados.
      </footer>
      {confirm && (
        <Modal titleId="confirm-title" onClose={() => setConfirm(null)}>
          <h2 id="confirm-title">
            {confirm === "discard"
              ? "Descartar este treino?"
              : "Salvar treino parcial?"}
          </h2>
          <p>
            {confirm === "discard"
              ? "As séries desta sessão serão perdidas."
              : "As séries já confirmadas serão salvas no histórico."}
          </p>
          <button
            data-initial-focus={confirm === "partial" ? true : undefined}
            className="primary"
            onClick={() => endSession(confirm === "discard")}
          >
            {confirm === "discard" ? "Sim, descartar" : "Salvar parcial"}
          </button>
          <button
            data-initial-focus={confirm === "discard" ? true : undefined}
            className="secondary"
            onClick={() => setConfirm(null)}
          >
            Continuar treino
          </button>
        </Modal>
      )}
      {summary && (
        <Modal titleId="summary-title" onClose={() => setSummary(null)}>
          <span className="eyebrow">TREINO {summary.status.toUpperCase()}</span>
          <h2 id="summary-title">Seu esforço conta.</h2>
          <div className="reps">{summary.total}</div>
          <p>flexões realizadas</p>
          <p>
            {summary.done.length} séries · {clock(summary.duration)} de duração
          </p>
          <button
            data-initial-focus
            className="primary"
            onClick={() => setSummary(null)}
          >
            Voltar ao início
          </button>
        </Modal>
      )}
      {resetOpen && (
        <Modal titleId="reset-title" onClose={() => setResetOpen(false)}>
          <h2 id="reset-title">Apagar todos os registros locais?</h2>
          <p>
            A configuração, a sessão em andamento e todo o histórico serão
            apagados e substituídos pelos valores iniciais. Esta ação não pode
            ser desfeita. Baixe os dados para recuperação antes de continuar.
          </p>
          <button className="primary" onClick={resetData}>
            Sim, apagar e redefinir
          </button>
          <button
            data-initial-focus
            className="secondary"
            onClick={() => setResetOpen(false)}
          >
            Manter meus dados
          </button>
        </Modal>
      )}
    </div>
  );
}
function Back({
  onClick,
  label = "Voltar",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="back" onClick={onClick}>
      ← {label}
    </button>
  );
}
function Settings({
  config,
  onSave,
}: {
  config: Config;
  onSave: (c: Config) => void;
}) {
  const [c, setC] = useState(config);
  const [minutes, setMinutes] = useState(String(Math.floor(c.rest / 60)));
  const [seconds, setSeconds] = useState(String(c.rest % 60));
  const [error, setError] = useState("");
  return (
    <form
      className="card settings"
      onSubmit={(e) => {
        e.preventDefault();
        const m = Number(minutes),
          s = Number(seconds);
        if (
          minutes === "" ||
          seconds === "" ||
          !Number.isInteger(m) ||
          !Number.isInteger(s) ||
          m < 0 ||
          m > 59 ||
          s < 0 ||
          s > 59
        ) {
          setError("Use minutos e segundos inteiros entre 0 e 59.");
          return;
        }
        const next = { ...c, rest: m * 60 + s };
        const message = validate(next);
        if (message) {
          setError(message);
          return;
        }
        onSave(next);
      }}
    >
      <label>
        Meta por treino
        <input
          required
          type="number"
          min="1"
          max="10000"
          step="1"
          inputMode="numeric"
          value={c.total || ""}
          onChange={(e) => setC({ ...c, total: Number(e.target.value) })}
        />
      </label>
      <label>
        Flexões por série
        <input
          required
          type="number"
          min="1"
          max="10000"
          step="1"
          inputMode="numeric"
          value={c.perSet || ""}
          onChange={(e) => setC({ ...c, perSet: Number(e.target.value) })}
        />
      </label>
      <fieldset>
        <legend>Descanso entre séries</legend>
        <div className="columns">
          <label>
            Minutos
            <input
              required
              type="number"
              min="0"
              max="59"
              step="1"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label>
            Segundos
            <input
              required
              type="number"
              min="0"
              max="59"
              step="1"
              inputMode="numeric"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </label>
        </div>
      </fieldset>
      <label>
        Início do planejamento
        <input
          required
          type="date"
          value={c.start}
          onChange={(e) => setC({ ...c, start: e.target.value })}
        />
      </label>
      <label>
        Frequência
        <select
          value={c.mode}
          onChange={(e) =>
            setC({ ...c, mode: e.target.value as Config["mode"] })
          }
        >
          <option value="cycle">Treino e descanso</option>
          <option value="week">Dias da semana</option>
        </select>
      </label>
      {c.mode === "cycle" ? (
        <label>
          Dias de descanso após cada treino
          <input
            required
            type="number"
            min="0"
            max="365"
            step="1"
            inputMode="numeric"
            value={c.restDays}
            onChange={(e) =>
              setC({
                ...c,
                restDays: e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
          />
        </label>
      ) : (
        <fieldset>
          <legend>Dias de treino</legend>
          <div className="weekdays">
            {days.map((day, i) => (
              <button
                key={day}
                type="button"
                aria-pressed={c.weekdays.includes(i)}
                onClick={() =>
                  setC({
                    ...c,
                    weekdays: c.weekdays.includes(i)
                      ? c.weekdays.filter((d) => d !== i)
                      : [...c.weekdays, i].sort(),
                  })
                }
              >
                {day}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <button className="primary" type="submit">
        Salvar planejamento
      </button>
    </form>
  );
}
