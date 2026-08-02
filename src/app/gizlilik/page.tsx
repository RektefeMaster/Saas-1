import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: "Gizlilik Politikası ve KVKK Aydınlatma Metni | Ahi AI",
  description:
    "Ahi AI'nın hangi kişisel verileri neden işlediği, kimlerle paylaştığı, ne kadar sakladığı ve haklarınızı nasıl kullanabileceğiniz.",
};

const LAST_UPDATED = "31 Temmuz 2026";
const CONTROLLER = "Nurullah Aydın";
const CONTACT_EMAIL = "nuronuro458@gmail.com";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="site-display text-xl" style={{ color: "var(--ahi-text)" }}>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
        {children}
      </div>
    </section>
  );
}

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="underline decoration-[var(--ahi-brand)] underline-offset-4 transition-colors hover:opacity-80"
      style={{ color: "var(--ahi-brand)" }}
      href={href}
    >
      {children}
    </a>
  );
}

export default function GizlilikPage() {
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1
          className="site-display text-[clamp(1.9rem,4.5vw,2.75rem)]"
          style={{ color: "var(--ahi-text)" }}
        >
          Gizlilik Politikası ve KVKK Aydınlatma Metni
        </h1>
        <p className="site-meta mt-3 text-sm" style={{ color: "var(--ahi-text-3)" }}>
          Son güncelleme: {LAST_UPDATED}
        </p>

        <p className="mt-6 text-[15px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
          Ahi AI, işletmelerin WhatsApp üzerinden gelen randevu ve bilgi
          taleplerini otomatik yanıtlayan bir hizmettir. Bu metin, hizmeti
          kullanan işletmelerin ve o işletmelere WhatsApp&apos;tan yazan
          müşterilerin kişisel verilerinin nasıl işlendiğini açıklar.
        </p>

        <Section title="1. Veri sorumlusu">
          <p>
            Veri sorumlusu: <strong style={{ color: "var(--ahi-text)" }}>{CONTROLLER}</strong>
            <br />
            İletişim: <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
          </p>
          <p>
            Hizmeti kullanan işletmeler kendi müşteri verileri bakımından ayrıca
            veri sorumlusudur; Ahi AI bu verileri işletme adına işler.
          </p>
        </Section>

        <Section title="2. İşlenen kişisel veriler">
          <p>WhatsApp üzerinden yazan müşteriler için:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Telefon numarası</li>
            <li>Ad ve soyad (yalnızca siz belirtirseniz)</li>
            <li>
              Gönderdiğiniz mesajların içeriği; sesli mesaj gönderirseniz bunun
              metne çevrilmiş hâli; görsel gönderirseniz görselin metinsel
              betimlemesi
            </li>
            <li>
              Randevu bilgileri: tarih, saat, seçilen hizmet, varsa tercih
              edilen personel, randevu durumu
            </li>
            <li>
              Ziyaret geçmişi ve tercihler (örneğin genelde aldığınız hizmet,
              uygun olduğunuz saat aralığı)
            </li>
            <li>Verdiğiniz değerlendirme puanı</li>
          </ul>
          <p>Hizmeti kullanan işletmeler için:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>İşletme adı, adresi, iletişim telefonu, çalışma saatleri</li>
            <li>Hizmet ve fiyat listesi, personel bilgileri</li>
            <li>Panel giriş bilgileri</li>
          </ul>
          <p>
            Kimlik belgesi, banka/kart bilgisi, sağlık raporu gibi hassas
            belgeler talep edilmez. Böyle bir görsel gönderilirse sistem
            içeriğini çıkarmaz, yalnızca &quot;belge gönderilmiş&quot; bilgisini
            kaydeder. Bu tür belgeleri paylaşmamanızı öneririz.
          </p>
        </Section>

        <Section title="3. İşleme amaçları ve hukuki sebep">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Randevu oluşturma, değiştirme, iptal etme ve hatırlatma gönderme —{" "}
              <em>sözleşmenin kurulması ve ifası</em>
            </li>
            <li>
              Sorulara yanıt verme, fiyat ve müsaitlik bilgisi paylaşma —{" "}
              <em>meşru menfaat</em>
            </li>
            <li>
              Sizi bir sonraki konuşmada tanıyabilmek ve aynı bilgileri tekrar
              sormamak — <em>meşru menfaat</em>
            </li>
            <li>
              Hizmet kalitesini ölçme, hata ayıklama ve kötüye kullanımı önleme —{" "}
              <em>meşru menfaat</em>
            </li>
            <li>
              Kampanya ve geri kazanım mesajları — <em>açık rıza</em> (dilediğiniz
              an geri alabilirsiniz)
            </li>
          </ul>
        </Section>

        <Section title="4. Yapay zeka kullanımı">
          <p>
            Mesajlarınız, uygun yanıtın üretilebilmesi için yapay zeka
            sağlayıcısına iletilir. Sesli mesajlar metne çevrilir, görseller
            metinsel olarak betimlenir. Bu işlem yalnızca size cevap
            verebilmek içindir.
          </p>
          <p>
            Yanıtlar otomatik üretilir. Randevunuzla ilgili nihai karar her zaman
            işletmeye aittir; hatalı veya eksik bir yanıt aldığınızı
            düşünüyorsanız işletmeyi doğrudan arayabilirsiniz.
          </p>
        </Section>

        <Section title="5. Aktarım ve yurt dışına aktarım">
          <p>
            Hizmetin çalışabilmesi için veriler aşağıdaki hizmet sağlayıcıların
            altyapısında işlenir. Bu sağlayıcıların sunucuları büyük ölçüde
            Türkiye dışındadır; dolayısıyla kişisel verileriniz yurt dışına
            aktarılmaktadır.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Meta (WhatsApp Business Platform)</strong> — mesajların
              iletilmesi
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>OpenAI</strong> — mesajların yanıtlanması, ses ve görsel
              çözümleme
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Supabase</strong> — randevu ve müşteri kayıtlarının
              saklanması
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Upstash</strong> — kısa süreli konuşma hafızası
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Vercel</strong> — uygulamanın barındırılması
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Twilio</strong> — SMS bildirimleri (kullanıldığı ölçüde)
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Sentry, PostHog, Langfuse</strong> — hata takibi ve
              kullanım ölçümü
            </li>
          </ul>
          <p>
            Veriler bunun dışında üçüncü kişilere satılmaz, reklam amacıyla
            paylaşılmaz.
          </p>
        </Section>

        <Section title="6. Saklama süreleri">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Konuşma oturumu:</strong> 24 saat sonra otomatik silinir
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Sesli mesaj ve görseller:</strong> şifreli olarak en fazla
              48 saat saklanır, sonra otomatik silinir
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Randevu kayıtları ve müşteri notları:</strong> işletmeyle
              ilişki sürdüğü müddetçe; silme talebinde derhâl silinir
            </li>
            <li>
              <strong style={{ color: "var(--ahi-text)" }}>Teknik kayıtlar (log):</strong> hata ayıklama ve kötüye
              kullanım incelemesi için sınırlı süre
            </li>
          </ul>
        </Section>

        <Section title="7. Kampanya mesajlarından çıkma">
          <p>
            Kampanya veya hatırlatma amaçlı mesaj almak istemiyorsanız
            WhatsApp&apos;tan <strong style={{ color: "var(--ahi-text)" }}>&quot;DUR&quot;</strong> yazmanız
            yeterlidir. Bu andan itibaren size pazarlama mesajı gönderilmez.
          </p>
          <p>
            Kendi aldığınız randevuya ait hatırlatmalar bundan etkilenmez, çünkü
            bunlar reklam değil hizmetin parçasıdır. Onları da istemiyorsanız
            işletmeye bildirmeniz yeterlidir.
          </p>
        </Section>

        <Section title="8. Haklarınız">
          <p>
            KVKK madde 11 uyarınca; kişisel verinizin işlenip işlenmediğini
            öğrenme, buna ilişkin bilgi talep etme, işlenme amacını öğrenme,
            eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini
            veya yok edilmesini isteme, işlemeye itiraz etme ve zarara
            uğramanız hâlinde giderim talep etme haklarına sahipsiniz.
          </p>
          <p>
            Taleplerinizi{" "}
            <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>{" "}
            adresine iletebilirsiniz. Başvurunuz en geç 30 gün içinde
            yanıtlanır.
          </p>
        </Section>

        <Section title="9. Güvenlik">
          <p>
            Veriler şifreli bağlantı üzerinden iletilir; geçici medya dosyaları
            şifrelenerek saklanır ve süresi dolunca silinir. Panel erişimi
            yetkilendirme ile korunur. Buna rağmen internet üzerinden yapılan
            hiçbir aktarımın %100 güvenli olduğu garanti edilemez.
          </p>
        </Section>

        <Section title="10. Çerezler">
          <p>
            Web sitesinde oturumun sürdürülmesi için zorunlu çerezler ve
            hizmetin nasıl kullanıldığını anlamaya yönelik ölçümleme araçları
            kullanılır. Tarayıcı ayarlarınızdan çerezleri sınırlayabilirsiniz;
            bu durumda panel girişi çalışmayabilir.
          </p>
        </Section>

        <Section title="11. Değişiklikler">
          <p>
            Bu metin güncellenebilir. Güncelleme tarihi sayfanın başında
            belirtilir. Önemli değişikliklerde hizmeti kullanan işletmeler
            bilgilendirilir.
          </p>
        </Section>

        <p className="mt-10 text-[15px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
          Verilerinizin silinmesini talep etmek için{" "}
          <Link
            href="/veri-silme"
            className="underline decoration-[var(--ahi-brand)] underline-offset-4"
            style={{ color: "var(--ahi-brand)" }}
          >
            Veri Silme Talebi
          </Link>{" "}
          sayfasına bakabilirsiniz.
        </p>

        <p
          className="mt-12 border-t pt-6 text-sm"
          style={{ borderColor: "var(--ahi-line)", color: "var(--ahi-text-3)" }}
        >
          Sorularınız için:{" "}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </main>
    </SiteShell>
  );
}
