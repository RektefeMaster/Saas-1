import type { Metadata } from "next";
import Link from "next/link";

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
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

export default function GizlilikPage() {
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
          Gizlilik Politikası ve KVKK Aydınlatma Metni
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Son güncelleme: {LAST_UPDATED}
        </p>

        <p className="mt-6 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          Ahi AI, işletmelerin WhatsApp üzerinden gelen randevu ve bilgi
          taleplerini otomatik yanıtlayan bir hizmettir. Bu metin, hizmeti
          kullanan işletmelerin ve o işletmelere WhatsApp&apos;tan yazan
          müşterilerin kişisel verilerinin nasıl işlendiğini açıklar.
        </p>

        <Section title="1. Veri sorumlusu">
          <p>
            Veri sorumlusu: <strong>{CONTROLLER}</strong>
            <br />
            İletişim:{" "}
            <a
              className="text-emerald-700 hover:underline dark:text-emerald-400"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
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
              <strong>Meta (WhatsApp Business Platform)</strong> — mesajların
              iletilmesi
            </li>
            <li>
              <strong>OpenAI</strong> — mesajların yanıtlanması, ses ve görsel
              çözümleme
            </li>
            <li>
              <strong>Supabase</strong> — randevu ve müşteri kayıtlarının
              saklanması
            </li>
            <li>
              <strong>Upstash</strong> — kısa süreli konuşma hafızası
            </li>
            <li>
              <strong>Vercel</strong> — uygulamanın barındırılması
            </li>
            <li>
              <strong>Twilio</strong> — SMS bildirimleri (kullanıldığı ölçüde)
            </li>
            <li>
              <strong>Sentry, PostHog, Langfuse</strong> — hata takibi ve
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
              <strong>Konuşma oturumu:</strong> 24 saat sonra otomatik silinir
            </li>
            <li>
              <strong>Sesli mesaj ve görseller:</strong> şifreli olarak en fazla
              48 saat saklanır, sonra otomatik silinir
            </li>
            <li>
              <strong>Randevu kayıtları ve müşteri notları:</strong> işletmeyle
              ilişki sürdüğü müddetçe; silme talebinde derhâl silinir
            </li>
            <li>
              <strong>Teknik kayıtlar (log):</strong> hata ayıklama ve kötüye
              kullanım incelemesi için sınırlı süre
            </li>
          </ul>
        </Section>

        <Section title="7. Kampanya mesajlarından çıkma">
          <p>
            Kampanya veya hatırlatma amaçlı mesaj almak istemiyorsanız
            WhatsApp&apos;tan <strong>&quot;DUR&quot;</strong> yazmanız
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
            <a
              className="text-emerald-700 hover:underline dark:text-emerald-400"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
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

        <p className="mt-10 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          Verilerinizin silinmesini talep etmek için{" "}
          <Link
            href="/veri-silme"
            className="text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Veri Silme Talebi
          </Link>{" "}
          sayfasına bakabilirsiniz.
        </p>

        <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Sorularınız için:{" "}
          <a
            className="text-emerald-700 hover:underline dark:text-emerald-400"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
