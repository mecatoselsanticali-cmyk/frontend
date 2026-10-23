import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { addDaysToDateString, dayOfWeekForDateString, firstOfMonthForDateString, todayColombia } from "../utils/timezone";

export interface DateRange { from: string; to: string }

// Fechas calendario, sin convertirlas a la zona horaria del navegador.
const calendarDate = (value: string) => new Date(`${value}T12:00:00Z`);
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  calendarDate(value).toLocaleDateString("es-CO", { ...options, timeZone: "UTC" });

function rangeLabel({ from, to }: DateRange) {
  if (!from && !to) return "Filtrar por rango de fecha";
  if (!from) return `Hasta ${dateLabel(to, { day: "numeric", month: "short", year: "numeric" })}`;
  if (!to) return `Desde ${dateLabel(from, { day: "numeric", month: "short", year: "numeric" })}`;
  return `${dateLabel(from, { day: "numeric", month: "short", ...(from.slice(0, 4) !== to.slice(0, 4) ? { year: "numeric" } : {}) })} – ${dateLabel(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

function moveMonth(month: string, offset: number) {
  const date = calendarDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function DateRangeSheet({ value, onApply, onClose }: {
  value: DateRange; onApply: (range: DateRange) => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => (value.from || value.to || todayColombia()).slice(0, 7));
  const [choosingEnd, setChoosingEnd] = useState(Boolean(value.from && !value.to));
  const [entered, setEntered] = useState(false);
  const today = todayColombia();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const alreadyLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    dialog?.showModal();
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      dialog?.close();
      if (!alreadyLocked) document.body.classList.remove("overflow-hidden");
      previousFocus?.focus();
    };
  }, []);

  const selectDay = (day: string) => {
    if (!choosingEnd || !draft.from) {
      setDraft({ from: day, to: "" });
      setChoosingEnd(true);
    } else {
      setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
      setChoosingEnd(false);
    }
  };

  const presets: { label: string; range: DateRange }[] = [
    { label: "Hoy", range: { from: today, to: today } },
    { label: "Ayer", range: { from: addDaysToDateString(today, -1), to: addDaysToDateString(today, -1) } },
    { label: "Esta semana", range: { from: addDaysToDateString(today, -((dayOfWeekForDateString(today) + 6) % 7)), to: today } },
    { label: "Este mes", range: { from: firstOfMonthForDateString(today), to: today } },
  ];
  const firstDay = `${month}-01`;
  const leadingDays = (dayOfWeekForDateString(firstDay) + 6) % 7;
  const daysInMonth = calendarDate(addDaysToDateString(`${moveMonth(month, 1)}-01`, -1)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day < 1 || day > daysInMonth ? null : `${month}-${String(day).padStart(2, "0")}`;
  });

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={hintId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 backdrop:bg-black/40">
      <section className={`flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-zinc-200 bg-white p-5 shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${entered ? "translate-y-0" : "translate-y-full"}`}>
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-zinc-200" />
        <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold text-zinc-900">Selecciona un rango de fechas</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar calendario" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><X size={19} aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Rangos rápidos">
            {presets.map(({ label, range }) => {
              const active = draft.from === range.from && draft.to === range.to;
              return <button key={label} type="button" aria-pressed={active} onClick={() => { setDraft(range); setMonth(range.from.slice(0, 7)); setChoosingEnd(false); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${active ? "border-orange-200 bg-orange-50 text-orange-600" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>{label}</button>;
            })}
          </div>
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Mes anterior" onClick={() => setMonth(moveMonth(month, -1))} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-orange-500"><ChevronLeft size={19} /></button>
            <h3 aria-live="polite" className="text-sm font-semibold capitalize text-zinc-800">{dateLabel(firstDay, { month: "long", year: "numeric" })}</h3>
            <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(moveMonth(month, 1))} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-orange-500"><ChevronRight size={19} /></button>
          </div>
          <div aria-hidden="true" className="grid grid-cols-7 text-center text-[11px] font-medium text-zinc-400">{["L", "M", "M", "J", "V", "S", "D"].map((day, index) => <span key={index} className="py-2">{day}</span>)}</div>
          <div role="group" aria-label="Días del mes" className="grid grid-cols-7 gap-y-1">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const edge = day === draft.from || day === draft.to;
              const selected = edge || Boolean(draft.from && draft.to && day > draft.from && day < draft.to);
              return <button key={day} type="button" onClick={() => selectDay(day)} aria-label={`${dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${day === draft.from ? ", inicio" : ""}${day === draft.to ? ", fin" : ""}`} aria-pressed={selected} aria-current={day === today ? "date" : undefined} className={`flex h-10 items-center justify-center text-sm focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${edge ? "rounded-full bg-orange-600 font-semibold text-white" : selected ? "bg-orange-50 text-orange-600" : "rounded-full text-zinc-700 hover:bg-zinc-50"} ${day === today && !selected ? "font-bold underline decoration-orange-500 underline-offset-4" : ""}`}>{Number(day.slice(-2))}</button>;
            })}
          </div>
          <p id={hintId} role="status" className="mt-3 min-h-8 text-center text-xs text-zinc-500">{choosingEnd ? "Ahora selecciona la fecha de fin" : draft.from && draft.to ? rangeLabel(draft) : "Selecciona primero la fecha de inicio"}</p>
        </div>
        <footer className="mt-3 flex shrink-0 items-center gap-4 border-t border-zinc-100 pt-4">
          <button type="button" onClick={() => { setDraft({ from: "", to: "" }); setChoosingEnd(false); }} className="rounded-lg px-2 py-3 text-sm font-medium text-zinc-500 hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-orange-500">Limpiar</button>
          <button type="button" disabled={Boolean(draft.from) !== Boolean(draft.to)} onClick={() => { onApply(draft); onClose(); }} className="w-full rounded-xl bg-orange-600 py-3 text-sm font-medium text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">Aplicar filtro</button>
        </footer>
      </section>
    </dialog>
  );
}


interface DateRangeFilterMobileProps extends DateRange {
  onChange: (range: DateRange) => void;
}

export default function DateRangeFilterMobile({ from, to, onChange }: DateRangeFilterMobileProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  return <>
      <button type="button" onClick={() => setCalendarOpen(true)} aria-haspopup="dialog" aria-expanded={calendarOpen} className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-700 active:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20"><Calendar size={17} className="shrink-0 text-zinc-400" aria-hidden="true" /><span className="flex-1 text-left">{rangeLabel({ from, to })}</span><ChevronDown size={16} className="shrink-0 text-zinc-400" aria-hidden="true" /></button>
    {calendarOpen && <DateRangeSheet value={{ from, to }} onApply={onChange} onClose={() => setCalendarOpen(false)} />}
  </>;
}
