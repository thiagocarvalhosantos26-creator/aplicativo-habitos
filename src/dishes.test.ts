import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultDishes,
  markDishes,
  undoDishes,
  dishesCount,
  dishesScheduled,
  validateDishes,
  localTime,
} from "./dishes.ts";
import {
  defaults,
  parseData,
  loadData,
  writeData,
  readData,
  saveResult,
} from "./storage.ts";
import { createSession, confirmSet, finish, localDate } from "./domain.ts";

describe("lavar as vasilhas", () => {
  const instant = (day: number, seconds = 0) =>
    new Date(2026, 9, day, 10, 0, seconds).getTime();
  const ready = () => ({
    ...defaultDishes(),
    config: { ...defaultDishes().config, start: "2026-10-01", goal: 2 },
  });
  it("marca uma vez, ignora toque repetido e bloqueia a meta diária", () => {
    const d = ready();
    const one = markDishes(d, instant(8));
    assert.equal(one.history.length, 1);
    assert.equal(markDishes(one, instant(8)), one);
    assert.equal(markDishes(one, instant(8, 0) + 500), one);
    const two = markDishes(one, instant(8, 2));
    assert.equal(dishesCount(two, "2026-10-08"), 2);
    assert.equal(markDishes(two, instant(8, 4)), two);
    assert.notEqual(one.history[0].id, two.history[0].id);
  });
  it("salva identificador, data e horário locais", () => {
    const one = markDishes(ready(), instant(8, 12));
    const e = one.history[0];
    assert.ok(e.id);
    assert.equal(e.date, "2026-10-08");
    assert.equal(e.time, "10:00:12");
    assert.equal(e.at, instant(8, 12));
    assert.equal(e.extra, false);
  });
  it("desfaz somente a última de hoje e mantém outros dias", () => {
    let d = markDishes(ready(), instant(7));
    d = markDishes(d, instant(8));
    d = markDishes(d, instant(8, 2));
    const olderToday = d.history[1].id;
    const undo = undoDishes(d, "2026-10-08");
    assert.equal(undo.history.length, 2);
    assert.equal(undo.history[0].id, olderToday);
    assert.equal(undoDishes(undo, "2026-10-09"), undo);
  });
  it("zera o progresso na virada do dia sem apagar histórico", () => {
    const day = localDate(new Date(2026, 9, 8, 23, 59, 59));
    const next = localDate(new Date(2026, 9, 9, 0, 0, 1));
    const d = markDishes(ready(), new Date(2026, 9, 8, 23, 59, 59).getTime());
    assert.equal(dishesCount(d, day), 1);
    assert.equal(dishesCount(d, next), 0);
    assert.equal(
      markDishes(d, new Date(2026, 9, 9, 0, 0, 1).getTime()).history.length,
      2,
    );
  });
  it("respeita início e dias da semana, sem mudar calendário nas extras", () => {
    const d = ready();
    d.config.mode = "week";
    d.config.weekdays = [1];
    assert.equal(dishesScheduled(d.config, "2026-10-05"), true);
    assert.equal(dishesScheduled(d.config, "2026-10-08"), false);
    assert.equal(dishesScheduled(d.config, "2026-09-28"), false);
    const extra = markDishes(d, instant(8));
    assert.equal(extra.history[0].extra, true);
    assert.deepEqual(extra.config, d.config);
  });
  it("rejeita configuração inválida", () => {
    for (const patch of [
      { goal: 0 },
      { goal: -1 },
      { goal: 1.2 },
      { goal: Infinity },
      { mode: "other" as never },
      { start: "2026-02-30" },
      { mode: "week" as const, weekdays: [] },
    ])
      assert.notEqual(validateDishes({ ...ready().config, ...patch }), "");
  });
});
describe("migração e separação dos hábitos", () => {
  const old = () => {
    const d = defaults();
    const active = confirmSet(createSession(d.config), 3);
    return {
      config: d.config,
      active,
      history: [
        {
          ...finish({ ...active, id: "old-history" }),
          status: "parcial" as const,
        },
      ],
    };
  };
  it("migra a versão publicada sem perder configuração, histórico ou sessão ativa", () => {
    const legacy = old();
    const raw = JSON.stringify(legacy);
    const migrated = parseData(raw);
    assert.equal(migrated.version, 2);
    assert.deepEqual(migrated.config, legacy.config);
    assert.deepEqual(migrated.history, legacy.history);
    assert.deepEqual(migrated.active, legacy.active);
    assert.equal(migrated.dishes.config.goal, 1);
    assert.deepEqual(migrated.dishes.history, []);
    assert.deepEqual(parseData(JSON.stringify(migrated)), migrated);
  });
  it("não grava a migração durante a leitura e preserva o bruto quando falha", () => {
    const raw = JSON.stringify(old());
    const storage = { getItem: () => raw };
    assert.equal(loadData(storage).ok, true);
    assert.equal(storage.getItem(), raw);
    for (const invalid of [
      { ...old(), dishes: null },
      { ...old(), version: 2 },
      {
        ...defaults(),
        dishes: { config: defaultDishes().config, history: [null] },
      },
      { ...defaults(), version: 3 },
    ]) {
      const saved = JSON.stringify(invalid);
      assert.deepEqual(loadData({ getItem: () => saved }), {
        ok: false,
        raw: saved,
      });
    }
  });
  it("persiste marcação e desfazer após reabrir, preservando as flexões", () => {
    let raw: string | null = null;
    const memory = {
      getItem: () => raw,
      setItem: (_k: string, value: string) => {
        raw = value;
      },
    };
    const migrated = parseData(JSON.stringify(old()));
    const next = { ...migrated, dishes: markDishes(migrated.dishes) };
    writeData(next, memory);
    const reopened = readData(memory);
    assert.deepEqual(reopened, next);
    writeData({ ...reopened, dishes: undoDishes(reopened.dishes) }, memory);
    assert.equal(readData(memory).dishes.history.length, 0);
    assert.deepEqual(readData(memory).active, migrated.active);
    assert.deepEqual(readData(memory).history, migrated.history);
  });
  it("cada configuração e histórico permanece independente", () => {
    const d = defaults();
    const changed = {
      ...d,
      dishes: { ...d.dishes, config: { ...d.dishes.config, goal: 3 } },
    };
    assert.deepEqual(changed.config, d.config);
    const marked = { ...changed, dishes: markDishes(changed.dishes) };
    const result = finish(
      confirmSet(createSession({ ...d.config, total: 1 }), 1),
    );
    const saved = saveResult(marked, result);
    assert.deepEqual(saved.dishes, marked.dishes);
    assert.equal(saved.history.length, 1);
    assert.equal(saved.dishes.history.length, 1);
  });
  it("rejeita datas, horas e identificadores inválidos no novo histórico", () => {
    const d = defaults();
    const now = new Date();
    const entry = {
      id: "entry",
      at: now.getTime(),
      date: localDate(now),
      time: localTime(now),
      extra: false,
    };
    for (const patch of [
      { date: "2026-02-30" },
      { time: "25:00:00" },
      { id: "" },
      { at: -1 },
      { extra: null },
    ])
      assert.throws(() =>
        parseData(
          JSON.stringify({
            ...d,
            dishes: { ...d.dishes, history: [{ ...entry, ...patch }] },
          }),
        ),
      );
  });
});
