/**
 * Vitrin için çizilmiş işaretler — 44×44 ızgara, tek çizgi dili.
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

/** WhatsApp / konuşma */
export function MarkSpeech({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M10 14.5c0-3.6 3.6-6.5 12-6.5s12 2.9 12 6.5-3.6 6.5-12 6.5c-1.4 0-2.7-.1-3.9-.3L10 24.5V14.5z" />
      <path d="M16 14.2h12M16 17.8h8" />
    </svg>
  );
}

/** Ok */
export function MarkArrow({ className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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

/** Kuaför / berber — makas */
export function MarkScissors({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <circle cx="13.5" cy="13.5" r="3.5" />
      <circle cx="13.5" cy="30.5" r="3.5" />
      <path d="M16.5 15.5 31 31.5" />
      <path d="M16.5 28.5 31 12.5" />
      <path d="M31 12.5h4.5M31 31.5h4.5" />
    </svg>
  );
}

/** Güzellik / bakım — ayna + parıltı */
export function MarkCare({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <ellipse cx="19.5" cy="20" rx="9" ry="11.5" />
      <path d="M10.5 20h18" />
      <path d="M33 9v5M30.5 11.5h5" />
      <path d="M35.5 18v3M34 19.5h3" />
    </svg>
  );
}

/** Klinik / sağlık — haç */
export function MarkClinic({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <rect x="9" y="9" width="26" height="26" rx="6" />
      <path d="M22 15.5v13M15.5 22h13" />
    </svg>
  );
}

/** Servis / tamir — anahtar */
export function MarkWrench({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <path d="M27.5 10a6 6 0 0 0-8.2 8.2L9.5 28l6 6 9.8-9.8A6 6 0 0 0 27.5 10z" />
      <circle cx="28.5" cy="14.5" r="1.7" />
    </svg>
  );
}

/** Danışmanlık — takvim */
export function MarkConsult({ className }: MarkProps) {
  return (
    <svg {...BASE} className={className} aria-hidden>
      <rect x="9" y="12" width="26" height="22" rx="3" />
      <path d="M9 19.5h26" />
      <path d="M16 8.5v6M28 8.5v6" />
      <path d="M16 26.5h4M23 26.5h6" />
    </svg>
  );
}
