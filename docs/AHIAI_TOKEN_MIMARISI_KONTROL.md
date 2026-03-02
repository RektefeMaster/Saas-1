# Token Cimrisi Ahiai Mimarisi – Derin Kontrol ve Manuel Test Rehberi

## Yapılan Kod Düzeltmesi

- **Config path state summary:** `buildConfigSystemPrompt` kullanan işletmelerde (bot_config’li) bağlam bloğunda “[Durum: …]” özeti yoktu. `PromptBuilderContext`’e `stateSummary` alanı eklendi ve ai.ts’te `buildStateSummary(state)` config path’e de geçirildi. Böylece hem legacy hem config path aynı kayan hafıza davranışına sahip.

---

## 1. Webhook

| Kontrol | Durum |
|--------|--------|
| Yanıtta işletme adı prefix’i kaldırıldı mı? | Evet. Sadece `safeReply` gönderiliyor. |
| Tenant değişiminde “🏪 İŞLETME 🏪” ayracı kaldırıldı mı? | Evet. Blok tamamen kaldırıldı. |
| Boş/geçersiz mesajda processMessage çağrılıyor mu? | Hayır. `if (!rawText)` ile continue; processMessage sadece dolu metinle çağrılıyor. |

---

## 2. Niyet Sınıflandırma ve Model Routing

| Kontrol | Durum |
|--------|--------|
| Deterministic iptal/gecikme’de classification çağrılıyor mu? | Hayır. Önce deterministic intent ile return ediliyor, ek API çağrısı yok. |
| İnsan escalation isteğinde classification çağrılıyor mu? | Hayır. Erken return. |
| openai yokken classifyIntentForRouting | “simple” döner; ana LLM de zaten openai yoksa erken return. |
| Classification hata verirse | catch’te “simple” dönülüyor, ana akış kilitlenmiyor. |
| 429 retry’da model parametresi | callOpenAI retry’da aynı `model` kullanılıyor. |

**Yanlış pozitif:** “İptal etmek istemiyorum” → “iptal” geçtiği için COMPLEX’e gider. Bu nianslı bir ifade; 4o’ya gitmek kabul edilebilir.

---

## 3. Bağlam Sıkıştırma

| Kontrol | Durum |
|--------|--------|
| API’ye giden mesaj sayısı | Son 2 tur (4 mesaj): `recentTurns = chatHistory.slice(-4)`. |
| State summary legacy path | buildSystemContext içinde buildStateSummary(state) ile bağlama ekleniyor. |
| State summary config path | promptContext.stateSummary = buildStateSummary(state) ile buildContextBlock’ta kullanılıyor. |
| step === "tenant_bulundu" | Sadece welcome dönülüyor; buildStateSummary’e bu step ile girilmiyor (main path’te state hâlâ tenant_bulundu ile set edilmiş olabilir ama bir sonraki mesajda step tarih_saat_bekleniyor’a geçmiş olur). |
| Session’da chat_history | Hâlâ trimChatHistory ile son 20 mesaj saklanıyor; sadece API’ye giden kısım 2 tur. |

---

## 4. Session ve message_count

| Kontrol | Durum |
|--------|--------|
| state yokken setSession + fall-through | Önce message_count: 1, chat_history: [] ile set ediliyor; aynı istekte state değişkeni null kaldığı için openaiMessages’da chatHistory [] olur, sonunda setSession ile message_count: 1 ve chat_history: [user, assistant] yazılır. Tutarlı. |
| sessionDeleted sonrası | chat_history sadece [incomingMessage, finalReply]; extracted temizleniyor. Sonraki mesajda state summary minimal olur; tasarım böyle. |

---

## 5. XML ve Prompt

| Kontrol | Durum |
|--------|--------|
| Legacy buildSystemPrompt | <rol>, <ton>, <kurallar> blokları var; bağlam wrapContextInXml(systemContext) ile <bağlam> içinde. |
| Config buildSystemPrompt | <rol>, <ton>, <kurallar>, <bağlam> promptBuilder’da üretiliyor. |
| Kısa onay talimatı | Hem legacy (ton) hem config (buildToneInstructions) içinde “randevu/iptal onayında kısa esnaf ağzı” var. |

---

## 6. Eksik / İsteğe Bağlı İyileştirmeler

1. **İlk karşılama mesajında işletme adı:** `getWelcomeMessage(msgs, tenant.name)` ve config’teki `opening_message` hâlâ `{tenant_name}` içerebiliyor. Planda “mesajlarda işletme ismi yazmasın” özellikle yanıt prefix’i için geçti; ilk “Merhaba, X olarak nasıl yardımcı olayım?” tamamen doğal konuşma istiyorsanız, welcome şablonlarını da “Merhaba, nasıl yardımcı olayım?” gibi nötrleştirebilirsiniz (config/DB tarafında).

2. **Prompt caching:** Planda “ileride” deniyor; OpenAI API’de system mesajı için cache_control kullanımı dokümantasyona göre eklenebilir. Şu an kodda yok.

3. **Boş mesaj:** Webhook zaten boş rawText’te processMessage’a girmiyor; ek koruma gerekmiyor.

---

## 7. Manuel Test Önerileri

Aşağıdaki senaryoları gerçek veya test WhatsApp hattıyla deneyebilirsiniz.

1. **Basit (mini):**  
   “Selam” → Kısa karşılama.  
   “Saç kesimi ne kadar?” → get_services çağrılmalı, fiyat dönmeli.  
   “Yarın 15:00’e randevu alabilir miyim?” → check_availability / create_appointment akışı.

2. **Karmaşık (4o):**  
   “Randevumu iptal etmek istiyorum” → get_last_appointment + cancel_appointment.  
   “Her pazartesi 10’da gelsem olur mu?” → create_recurring.  
   “Randevumu yarına erteleyebilir misin?” → reschedule veya iptal + yeni randevu.

3. **Tenant:**  
   İşletme A’nın linki/QR’ı ile açılan sohbet → İlk mesajda tenant A’ya bağlanmalı, yanıtta işletme adı başlığı olmamalı.  
   Aynı numaradan İşletme B linki ile mesaj → B’ye geçmeli, ayraç mesajı (“🏪 …”) gelmemeli.

4. **Bağlam:**  
   “Yarın 14:00 boş mu?” → check_availability.  
   “Tamam 14’e al” → create_appointment (önceki turda gösterilen tarih/saat kullanılmalı).  
   Yanıtlar kısa ve doğal olmalı (“Aldım, yarın 14’te görüşürüz” benzeri).

5. **Hata:**  
   OPENAI_API_KEY yanlış/boş → “Şu an randevu alamıyorum…” benzeri mesaj, crash olmamalı.  
   Classification API hatası → “simple” kullanılmalı, sohbet devam etmeli.

---

## 8. Özet

- **Hata:** Config path’te state summary eksikti; eklendi.
- **Eksik:** Yok (prompt caching planda “ileride”).
- **Fazlalık:** Yok.
- **Tutarlılık:** Legacy ve config path hem state summary hem son 2 tur ile uyumlu.
- **Lint:** Temiz.
- **Build:** Projede `npm run build` çalıştırıldı; tamamlanma süresi ortama göre değişir.

Bu dokümandaki manuel testleri uygulayarak canlı davranışı doğrulayabilirsiniz.
