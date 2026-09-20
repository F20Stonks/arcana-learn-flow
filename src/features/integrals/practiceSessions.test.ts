import { beforeEach, describe, expect, it } from "vitest";
import {
  deletePracticeSession,
  getPracticeSessions,
  renamePracticeSession,
  resetPracticeSessions,
  savePracticeSession,
  updatePracticeSession,
} from "./practiceSessions";
import { setProgressScope } from "./progress";

beforeEach(() => {
  setProgressScope(null);
  resetPracticeSessions();
});

describe("saving", () => {
  it("stores a named session with its filter and unsolvedOnly flag", () => {
    const s = savePracticeSession("MIT archive", { sourceKeys: ["MIT Integration Bee::2024::Qualifying Round"] }, false);
    expect(s.name).toBe("MIT archive");
    expect(s.filter.sourceKeys).toEqual(["MIT Integration Bee::2024::Qualifying Round"]);
    expect(s.unsolvedOnly).toBe(false);
    expect(getPracticeSessions()).toHaveLength(1);
  });

  it("gives every session a unique id, even created in the same instant", () => {
    const a = savePracticeSession("A", {}, false);
    const b = savePracticeSession("B", {}, false);
    expect(a.id).not.toBe(b.id);
  });

  it("keeps insertion order", () => {
    savePracticeSession("first", {}, false);
    savePracticeSession("second", {}, false);
    expect(getPracticeSessions().map((s) => s.name)).toEqual(["first", "second"]);
  });
});

describe("deleting and renaming", () => {
  it("removes exactly the named session", () => {
    const a = savePracticeSession("keep", {}, false);
    const b = savePracticeSession("drop", {}, false);
    deletePracticeSession(b.id);
    expect(getPracticeSessions().map((s) => s.id)).toEqual([a.id]);
  });

  it("renames in place without disturbing the filter", () => {
    const s = savePracticeSession("old name", { minDifficulty: 3 }, true);
    renamePracticeSession(s.id, "new name");
    const [got] = getPracticeSessions();
    expect(got.name).toBe("new name");
    expect(got.filter.minDifficulty).toBe(3);
    expect(got.unsolvedOnly).toBe(true);
  });
});

describe("updating", () => {
  it("changes the filter and unsolvedOnly without disturbing id, name or createdAt", () => {
    const s = savePracticeSession("my session", { minDifficulty: 1 }, false);
    updatePracticeSession(s.id, { minDifficulty: 4, sourceKeys: ["MIT::2024::Qualifying Round"] }, true);
    const [got] = getPracticeSessions();
    expect(got.id).toBe(s.id);
    expect(got.name).toBe("my session");
    expect(got.createdAt).toBe(s.createdAt);
    expect(got.filter).toEqual({ minDifficulty: 4, sourceKeys: ["MIT::2024::Qualifying Round"] });
    expect(got.unsolvedOnly).toBe(true);
  });

  it("keeps a stable id — updating is never delete-and-recreate", () => {
    const a = savePracticeSession("A", {}, false);
    const b = savePracticeSession("B", {}, false);
    updatePracticeSession(a.id, { minDifficulty: 2 }, false);
    expect(getPracticeSessions().map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it("is a no-op on an id that doesn't exist", () => {
    savePracticeSession("A", {}, false);
    updatePracticeSession("session:does-not-exist", { minDifficulty: 2 }, false);
    expect(getPracticeSessions()).toHaveLength(1);
  });
});

describe("scoping", () => {
  it("keeps two accounts' saved sessions completely separate", () => {
    setProgressScope("alice");
    savePracticeSession("alice's session", {}, false);
    expect(getPracticeSessions()).toHaveLength(1);

    setProgressScope("bob");
    expect(getPracticeSessions()).toHaveLength(0);
    savePracticeSession("bob's session", {}, false);
    expect(getPracticeSessions()).toHaveLength(1);
    expect(getPracticeSessions()[0].name).toBe("bob's session");

    setProgressScope("alice");
    expect(getPracticeSessions()).toHaveLength(1);
    expect(getPracticeSessions()[0].name).toBe("alice's session");

    setProgressScope(null);
  });

  it("survives storage being unavailable without throwing", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });
    try {
      expect(() => savePracticeSession("x", {}, false)).not.toThrow();
      expect(getPracticeSessions()).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reset", () => {
  it("clears every saved session", () => {
    savePracticeSession("a", {}, false);
    savePracticeSession("b", {}, false);
    expect(getPracticeSessions()).toHaveLength(2);
    resetPracticeSessions();
    expect(getPracticeSessions()).toHaveLength(0);
  });
});
