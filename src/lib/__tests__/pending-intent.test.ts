// @vitest-environment node
/**
 * "Hangi işletme?" sorulurken müşterinin asıl mesajının saklanması.
 *
 * Soru sorulduğu turda tenant belli değildir, dolayısıyla oturum da yoktur.
 * Müşteri listeden seçtiğinde WhatsApp bize yalnızca işletme adını gönderir;
 * bu olmadan "yarın saat 3'e randevu" niyeti kaybolur.
 */
import { describe, it, expect } from "vitest";
import { setPendingIntent, takePendingIntent } from "@/lib/redis";

const PHONE = "+905551112233";

describe("bekleyen niyet", () => {
  it("saklanır ve geri okunur", async () => {
    await setPendingIntent(PHONE, "yarın saat 3'e randevu almak istiyorum");
    expect(await takePendingIntent(PHONE)).toBe(
      "yarın saat 3'e randevu almak istiyorum"
    );
  });

  it("tek kullanımlıktır — ikinci okumada boş döner", async () => {
    await setPendingIntent(PHONE, "kuaför randevusu");
    expect(await takePendingIntent(PHONE)).toBe("kuaför randevusu");
    // Aksi halde sonraki alakasız mesajlara eski niyet karışırdı.
    expect(await takePendingIntent(PHONE)).toBeNull();
  });

  it("hiç saklanmamışsa null döner", async () => {
    expect(await takePendingIntent("+905559998877")).toBeNull();
  });

  it("boş mesaj saklanmaz", async () => {
    await setPendingIntent(PHONE, "   ");
    expect(await takePendingIntent(PHONE)).toBeNull();
  });

  it("aynı numaranın farklı yazımları aynı kaydı görür", async () => {
    await setPendingIntent("+90 555 111 22 33", "randevu");
    expect(await takePendingIntent("905551112233")).toBe("randevu");
  });

  it("farklı müşteriler birbirinin niyetini görmez", async () => {
    await setPendingIntent("+905551112233", "birinci müşteri");
    await setPendingIntent("+905554445566", "ikinci müşteri");

    expect(await takePendingIntent("+905554445566")).toBe("ikinci müşteri");
    expect(await takePendingIntent("+905551112233")).toBe("birinci müşteri");
  });
});
