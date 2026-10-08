import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
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
} from "./domain.ts";
import {
  defaults,
  readData,
  saveResult,
  writeData,
  parseData,
  loadData,
} from "./storage.ts";
describe("planejamento", () => {
  it("divide a última série com o restante", () => {
    assert.deepEqual(splitSets(52, 5), [...Array(10).fill(5), 2]);
    assert.deepEqual(splitSets(3, 5), [3]);
  });
  it("treina a cada três dias com dois descansos", () => {
    const c = { ...defaults().config, start: "2026-10-08" };
    assert.deepEqual(
      ["08", "09", "10", "11"].map((day) => isTrainingDay(c, `2026-10-${day}`)),
      [true, false, false, true],
    );
    assert.equal(nextTraining(c, "2026-10-09"), "2026-10-11");
    assert.equal(isTrainingDay(c, "2026-10-07"), false);
  });
  it("respeita dias da semana e início futuro", () => {
    const c = {
      ...defaults().config,
      start: "2026-10-08",
      mode: "week" as const,
      weekdays: [1],
    };
    assert.equal(nextTraining(c, "2026-10-01"), "2026-10-12");
  });
  it("mantém o calendário em datas locais", () =>
    assert.equal(localDate(new Date(2026, 9, 8, 23, 59)), "2026-10-08"));
  it("rejeita entradas inválidas", () => {
    const c = defaults().config;
    for (const patch of [
      { total: 1.5 },
      { perSet: -1 },
      { rest: NaN },
      { start: "2026-02-30" },
      { restDays: -1 },
      { mode: "week" as const, weekdays: [] },
    ])
      assert.notEqual(validate({ ...c, ...patch }), "");
  });
});
describe("validação e recuperação de dados persistidos", () => {
  const config = {
    total: 50,
    perSet: 5,
    rest: 120,
    start: "2026-10-08",
    mode: "cycle",
    restDays: 2,
    weekdays: [1, 3, 5],
  };
  const session = {
    id: "sessao-versao-1",
    started: 1000,
    goal: 50,
    plan: Array(10).fill(5),
    rest: 120,
    done: [3],
    phase: "rest",
    endsAt: 122000,
    pausedMs: null,
  };
  const previous = () => ({
    config: { ...config },
    active: { ...session },
    history: [
      {
        ...session,
        id: "historico-versao-1",
        finished: 3000,
        duration: 2000,
        total: 3,
        status: "parcial",
      },
    ],
  });
  it("aceita dados válidos da versão atual sem alterar configuração ou histórico", () => {
    const old = previous();
    const read = parseData(JSON.stringify(old));
    assert.deepEqual(read.config, old.config);
    assert.deepEqual(read.history, old.history);
    assert.equal(read.active?.id, old.active.id);
    assert.deepEqual(read.active?.done, [3]);
    assert.equal(read.active?.phase, "ready");
    const complete = {
      ...session,
      id: "concluido",
      done: Array(10).fill(5),
      phase: "ready",
      endsAt: null,
      finished: 5000,
      duration: 4000,
      total: 50,
      status: "concluído",
    };
    assert.equal(
      parseData(JSON.stringify({ ...old, history: [complete] })).history[0]
        .status,
      "concluído",
    );
  });
  it("rejeita frequência inválida e dias inválidos em ambas as modalidades", () => {
    for (const patch of [
      { mode: "other" },
      { weekdays: null },
      { weekdays: [7] },
      { weekdays: [1.5] },
      { mode: "week", weekdays: [] },
      { restDays: -1 },
    ])
      assert.throws(() =>
        parseData(
          JSON.stringify({ ...previous(), config: { ...config, ...patch } }),
        ),
      );
    assert.notEqual(
      validate({ ...defaults().config, mode: "invalid" as never }),
      "",
    );
  });
  it("rejeita histórico com null ou objeto incompleto, sem filtrá-lo", () => {
    for (const entry of [
      null,
      {},
      { ...previous().history[0], total: 999 },
      { ...previous().history[0], duration: 1 },
      { ...previous().history[0], finished: 0 },
      { ...previous().history[0], status: "concluído" },
    ])
      assert.throws(() =>
        parseData(JSON.stringify({ ...previous(), history: [entry] })),
      );
  });
  it("rejeita sessões e estados de cronômetro inconsistentes", () => {
    for (const patch of [
      { id: "" },
      { started: null },
      { goal: 51 },
      { plan: [] },
      { plan: [-1] },
      { done: Array(11).fill(5) },
      { done: [1.5] },
      { rest: -1 },
      { phase: "invalid" },
      { phase: "ready" },
      { endsAt: null },
      { pausedMs: 1000 },
      { endsAt: null, pausedMs: 120001 },
      { endsAt: 0 },
      { done: [] },
      { done: Array(10).fill(5) },
    ])
      assert.throws(
        () =>
          parseData(
            JSON.stringify({ ...previous(), active: { ...session, ...patch } }),
          ),
        JSON.stringify(patch),
      );
  });
  it("aceita sessões pausadas e prontas compatíveis com a versão atual", () => {
    const old = previous();
    assert.equal(
      parseData(
        JSON.stringify({
          ...old,
          active: { ...session, endsAt: null, pausedMs: 50000 },
        }),
      ).active?.pausedMs,
      50000,
    );
    assert.equal(
      parseData(
        JSON.stringify({
          ...old,
          active: { ...session, phase: "ready", endsAt: null },
        }),
      ).active?.phase,
      "ready",
    );
  });
  it("preserva conteúdo bruto inválido, inclusive JSON vazio, sem gravar", () => {
    for (const raw of [
      "",
      "{broken",
      JSON.stringify({ ...previous(), history: [null] }),
    ]) {
      let writes = 0;
      const storage = {
        getItem: () => raw,
        setItem: () => {
          writes++;
        },
      };
      const result = loadData(storage);
      assert.deepEqual(result, { ok: false, raw });
      assert.equal(writes, 0);
    }
  });
  it("diferencia registro ausente de falha ao acessar armazenamento", () => {
    assert.equal(loadData({ getItem: () => null }).ok, true);
    assert.deepEqual(
      loadData({
        getItem: () => {
          throw new Error("bloqueado");
        },
      }),
      { ok: false, raw: null },
    );
  });
});
describe("sessão e armazenamento", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    };
  };
  it("reconcilia descanso vencido sem registrar outra série", () => {
    const s = confirmSet(createSession(defaults().config, 1000), 5, 2000);
    assert.equal(remaining(s, 32000), 90000);
    const resumed = reconcile(JSON.parse(JSON.stringify(s)), 200000);
    assert.equal(resumed.phase, "ready");
    assert.deepEqual(resumed.done, [5]);
    assert.deepEqual(reconcile(resumed, 900000).done, [5]);
  });
  it("preserva pausa mesmo após longo intervalo", () => {
    const s = confirmSet(createSession(defaults().config, 1000), 5, 2000);
    const paused = { ...s, endsAt: null, pausedMs: 60000 };
    assert.equal(remaining(reconcile(paused, 999999), 999999), 60000);
  });
  it("retoma sessão após recarregar armazenamento", () => {
    const storage = memory();
    const d = defaults();
    d.active = confirmSet(createSession(d.config), 3);
    writeData(d, storage);
    const read = readData(storage);
    assert.equal(read.active?.id, d.active.id);
    assert.deepEqual(read.active?.done, [3]);
    assert.equal(read.active?.endsAt, d.active.endsAt);
  });
  it("não confirma enquanto descansa e não descansa na última série", () => {
    const c = { ...defaults().config, total: 7 };
    let s = confirmSet(createSession(c), 4);
    assert.equal(confirmSet(s, 5), s);
    s = confirmSet(reconcile(s, Date.now() + 200000), 2);
    assert.deepEqual(s.done, [4, 2]);
    assert.equal(s.endsAt, null);
    assert.equal(finish(s).status, "concluído");
  });
  it("salva parcial e evita registros duplicados", () => {
    const d = defaults();
    const s = confirmSet(createSession(d.config, 1000), 3, 2000);
    const r = finish(s, 3000);
    assert.equal(r.status, "parcial");
    assert.equal(r.total, 3);
    assert.equal(r.duration, 2000);
    assert.equal(saveResult(saveResult(d, r), r).history.length, 1);
    assert.equal(saveResult(d, r).active, null);
  });
});
