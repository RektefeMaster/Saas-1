# Design System Master File — Ahi AI

> **LOGIC:** When building a specific page, first check `design-system/saas-dashboard/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Ahi AI (İşletme Paneli)
**Updated:** 2026-07-31
**Category:** B2B SaaS — randevu / CRM / WhatsApp operasyon paneli
**Design Dials:** Variance 2/10 (Minimal) | Motion 2/10 (Subtle) | Density 6/10 (Standard)

---

## North Star (ürün önceliği)

1. **Sürtünmesiz** — az tıklama, net bir sonraki adım, çift navigasyon yok
2. **Anlaşılır** — sade dil, emoji yok, ikon = Lucide SVG
3. **Performanslı** — gereksiz gradient/shadow/animasyon yok; CSS transition 150–200ms

## Aesthetic direction

**Calm operational UI** — yeşil marka vurgusu, bol beyaz alan, düşük görsel gürültü.
AI şablon anti-pattern’lerden kaçın: purple gradient, Sparkles badge, gradient text, emoji, `border-2` + renkli gradient kart yağmuru, Inter.

### Typography (mevcut stack)

- **Body / UI:** Manrope (`--font-manrope`)
- **Mono / code:** Space Grotesk (`--font-space-grotesk`) — sadece kod / tenant code
- Display font ekleme; dashboard’da abartılı tipografi yok

### Color (mevcut token’lar — `globals.css`)

| Role | Hex | Token |
|------|-----|-------|
| Primary / CTA | `#059669` | `--primary` |
| Background | `#f8fafc` | `--background` |
| Foreground | `#0f172a` | `--foreground` |
| Card | `#ffffff` | `--card` |
| Muted | `#f1f5f9` | `--muted` |
| Border | `#e2e8f0` | `--border` |
| Destructive | `#dc2626` | `--destructive` |
| Warning | `#d97706` | `--warning` |

Aktif nav / birincil CTA = emerald (`primary`). Siyah “aktif” pill kullanma.

### Spacing

8pt grid. Section gap: `24px`. Kart padding: `16–20px`. Touch hedef: ≥44px (mobil).

### Motion

Sadece anlam taşıyan micro-interaction. `prefers-reduced-motion` saygı. Scroll reveal marketing’te; dashboard’da yok.

### Components

- Kart: `border` + `bg-card` + `rounded-xl` — gölge sadece modal/dropdown
- Empty state: sakin, tek satır mesaj; renkli kutlama yok
- Severity: sol kenar çizgisi veya küçük nokta; tüm kartı boyama
- Form: görünür label, blur’da validation, submit’te loading

## Anti-patterns (yasak)

- Emoji ikon (`🎯` `⭐` `💰` `📷`)
- `bg-gradient-to-*` dekoratif kart arka planları
- `border-2` + alarm rengi boş durumlarda
- Aynı ekranda sidebar + ikinci segment nav tekrarı (mümkünse tek hiyerarşi)
- Placeholder-only label
- Hover-only kritik bilgi

## Pre-delivery checklist

- [ ] cursor-pointer / button semantics tıklanabilirlerde
- [ ] Focus ring görünür (`--ring`)
- [ ] Contrast ≥ 4.5:1
- [ ] 375 / 768 / 1024 kontrol
- [ ] Loading → success/error feedback
- [ ] Reduced motion
