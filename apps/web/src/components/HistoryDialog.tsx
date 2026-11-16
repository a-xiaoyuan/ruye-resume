// 历史版本：本机自动快照 + 云端修订记录合在一起，按时间倒序。可以恢复任意一版（恢复后还能撤销）
import { useEffect, useState } from "react";
import { recoverDocument, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import type { CloudApi } from "../cloud.ts";
import { docStats, formatWhen, listSnapshots } from "../history.ts";
import { contentHash } from "../sync.ts";

interface Row {
  key: string;
  at: number;
  source: "local" | "cloud";
  title: string;
  /** 云端当前版本 */
  current?: boolean;
  doc?: RuyeDocument;
  load: () => Promise<RuyeDocument>;
}

interface Props {
  docId: string;
  label: string;
  /** 这份简历现在的内容：用来标出每一版和现在差多少字 */
  current: RuyeDocument;
  api: CloudApi | null;
  onRestore: (doc: RuyeDocument, when: string) => void;
  onClose: () => void;
}

export function HistoryDialog({ docId, label, current, api, onRestore, onClose }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cloudNote, setCloudNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = contentHash(current);
  const base = docStats(current);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local: Row[] = (await listSnapshots(docId)).map((s) => ({
        key: `l${s.at}`,
        at: s.at,
        source: "local",
        title: s.doc.meta.alias?.trim() || s.doc.meta.title,
        doc: s.doc,
        load: async () => s.doc,
      }));
      let cloud: Row[] = [];
      if (api?.revisions && api.revision) {
        try {
          const revs = await api.revisions(docId);
          cloud = revs.map((r) => ({
            key: `c${r.version}`,
            at: r.savedAt,
            source: "cloud",
            title: r.title,
            current: r.current,
            load: async () => {
              const d = await api.revision!(docId, r.version);
              const rec = recoverDocument(d.doc);
              if (!rec) throw new Error("这个云端版本无法识别");
              return rec.doc;
            },
          }));
        } catch (e) {
          // 还没同步过的简历云端没有记录（404），不算错误
          const status = (e as { status?: number }).status;
          if (status !== 404) setCloudNote(`云端历史读取失败：${(e as Error).message}`);
        }
      } else if (!api) setCloudNote("登录后，云端还会为每份简历保留最近 50 个历史版本，换电脑也能找回。");
      if (alive) setRows([...local, ...cloud].sort((a, b) => b.at - a.at));
    })();
    return () => {
      alive = false;
    };
  }, [docId, api]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function restore(r: Row) {
    setBusy(r.key);
    setError(null);
    try {
      const doc = await r.load();
      onRestore(doc, formatWhen(r.at));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog history-dialog" role="dialog" aria-modal="true" aria-label={`「${label}」的历史版本`}>
        <header className="history-head">
          <div>
            <h2>历史版本</h2>
            <p>{label}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="history-rule">本机每隔 10 分钟左右自动留一版，保留最近 30 版。恢复之后还能撤销。</p>
        {cloudNote && <p className="history-note">{cloudNote}</p>}
        {error && <p className="dialog-error">{error}</p>}
        {rows === null ? (
          <p className="history-empty">正在读取…</p>
        ) : rows.length === 0 ? (
          <p className="history-empty">还没有历史版本。继续编辑一会儿，这里就会出现自动留下的版本。</p>
        ) : (
          <ol className="history-list">
            {rows.map((r) => {
              const same = r.doc ? contentHash(r.doc) === now : r.current;
              const delta = r.doc ? docStats(r.doc).chars - base.chars : null;
              return (
                <li key={r.key} className={same ? "same" : ""}>
                  <div className="history-main">
                    <span className="history-when">{formatWhen(r.at)}</span>
                    <span className="history-title">{r.title}</span>
                  </div>
                  <span className="history-meta">
                    <i className={`src ${r.source}`}>{r.source === "local" ? "本机" : r.current ? "云端 · 当前" : "云端"}</i>
                    {delta !== null && delta !== 0 && <span>比现在{delta > 0 ? `多 ${delta}` : `少 ${-delta}`} 字</span>}
                    {same && <span>和现在一样</span>}
                  </span>
                  <button type="button" disabled={same || busy !== null} onClick={() => restore(r)}>
                    {busy === r.key ? "读取中…" : "恢复这一版"}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
