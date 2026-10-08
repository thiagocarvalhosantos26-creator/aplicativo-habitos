import { useState } from "react";
import {
  dishesCount,
  dishesScheduled,
  validateDishes,
  type DishesData,
  type DishesConfig,
} from "./dishes";
const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function DishesCard({
  data,
  date,
  onMark,
  onUndo,
  onSettings,
  onHistory,
}: {
  data: DishesData;
  date: string;
  onMark: () => void;
  onUndo: () => void;
  onSettings: () => void;
  onHistory: () => void;
}) {
  const count = dishesCount(data, date);
  const complete = count >= data.config.goal;
  const scheduled = dishesScheduled(data.config, date);
  return (
    <section className="card dishes-card" aria-labelledby="dishes-title">
      <div className="hero-top">
        <span className="eyebrow">CUIDADO COM A CASA</span>
        <span className="brand-icon" aria-hidden="true">
          ✓
        </span>
      </div>
      <h2 id="dishes-title">Lavar as vasilhas</h2>
      <p>Uma tarefa pequena. Um dia mais leve.</p>
      <p className="dishes-progress">
        <strong>
          {count} de {data.config.goal}{" "}
          {data.config.goal === 1 ? "vez" : "vezes"}
        </strong>{" "}
        hoje
      </p>
      <p className="aside">
        {scheduled
          ? "Programado para hoje."
          : "Hoje não está programado. Você pode registrar uma realização extra."}
      </p>
      <button className="primary" disabled={complete} onClick={onMark}>
        {complete
          ? "Concluído hoje"
          : scheduled
            ? "Marcar como feito"
            : "Marcar como feito · extra"}
      </button>
      {count > 0 && (
        <button className="text-button" onClick={onUndo}>
          Desfazer última marcação de hoje
        </button>
      )}
      <div className="quick-links">
        <button onClick={onSettings}>
          Configurar vasilhas <span>→</span>
        </button>
        <button onClick={onHistory}>
          Histórico de vasilhas <span>→</span>
        </button>
      </div>
    </section>
  );
}
export function DishesSettings({
  config,
  onSave,
}: {
  config: DishesConfig;
  onSave: (c: DishesConfig) => void;
}) {
  const [c, setC] = useState(config);
  const [goal, setGoal] = useState(String(c.goal));
  const [error, setError] = useState("");
  return (
    <form
      className="card settings"
      onSubmit={(e) => {
        e.preventDefault();
        const next = { ...c, goal: Number(goal) };
        const message = goal.trim()
          ? validateDishes(next)
          : "Informe a meta diária.";
        if (message) {
          setError(message);
          return;
        }
        onSave(next);
      }}
    >
      <label>
        Meta de vezes por dia
        <input
          required
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <label>
        Data de início
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
            setC({ ...c, mode: e.target.value as DishesConfig["mode"] })
          }
        >
          <option value="daily">Todos os dias</option>
          <option value="week">Dias da semana</option>
        </select>
      </label>
      {c.mode === "week" && (
        <fieldset>
          <legend>Dias programados</legend>
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
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <button className="primary" type="submit">
        Salvar configuração de vasilhas
      </button>
    </form>
  );
}
export function DishesHistory({ data }: { data: DishesData }) {
  return (
    <>
      {!data.history.length ? (
        <section className="card">
          <h2>Ainda sem marcações</h2>
          <p>As realizações de lavar as vasilhas aparecerão aqui.</p>
        </section>
      ) : (
        data.history.map((e) => (
          <article className="card history" key={e.id}>
            <div className="row">
              <b>
                {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")} ·{" "}
                {e.time}
              </b>
              <span className="pill">{e.extra ? "Extra" : "Realizado"}</span>
            </div>
            <p>Lavar as vasilhas · 1 realização</p>
            <small>ID: {e.id}</small>
          </article>
        ))
      )}
    </>
  );
}
