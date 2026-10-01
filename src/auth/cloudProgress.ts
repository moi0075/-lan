import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadStore,
  newStore,
  parseStore,
  saveStore,
  type Store,
} from "../engine/storage";

export const accountKey = (id: string) => `elan-account-${id}`;
export type SyncStatus =
  "loading" | "saved" | "saving" | "offline" | "conflict";
export interface CloudRow {
  store: Store;
  revision: number;
}
export interface ProgressRepository {
  read(): Promise<CloudRow | null>;
  write(store: Store, revision: number | null): Promise<number>;
}
export class ProgressConflict extends Error {}
export function progressRepository(
  client: SupabaseClient,
  userId: string,
): ProgressRepository {
  return {
    async read() {
      const { data, error } = await client
        .from("learning_accounts")
        .select("store,revision")
        .eq("user_id", userId)
        .abortSignal(AbortSignal.timeout(12000))
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (!Number.isSafeInteger(data.revision) || data.revision < 1)
        throw Error("Invalid revision");
      return {
        store: parseStore(JSON.stringify(data.store)),
        revision: data.revision,
      };
    },
    async write(store, revision) {
      const next = (revision ?? 0) + 1;
      const row = {
        store,
        revision: next,
        updated_at: new Date().toISOString(),
      };
      const query =
        revision === null
          ? client.from("learning_accounts").insert({ ...row, user_id: userId })
          : client
              .from("learning_accounts")
              .update(row)
              .eq("user_id", userId)
              .eq("revision", revision);
      const { data, error } = await query
        .select("revision")
        .abortSignal(AbortSignal.timeout(12000));
      if (error?.code === "23505" || (!error && !data?.length))
        throw new ProgressConflict();
      if (error) throw error;
      return next;
    },
  };
}
interface Metadata {
  revision: number | null;
  base: string;
}
/** A cached account never shares the guest key. Revision checks prevent overwriting another device. */
export class CloudProgress {
  store: Store = newStore();
  status: SyncStatus = "loading";
  private revision: number | null = null;
  private base = "";
  private ready = false;
  private running: Promise<void> | null = null;
  private metadataKey: string;
  constructor(
    public key: string,
    private repository: ProgressRepository,
    private changed: () => void,
  ) {
    this.metadataKey = `${key}-sync`;
  }
  async open(preferCloud = false) {
    this.ready = false;
    this.status = "loading";
    this.changed();
    let cached: string | null;
    try {
      cached = localStorage.getItem(this.key);
    } catch (error) {
      this.status = "offline";
      this.changed();
      throw error;
    }
    let meta: Metadata | null = null;
    try {
      meta = JSON.parse(localStorage.getItem(this.metadataKey) || "null");
    } catch {
      /* Untrusted local metadata. */
    }
    if (
      meta &&
      !(
        typeof meta.base === "string" &&
        (meta.revision === null ||
          (Number.isSafeInteger(meta.revision) && meta.revision > 0))
      )
    )
      meta = null;
    const local = cached ? loadStore(this.key) : { store: newStore() };
    this.store = local.store;
    const validCache = cached && !local.error ? cached : null;
    try {
      const remote = await this.repository.read();
      const pending = !!validCache && (!meta || validCache !== meta.base);
      if (
        !preferCloud &&
        pending &&
        remote &&
        remote.revision !== meta?.revision
      ) {
        this.status = "conflict";
      } else {
        if (preferCloud || !pending) this.store = remote?.store ?? this.store;
        this.revision = remote?.revision ?? null;
        this.base = remote ? JSON.stringify(remote.store) : "";
        this.ready = true;
        this.status = "saved";
        saveStore(this.store, this.key);
        this.persistMetadata();
      }
    } catch {
      this.status = "offline";
    }
    this.changed();
    return this.store;
  }
  update(store: Store) {
    this.store = store;
    saveStore(store, this.key);
    if (this.ready && JSON.stringify(store) !== this.base) {
      this.status = "saving";
      this.changed();
    }
  }
  private persistMetadata() {
    localStorage.setItem(
      this.metadataKey,
      JSON.stringify({ revision: this.revision, base: this.base }),
    );
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.performFlush().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async performFlush() {
    if (!this.ready || this.status === "conflict") return;
    try {
      while (JSON.stringify(this.store) !== this.base) {
        this.status = "saving";
        this.changed();
        const snapshot = this.store;
        this.revision = await this.repository.write(snapshot, this.revision);
        this.base = JSON.stringify(snapshot);
        this.persistMetadata();
      }
      this.status = "saved";
    } catch (error) {
      this.status = error instanceof ProgressConflict ? "conflict" : "offline";
      if (error instanceof ProgressConflict) this.ready = false;
    }
    this.changed();
  }
}
