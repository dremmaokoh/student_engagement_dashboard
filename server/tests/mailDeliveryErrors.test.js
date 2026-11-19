import { describeMailFailure } from "../src/services/mailDeliveryErrors.js";
import { mailTransportMode } from "../src/services/mailService.js";

describe("mail delivery in the test environment", () => {
  test("test configuration does not inherit external mail transports", () => {
    expect(mailTransportMode()).toBe("none");
  });

  test("describes a missing mail configuration", () => {
    expect(describeMailFailure({ sent: false, reason: "not_configured" })).toBe(
      "Email delivery is not configured on this server.",
    );
  });

  test("describes SMTP failures without exposing raw provider details", () => {
    expect(
      describeMailFailure({ sent: false, reason: "smtp_error", code: "ETIMEDOUT" }),
    ).toMatch(/could not reach the smtp server/i);
    expect(
      describeMailFailure({ sent: false, reason: "smtp_error", code: "EAUTH" }),
    ).toMatch(/smtp login failed/i);
  });

  test("returns no failure description for a successful send", () => {
    expect(describeMailFailure({ sent: true })).toBeNull();
  });
});
