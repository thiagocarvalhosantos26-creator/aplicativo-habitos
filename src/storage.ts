import {
  localDate,
  validate,
  reconcile,
  type Config,
  type Session,
  type RecordEntry,
} from "./domain.ts";
import {
  defaultDishes,
  validateDishes,
  type DishesData,
  type DishesConfig,
  type DishesEntry,
} from "./dishes.ts";
import { validDate } from "./domain.ts";
export type Data = {
  version: 2;
  config: Config;
  active: Session | null;
  history: RecordEntry[];
  dishes: DishesData;
};
export const KEY = "flexoes:v1";
export const defaults = (): Data => ({
  version: 2,
  dishes: defaultDishes(),
  config: {
    total: 50,
    perSet: 5,
    rest: 120,
    start: localDate(),
    mode: "cycle",
    restDays: 2,
    weekdays: [1, 3, 5],
  },
  active: null,
  history: [],
});
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const timestamp = (v: unknown): v is number => integer(v, 0, 8640000000000000);
const quantities = (v: unknown, min: number): v is number[] =>
  Array.isArray(v) && v.every((n) => integer(n, min, 10000));
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

function isConfig(v: unknown): v is Config {
  return (
    object(v) &&
    integer(v.total, 1, 10000) &&
    integer(v.perSet, 1, 10000) &&
    integer(v.rest, 0, 3599) &&
    typeof v.start === "string" &&
    (v.mode === "cycle" || v.mode === "week") &&
    integer(v.restDays, 0, 365) &&
    Array.isArray(v.weekdays) &&
    v.weekdays.every((d) => integer(d, 0, 6)) &&
    !validate(v as Config)
  );
}
function isSession(v: unknown): v is Session {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !v.id.trim() ||
    !timestamp(v.started) ||
    !integer(v.goal, 1, 10000) ||
    !integer(v.rest, 0, 3599) ||
    !quantities(v.plan, 1) ||
    !v.plan.length ||
    sum(v.plan) !== v.goal ||
    !quantities(v.done, 0) ||
    v.done.length > v.plan.length
  )
    return false;
  if (v.phase === "ready") return v.endsAt === null && v.pausedMs === null;
  if (
    v.phase !== "rest" ||
    v.rest === 0 ||
    v.done.length === 0 ||
    v.done.length === v.plan.length
  )
    return false;
  return (
    (timestamp(v.endsAt) && v.endsAt >= v.started && v.pausedMs === null) ||
    (v.endsAt === null && integer(v.pausedMs, 0, v.rest * 1000))
  );
}
function isRecord(v: unknown): v is RecordEntry {
  if (!object(v)) return false;
  const record = v;
  if (!isSession(v)) return false;
  return (
    timestamp(record.finished) &&
    record.finished >= v.started &&
    integer(record.duration, 0, Number.MAX_SAFE_INTEGER) &&
    record.duration === record.finished - v.started &&
    integer(record.total, 0, 100000000) &&
    record.total === sum(v.done) &&
    (record.status === "concluído"
      ? v.done.length === v.plan.length
      : record.status === "parcial" && v.done.length < v.plan.length)
  );
}
function isDishesEntry(v: unknown): v is DishesEntry {
  return (
    object(v) &&
    typeof v.id === "string" &&
    !!v.id.trim() &&
    timestamp(v.at) &&
    typeof v.date === "string" &&
    validDate(v.date) &&
    typeof v.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(v.time) &&
    typeof v.extra === "boolean"
  );
}
function isDishes(v: unknown): v is DishesData {
  if (!object(v) || !object(v.config)) return false;
  const c = v.config;
  if (
    !integer(c.goal, 1, Number.MAX_SAFE_INTEGER) ||
    typeof c.start !== "string" ||
    !(c.mode === "daily" || c.mode === "week") ||
    !Array.isArray(c.weekdays) ||
    !c.weekdays.every((d) => integer(d, 0, 6)) ||
    validateDishes(c as DishesConfig) ||
    !Array.isArray(v.history) ||
    !v.history.every(isDishesEntry)
  )
    return false;
  return new Set(v.history.map((e) => e.id)).size === v.history.length;
}
export function parseData(raw: string): Data {
  const v: unknown = JSON.parse(raw);
  if (
    !object(v) ||
    !isConfig(v.config) ||
    !(
      v.active === null ||
      (isSession(v.active) && v.active.done.length < v.active.plan.length)
    ) ||
    !Array.isArray(v.history) ||
    !v.history.every(isRecord)
  )
    throw new Error("Dados locais inconsistentes");
  const ids = v.history.map((r) => r.id);
  if (
    new Set(ids).size !== ids.length ||
    (v.active !== null && ids.includes(v.active.id))
  )
    throw new Error("Identificadores de sessão duplicados");
  // The published version had no schema version or dishes field. Migrate only
  // this exact shape, in memory; never replace malformed/partial new data.
  const legacy = !Object.hasOwn(v, "version") && !Object.hasOwn(v, "dishes");
  if (!legacy && (v.version !== 2 || !isDishes(v.dishes)))
    throw new Error("Dados de hábitos inconsistentes");
  return {
    version: 2,
    dishes: legacy ? defaultDishes() : (v.dishes as DishesData),
    config: v.config,
    active: v.active ? reconcile(v.active) : null,
    history: v.history,
  };
}
export type ReadResult =
  { ok: true; data: Data } | { ok: false; raw: string | null };
export function loadData(storage?: Pick<Storage, "getItem">): ReadResult {
  let raw: string | null = null;
  try {
    raw = (storage ?? localStorage).getItem(KEY);
    return { ok: true, data: raw === null ? defaults() : parseData(raw) };
  } catch {
    return { ok: false, raw };
  }
}
export function readData(
  storage: Pick<Storage, "getItem"> = localStorage,
): Data {
  const result = loadData(storage);
  if (!result.ok) throw new Error("Não foi possível ler os dados locais");
  return result.data;
}
export function writeData(
  d: Data,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(KEY, JSON.stringify(d));
}
export function saveResult(d: Data, entry: RecordEntry): Data {
  return {
    ...d,
    active: null,
    history: d.history.some((r) => r.id === entry.id)
      ? d.history
      : [entry, ...d.history],
  };
}
