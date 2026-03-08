/**
 * OpenAI API key testi. Kullanım: node --env-file=.env scripts/test-openai-key.mjs
 */
const key = (process.env.OPENAI_API_KEY ?? "").replace(/\s/g, "").trim();
if (!key || key.length < 20 || !key.startsWith("sk-")) {
  console.error("OPENAI_API_KEY eksik veya geçersiz (.env içinde sk- ile başlamalı)");
  process.exit(1);
}

console.log("OpenAI API test ediliyor...");
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Merhaba, tek kelime cevap ver: tamam" }],
    max_tokens: 10,
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error("Hata:", data.error?.message || res.statusText);
  if (res.status === 401) console.error("API key yanlış veya iptal edilmiş.");
  if (res.status === 429) console.error("Kota / limit aşıldı.");
  process.exit(1);
}

const text = data.choices?.[0]?.message?.content ?? "";
console.log("OpenAI API çalışıyor. Yanıt:", text.trim() || "(boş)");
