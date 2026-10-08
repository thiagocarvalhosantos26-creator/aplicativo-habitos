import { localDate, validDate } from "./domain.ts";

export type DishesConfig = {
  goal: number;
  start: string;
  mode: "daily" | "week";
  weekdays: number[];
};
export type DishesEntry = {
  id: string;
  at: number;
  date: string;
  time: string;
  extra: boolean;
};
export type DishesData = { config: DishesConfig; history: DishesEntry[] };
export const defaultDishes = (): DishesData => ({
  config: {
    goal: 1,
    start: localDate(),
    mode: "daily",
    weekdays: [1, 2, 3, 4, 5],
  },
  history: [],
});
export function validateDishes(c: DishesConfig) {
  if (!Number.isSafeInteger(c.goal) || c.goal < 1)
    return "A meta deve ser um número inteiro positivo.";
  if (!validDate(c.start)) return "Informe uma data de início válida.";
  if (c.mode !== "daily" && c.mode !== "week")
    return "Selecione uma frequência válida.";
  if (
    !Array.isArray(c.weekdays) ||
    c.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    (c.mode === "week" && !c.weekdays.length)
  )
    return "Selecione dias da semana válidos.";
  return "";
}
export function dishesScheduled(c: DishesConfig, date: string) {
  return (
    date >= c.start &&
    (c.mode === "daily" ||
      c.weekdays.includes(new Date(date + "T12:00:00").getDay()))
  );
}
export const dishesCount = (d: DishesData, date: string) =>
  d.history.filter((e) => e.date === date).length;
export function localTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}
export function markDishes(d: DishesData, now = Date.now()): DishesData {
  const instant = new Date(now);
  const date = localDate(instant);
  const last = d.history[0];
  // Persisted debounce survives a page reload and applies even with a daily goal > 1.
  if (
    dishesCount(d, date) >= d.config.goal ||
    (last && Math.abs(now - last.at) < 1000)
  )
    return d;
  return {
    ...d,
    history: [
      {
        id: crypto.randomUUID(),
        at: now,
        date,
        time: localTime(instant),
        extra: !dishesScheduled(d.config, date),
      },
      ...d.history,
    ],
  };
}
export function undoDishes(d: DishesData, date = localDate()): DishesData {
  const index = d.history.findIndex((e) => e.date === date);
  if (index < 0) return d;
  return { ...d, history: d.history.filter((_, i) => i !== index) };
}
