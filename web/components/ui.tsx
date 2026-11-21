"use client";
import { useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6 ${className}`}>{children}</div>;
}

export function SectionTitle({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-base text-white shadow-sm">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
  );
}

const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${field} ${p.className ?? ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${field} ${p.className ?? ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${field} ${p.className ?? ""}`} />;

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200 hover:from-indigo-500 hover:to-violet-500",
    secondary: "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
    ghost: "text-slate-600 hover:bg-slate-100",
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} />;
}

export function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; icon?: string }) {
  return (
    <label className={`flex cursor-pointer select-none items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {icon && <span>{icon}</span>}
      {label}
      {checked && <span className="ml-1 text-indigo-600">✓</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>;
}

/** A prompt box Claude reads: write what you want in your own words; chips add ideas. */
export function PromptBox({
  label, hint, value, onChange, placeholder, chips = [], rows = 3, required,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; chips?: string[]; rows?: number; required?: boolean }) {
  const add = (c: string) => onChange(value.trim() ? `${value.trim()}${/[.!?]$/.test(value.trim()) ? "" : "."} ${c}` : c);
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 p-3.5 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-bold text-white">✦</span>
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <textarea
        rows={rows}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      {!!chips.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => add(c)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700">
              + {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Ask Claude" chat input for changing one part of a finished post. */
export function AskClaude({ placeholder, suggestions = [], onSend, disabled }: { placeholder: string; suggestions?: string[]; onSend: (text: string) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  async function send(t = text) {
    if (!t.trim() || sending) return;
    setSending(true);
    try {
      await onSend(t.trim());
      setText("");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="mt-3">
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-1.5 pl-3 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
        <span className="text-xs font-semibold text-indigo-600">✦ Ask Claude</span>
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled || sending} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-slate-400" />
        <button disabled={disabled || sending || !text.trim()} className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40">
          {sending ? "…" : "Send"}
        </button>
      </form>
      {!!suggestions.length && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" disabled={disabled || sending} onClick={() => void send(s)} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200 transition hover:text-indigo-700 hover:ring-indigo-200 disabled:opacity-40">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
