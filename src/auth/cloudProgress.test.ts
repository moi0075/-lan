import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountKey,
  CloudProgress,
  ProgressConflict,
  type CloudRow,
  type ProgressRepository,
} from "./cloudProgress";
import {
  GUEST_STORAGE_KEY,
  newStore,
  saveStore,
  startSession,
} from "../engine/storage";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
function repository(row: CloudRow | null = null) {
  const repo: ProgressRepository = {
    read: vi.fn(async () => row),
    write: vi.fn(async (store, revision) => {
      if (revision !== (row?.revision ?? null)) throw new ProgressConflict();
      row = { store, revision: (revision ?? 0) + 1 };
      return row.revision;
    }),
  };
  return repo;
}
describe("account learning persistence", () => {
  it("isolates guests and different accounts", async () => {
    const guest = newStore();
    guest.profiles[0].name = "Guest";
    saveStore(guest);
    const remote = newStore();
    remote.profiles[0].name = "Alice";
    const a = new CloudProgress(
      accountKey("alice"),
      repository({ store: remote, revision: 4 }),
      () => {},
    );
    const b = new CloudProgress(accountKey("bob"), repository(), () => {});
    expect((await a.open()).profiles[0].name).toBe("Alice");
    expect((await b.open()).profiles[0].name).toBe("Explorateur");
    expect(
      JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY)!).profiles[0].name,
    ).toBe("Guest");
  });
  it("restores unsent changes after closing offline and retries without losing progress", async () => {
    const repo = repository();
    const key = accountKey("alice");
    const a = new CloudProgress(key, repo, () => {});
    await a.open();
    const edited = {
      ...a.store,
      profiles: a.store.profiles.map((p) => ({ ...p, name: "Edited offline" })),
    };
    a.update(edited);
    vi.mocked(repo.write).mockRejectedValueOnce(Error("Network"));
    await a.flush();
    expect(a.status).toBe("offline");
    const restored = new CloudProgress(key, repo, () => {});
    expect((await restored.open()).profiles[0].name).toBe("Edited offline");
    await restored.flush();
    expect(restored.status).toBe("saved");
    expect((await repo.read())!.store.profiles[0].name).toBe("Edited offline");
  });
  it("does not overwrite another device when local changes are pending", async () => {
    const initial = newStore();
    const repo = repository({ store: initial, revision: 1 });
    const a = new CloudProgress(accountKey("a"), repo, () => {});
    await a.open();
    a.update({
      ...initial,
      profiles: initial.profiles.map((p) => ({ ...p, name: "Local" })),
    });
    const other = {
      ...initial,
      profiles: initial.profiles.map((p) => ({ ...p, name: "Other device" })),
    };
    await repo.write(other, 1);
    await a.flush();
    expect(a.status).toBe("conflict");
    const restored = new CloudProgress(accountKey("a"), repo, () => {});
    await restored.open();
    expect(restored.status).toBe("conflict");
    expect(restored.store.profiles[0].name).toBe("Local");
    await restored.flush();
    expect((await repo.read())!.store.profiles[0].name).toBe("Other device");
    await restored.open(true);
    expect(restored.store.profiles[0].name).toBe("Other device");
  });
  it("serializes writes and includes an answer received while a write is in flight", async () => {
    const repo = repository();
    const a = new CloudProgress(accountKey("a"), repo, () => {});
    await a.open();
    a.update(a.store);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const original = repo.write;
    repo.write = vi.fn(async (s, rev) => {
      await gate;
      return original(s, rev);
    });
    const flush = a.flush();
    a.update({
      ...a.store,
      profiles: a.store.profiles.map((p) => ({ ...p, name: "Latest" })),
    });
    release();
    await flush;
    expect((await repo.read())!.store.profiles[0].name).toBe("Latest");
    expect(a.status).toBe("saved");
  });
  it("recovers a corrupt cache from the cloud without inventing a conflict", async () => {
    const key = accountKey("corrupt");
    localStorage.setItem(key, "invalid-json");
    const remote = newStore();
    remote.profiles[0].name = "Remote progress";
    const controller = new CloudProgress(
      key,
      repository({ store: remote, revision: 7 }),
      () => {},
    );
    expect((await controller.open()).profiles[0].name).toBe("Remote progress");
    expect(controller.status).toBe("saved");
    expect(localStorage.getItem(`${key}-recovery`)).toBe("invalid-json");
  });
  it("does not confuse legacy migration with pending changes when the cloud has advanced", async () => {
    const key = accountKey("legacy");
    const legacy = newStore();
    legacy.profiles[0].session = startSession(legacy.profiles[0]);
    const snapshot = JSON.parse(JSON.stringify(legacy));
    delete snapshot.profiles[0].session.answeredCount;
    delete snapshot.profiles[0].session.hintIds;
    const raw = JSON.stringify(snapshot);
    localStorage.setItem(key, raw);
    localStorage.setItem(
      `${key}-sync`,
      JSON.stringify({ revision: 4, base: raw }),
    );
    const remote = newStore();
    remote.profiles[0].name = "Updated on another device";
    const controller = new CloudProgress(
      key,
      repository({ store: remote, revision: 5 }),
      () => {},
    );
    expect((await controller.open()).profiles[0].name).toBe(
      "Updated on another device",
    );
    expect(controller.status).toBe("saved");
  });
});
