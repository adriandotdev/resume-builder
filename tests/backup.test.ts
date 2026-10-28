import { describe, expect, it } from "vitest";
import {
  backupStatus, EMPTY_BACKUP, fingerprint, formatBackedUpAgo, markBackedUp, parseBackup, readBackup, reconcile, writeBackup,
  BACKUP_KEY, REMIND_AFTER_DAYS,
} from "@/lib/backup";

const DAY = 86_400_000;
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe("backup state", () => {
  it("parses garbage as empty", () => {
    expect(parseBackup(null)).toEqual(EMPTY_BACKUP);
    expect(parseBackup("{nope")).toEqual(EMPTY_BACKUP);
    expect(parseBackup("[]")).toEqual(EMPTY_BACKUP);
    expect(parseBackup(JSON.stringify({ lastBackupAt: "x", dirtySince: -5, lastBackupHash: 3 }))).toEqual(EMPTY_BACKUP);
  });

  it("round-trips through storage and survives blocked storage", () => {
    const s = mem();
    const state = markBackedUp("abc", 1000);
    expect(writeBackup(s, state)).toBe(true);
    expect(readBackup(s)).toEqual(state);
    expect(s.getItem(BACKUP_KEY)).toContain("\"version\":1");
    expect(writeBackup(null, state)).toBe(false);
    expect(readBackup(null)).toEqual(EMPTY_BACKUP);
    const full = { getItem: () => null, setItem: () => { throw new Error("full"); } };
    expect(writeBackup(full, state)).toBe(false);
  });

  it("fingerprint changes with content", () => {
    expect(fingerprint("a")).toBe(fingerprint("a"));
    expect(fingerprint("a")).not.toBe(fingerprint("b"));
  });
});

describe("reconcile", () => {
  it("does not nag a new visitor with only the sample", () => {
    expect(reconcile(EMPTY_BACKUP, "h1", true, 5)).toBe(EMPTY_BACKUP);
  });

  it("starts the clock at the first change and keeps it", () => {
    const a = reconcile(EMPTY_BACKUP, "h1", false, 100);
    expect(a.dirtySince).toBe(100);
    expect(reconcile(a, "h2", false, 900)).toBe(a);
  });

  it("after a backup, only different data counts as a change", () => {
    const b = markBackedUp("h1", 50);
    expect(reconcile(b, "h1", false, 60)).toBe(b);
    expect(reconcile(b, "h2", false, 60).dirtySince).toBe(60);
  });

  it("clears the flag when an edit is undone", () => {
    const dirty = { ...markBackedUp("h1", 50), dirtySince: 60 };
    expect(reconcile(dirty, "h1", false, 70).dirtySince).toBeNull();
  });
});

describe("backupStatus", () => {
  it("is none before there is anything to back up, ok once backed up", () => {
    expect(backupStatus(EMPTY_BACKUP, 0)).toBe("none");
    expect(backupStatus(markBackedUp("h", 0), 99 * DAY)).toBe("ok");
  });

  it("is due only when changes are a full interval old", () => {
    const s = { ...EMPTY_BACKUP, dirtySince: 0 };
    expect(backupStatus(s, REMIND_AFTER_DAYS * DAY - 1)).toBe("ok");
    expect(backupStatus(s, REMIND_AFTER_DAYS * DAY)).toBe("due");
  });
});

describe("formatBackedUpAgo", () => {
  it("reads naturally", () => {
    const now = 100 * DAY;
    expect(formatBackedUpAgo(null, now)).toBe("Never backed up");
    expect(formatBackedUpAgo(now - 10_000, now)).toBe("Last backed up just now");
    expect(formatBackedUpAgo(now - 5 * 60_000, now)).toBe("Last backed up 5 min ago");
    expect(formatBackedUpAgo(now - 3 * 3_600_000, now)).toBe("Last backed up 3 hours ago");
    expect(formatBackedUpAgo(now - DAY, now)).toBe("Last backed up 1 day ago");
    expect(formatBackedUpAgo(now - 9 * DAY, now)).toBe("Last backed up 9 days ago");
  });
});
