import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Veri Silme Talebi | Ahi AI",
  description:
    "Ahi AI üzerinde tutulan kişisel verilerinizin silinmesini nasıl talep edeceğiniz.",
};

const CONTACT_EMAIL = "nuronuro458@gmail.com";

export default function VeriSilmePage() {
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1
          className="site-display text-[clamp(1.9rem,4.5vw,2.75rem)]"
          style={{ color: "var(--ahi-text)" }}
        >
          Veri Silme Talebi
        </h1>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
          <p>
            Ahi AI üzerinde saklanan kişisel verilerinizin silinmesini istiyorsanız
            aşağıdaki yollardan biriyle talepte bulunabilirsiniz. Talebiniz en geç
            30 gün içinde sonuçlandırılır ve size e-posta ile bilgi verilir.
          </p>

          <h2 className="site-display pt-4 text-xl" style={{ color: "var(--ahi-text)" }}>
            1. WhatsApp üzerinden
          </h2>
          <p>
            Bot ile yazıştığınız WhatsApp hattına{" "}
            <strong style={{ color: "var(--ahi-text)" }}>&quot;verilerimi sil&quot;</strong> yazmanız yeterlidir. Talebiniz
            işletmeye iletilir.
          </p>
          <p>
            Yalnızca kampanya mesajlarını kesmek istiyorsanız veri silmeye gerek
            yok: <strong style={{ color: "var(--ahi-text)" }}>&quot;DUR&quot;</strong> yazmanız yeterli. Randevu
            hatırlatmalarınız bundan etkilenmez.
          </p>

          <h2 className="site-display pt-4 text-xl" style={{ color: "var(--ahi-text)" }}>
            2. E-posta ile
          </h2>
          <p>
            <a
              className="underline decoration-[var(--ahi-brand)] underline-offset-4"
              style={{ color: "var(--ahi-brand)" }}
              href={`mailto:${CONTACT_EMAIL}?subject=Veri%20Silme%20Talebi`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            adresine, konu satırına &quot;Veri Silme Talebi&quot; yazarak
            ulaşabilirsiniz. Kimliğinizi doğrulayabilmemiz için mesajınızda
            <strong style={{ color: "var(--ahi-text)" }}> WhatsApp&apos;ta kullandığınız telefon numarasını</strong>{" "}
            belirtin.
          </p>

          <h2 className="site-display pt-4 text-xl" style={{ color: "var(--ahi-text)" }}>
            Ne siliniyor?
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Telefon numaranız ve adınız</li>
            <li>Mesaj içerikleriniz ve konuşma kayıtlarınız</li>
            <li>Randevu geçmişiniz</li>
            <li>Botun sizinle ilgili tuttuğu tercih notları</li>
            <li>Varsa değerlendirme puanınız</li>
          </ul>
          <p>
            Sesli mesajlar ve görseller zaten en fazla 48 saat şifreli olarak
            saklanır ve otomatik silinir; konuşma oturumu 24 saat sonra düşer.
          </p>

          <h2 className="site-display pt-4 text-xl" style={{ color: "var(--ahi-text)" }}>
            Silinemeyen veriler
          </h2>
          <p>
            Yasal saklama yükümlülüğü bulunan kayıtlar (örneğin fatura ve muhasebe
            kayıtları) mevzuatın öngördüğü süre boyunca saklanmak zorundadır. Bu
            kayıtlar yalnızca yasal amaçla tutulur, pazarlama veya başka bir amaçla
            kullanılmaz.
          </p>

          <p
            className="mt-10 border-t pt-6 text-sm"
            style={{ borderColor: "var(--ahi-line)", color: "var(--ahi-text-3)" }}
          >
            Ayrıntılı bilgi için{" "}
            <Link
              href="/gizlilik"
              className="underline decoration-[var(--ahi-brand)] underline-offset-4"
              style={{ color: "var(--ahi-brand)" }}
            >
              Gizlilik Politikası
            </Link>{" "}
            sayfamıza bakabilirsiniz.
          </p>
        </div>
      </main>
    </SiteShell>
  );
}
