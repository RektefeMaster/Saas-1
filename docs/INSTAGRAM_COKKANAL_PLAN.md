# Instagram + WhatsApp Çok Kanallı Asistan — Uygulama Planı

> Durum: plan onayı bekliyor. Kod değişikliği yapılmadı.
> Tarih: 2026-08-04 · Sürüm 2 (rakip araştırması + Meta kuralları doğrulandı)

## Uygulanan (2026-08-04)

Instagram'dan bağımsız, bugün değer üreten iki parça tamamlandı. Ölçüt: mevcut
177 test tek satır değişmeden yeşil kaldı (toplam 194'e çıktı), tip kontrolü ve
production build temiz.

**1. Kanal hesap defteri ("anahtarlık") — altyapı hazır, özellik kapalı**
- `tenant_channel_accounts` tablosu (migration 046), WhatsApp + Instagram
- `resolveWhatsAppCredentials(tenantId)`: işletmenin kendi numarası varsa
  oradan, yoksa ortak numaradan. Kayıt olmadığı için bugün davranış aynı.
- Gelen mesaj artık **ulaştığı numaradan** tenant'a çözülüyor
  (`routingReason: "channel_account"`) — kendi numarası olan işletmede
  içerik tahmini hiç çalışmıyor.
- Müşteriye giden tüm gönderimler tenant taşıyor (panel, kampanya, hatırlatma,
  bekleme listesi, takip). İşletme sahibine giden platform bildirimleri
  bilinçli olarak ortak numarada bırakıldı ve gerekçesi koda yazıldı.
- Tokenlar AES-256-GCM ile şifreli (`CHANNEL_TOKEN_KEY`), düz metin saklanmıyor.

**2. "Emin değilsen sor" — yönlendirme sızıntı freni**
- Benzer isimli işletmeler yakın puan aldığında bot artık tahmin etmiyor;
  müşteriye seçmeli liste gönderiyor (`routingReason: "ambiguous"`).
- Seçim, satır kimliğinde tenant kodu olarak taşınıyor — cevap tahmine değil
  seçime dayanıyor.
- Adaylardan biri müşterinin mevcut işletmesiyse soru sorulmuyor, ona devam
  ediliyor.
- Adlar birebir aynıysa liste satırında işletme telefonu gösteriliyor
  (WhatsApp başlığı 24 karaktere kırptığı için tek ayırt edici bilgi).

**Denetimde bulunup düzeltilenler (aynı gün):**
- *Hata:* kendi numarası bağlı işletmede mesaj temizliği atlanıyordu; QR/link
  ile gelen `Kod: AHMET01` işaretleri modele sızıyordu.
- *Tasarım hatası:* gelen mesaj çözümü `status='active'` filtreliyordu. Tokeni
  düşmüş bir hesabın müşterileri isim tahminine düşerdi. Artık gelen taraf
  durumu yok sayıyor (kim olduğu her zaman bellidir), durum yalnızca gönderimi
  etkiliyor ve kullanılamaz hesap loga düşüyor.
- *Eksik:* belirsizlikte randevu geçmişi kontrolü atlanıyordu; artık TEK aday
  geçmişte varsa soru sorulmadan devam ediliyor (iki adayda da varsa soruluyor).
- *Eksik:* müşterinin asıl mesajı "hangi işletme?" sorusunda kayboluyordu.
  Artık 15 dk saklanıp seçimden sonra geri yükleniyor.
- Ölü kod temizliği (kullanılmayan test yardımcısı, kullanılmayan dönüş alanı).

**Ertelendi (istek üzerine):** göstergeler/ölçümleme. 100 işletmeyi geçmeden
yapılmalı — bkz. §12'deki ortak numara tavanı.

**Açık kalan:** aynı isimli tenant oluşturulurken admin panelde uyarı yok.
Sorunun kaynağındaki çözüm budur; runtime freni onu tamamlıyor ama yerine
geçmiyor.

## 0. Alınan kararlar

| Karar | Seçim |
|---|---|
| Kimlik modeli | Telefon **randevu anında** istenir; sohbet telefonsuz başlar |
| Instagram bağlantısı | Tek tıklık **sihirli link** (magic link) |
| WhatsApp modeli | Ortak numara + içerikten yönlendirme **korunur** |

---

# BÖLÜM I — ARAŞTIRMA

## 1. Rakipler ne yapıyor, nerede tıkanıyorlar

Pazarın tamamı (ManyChat, Chatfuel, respond.io, SleekFlow, Trengo, Wati,
Interakt, Zoko, Spur) aynı beş yerde tıkanıyor:

### 1.1 "AI" dedikleri şey aslında anahtar kelime eşleşmesi

ManyChat'in AI eklentisi ayda 29 $ ve kullanıcıların tarifi net: *"gerçek
konuşma AI'ından çok anahtar kelime eşleştirmeye yakın; kendi içeriğinizden
öğrenemiyor ve konuşma boyunca bağlamı tutamıyor."* Chatfuel dahil tüm
akış-tabanlı (flow builder) araçlar aynı sınırda: müşteri senaryonun dışına
çıktığı an bot kırılıyor.

**Bizde zaten var:** `bot-v1` gerçek bir LLM ajanı — tool calling
(`tools/executor.ts`), tenant başına bilgi tabanı
(`tenantKnowledge.service.ts`), sektör profili, kalıcı lead hafızası
(`leadMemory.service.ts`), kritik güvenlik korumaları
(`critical-guardrails.ts`). Rakiplerin 29 $'lık eklentisinin yapamadığı şey
bizim çekirdeğimiz.

### 1.2 Kimlik dağınıklığı — sektörün en büyük acısı

Saha araştırmasının birebir ifadesi: *"Mesajlar birden çok platformdan
geliyor — WhatsApp, Instagram DM'leri, müşterilerin berberin kişisel
numarasına yazması — bilgi her yere dağılıyor ve randevular kayboluyor."*

Hiçbir rakip aynı müşteriyi iki kanalda tek kişi olarak görmüyor. Instagram'dan
yazan Ayşe ile WhatsApp'tan yazan Ayşe iki ayrı kayıt.

**Bizim çözümümüz:** `contact_ref` / `customer_phone` ayrımı + telefon
eşleştiğinde otomatik CRM birleştirme (§5.3). İşletme tek müşteri görür,
geçmiş birleşir.

### 1.3 Takvim ile sohbet arasındaki boşluk

*"Randevu yazılımı takvimi yönetiyor ama mesajlara cevap vermiyor; randevuya
giden konuşmayı kimse yönetmiyor."* Setmore/Calendly tarafı sohbet bilmiyor,
ManyChat tarafı takvim bilmiyor. İkisini birbirine Zapier ile bağlamak
müşterinin işi oluyor.

**Bizde zaten var:** `booking.service.ts` + `reserveAppointment` aracı,
çakışma kontrolü, personel bazlı müsaitlik, paket/seans takibi. Sohbet ve
takvim tek üründe.

### 1.4 WhatsApp'ta gerçek ekip gelen kutusu yok

ManyChat'te *"birden fazla temsilcinin WhatsApp konuşmalarını görüp
yanıtlayabileceği düzgün bir ekip gelen kutusu yok, sadece basit bir canlı
sohbet devralma"* var.

**Bizde zaten var:** `automation_mode` Postgres'te tek doğruluk kaynağı,
iyimser kilitleme ile atomik devralma (`conversations.version`), personel
ataması (`assigned_membership_id`), devralma özeti
(`handoffPolicy.service.ts`).

### 1.5 Kurulum sürtünmesi

İstisnasız hepsi işi işletme sahibine yıkıyor: hesap aç, Facebook sayfası
bağla, WABA oluştur, numara doğrula, webhook ayarla. Küçük esnaf bunu yapmıyor
— satış burada ölüyor.

**Bizim farkımız:** WhatsApp'ta sahibin eforu **sıfır** (ortak numara),
Instagram'da **1 tık**. Ice breakers, persistent menu, webhook aboneliği
OAuth callback'inde otomatik kuruluyor (§8).

### 1.6 Bonus: çözülmemiş teknik borç

Instagram bot geliştirici topluluğunda hâlâ açık bir başlık var: *"Instagram
botlarında yinelenen mesaj teslimatını çözen oldu mu?"* Instagram aynı mesajı
webhook'a 2-3 kez teslim ediyor ve botlar aynı cevabı tekrar tekrar
gönderiyor.

**Bizde zaten çözülmüş:** üç katmanlı idempotency — Inngest event id
(`whatsapp-inbound-<messageId>`), Redis claim
(`claimWebhookMessageId`, sahiplik token'lı), ve DB seviyesinde
`insertInboundMessageIdempotent`. Rakiplerin çözemediği problem bizde altyapı
kararı olarak halledilmiş durumda.

---

## 2. Meta'nın sert kuralları (doğrulanmış)

Bunlar pazarlık edilemez; ürün tasarımı bunlara uymak zorunda.

### 2.1 ⚠️ Randevu hatırlatma etiketi öldü

**27 Nisan 2026 itibarıyla `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE` ve
`POST_PURCHASE_UPDATE` etiketleri hata 100 döndürüyor.**

`CONFIRMED_EVENT_UPDATE` tam olarak randevu hatırlatma etiketiydi. Instagram'da
24 saatlik pencere dışında randevu hatırlatması göndermenin **standart yolu
artık yok.** Geçiş yolu olarak Utility Templates / Marketing Messages API
gösteriliyor, ama bunlar ayrı onay ve opt-in gerektiriyor.

**Sonuç:** Bu, "telefonu randevu anında iste" kararını bir tercih olmaktan
çıkarıp **zorunluluk** yapıyor. Instagram'dan randevu alan müşteriye
hatırlatma göndermenin tek güvenilir yolu telefonunu alıp WhatsApp/SMS'e
düşmek. Karar doğruydu; artık gerekçesi daha da güçlü.

### 2.2 HUMAN_AGENT etiketi: sadece gerçek insan

7 günlük uzatma sağlayan `HUMAN_AGENT` etiketi **yalnızca gerçek bir insan
temsilci** tarafından kullanılabilir. *"Meta otomatik mesajlarda bu etiketin
kullanımını açıkça yasaklıyor ve sistemleri kötüye kullanımı tespit etmek
üzere tasarlanmış."* Sadece destek amaçlı — promosyon yasak.

**Bizim için mükemmel oturuyor:** Panelde personel konuşmayı devraldığında
(`automation_mode = HUMAN_ACTIVE`) `HUMAN_AGENT` kullanılabilir. Bot
yanıtlarken **asla**. Bu ayrım kodda zorunlu kılınacak — `sendText()` etiketi
kendi başına seçemeyecek, `senderType` parametresinden türetecek.

ManyChat topluluğunda bu etiket yüzünden alınan hatalar açık başlık; çoğu
rakip bu ayrımı yanlış yapıyor. Biz mimari olarak yanlış yapamayacak şekilde
kuracağız.

### 2.3 Diğer doğrulanmış sınırlar

| Konu | Sınır | Kaynak durumu |
|---|---|---|
| Quick replies | **13 adet**, başlık **20 karakter** | Meta dokümanı ✔ |
| Özel yanıt (yorum→DM) | Yorumdan sonra **7 gün**, yorum başına **1 mesaj** | Meta dokümanı ✔ |
| Özel yanıt hızı | **750/saat** | Üçüncü taraf |
| API çağrı hızı | 100/sn metin, 10/sn ses-video | Üçüncü taraf |
| Otomatik mesaj | **200/saat/hesap** (?) | ⚠️ Çelişkili — Faz 0'da canlı doğrulanacak |
| Medya URL ömrü | Kısa (7 güne kadar) | Hemen indirilmeli |
| Pencere | 24 saat, şablonsuz | Meta dokümanı ✔ |
| Platform ücreti | **0 $** (WhatsApp mesaj başına ücretli) | ✔ |

⚠️ "200 otomatik mesaj/saat/hesap" rakamı ile "100 çağrı/sn" birbiriyle
çelişiyor ve resmî hız limiti sayfası 404 veriyor. Faz 0'da kendi test
hesabımızla canlı ölçülecek — yoğun bir kuaför için 200/saat gerçekse bu
gerçek bir kapasite sınırı.

### 2.4 Instagram ücretsiz — iş modeli avantajı

Instagram Messaging API platform ücreti **0 $**. WhatsApp ise 1 Temmuz
2025'ten beri mesaj başına faturalandırılıyor (24 saatlik hizmet penceresi
içindeki yanıtlar ücretsiz, şablonlar ücretli).

Yani Instagram konuşmalarının bize maliyeti **sadece LLM token'ı.** Bu,
fiyatlandırmada rakiplerden ayrışma alanı: kişi-başı ücretlendirme yapan
ManyChat modelinin (Mart 2026'da ücretsiz plan 1000→25 kişiye düştü, en büyük
şikâyet konusu) tam tersi bir konumlanma mümkün.

### 2.5 Kimlik doğrulama yolu: gerçek bir ödünleşim

| | Instagram Login | Facebook Login for Business |
|---|---|---|
| Facebook sayfası | **Gerekmiyor** | Gerekli (IG hesabı sayfaya bağlı olmalı) |
| Sahibin sürtünmesi | **Düşük** | Yüksek |
| DM + webhook | ✔ | ✔ |
| Yorum yönetimi | ✘ | ✔ |
| Yorum→DM otomasyonu | **Yapılamaz** | Yapılabilir |

Sürtünme hedefimiz Instagram Login'i, yorum→DM özelliği Facebook Login'i
işaret ediyor. **Önerim:** V1'de Instagram Login (minimum sürtünme, çekirdek
DM otomasyonu), `tenant_channel_accounts.auth_method` alanında yol saklanır,
yorum→DM isteyen işletme için Facebook Login yükseltmesi sonradan eklenir.
Adapter tasarımı iki yolu da taşıyacak şekilde kurulur; bu bir yeniden yazım
gerektirmeyecek.

### 2.6 Handover Protocol — atlanırsa sessiz arıza

`standby` webhook olayı, IG hesabında **başka bir uygulama kontrolü elinde
tuttuğunda** geliyor. İşletme daha önce ManyChat vb. bağladıysa mesajlar bize
`standby` olarak düşer, `messages` olarak değil — bot sessizce ölür ve kimse
sebebini anlamaz.

Bağlantı anında kontrol edilecek, çakışma varsa sahibine anlaşılır Türkçe
uyarı verilecek: *"Instagram hesabınızda başka bir otomasyon uygulaması var.
Ahi AI'ın mesajları yanıtlayabilmesi için birincil uygulama olarak
seçilmeli."*

---

# BÖLÜM II — TASARIM

## 3. Kanal soyutlaması

### 3.1 Sorun

`src/lib/bot-v1/whatsapp-worker.ts` (1073 satır) iki işi birden yapıyor:

- **Kanal-özel:** medya indirme, Meta gönderimi, echo tespiti, şablon kurtarma
- **Kanal-bağımsız:** kilit, claim, kill switch, rate limit, tenant yönlendirme,
  oturum, konuşma kaydı, AI çağrısı, lead memory, audit

İkisi ayrılmazsa Instagram için 1000 satırlık ikinci bir kopya doğar ve iki
kanal birbirinden bağımsız çürür.

### 3.2 Yapı

```
src/lib/channels/
  types.ts                 # ChannelAdapter, NormalizedInbound, EntryPoint
  registry.ts              # channel -> adapter
  whatsapp/adapter.ts      # mevcut whatsapp.ts sarmalayıcısı
  instagram/adapter.ts
  instagram/client.ts      # Graph API
  instagram/oauth.ts       # bağlantı akışı
  instagram/setup.ts       # ice breakers + persistent menu otomatik kurulum

src/lib/bot-v1/inbound-pipeline.ts   # bugünkü worker'ın kanal-bağımsız gövdesi
```

```ts
interface ChannelAdapter {
  channel: ChannelKind;
  parseWebhook(body: unknown): NormalizedInbound[];
  resolveTenant(i: NormalizedInbound): Promise<TenantResolution>;
  materializeText(i: NormalizedInbound): Promise<TextResult>;   // ses/görsel dahil
  sendText(p: SendTextParams): Promise<SendResult>;
  sendChoices?(p: SendChoicesParams): Promise<SendResult>;
  recoverOutsideWindow?(p: RecoverParams): Promise<SendResult>; // WA şablon; IG'de yok
  capabilities: ChannelCapabilities;
}

interface ChannelCapabilities {
  windowHours: 24;
  outsideWindowStrategy: "template" | "none";   // WA "template", IG "none"
  humanAgentExtensionDays: number | null;       // WA null, IG 7 (yalnız insan)
  maxChoices: number;                            // WA 10, IG 13
  maxChoiceLabelLength: number;                  // WA 24, IG 20
  maxTextLength: number;                         // WA 4096, IG 1000
  supportsRichIdentity: boolean;                 // IG @handle + isim
}
```

**Kritik kural:** `sendText()` mesaj etiketini kendi başına seçemez;
`senderType: "AI" | "HUMAN"` parametresinden türetir. Bot `HUMAN_AGENT`
kullanamaz — mimari olarak imkânsız (§2.2).

`processWhatsAppInboundEvent()` içindeki akış birebir korunarak
`inbound-pipeline.ts`'e taşınır. **Doğruluk ölçütü:** mevcut test paketi
değiştirilmeden yeşil kalmalı.

### 3.3 Giriş noktaları (entry points)

Araştırmadan çıkan doğru çerçeve: *"Ice breakers, quick replies, yorum
tetikli özel yanıtlar ve payload tıklamaları, tek bir konuşmaya açılan farklı
kapılar olarak ele alınmalı."*

Instagram'da konuşma DM'den önce başlıyor. Tek tip `EntryPoint` modeli:

| Giriş | Webhook | Bota giden bağlam |
|---|---|---|
| Doğrudan DM | `messages` | — |
| Hikaye yanıtı | `messages.reply_to.story` | "hikayenden yazdı" |
| Hikaye bahsi | `messages` (mention) | "hikayesinde etiketledi" |
| Ice breaker | `messaging_postbacks` | seçilen niyet |
| Quick reply | `messages.quick_reply.payload` | seçim |
| ig.me referans | `messaging_referral` | QR/kampanya kaynağı |
| Yorum→DM (V2) | `comments` + private reply | yorum metni |

Hepsi `conversations.metadata.entry_point` olarak kaydedilir — hem prompt
bağlamı hem de panelde "bu müşteri nereden geldi" analitiği.

## 4. Kimlik modeli

| Kavram | Anlamı | WhatsApp | Instagram |
|---|---|---|---|
| `contact_ref` | **Konuşma kimliği** (opak) | telefon rakamları (bugünkü değer) | `ig:<IGSID>` |
| `customer_phone` | **Ticari kimlik** (gerçek E.164) | aynı telefon | randevu anında sorulur |

623 referansı ikiye böler:

- **Konuşma katmanı → `contact_ref`** (~15-20 dosya): Redis oturum anahtarı,
  `lead_memory`, `conversation_messages`, `bot_message_audit`, rate limit,
  `conversations.external_user_id`, `phone_tenant_mappings`
- **Ticari katman → `customer_phone` kalır** (dokunulmaz): `appointments`,
  `crm_customers`, `revenue_events`, `customer_packages`, `waitlist`,
  `customer_blacklist`, kampanyalar

WhatsApp'ta ikisi aynı değeri taşır → **mevcut veri ve davranış hiç değişmez.**

> `sessionKey()` (`src/lib/redis.ts:259`) bugün `normalizePhoneDigits()`
> uyguluyor. IGSID tamamen rakam olduğu için kazara çalışır ama bu tesadüfi;
> `contact_ref` için ayrı, kanal-farkında normalizasyon yazılacak.

## 5. Veri modeli

### `046_multichannel_core.sql`

```sql
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_channel_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_channel_check
  CHECK (channel IN ('whatsapp', 'instagram'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel_handle TEXT,
  ADD COLUMN IF NOT EXISTS channel_display_name TEXT,
  ADD COLUMN IF NOT EXISTS channel_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS entry_point TEXT;

CREATE TABLE IF NOT EXISTS tenant_channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  external_account_id TEXT NOT NULL,
  account_handle TEXT,
  auth_method TEXT CHECK (auth_method IN ('instagram_login', 'facebook_login')),
  access_token_encrypted TEXT,          -- AES-256-GCM, CHANNEL_TOKEN_KEY
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disconnected','token_expired','revoked','needs_control')),
  connected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, external_account_id),   -- webhook -> tenant deterministik
  UNIQUE (tenant_id, channel)
);
```

`UNIQUE (channel, external_account_id)` webhook'tan tenant çözümünün tek
kaynağıdır — tahmin yok. `status='needs_control'` handover protocol çakışması
içindir (§2.6).

### `047_multichannel_contact_ref.sql`

`lead_memory`, `conversation_messages`, `bot_message_audit` tablolarına
`contact_ref TEXT` eklenir; `customer_phone` değeriyle backfill edilir
(WhatsApp'ta ikisi eşit → kayıpsız). Unique kısıtlar `contact_ref`'e taşınır.

**Token şifreleme:** `access_token_encrypted` düz metin saklanmaz. Ayrı bir
`CHANNEL_TOKEN_KEY` ile AES-256-GCM. Bu bir müşteri kimlik bilgisi — sızıntısı
işletmenin tüm DM'lerine erişim demek. Loglara, Sentry'ye, hata mesajlarına
asla yazılmaz.

## 6. Instagram entegrasyonu

### 6.1 Webhook — `src/app/api/webhook/instagram/route.ts`

İmza doğrulama (`x-hub-signature-256`) ve Inngest kuyruk deseni WhatsApp ile
aynı — `webhookVerify.middleware.ts` yeniden kullanılır.

`object === "instagram"`, `entry[].messaging[]`.
`sender.id` = IGSID, `recipient.id` = işletme hesabı → `tenant_channel_accounts`.

| Olay | Davranış |
|---|---|
| `messages` (metin) | Normal akış |
| `messages` (ek: görsel/ses) | Vision/STT — CDN URL'den, **hemen indirilir** |
| `messages.is_echo` | **Sahibi IG uygulamasından yazdı** → insan devralma sinyali, AI susar |
| `messages.reply_to.story` | Hikaye yanıtı → prompt bağlamı |
| `messages.quick_reply` | Seçim |
| `messaging_postbacks` | Ice breaker / menü tıklaması |
| `messaging_seen` | Okundu bilgisi |
| `messaging_referral` | ig.me kaynak etiketi |
| `message_reactions` | Panelde gösterilir, bota gitmez |
| `standby` | **Kontrol bizde değil** → ops alert, sessiz ölme yok |

`is_echo` özellikle önemli: sahibi telefonundan IG'ye cevap yazdığında bot
araya girmemeli. WhatsApp'ta ortak numara olduğu için bu hiç yaşanmıyor;
Instagram'da normal davranış olacak. Echo geldiğinde konuşma otomatik
`HUMAN_ACTIVE`'e geçer ve panelde "sahibi Instagram'dan yanıtladı" görünür.

### 6.2 Gönderim

```
POST https://graph.instagram.com/v23.0/<ig_account_id>/messages
```

- Metin 1000 karakter → uzun cevaplar cümle sınırından bölünür
- Quick replies ≤13, başlık ≤20 karakter (WA interactive list karşılığı)
- **Şablon yok.** Pencere kapandıysa gönderim yolu yok (§2.1)
- `HUMAN_AGENT` yalnız `senderType === "HUMAN"` iken (§2.2)

### 6.3 Hatırlatma / takip akışları

Cron akışları (`reminders`, `followups`, `no-show`, `review-reminder`,
`lead-followup`) kanal-farkında hale gelir:

1. Konuşma WhatsApp ise → bugünkü davranış
2. Instagram + `contact_phone` var → **WhatsApp/SMS'e düş**
3. Instagram + telefon yok + pencere açık → IG'den gönder
4. Instagram + telefon yok + pencere kapalı → **gönderme**, panelde
   "bu müşteriye ulaşılamıyor" rozeti + ops alert

4. madde kritik: sessizce başarısız olmak yasak. İşletme hatırlatmanın
gitmediğini bilmeli.

## 7. Bot davranışı: Instagram'a optimizasyon

Aynı yetenekler, farklı ton ve mekanik. `promptBuilder.service.ts` ve
`prompt-rules.ts`'e sektör profiline benzer **kanal profili** eklenir.

| Konu | WhatsApp | Instagram |
|---|---|---|
| Ton | Nazik, işlek | Daha kısa, samimi, emoji toleransı yüksek |
| Seçim sunma | Interactive list (10) | Quick replies (13 × 20 karakter) |
| Uzunluk | 4096 | ≤1000, cümleden bölerek |
| Telefon | Zaten var | Randevu kesinleşirken |
| Açılış | Selam → hizmet | Hikaye/gönderi bağlamı varsa oradan |

### 7.1 Telefon köprüsü (kritik akış)

IG konuşmalarında `reserveAppointment` aracı telefon olmadan çağrılamaz.
Araç şeması (`tools/tool-schemas.ts`) IG'de telefonu zorunlu alan yapar; bot
randevu kesinleşmeden hemen önce sorar:

> "Randevunu kesinleştiriyorum. Hatırlatma gönderebilmem için telefon
> numaranı alabilir miyim?"

Gerekçe müşteriye de dürüst: Instagram'da hatırlatma gönderilemiyor (§2.1).

### 7.2 Kanallar arası müşteri birleştirme

Telefon alındığında `crm_customers` içinde eşleşme aranır. Bulunursa
Instagram konuşması **mevcut müşteriye bağlanır** — geçmiş randevular,
paketler, notlar birleşir. İşletme tek müşteri görür.

Bu, §1.2'deki sektörel acının doğrudan çözümü ve hiçbir rakipte yok.

### 7.3 Otomatik kurulan varlıklar

OAuth callback'inde API ile set edilir, sahibi hiçbir şey yapmaz:
- **Ice breakers:** "Randevu almak istiyorum" · "Fiyatlar" · "Çalışma saatleri" · "Konum"
- **Persistent menu:** Randevu al · Randevumu iptal et · Yetkiliye bağlan

Ice breaker metinleri tenant'ın sektör profilinden üretilir (kuaför ile oto
yıkama farklı görür).

## 8. Panel: birleşik gelen kutusu

`src/app/dashboard/[tenantId]/inbox/InboxContent.tsx`:

- Konuşma satırında **kanal rozeti** (WhatsApp yeşil / Instagram gradient)
- Kanal filtresi: Tümü · WhatsApp · Instagram
- IG'de telefon yerine `@handle` + görünen ad + avatar
- Devralma/asistana bırakma/çözüldü akışları **aynı** (kanal-bağımsız)
- **Pencere sayacı:** IG konuşmalarında "yanıt penceresi 4s 12dk sonra
  kapanıyor" — kapandıktan sonra yazma alanı kilitli ve sebebi yazıyor
- Echo mesajları "Siz (Instagram)" olarak görünür
- Giriş noktası rozeti: "hikayeden geldi", "ice breaker"

Admin panelde (`src/app/admin/(dashboard)/conversations`) kanal kolonu +
`tenant_channel_accounts` sağlık görünümü.

## 9. Kurulum akışı

### Admin (siz)

1. "İşletme ekle": ad, sektör, telefon
   (mevcut `POST /api/admin/tenants/quick` zaten tenant kodu, kullanıcı adı,
   geçici şifre üretiyor)
2. Sistem "Instagram'ı bağla" linkini üretir
   (`magic_links`, `purpose='instagram_connect'` — altyapı
   `supabase/migrations/028_magic_links.sql` ile mevcut)
3. Link WhatsApp/SMS ile sahibine gider

### İşletme sahibi

1. Linke tıklar → tek sayfa, tek buton
2. Meta OAuth → "İzin Ver"
3. Callback otomatik: token alınır + şifrelenir, hesap kimliği/@handle çekilir,
   webhook abone edilir, ice breakers + persistent menu kurulur, handover
   kontrolü yapılır
4. "Hazır! Instagram mesajlarınız artık yanıtlanıyor" + panel giriş bilgileri

**Sahibin toplam eforu: 1 tık + 1 onay.** WhatsApp'ta sıfır.

### Ön koşul kontrolü

Bağlan sayfası önce kontrol eder ve anlaşılır Türkçe hata verir:
- IG hesabı Professional (Business/Creator) mı?
- IG uygulamasında "Mesajlara erişime izin ver" açık mı?
- Başka otomasyon uygulaması kontrolü elinde mi? (§2.6)

### Bağlantı sağlığı

Token 60 günlük. **Yenileme cron'u** (`/api/cron/channel-token-refresh`) +
düşerse `status='token_expired'` + panel uyarı bandı + ops alert.

Sessiz bozulma en büyük risk: işletme DM aldığını sanır, bot ölüdür.
Günlük sağlık kontrolü her bağlı hesabı doğrular.

---

# BÖLÜM III — YÜRÜTME

## 10. Faz planı

| Faz | İş | Bağımlılık | Risk |
|---|---|---|---|
| **0** | Meta App Review + Business Verification + hız limiti canlı ölçümü | — | Süre 1-3 hafta, **paralel** |
| **1** | Kanal soyutlaması refactor (WA davranışı birebir) | — | **En yüksek — regresyon** |
| **2** | Migration 046/047 + token şifreleme | 1 | Orta |
| **3** | Instagram webhook + adapter + gönderim | 1,2 | Orta |
| **4** | Telefon köprüsü + CRM birleştirme + IG prompt profili | 3 | Orta |
| **5** | Panel birleşik inbox + pencere sayacı | 3 | Düşük |
| **6** | Tek tıklık kurulum (OAuth + otomatik ayar + ön koşul kontrolü) | 2,3 | Orta |
| **7** | Sertleştirme: token cron, echo, standby, hatırlatma yönlendirme, retention | hepsi | Düşük |

Faz 0 hemen başlamalı ve hiçbir şeyi bloklamıyor — kod tarafı App Review
beklerken bitiyor, geliştirme kendi hesabımızla yapılabiliyor.

Faz 1 tek başına dikkat ister: canlı WhatsApp trafiği varken çalışan sistem
yeniden şekilleniyor. Feature flag arkasında, mevcut test paketi değişmeden
yeşil kalarak.

## 11. "Kusursuz" ne demek — ölçütler

Her faz bu ölçütlerle kapanır; öznel değil.

**Doğruluk**
- Mevcut test paketi (`npm run test:run`) değiştirilmeden yeşil
- Aynı mesaj 3 kez teslim edilince tek cevap gider (IG duplicate senaryosu testi)
- Bot hiçbir koşulda `HUMAN_AGENT` etiketi göndermez (birim testi)
- Pencere kapalıyken IG'ye gönderim denenmez, hatırlatma WA/SMS'e düşer

**Görünürlük**
- Hiçbir arıza sessiz değil: token düşmesi, standby, pencere kapanması,
  ulaşılamayan hatırlatma — hepsi panelde + ops alert
- Her konuşmanın giriş noktası kayıtlı

**Sürtünme**
- Sahibin Instagram eforu ≤ 1 tık; WhatsApp eforu = 0
- Ön koşul hataları Türkçe ve eyleme dönüştürülebilir

**Gizlilik**
- Token'lar şifreli; log/Sentry/hata mesajlarında görünmüyor
- Medya mevcut retention politikasına uyuyor

**Deneyim**
- IG cevapları 1000 karakteri aşmıyor, cümleden bölünüyor
- Aynı müşteri iki kanalda tek CRM kaydı

## 12. Riskler

| Risk | Karşılık |
|---|---|
| WhatsApp akışında regresyon | Faz 1'de testler değişmez; feature flag; adapter WA'yı birebir sarmalar |
| App Review reddi | Erken başla; net gerekçe; ret halinde IG kodu hazır bekler |
| IG token sessizce düşer | Yenileme cron + status + panel bandı + ops alert |
| Pencere dışı ulaşılamama | Telefon varsa WA/SMS; yoksa panelde açıkça göster |
| Başka uygulama kontrolü elinde | `standby` yakalanır, bağlantıda kontrol edilir |
| Müşteri hiç telefon vermez | CRM'e girmez, "telefonsuz lead" olarak `conversations`'ta kalır |
| 200 mesaj/saat sınırı gerçekse | Faz 0'da ölçülür; gerekirse kuyruk + öncelik sırası |
| **Ortak WA numarası tavanı** | ⚠️ Aşağıda |

### ⚠️ Ortak WhatsApp numarasının stratejik tavanı

Karar gereği ortak numara korunuyor (doğru karar — sıfır sürtünmenin kaynağı),
ama iki yapısal sınırı bilinmeli:

1. **Throughput tavanı:** Meta'nın mesajlaşma limitleri numara başına
   (günlük benzersiz müşteri: 1K → 10K → 100K → sınırsız). Tüm tenant trafiği
   tek numaradan aktığı için tavan ortak.
2. **Kalite ortak riski:** Tek bir tenant'ın şikâyet alması numaranın kalite
   puanını düşürür — **tüm işletmeler etkilenir.**

Instagram'da bu sorun yok (her işletme kendi hesabı). Öneri: tavanı şimdi
ölçmeye başlayalım (günlük benzersiz alıcı + kalite puanı metriği panelde),
ve `tenant_channel_accounts` şeması WhatsApp'ı da taşıdığı için ileride
isteyen işletme kendi numarasına geçebilsin. Bugün bir şey değiştirmiyoruz,
sadece kapıyı açık ve ölçülü tutuyoruz.

## 13. Kapsam dışı (bilinçli, V2)

- Yorum→DM otomasyonu (Facebook Login yükseltmesi gerekir — §2.5)
- Facebook Messenger kanalı (aynı adapter ile kolay)
- Marketing Messages API ile opt-in'li IG hatırlatma
- Tenant başına birden fazla IG hesabı
- WhatsApp'ın işletme başına numaraya geçişi (kapı açık)

---

## Kaynaklar

- [Meta — Instagram Messaging Webhooks](https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/)
- [Meta — Instagram Quick Replies](https://developers.facebook.com/docs/messenger-platform/instagram/features/quick-replies/)
- [Instagram Messaging API 24-Hour Window Policy (2026)](https://www.keyapi.ai/blog/instagram-messaging-api-policy/)
- [Instagram DM Compliance 2026: Meta's Allowed vs Banned](https://creatorflow.so/blog/instagram-dm-compliance-meta-rules/)
- [Instagram API Rate Limits (2026 Developer Guide)](https://instantdm.com/blog/instagram-api-rate-limits-explained-2026-developer-guide)
- [ManyChat Review 2026 — SetSmart](https://setsmart.io/blog/manychat-review)
- [ManyChat Pricing 2026 — Flowgent](https://flowgent.ai/blog/manychat-pricing)
- [Best Interakt alternatives — respond.io](https://respond.io/blog/best-interakt-alternatives)
- [Duplicate Message Deliveries in Instagram Bots — AI Automation Society](https://www.skool.com/ai-automation-society/anyone-solved-duplicate-message-deliveries-in-instagram-bots)
- [Instagram Comment-to-DM Automation — Inrō](https://www.inro.social/blog/instagram-comment-to-dm-automation)
- [Barbershop chatbot — inbox-ia](https://inbox-ia.com/en/blog/chatbot-for-barbershops)
- [WhatsApp Business API Pricing 2026 — respond.io](https://respond.io/blog/whatsapp-business-api-pricing)
- [Instagram API Pricing 2026 — Blotato](https://www.blotato.com/blog/instagram-api-pricing)
- [Instagram Official APIs Reference (April 2026)](https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42)
