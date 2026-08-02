/**
 * Vitrin için çizilmiş işaret seti.
 *
 * Hepsi tek bir kurala göre kuruldu: 44×44 ızgara, yalnız daire ve düz çizgi,
 * 1.6 kalınlık, yuvarlak uç. Böylece ikon kütüphanesi karışımı gibi değil,
 * tek elden çıkmış bir esnaf damgası takımı gibi duruyor.
 */

interface MarkProps {
  className?: string;
}

const BASE = {
  viewBox: "0 0 44 44",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Kuaför & berber — makas */
export function MarkScissors({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <circle cx="13.5" cy="32" r="4.4" />
      <circle cx="30.5" cy="32" r="4.4" />
      <path d="M16.6 28.9 31 9.5" />
      <path d="M27.4 28.9 13 9.5" />
      <circle cx="22" cy="21.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Güzellik & bakım — el aynası */
export function MarkMirror({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <circle cx="22" cy="17" r="9" />
      <path d="M17.5 13.5a5.5 5.5 0 0 1 4.5-2.3" />
      <path d="M22 26v9" />
      <path d="M18.4 35h7.2" />
    </svg>
  );
}

/** Klinik & sağlık — nabız */
export function MarkPulse({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <circle cx="22" cy="22" r="14" />
      <path d="M9.5 22h5.2l3.1-7.4 5.4 14.4 3-7h8.3" />
    </svg>
  );
}

/** Servis & tamir — civata */
export function MarkBolt({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <circle cx="22" cy="22" r="7" />
      <circle cx="22" cy="22" r="13" strokeDasharray="3.4 4.6" />
      <path d="M22 5.5v3.6M22 34.9v3.6M5.5 22h3.6M34.9 22h3.6" />
    </svg>
  );
}

/** Danışmanlık & hizmet — söz */
export function MarkSpeech({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M9 15.5A4.5 4.5 0 0 1 13.5 11h17a4.5 4.5 0 0 1 4.5 4.5v10a4.5 4.5 0 0 1-4.5 4.5H20l-7 5.5V30h.5A4.5 4.5 0 0 1 9 25.5z" />
      <path d="M15.5 18.5h13M15.5 23.5h8" />
    </svg>
  );
}

/** Defter — kayıt yüzeyi */
export function MarkLedger({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M11 8.5h18a3.5 3.5 0 0 1 3.5 3.5v23.5H14.5A3.5 3.5 0 0 1 11 32z" />
      <path d="M11 32a3.5 3.5 0 0 1 3.5-3.5h18" />
      <path d="M17 15h10M17 20.5h10" />
    </svg>
  );
}

/** Takvim — gün düzeni */
export function MarkCalendar({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <rect x="8.5" y="11" width="27" height="24.5" rx="3.5" />
      <path d="M8.5 19h27" />
      <path d="M15.5 8v6M28.5 8v6" />
      <circle cx="17" cy="26.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="27" cy="26.5" r="1.6" />
    </svg>
  );
}

/** Kalkan — yetki ve güvenlik */
export function MarkShield({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M22 6.5 34.5 11v10.5c0 7.6-5.1 13.2-12.5 16-7.4-2.8-12.5-8.4-12.5-16V11z" />
      <path d="M16.5 21.8l4 4 7-7.6" />
    </svg>
  );
}

/** Yönlendirme oku — kendi çizgi dilimizle */
export function MarkArrow({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Ahi damgası — Selçuklu yıldızından türetilmiş sekiz köşeli mühür.
 * Wordmark'ın yanında ve koyu bölümlerin köşesinde kullanılır.
 */
export function AhiSeal({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <path
        d="M20 3.5 26.2 8h7.8v7.8L38.5 20 34 26.2v7.8h-7.8L20 38.5 13.8 34H6v-7.8L1.5 20 6 13.8V6h7.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M20 13.8v12.4M13.8 20h12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
