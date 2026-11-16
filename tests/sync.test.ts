import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RuyeDocument } from "../packages/schema/src/index.ts";
import { CloudError, type CloudApi, type RemoteSummary } from "../apps/web/src/cloud.ts";
import { contentHash, detachedIds, planSync, reattach, runSync, type LocalStore, type SyncState } from "../apps/web/src/sync.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));
const rs = (id: string, version: number, deleted = false): RemoteSummary => ({ id, title: id, alias: null, version, updatedAt: 0, deleted });

test("内容指纹忽略 updatedAt，内容一变就变", () => {
  const a = load("full");
  const b = { ...a, meta: { ...a.meta, updatedAt: "2030-01-01T00:00:00Z" } };
  assert.equal(contentHash(a), contentHash(b));
  const c = structuredClone(a);
  c.meta.title = "改过";
  assert.notEqual(contentHash(a), contentHash(c));
});

test("planSync：三方比较的各种情况", () => {
  const st: SyncState = {
    same: { version: 3, hash: "h" },
    localEdit: { version: 3, hash: "old" },
    remoteEdit: { version: 3, hash: "h" },
    both: { version: 3, hash: "old" },
    deletedHere: { version: 5, hash: "h" },
    deletedHereRemoteChanged: { version: 5, hash: "h" },
    deletedThere: { version: 2, hash: "h" },
    deletedThereEdited: { version: 2, hash: "old" },
    detached: { version: 2, hash: "h", detached: true },
    gone: { version: 1, hash: "h" },
  };
  const local = ["same", "localEdit", "remoteEdit", "both", "deletedThere", "deletedThereEdited", "detached", "newHere", "noRecord"].map((id) => ({ id, hash: "h" }));
  const remote = [
    rs("same", 3), rs("localEdit", 3), rs("remoteEdit", 4), rs("both", 4),
    rs("deletedHere", 5), rs("deletedHereRemoteChanged", 6),
    rs("deletedThere", 3, true), rs("deletedThereEdited", 3, true), rs("detached", 3, true),
    rs("newThere", 1), rs("noRecord", 2), rs("gone", 2, true),
  ];
  const acts = Object.fromEntries(planSync(local, remote, st).map((a) => [a.id, a]));
  assert.equal(acts.same, undefined);
  assert.deepEqual(acts.localEdit, { kind: "push", id: "localEdit", baseVersion: 3 });
  assert.deepEqual(acts.remoteEdit, { kind: "pull", id: "remoteEdit" });
  assert.deepEqual(acts.both, { kind: "conflict", id: "both", remoteVersion: 4 });
  assert.deepEqual(acts.deletedHere, { kind: "delete-remote", id: "deletedHere", baseVersion: 5 });
  // 本机删了，但云端之后又被改过：拉回来，不丢
  assert.deepEqual(acts.deletedHereRemoteChanged, { kind: "pull", id: "deletedHereRemoteChanged" });
  // 云端删了：本机没改过就保留并停止同步；本机改过就重新上传
  assert.deepEqual(acts.deletedThere, { kind: "detach", id: "deletedThere" });
  assert.deepEqual(acts.deletedThereEdited, { kind: "push", id: "deletedThereEdited", baseVersion: null });
  assert.equal(acts.detached, undefined);
  assert.deepEqual(acts.newHere, { kind: "push", id: "newHere", baseVersion: null });
  assert.deepEqual(acts.newThere, { kind: "pull", id: "newThere" });
  // 两边都有却没有同步记录：当作冲突，两份都留
  assert.deepEqual(acts.noRecord, { kind: "conflict", id: "noRecord", remoteVersion: 2 });
  assert.deepEqual(acts.gone, { kind: "forget", id: "gone" });
});

/** 内存里的假云端：带版本号检查，行为与后端一致 */
function fakeCloud() {
  const docs = new Map<string, { version: number; doc: RuyeDocument; deleted: boolean }>();
  const api: CloudApi = {
    async list() {
      return [...docs].map(([id, d]) => rs(id, d.version, d.deleted));
    },
    async get(id) {
      const d = docs.get(id);
      if (!d || d.deleted) throw new CloudError("not found", 404, "not_found");
      return { id, version: d.version, updatedAt: 0, doc: structuredClone(d.doc) };
    },
    async put(id, baseVersion, doc) {
      const d = docs.get(id);
      if (d && !(d.deleted && baseVersion === null) && baseVersion !== d.version) throw new CloudError("conflict", 409, "version_conflict", rs(id, d.version, d.deleted));
      const version = (d?.version ?? 0) + 1;
      docs.set(id, { version, doc: structuredClone(doc), deleted: false });
      return { id, version, updatedAt: 0 };
    },
    async remove(id, baseVersion) {
      const d = docs.get(id)!;
      if (d.version !== baseVersion) throw new CloudError("conflict", 409, "version_conflict");
      d.deleted = true;
      d.version++;
      return { id, version: d.version, updatedAt: 0 };
    },
  };
  return { api, docs };
}

function memStore(initial: Record<string, RuyeDocument>, busy: string[] = []) {
  const docs = new Map(Object.entries(initial));
  let n = 0;
  const store: LocalStore = {
    list: () => [...docs].map(([id, doc]) => ({ id, doc })),
    put: (id, doc) => (docs.set(id, doc), null),
    newId: () => `copy-${++n}`,
    canReplace: (id) => !busy.includes(id),
  };
  return { store, docs };
}

test("两台设备：上传、拉取、冲突时两份都保留", async () => {
  const cloud = fakeCloud();
  const base = load("full");

  // 设备 A 上传
  const a = memStore({ "doc-1": base });
  let sa = (await runSync(cloud.api, a.store, {})).state;
  assert.equal(cloud.docs.get("doc-1")!.version, 1);

  // 设备 B 首次同步：拉下来
  const b = memStore({});
  let sb = (await runSync(cloud.api, b.store, {})).state;
  assert.equal(b.docs.get("doc-1")!.meta.title, base.meta.title);

  // B 修改并同步；A 没改过，同步后得到 B 的版本
  const edited = structuredClone(base);
  edited.meta.title = "B 改过的标题";
  b.docs.set("doc-1", edited);
  sb = (await runSync(cloud.api, b.store, sb)).state;
  const ra = await runSync(cloud.api, a.store, sa);
  sa = ra.state;
  assert.deepEqual(ra.report.replaced, ["doc-1"]);
  assert.equal(a.docs.get("doc-1")!.meta.title, "B 改过的标题");

  // 两边同时改：A 同步时发生冲突，云端版本另存为副本，A 的版本成为云端最新
  const fromA = structuredClone(edited);
  fromA.meta.title = "A 的修改";
  a.docs.set("doc-1", fromA);
  const fromB = structuredClone(edited);
  fromB.meta.title = "B 的修改";
  b.docs.set("doc-1", fromB);
  sb = (await runSync(cloud.api, b.store, sb)).state;
  const r = await runSync(cloud.api, a.store, sa);
  sa = r.state;
  assert.equal(r.report.conflicts.length, 1);
  const copyId = r.report.conflicts[0].copyId;
  assert.equal(a.docs.get("doc-1")!.meta.title, "A 的修改");
  assert.equal(a.docs.get(copyId)!.meta.title, "B 的修改");
  assert.match(a.docs.get(copyId)!.meta.alias ?? "", /冲突副本/);
  assert.equal(cloud.docs.get("doc-1")!.doc.meta.title, "A 的修改");
  assert.equal(cloud.docs.get(copyId)!.doc.meta.title, "B 的修改");

  // 再同步一次没有变化
  const again = await runSync(cloud.api, a.store, sa);
  assert.equal(again.report.pushed + again.report.pulled + again.report.conflicts.length, 0);
});

test("正在编辑、尚未写入本机的简历不会被云端版本覆盖", async () => {
  const cloud = fakeCloud();
  const base = load("full");
  const a = memStore({ "doc-1": base }, ["doc-1"]);
  const sa = (await runSync(cloud.api, a.store, {})).state;
  const changed = structuredClone(base);
  changed.meta.title = "云端更新";
  await cloud.api.put("doc-1", 1, changed);
  const r = await runSync(cloud.api, a.store, sa);
  assert.deepEqual(r.report.skipped, ["doc-1"]);
  assert.equal(a.docs.get("doc-1")!.meta.title, base.meta.title);
});

test("云端删除时本机保留；本机删除时同步删除云端", async () => {
  const cloud = fakeCloud();
  const a = memStore({ "doc-1": load("full"), "doc-2": load("short") });
  let sa = (await runSync(cloud.api, a.store, {})).state;
  await cloud.api.remove("doc-1", 1);
  const r = await runSync(cloud.api, a.store, sa);
  sa = r.state;
  assert.deepEqual(r.report.detached, ["doc-1"]);
  assert.ok(a.docs.has("doc-1"));
  a.docs.delete("doc-2");
  sa = (await runSync(cloud.api, a.store, sa)).state;
  assert.equal(cloud.docs.get("doc-2")!.deleted, true);
  assert.equal(sa["doc-2"], undefined);
});

test("登录失效（401）向上抛出；其他错误记入报告、不中断其余简历", async () => {
  const cloud = fakeCloud();
  const a = memStore({ "doc-1": load("full"), "doc-2": load("short") });
  const failing: CloudApi = { ...cloud.api, put: async (id, b, d) => (id === "doc-1" ? Promise.reject(new CloudError("太大了", 413, "document_too_large")) : cloud.api.put(id, b, d)) };
  const r = await runSync(failing, a.store, {});
  assert.equal(r.report.errors.length, 1);
  assert.equal(r.report.pushed, 1);
  const expired: CloudApi = { ...cloud.api, list: async () => Promise.reject(new CloudError("expired", 401, "unauthorized")) };
  await assert.rejects(runSync(expired, a.store, {}), (e: unknown) => e instanceof CloudError && e.status === 401);
});

test("重新开启同步：仅本机的简历重新上传，云端恢复", async () => {
  const cloud = fakeCloud();
  const a = memStore({ "doc-1": load("full") });
  let sa = (await runSync(cloud.api, a.store, {})).state;
  await cloud.api.remove("doc-1", 1);
  sa = (await runSync(cloud.api, a.store, sa)).state;
  assert.deepEqual(detachedIds(sa), ["doc-1"]);
  sa = reattach(sa, detachedIds(sa));
  const r = await runSync(cloud.api, a.store, sa);
  assert.equal(r.report.pushed, 1);
  assert.equal(cloud.docs.get("doc-1")!.deleted, false);
  assert.deepEqual(detachedIds(r.state), []);
});
