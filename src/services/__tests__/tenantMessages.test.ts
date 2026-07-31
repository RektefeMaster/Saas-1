import { describe, it, expect } from "vitest";
import {
  resolveTenantMessage,
  type TenantMessageContext,
} from "../tenantMessages.service";

function makeContext(
  overrides: Partial<TenantMessageContext> = {}
): TenantMessageContext {
  return {
    tenantId: "t1",
    tenantName: "Beyaz Diş Kliniği",
    businessTypeMessages: {},
    tenantMessages: {},
    ...overrides,
  };
}

describe("resolveTenantMessage", () => {
  it("tenant şablonu işletme tipi şablonunu ezer", () => {
    const context = makeContext({
      businessTypeMessages: { reminder_24h: "Tip şablonu {time}" },
      tenantMessages: { reminder_24h: "Panel şablonu {time}" },
    });
    expect(
      resolveTenantMessage(context, "reminder_24h", { time: "14:00" }, "fallback")
    ).toBe("Panel şablonu 14:00");
  });

  it("tenant şablonu yoksa işletme tipi şablonuna düşer", () => {
    const context = makeContext({
      businessTypeMessages: { reminder_24h: "Yarın saat {time} randevunuz var." },
    });
    expect(
      resolveTenantMessage(context, "reminder_24h", { time: "09:30" }, "fallback")
    ).toBe("Yarın saat 09:30 randevunuz var.");
  });

  it("hiç şablon yoksa fallback metni doldurulur", () => {
    expect(
      resolveTenantMessage(
        makeContext(),
        "reminder_24h",
        { date: "12.05.2026", time: "10:00" },
        "{date} günü {time} randevunuz var - {tenant_name}"
      )
    ).toBe("12.05.2026 günü 10:00 randevunuz var - Beyaz Diş Kliniği");
  });

  it("boş/whitespace şablon geçersiz sayılır ve bir sonrakine düşer", () => {
    const context = makeContext({
      businessTypeMessages: { reminder_24h: "Tip şablonu" },
      tenantMessages: { reminder_24h: "   " },
    });
    expect(
      resolveTenantMessage(context, "reminder_24h", {}, "fallback")
    ).toBe("Tip şablonu");
  });

  it("string olmayan şablon değeri yok sayılır", () => {
    const context = makeContext({
      tenantMessages: { reminder_24h: 42 },
      businessTypeMessages: { reminder_24h: "Tip şablonu" },
    });
    expect(resolveTenantMessage(context, "reminder_24h", {}, "fallback")).toBe(
      "Tip şablonu"
    );
  });

  it("context yokken fallback çalışır (cron tenant'ı okuyamasa bile mesaj gider)", () => {
    expect(
      resolveTenantMessage(undefined, "reminder_24h", { time: "11:00" }, "Saat {time}")
    ).toBe("Saat 11:00");
  });

  it("{tenant_name} ve {işletme_adınız} otomatik doldurulur", () => {
    const context = makeContext({
      tenantMessages: { review_request: "{işletme_adınız} deneyiminizi puanlayın" },
    });
    expect(resolveTenantMessage(context, "review_request", {}, "fallback")).toBe(
      "Beyaz Diş Kliniği deneyiminizi puanlayın"
    );
  });
});
