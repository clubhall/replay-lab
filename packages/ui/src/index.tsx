import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  TextareaHTMLAttributes
} from "react";
import { clsx } from "clsx";
import "./styles.css";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("ch-panel", className)} {...props} />;
}

export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={clsx("ch-section-title", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={clsx("ch-button", `ch-button--${variant}`, className)} {...props} />;
}

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx("ch-chip", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("ch-input", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: HTMLAttributes<HTMLTextAreaElement> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx("ch-textarea", className)} {...props} />;
}

export function Stat({
  label,
  value,
  className
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={clsx("ch-stat", className)}>
      <span className="ch-stat__label">{label}</span>
      <strong className="ch-stat__value">{value}</strong>
    </div>
  );
}

export function Stack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("ch-stack", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children
}: PropsWithChildren<{
  label: string;
  hint?: string;
}>) {
  return (
    <label className="ch-field">
      <span className="ch-field__label">{label}</span>
      {hint ? <span className="ch-field__hint">{hint}</span> : null}
      {children}
    </label>
  );
}
