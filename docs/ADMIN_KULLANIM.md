# Admin Panel Kullanım Kılavuzu

## Hızlı Başlangıç

### ⌘K / Ctrl+K — Komut Paleti
Herhangi bir admin sayfasında **⌘K** (Mac) veya **Ctrl+K** (Windows/Linux) ile komut paletini açın.

- **İşletme ara**: İsim veya tenant kodu yazarak doğrudan detay sayfasına gidin
- **Sayfa ara**: "Kampanyalar", "Araçlar" gibi sayfa adları ile hızlı geçiş

### Quick Add — 60 Saniyede İşletme
1. **İşletmeler** sayfasına gidin
2. Sağ üstteki **Quick Add** (turuncu/cyan) butonuna tıklayın
3. Sadece 3 alan doldurun:
   - İşletme adı
   - İşletme tipi (dropdown)
   - Sahip telefonu (E.164: +905551234567)
4. **Oluştur** → Otomatik tenant kodu, kullanıcı adı ve geçici şifre üretilir

**Dashboard'dan**: "Quick Add" butonu sizi İşletmeler sayfasına götürür ve drawer otomatik açılır.

### Satır İşlemleri (İşletmeler Tablosu)
Her işletme satırında:

| Buton | Açıklama |
|-------|----------|
| **Giriş Yap** | İşletme dashboard'una yeni sekmede geç |
| **+1 Hafta** | Aboneliği 7 gün uzat |
| **+1 Ay** | Aboneliği 30 gün uzat |
| **Limit** (⚡) | Aylık mesaj kotası (0 = varsayılan) |
| **Botu Durdur** (⏻) | WhatsApp botunu durdur (sadece aktif işletmelerde) |
| **Botu Başlat** (⚡) | Botu tekrar başlat (askıda işletmelerde) |
| **Düzenle** | Detay sayfasına git |

### Sistem Sağlığı (Sol Alt)
- **Yeşil nokta**: Sistem sağlıklı
- **Turuncu**: Son 24 saatte Sentry hatası var
- **Gri**: Sistem donduruldu (Kill Switch)
- Tıklayarak **Araçlar** sayfasına gidin

### Kill Switch (Header)
- **Sistemi Dondur**: Tüm WhatsApp botlarını tek tıkla durdur (acil durum)
- **Sistemi Çöz**: Normale dön

## Kısayollar

| Kısayol | İşlev |
|---------|-------|
| ⌘K / Ctrl+K | Komut paleti |
| ESC | Komut paletini / modalleri kapat |

## Özet Kartları (İşletmeler)
- **Toplam**: Kayıtlı işletme sayısı
- **Aktif**: Bot çalışan işletmeler
- **Askıda**: Bot durdurulmuş işletmeler
- **Pasif**: Diğer durumlar

## Filtreleme ve Arama
- **Arama kutusu**: İsim, tenant kodu veya işletme tipi ile bulanık arama
- **Durum filtresi**: Aktif / Pasif / Askıda
- **Sütun sıralama**: Başlıklara tıklayarak sırala
