"use client";
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Card({ children, className = "", ticket = false }: { children: ReactNode; className?: string; ticket?: boolean }) {
  return (
    <div className={`relative rounded-[22px] border border-line bg-card p-5 shadow-[0_1px_0_rgba(18,33,59,0.04),0_18px_40px_-24px_rgba(18,33,59,0.35)] sm:p-6 ${ticket ? "ticket" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[11px] uppercase tracking-[0.18em] text-muted ${className}`}>{children}</p>;
}

export function SectionTitle({ no, title, hint }: { no: string; title: string; hint?: string; icon?: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-4">
      <span className="font-mono text-xs text-sunset">{no}</span>
      <div>
        <h2 className="font-display text-[28px] leading-none text-ink">{title}</h2>
        {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
      {children}
      {hint && <span className="ml-1 normal-case tracking-normal text-muted/70">{hint}</span>}
    </label>
  );
}

const field = "w-full rounded-xl border border-line bg-white/70 px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-ink focus:bg-white focus:shadow-[0_0_0_4px_rgba(230,178,62,0.25)] disabled:opacity-60";

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${field} ${p.className ?? ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${field} ${p.className ?? ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${field} ${p.className ?? ""}`} />;

export function Button({ variant = "primary", className = "", children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-ink text-paper hover:bg-ink-2 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-sunset before:to-sunset-2 before:transition-transform before:duration-500 hover:before:translate-x-0",
    secondary: "border border-ink/80 bg-transparent text-ink hover:bg-ink hover:text-paper",
    danger: "border border-sunset/40 bg-transparent text-sunset hover:bg-sunset hover:text-white",
    ghost: "text-muted hover:text-ink",
  }[variant];
  return (
    <button {...p} className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}>
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export function Arrow() {
  return <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>;
}

export function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; icon?: string }) {
  return (
    <label className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ${checked ? "-rotate-1 border-ink bg-ink text-paper shadow-md" : "border-line bg-white/60 text-muted hover:border-ink/40 hover:text-ink"}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {icon && <span>{icon}</span>}
      {label}
      <span className={`ml-0.5 font-mono text-[10px] transition ${checked ? "text-gold" : "text-transparent"}`}>●</span>
    </label>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="animate-rise rounded-2xl border border-sunset/30 bg-sunset/5 px-4 py-3 text-sm text-[#9a2f12]">
      <span className="mr-2 font-mono text-[11px] uppercase tracking-widest">Turbulence</span>
      {message}
    </div>
  );
}

/** Luggage-tag style prompt box that Claude reads. */
export function PromptBox({
  no, label, hint, value, onChange, placeholder, chips = [], rows = 3, required,
}: { no?: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; chips?: string[]; rows?: number; required?: boolean }) {
  const add = (c: string) => onChange(value.trim() ? `${value.trim()}${/[.!?]$/.test(value.trim()) ? "" : "."} ${c}` : c);
  return (
    <div className="group relative rounded-2xl border border-line bg-white/60 p-4 pl-5 transition-all duration-300 focus-within:-translate-y-0.5 focus-within:border-ink/50 focus-within:bg-white focus-within:shadow-[0_14px_30px_-20px_rgba(18,33,59,0.5)]">
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-line transition-colors duration-300 group-focus-within:bg-sunset" />
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {no && <span className="font-mono text-[11px] text-sunset">{no}</span>}
        <span className="font-display text-xl text-ink">{label}{required && <span className="text-sunset">*</span>}</span>
        {hint && <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{hint}</span>}
      </div>
      <textarea
        rows={rows}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted/50"
      />
      {!!chips.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => add(c)} className="rounded-full border border-dashed border-line px-2.5 py-1 font-mono text-[11px] text-muted transition hover:-translate-y-0.5 hover:border-sunset hover:text-sunset">
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
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2 rounded-full bg-ink p-1.5 pl-4 transition focus-within:shadow-[0_0_0_4px_rgba(230,178,62,0.3)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Ask Claude</span>
        <input value={text} onChange={(e) => setText(e.target.value)} disabled={disabled || sending} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-paper outline-none placeholder:text-paper/40" />
        <button disabled={disabled || sending || !text.trim()} className="rounded-full bg-sunset px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sunset-2 disabled:opacity-30">
          {sending ? "…" : "Send"}
        </button>
      </form>
      {!!suggestions.length && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" disabled={disabled || sending} onClick={() => void send(s)} className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted transition hover:border-ink hover:text-ink disabled:opacity-40">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dotted flight route with a plane flying along it. */
export function FlightPath({ from = "IDEA", to = "POST", className = "" }: { from?: string; to?: string; className?: string }) {
  const d = "M 12 70 C 110 -6, 270 -6, 368 70";
  return (
    <div className={`relative h-[88px] w-full max-w-[380px] ${className}`}>
      <svg viewBox="0 0 380 88" className="absolute inset-0 h-full w-full" fill="none">
        <path d={d} stroke="currentColor" strokeWidth="2" className="route-line text-ink/40" strokeLinecap="round" />
        <circle cx="12" cy="70" r="5" className="fill-ink" />
        <circle cx="368" cy="70" r="5" className="fill-sunset" />
      </svg>
      <span className="absolute left-0 top-0 animate-fly text-xl" style={{ offsetPath: `path('${d}')`, offsetRotate: "auto 45deg" } as React.CSSProperties}>✈</span>
      <span className="absolute bottom-0 left-0 font-mono text-[10px] tracking-widest text-ink">{from}</span>
      <span className="absolute bottom-0 right-0 font-mono text-[10px] tracking-widest text-sunset">{to}</span>
    </div>
  );
}

/** Passport-style ink stamp. */
export function Stamp({ children, color = "sea", className = "" }: { children: ReactNode; color?: "sea" | "sunset" | "ink" | "gold"; className?: string }) {
  const c = { sea: "border-sea text-sea", sunset: "border-sunset text-sunset", ink: "border-ink text-ink", gold: "border-gold text-[#9c7316]" }[color];
  return (
    <span className={`inline-flex animate-stamp items-center rounded-md border-2 border-double px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${c} ${className}`}>
      {children}
    </span>
  );
}
