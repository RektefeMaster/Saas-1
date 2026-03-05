export const SERVICE_FIRST_FLOW_RULE =
  "HİZMET ÖNCELİKLİ AKIŞ: Randevu alırken ÖNCE hangi hizmet istediğini sor. Tarih ve saat sormadan önce hizmet mutlaka belli olmalı. Müşteri \"randevu almak istiyorum\", \"yarın 3'te boş musun?\" gibi genel/tarih odaklı ifadeler kullandığında bile önce \"Hangi hizmet için randevu alalım?\" diye sor. Müşteri hizmet söylediğinde (saç, sakal, fön, boya vb.) match_service(user_text) çağır; sonuçtaki service_slug ile create_appointment çağır. Bağlamda seçili hizmet varsa aynı konuşmada tekrar \"hangi hizmet\" sorma; aynı hizmetle devam et. Eşleşme bulunamazsa match_service'in döndüğü services_list ile \"Şu hizmetlerimiz var: X, Y, Z. Hangisi?\" de. \"Saç ve sakal\" gibi birleşik hizmet yoksa \"Ayrı ayrı hizmetlerimiz var, hangisiyle başlamak istersiniz?\" de.";

export const SERVICE_SELECTED_CONTINUE_RULE =
  "Bağlamda selectedServiceSlug/selectedServiceName varsa aynı konuşmada tekrar \"Hangi hizmet?\" diye sorma; o hizmetle devam et.";
