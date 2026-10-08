export type Config = {
  total: number;
  perSet: number;
  rest: number;
  start: string;
  mode: "cycle" | "week";
  restDays: number;
  weekdays: number[];
};
export type Session = {
  id: string;
  started: number;
  goal: number;
  plan: number[];
  rest: number;
  done: number[];
  phase: "ready" | "rest";
  endsAt: number | null;
  pausedMs: number | null;
};
export type RecordEntry = Session & {
  finished: number;
  duration: number;
  total: number;
  status: "concluído" | "parcial";
};
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayNumber(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function validDate(value: string) {
  const d = new Date(value + "T12:00:00");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(d.getTime()) &&
    localDate(d) === value
  );
}
export function validate(c: Config) {
  if (c.mode !== "cycle" && c.mode !== "week")
    return "Selecione uma frequência válida.";
  if (
    !Array.isArray(c.weekdays) ||
    c.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    return "Informe dias da semana válidos.";
  if (!Number.isInteger(c.total) || c.total < 1 || c.total > 10000)
    return "A meta deve ser um inteiro entre 1 e 10.000.";
  if (!Number.isInteger(c.perSet) || c.perSet < 1 || c.perSet > 10000)
    return "As flexões por série devem ser um inteiro entre 1 e 10.000.";
  if (!Number.isInteger(c.rest) || c.rest < 0 || c.rest > 3599)
    return "O descanso deve ficar entre 0 e 59 minutos e 59 segundos.";
  if (!validDate(c.start)) return "Informe uma data de início válida.";
  if (!Number.isInteger(c.restDays) || c.restDays < 0 || c.restDays > 365)
    return "Informe entre 0 e 365 dias de descanso.";
  if (
    c.mode === "week" &&
    (!c.weekdays.length ||
      c.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
  )
    return "Selecione pelo menos um dia da semana.";
  return "";
}
export function splitSets(total: number, size: number) {
  if (
    !Number.isInteger(total) ||
    !Number.isInteger(size) ||
    total < 1 ||
    size < 1
  )
    throw new Error("Quantidades inválidas");
  return Array.from({ length: Math.ceil(total / size) }, (_, i) =>
    Math.min(size, total - i * size),
  );
}
export function isTrainingDay(c: Config, date: string) {
  const delta = dayNumber(date) - dayNumber(c.start);
  return (
    delta >= 0 &&
    (c.mode === "cycle"
      ? delta % (c.restDays + 1) === 0
      : c.weekdays.includes(new Date(date + "T12:00:00").getDay()))
  );
}
export function nextTraining(c: Config, date = localDate()) {
  let d = new Date((date < c.start ? c.start : date) + "T12:00:00");
  for (let i = 0; i < 367; i++) {
    const key = localDate(d);
    if (isTrainingDay(c, key)) return key;
    d.setDate(d.getDate() + 1);
  }
  return null;
}
export function remaining(s: Session, now = Date.now()) {
  return s.pausedMs ?? Math.max(0, (s.endsAt ?? now) - now);
}
export function reconcile(s: Session, now = Date.now()): Session {
  return s.phase === "rest" && s.pausedMs === null && remaining(s, now) === 0
    ? { ...s, phase: "ready", endsAt: null }
    : s;
}
export function createSession(c: Config, now = Date.now()): Session {
  return {
    id: crypto.randomUUID(),
    started: now,
    goal: c.total,
    plan: splitSets(c.total, c.perSet),
    rest: c.rest,
    done: [],
    phase: "ready",
    endsAt: null,
    pausedMs: null,
  };
}
export function confirmSet(
  s: Session,
  amount: number,
  now = Date.now(),
): Session {
  if (
    s.phase !== "ready" ||
    s.done.length >= s.plan.length ||
    !Number.isInteger(amount) ||
    amount < 0 ||
    amount > 10000
  )
    return s;
  const done = [...s.done, amount];
  const rest = done.length < s.plan.length && s.rest > 0;
  return {
    ...s,
    done,
    phase: rest ? "rest" : "ready",
    endsAt: rest ? now + s.rest * 1000 : null,
    pausedMs: null,
  };
}
export function finish(s: Session, now = Date.now()): RecordEntry {
  return {
    ...s,
    finished: now,
    duration: Math.max(0, now - s.started),
    total: s.done.reduce((a, b) => a + b, 0),
    status: s.done.length === s.plan.length ? "concluído" : "parcial",
  };
}
export function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
