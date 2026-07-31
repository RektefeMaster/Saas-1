import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Veri Silme Talebi | Ahi AI",
  description:
    "Ahi AI üzerinde tutulan kişisel verilerinizin silinmesini nasıl talep edeceğiniz.",
};

const CONTACT_EMAIL = "nuronuro458@gmail.com";

export default function VeriSilmePage() {
  return (
    <main className="min-h-screen bg-white px-5 py-16 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          ← Ana sayfa
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Veri Silme Talebi
        </h1>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            Ahi AI üzerinde saklanan kişisel verilerinizin silinmesini istiyorsanız
            aşağıdaki yollardan biriyle talepte bulunabilirsiniz. Talebiniz en geç
            30 gün içinde sonuçlandırılır ve size e-posta ile bilgi verilir.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            1. WhatsApp üzerinden
          </h2>
          <p>
            Bot ile yazıştığınız WhatsApp hattına{" "}
            <strong>&quot;verilerimi sil&quot;</strong> yazmanız yeterlidir. Talebiniz
            işletmeye iletilir.
          </p>
          <p>
            Yalnızca kampanya mesajlarını kesmek istiyorsanız veri silmeye gerek
            yok: <strong>&quot;DUR&quot;</strong> yazmanız yeterli. Randevu
            hatırlatmalarınız bundan etkilenmez.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            2. E-posta ile
          </h2>
          <p>
            <a
              className="text-emerald-700 hover:underline dark:text-emerald-400"
              href={`mailto:${CONTACT_EMAIL}?subject=Veri%20Silme%20Talebi`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            adresine, konu satırına &quot;Veri Silme Talebi&quot; yazarak
            ulaşabilirsiniz. Kimliğinizi doğrulayabilmemiz için mesajınızda
            <strong> WhatsApp&apos;ta kullandığınız telefon numarasını</strong>{" "}
            belirtin.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
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

          <h2 className="pt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            Silinemeyen veriler
          </h2>
          <p>
            Yasal saklama yükümlülüğü bulunan kayıtlar (örneğin fatura ve muhasebe
            kayıtları) mevzuatın öngördüğü süre boyunca saklanmak zorundadır. Bu
            kayıtlar yalnızca yasal amaçla tutulur, pazarlama veya başka bir amaçla
            kullanılmaz.
          </p>

          <p className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Ayrıntılı bilgi için{" "}
            <Link
              href="/gizlilik"
              className="text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Gizlilik Politikası
            </Link>{" "}
            sayfamıza bakabilirsiniz.
          </p>
        </div>
      </div>
    </main>
  );
}
