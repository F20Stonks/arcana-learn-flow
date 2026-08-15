import { describe, it, expect } from "vitest";
import { mayMirror, matchSource, type ResourceSource } from "../../supabase/functions/_shared/licensePolicy";

const SOURCES: ResourceSource[] = [
  {
    name: "OpenStax",
    url_patterns: ["openstax.org", "cnx.org"],
    license_code: "CC-BY-4.0",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "© Rice University, OpenStax. Licensed CC BY 4.0.",
    mirror_allowed: true,
  },
  {
    name: "MIT OpenCourseWare",
    url_patterns: ["ocw.mit.edu"],
    license_code: "CC-BY-NC-SA-4.0",
    license_url: null,
    attribution: "MIT OpenCourseWare.",
    mirror_allowed: false,
  },
  {
    // A registry row that says yes but names a licence we do not recognise as hostable. The stricter
    // of the two answers must win, or a typo in the registry silently authorises hosting.
    name: "Misconfigured",
    url_patterns: ["example-misconfigured.org"],
    license_code: "ARR",
    license_url: null,
    attribution: "Someone.",
    mirror_allowed: true,
  },
];

describe("matchSource", () => {
  it("matches an exact hostname", () => {
    expect(matchSource("https://openstax.org/details/books/calculus-volume-1", SOURCES)?.name).toBe("OpenStax");
  });

  it("matches a subdomain of a registered pattern", () => {
    expect(matchSource("https://assets.openstax.org/x/y.pdf", SOURCES)?.name).toBe("OpenStax");
  });

  it("does not match a lookalike domain", () => {
    // The suffix check must be on a dot boundary, or "notopenstax.org" would pass as OpenStax.
    expect(matchSource("https://notopenstax.org/a.pdf", SOURCES)).toBeNull();
  });

  it("returns null for an unparseable url", () => {
    expect(matchSource("not a url", SOURCES)).toBeNull();
  });
});

describe("mayMirror", () => {
  it("permits hosting a CC BY source", () => {
    const d = mayMirror("https://openstax.org/a.pdf", SOURCES);
    expect(d.allowed).toBe(true);
    expect(d.attribution).toContain("CC BY 4.0");
  });

  it("refuses a NonCommercial source even though it is freely downloadable", () => {
    const d = mayMirror("https://ocw.mit.edu/courses/x/notes.pdf", SOURCES);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("CC-BY-NC-SA-4.0");
  });

  it("refuses an unrecognised domain rather than assuming it is free", () => {
    const d = mayMirror("https://some-university.ac.uk/notes/sheet1.pdf", SOURCES);
    expect(d.allowed).toBe(false);
    expect(d.source).toBeNull();
    expect(d.reason).toContain("all rights reserved");
  });

  it("lets the stricter answer win when the registry contradicts the licence list", () => {
    expect(mayMirror("https://example-misconfigured.org/a.pdf", SOURCES).allowed).toBe(false);
  });

  // If the registry cannot be read, the safe answer is to host nothing — an infrastructure failure
  // must never become an accidental "mirror everything".
  it("refuses everything when the source registry is empty", () => {
    expect(mayMirror("https://openstax.org/a.pdf", []).allowed).toBe(false);
  });
});
