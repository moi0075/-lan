import { ArrowUpRight } from "lucide-react";
import { flag, type Country } from "../data/catalog";
export function MiniProgress({ value = 0 }: { value?: number }) {
  return (
    <div
      className="mini-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={Math.min(3, value)}
      aria-label={`${Math.min(3, value)} réussites sur 3`}
    >
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= value ? "filled" : ""} />
      ))}
    </div>
  );
}
export function CountryFlag({
  country,
  large = false,
}: {
  country: Country;
  large?: boolean;
}) {
  return (
    <span
      className={`flag ${large ? "flag-large" : ""}`}
      role="img"
      aria-label={`Drapeau : ${country.name}`}
    >
      {flag(country)}
    </span>
  );
}
export function Stat({
  icon,
  value,
  suffix,
  label,
  detail,
  color,
}: {
  icon: React.ReactNode;
  value: string | number;
  suffix?: string;
  label: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <span className={`icon-tile ${color}`}>{icon}</span>
      <div>
        <span className="stat-label">{label}</span>
        <div className="stat-value">
          {value}
          {suffix && <small>{suffix}</small>}
        </div>
        <p>{detail}</p>
      </div>
      <ArrowUpRight size={16} className="stat-arrow" />
    </div>
  );
}
