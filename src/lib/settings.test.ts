import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  CURRENCY_LABEL,
  DEFAULT_TIME_ZONE,
  DOMAIN_PATTERN,
  buildTimeZoneGroups,
  domainErrorMessage,
  formatDateTime,
  isCurrency,
  isValidDomain,
  isValidTimeZone,
  normalizeDomain,
  organizationErrorMessage,
  organizationFormValues,
  parseDomain,
  parsePhone,
  parseTaxNumber,
  parseVatRate,
  parseWebsite,
  readOrganizationForm,
  safeWebsiteHref,
  supportedTimeZones,
  toAsciiDigits,
  validateOrganizationSettings,
  type OrganizationFormValues,
} from "./settings";

describe("email domains", () => {
  it("accepts lower-case domains the database accepts", () => {
    for (const d of ["example.com", "sub.example.co.uk", "my-company.sa", "a1.io", "ongoing-event.com.sa"]) {
      expect(isValidDomain(d), d).toBe(true);
      expect(DOMAIN_PATTERN.test(d), d).toBe(true);
    }
  });

  it("rejects malformed domains", () => {
    const bad = [
      "", "example", "Example.com", "exa mple.com", "example.c", "example.123", "example..com", ".example.com",
      "example.com.", "http://example.com", "user@example.com", "-bad.com", "bad-.com", "ex_ample.com",
      `${"a".repeat(64)}.com`, `${"abc.".repeat(64)}com`, "مثال.السعودية",
    ];
    for (const d of bad) expect(isValidDomain(d), d).toBe(false);
  });

  it("never accepts what the database CHECK would refuse", () => {
    for (const d of ["a.bc", "x-y.z-w.com", "1.2.co", "a--b.org"]) {
      if (isValidDomain(d)) expect(DOMAIN_PATTERN.test(d), d).toBe(true);
    }
  });

  it("normalises case, spaces, pasted e-mail addresses and URLs", () => {
    expect(normalizeDomain("  EXAMPLE.COM ")).toBe("example.com");
    expect(normalizeDomain("@example.com")).toBe("example.com");
    expect(normalizeDomain("Name@Example.com")).toBe("example.com");
    expect(normalizeDomain("https://www.Example.com/about")).toBe("www.example.com");
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("parses with Arabic messages", () => {
    expect(parseDomain(" Sales.Example.SA ")).toEqual({ ok: true, value: "sales.example.sa" });
    // Public mailbox providers would let anyone join automatically.
    const gmail = parseDomain("Gmail.com");
    expect(gmail.ok).toBe(false);
    if (!gmail.ok) expect(gmail.error).toContain("نطاق بريد عام");
    expect(parseDomain("outlook.com").ok).toBe(false);
    const empty = parseDomain("   ");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/أدخل نطاق البريد/);
    const bad = parseDomain("not a domain");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/صيغة النطاق غير صحيحة/);
  });

  it("explains database refusals", () => {
    expect(domainErrorMessage({ code: "23505", message: "duplicate key" })).toMatch(/مسجَّل مسبقًا/);
    expect(domainErrorMessage({ code: "23514", message: "check" })).toMatch(/صيغة النطاق/);
    expect(domainErrorMessage({ code: "42501", message: "rls" })).toMatch(/صلاحية/);
    expect(domainErrorMessage(null)).toBeUndefined();
  });
});

describe("time zones", () => {
  it("offers the runtime's IANA zones plus UTC, sorted and unique, with Riyadh as the default", () => {
    const zones = supportedTimeZones();
    expect(zones.length).toBeGreaterThan(300);
    expect(zones).toContain(DEFAULT_TIME_ZONE);
    expect(zones).toContain("UTC");
    expect(new Set(zones).size).toBe(zones.length);
    expect([...zones].sort()).toEqual(zones);
  });

  it("validates exact zone names only", () => {
    for (const z of ["Asia/Riyadh", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"]) {
      expect(isValidTimeZone(z), z).toBe(true);
    }
    for (const z of ["", "Mars/Olympus", "asia/riyadh", "Riyadh", "+03:00", "GMT+3", " Asia/Riyadh"]) {
      expect(isValidTimeZone(z), z).toBe(false);
    }
  });

  it("groups the picker with the region first and keeps an unknown current value", () => {
    const at = new Date("2026-11-09T10:00:00Z");
    const groups = buildTimeZoneGroups(supportedTimeZones(), at, "Asia/Riyadh");
    expect(groups[0].label).toBe("الخليج ومصر");
    expect(groups[0].options[0]).toEqual({ value: "Asia/Riyadh", label: "Asia/Riyadh (GMT+03:00)" });
    const values = groups.flatMap((g) => g.options.map((o) => o.value));
    expect(values.length).toBe(supportedTimeZones().length);
    expect(new Set(values).size).toBe(values.length);

    const legacy = buildTimeZoneGroups(["Asia/Riyadh", "UTC"], at, "Etc/GMT-3");
    expect(legacy[0]).toEqual({ label: "القيمة الحالية", options: [{ value: "Etc/GMT-3", label: "Etc/GMT-3 (GMT+03:00)" }] });
  });

  it("explains an unknown time zone refused by the database (22023)", () => {
    expect(organizationErrorMessage({ code: "22023", message: 'time zone "X" not recognized' })).toMatch(/المنطقة الزمنية غير معروفة/);
    expect(organizationErrorMessage({ code: "42501", message: "rls" })).toMatch(/صلاحية/);
    expect(organizationErrorMessage({ code: "23514", message: "check" })).toMatch(/غير مقبولة/);
    expect(organizationErrorMessage({ code: "XX000", message: "boom" })).toBe("boom");
    expect(organizationErrorMessage(undefined)).toBeUndefined();
  });
});

describe("currencies", () => {
  it("lists the ten supported currencies, each with an Arabic name", () => {
    expect([...CURRENCIES]).toEqual(["SAR", "AED", "KWD", "QAR", "BHD", "OMR", "EGP", "USD", "EUR", "GBP"]);
    for (const c of CURRENCIES) expect(CURRENCY_LABEL[c]).toMatch(/[؀-ۿ]/);
  });

  it("recognises only listed codes", () => {
    expect(isCurrency("SAR")).toBe(true);
    expect(isCurrency("GBP")).toBe(true);
    expect(isCurrency("sar")).toBe(false);
    expect(isCurrency("JPY")).toBe(false);
    expect(isCurrency("")).toBe(false);
  });
});

describe("VAT rate", () => {
  it("accepts 0 to 100 with up to two decimals", () => {
    expect(parseVatRate("15")).toEqual({ ok: true, value: 15 });
    expect(parseVatRate("0")).toEqual({ ok: true, value: 0 });
    expect(parseVatRate("100")).toEqual({ ok: true, value: 100 });
    expect(parseVatRate(" 12.75 ")).toEqual({ ok: true, value: 12.75 });
    expect(parseVatRate("5.5")).toEqual({ ok: true, value: 5.5 });
  });

  it("accepts Arabic-Indic digits and decimal separators", () => {
    expect(parseVatRate("١٥")).toEqual({ ok: true, value: 15 });
    expect(parseVatRate("٧٫٥")).toEqual({ ok: true, value: 7.5 });
    expect(parseVatRate("7,5")).toEqual({ ok: true, value: 7.5 });
    expect(toAsciiDigits("٠١٢٣٤٥٦٧٨٩ ۰۹")).toBe("0123456789 09");
  });

  it("rejects values out of range or malformed", () => {
    for (const raw of ["", "-1", "100.01", "101", "150", "abc", "1.234", "1e2", "15%", "Infinity"]) {
      expect(parseVatRate(raw).ok, raw).toBe(false);
    }
  });
});

describe("contact details", () => {
  it("validates tax numbers", () => {
    expect(parseTaxNumber("")).toEqual({ ok: true, value: null });
    expect(parseTaxNumber(" 300000000000003 ")).toEqual({ ok: true, value: "300000000000003" });
    expect(parseTaxNumber("gb 123-456")).toEqual({ ok: true, value: "GB 123-456" });
    expect(parseTaxNumber("٣٠٠١")).toEqual({ ok: true, value: "3001" });
    expect(parseTaxNumber("1".repeat(41)).ok).toBe(false);
    expect(parseTaxNumber("123/456").ok).toBe(false);
  });

  it("validates phone numbers", () => {
    expect(parsePhone("")).toEqual({ ok: true, value: null });
    expect(parsePhone(" +966  11 000 0000 ")).toEqual({ ok: true, value: "+966 11 000 0000" });
    expect(parsePhone("(011) 000-0000")).toEqual({ ok: true, value: "(011) 000-0000" });
    expect(parsePhone("٠٥٠١٢٣٤٥٦٧")).toEqual({ ok: true, value: "0501234567" });
    expect(parsePhone(`+${"1 ".repeat(20)}`).ok).toBe(true); // 20 digits, 40 characters: the limits
    for (const raw of ["123", "call me", "966+11000000", "1".repeat(21), `+${"1 ".repeat(21)}`]) {
      expect(parsePhone(raw).ok, raw).toBe(false);
    }
  });

  it("validates and normalises websites", () => {
    expect(parseWebsite("")).toEqual({ ok: true, value: null });
    expect(parseWebsite("example.com")).toEqual({ ok: true, value: "https://example.com" });
    expect(parseWebsite(" https://www.example.com/about ")).toEqual({ ok: true, value: "https://www.example.com/about" });
    expect(parseWebsite("http://example.sa")).toEqual({ ok: true, value: "http://example.sa" });
    for (const raw of ["not a url", "javascript:alert(1)", "ftp://example.com", "https://localhost", "https://user:pw@example.com", `example.com/${"a".repeat(200)}`]) {
      expect(parseWebsite(raw).ok, raw).toBe(false);
    }
  });

  it("only links stored websites over http(s)", () => {
    expect(safeWebsiteHref("https://example.com")).toBe("https://example.com/");
    expect(safeWebsiteHref("javascript:alert(1)")).toBeNull();
    expect(safeWebsiteHref("not a url")).toBeNull();
    expect(safeWebsiteHref(null)).toBeNull();
  });
});

describe("organisation settings form", () => {
  const valid: OrganizationFormValues = {
    name: "  OnGoing Events  ",
    currency: "aed",
    timezone: "Asia/Dubai",
    default_vat_rate: "5",
    tax_number: "100000000000003",
    address: "  طريق الملك فهد، الرياض ",
    phone: "+971 4 000 0000",
    website: "ongoing.example",
  };

  it("returns a normalised update for valid input, with empty optional fields as null", () => {
    expect(validateOrganizationSettings(valid)).toEqual({
      ok: true,
      value: {
        name: "OnGoing Events",
        currency: "AED",
        timezone: "Asia/Dubai",
        default_vat_rate: 5,
        tax_number: "100000000000003",
        address: "طريق الملك فهد، الرياض",
        phone: "+971 4 000 0000",
        website: "https://ongoing.example",
      },
    });
    const minimal = validateOrganizationSettings({ ...valid, tax_number: "", address: " ", phone: "", website: "" });
    expect(minimal.ok && minimal.value).toMatchObject({ tax_number: null, address: null, phone: null, website: null });
  });

  it("reports every invalid field at once", () => {
    const result = validateOrganizationSettings({
      name: " ",
      currency: "JPY",
      timezone: "Mars/Olympus",
      default_vat_rate: "150",
      tax_number: "#1",
      address: "x".repeat(501),
      phone: "call me",
      website: "javascript:alert(1)",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["address", "currency", "default_vat_rate", "name", "phone", "tax_number", "timezone", "website"],
      );
      expect(result.errors.timezone).toMatch(/منطقة زمنية/);
      expect(result.errors.default_vat_rate).toMatch(/بين 0 و100/);
    }
  });

  it("limits the name to 200 characters, counted like Postgres", () => {
    expect(validateOrganizationSettings({ ...valid, name: "ع".repeat(200) }).ok).toBe(true);
    expect(validateOrganizationSettings({ ...valid, name: "ع".repeat(201) }).ok).toBe(false);
    expect(validateOrganizationSettings({ ...valid, name: "😀".repeat(200) }).ok).toBe(true);
  });

  it("reads form fields as text and round-trips stored values", () => {
    const form = new Map<string, unknown>([["name", "Co"], ["currency", "SAR"], ["phone", { file: true }]]);
    const values = readOrganizationForm((field) => form.get(field));
    expect(values).toEqual({ name: "Co", currency: "SAR", timezone: "", default_vat_rate: "", tax_number: "", address: "", phone: "", website: "" });

    const stored = {
      name: "Co", currency: "SAR", timezone: "Asia/Riyadh", default_vat_rate: 15, tax_number: null,
      address: null, phone: "0110000000", website: "https://co.example",
    };
    const form2 = organizationFormValues(stored);
    expect(form2).toEqual({
      name: "Co", currency: "SAR", timezone: "Asia/Riyadh", default_vat_rate: "15", tax_number: "",
      address: "", phone: "0110000000", website: "https://co.example",
    });
    expect(validateOrganizationSettings(form2)).toEqual({ ok: true, value: stored });
  });
});

describe("formatDateTime", () => {
  it("formats in the organisation's time zone with Latin digits and the Gregorian calendar", () => {
    const riyadh = formatDateTime("2026-11-09T10:00:00Z", "Asia/Riyadh");
    expect(riyadh).toContain("2026");
    expect(riyadh).toContain("1:00");
    expect(formatDateTime("2026-11-09T10:00:00Z", "Asia/Dubai")).toContain("2:00");
  });

  it("falls back to Riyadh for a zone the runtime does not know, and keeps bad input as is", () => {
    expect(formatDateTime("2026-11-09T10:00:00Z", "Not/AZone")).toContain("1:00");
    expect(formatDateTime("yesterday", "Asia/Riyadh")).toBe("yesterday");
  });
});
