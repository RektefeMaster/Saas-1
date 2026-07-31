import { describe, expect, it } from "vitest";
import { isMetaSampleWhatsAppInbound } from "../meta-sample-webhook";

describe("isMetaSampleWhatsAppInbound", () => {
  it("Meta Test butonu sabit from numarasını yakalar", () => {
    expect(
      isMetaSampleWhatsAppInbound({ phone: "+16315551181", messageId: "wamid.real" })
    ).toBe(true);
    expect(isMetaSampleWhatsAppInbound({ phone: "16315551181" })).toBe(true);
  });

  it("Meta doküman örnek message id'sini yakalar", () => {
    expect(
      isMetaSampleWhatsAppInbound({
        phone: "+905551234567",
        messageId: "ABGGFlA5Fpa",
      })
    ).toBe(true);
  });

  it("örnek phone_number_id / display phone yakalar", () => {
    expect(
      isMetaSampleWhatsAppInbound({
        phone: "+905551234567",
        phoneNumberId: "123456123",
      })
    ).toBe(true);
    expect(
      isMetaSampleWhatsAppInbound({
        phone: "+905551234567",
        displayPhoneNumber: "16505551111",
      })
    ).toBe(true);
  });

  it("gerçek müşteri mesajını false döner", () => {
    expect(
      isMetaSampleWhatsAppInbound({
        phone: "+905551234567",
        messageId: "wamid.HBgLMTYzMTU1NTExODE",
        phoneNumberId: "987654321098765",
        displayPhoneNumber: "905321112233",
      })
    ).toBe(false);
  });
});
