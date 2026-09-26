import { t } from "./i18n/ja";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { treeRepository } from "./local/repository/treeRepository";
import { useData, changed } from "./useData";
import { Thumb } from "./Thumb";
import { UndoNotice } from "./UndoNotice";
import type { Edge, Series, TreeData, TreeNode } from "./types";
import { seriesRepository } from "./local/repository/seriesRepository";
import { record, travel, historyState } from "./history";
type FlowNode = Node<
  {
    card: TreeNode;
    onOpen: (id: string) => void;
    onMove: (
      id: string,
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => void;
    onArm: (v: boolean) => void;
  },
  "card"
>;
const Experiment = memo(function Experiment({ id, data }: NodeProps<FlowNode>) {
  const flow = useReactFlow<FlowNode>();
  const zoom = useStore((s) => s.transform[2]);
  const gesture = useRef<{
    x: number;
    y: number;
    from: { x: number; y: number };
    active: boolean;
    cancel: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const moved = useRef(false);
  const [armed, setArmed] = useState(false);
  useEffect(
    () => () => {
      if (gesture.current) clearTimeout(gesture.current.timer);
    },
    [],
  );
  return (
    <div
      className={`experiment ${armed ? "armed" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={data.card.display_id}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          data.onOpen(id);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchMoveCapture={(e) => {
        if (gesture.current?.active) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return;
        const from = flow.getNode(id)!.position;
        const g = {
          x: e.clientX,
          y: e.clientY,
          from: { ...from },
          active: false,
          cancel: false,
          timer: setTimeout(() => {
            if (g.cancel) return;
            g.active = true;
            moved.current = true;
            setArmed(true);
            data.onArm(true);
            navigator.vibrate?.(20);
          }, 380),
        };
        gesture.current = g;
        moved.current = false;
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g) return;
        const dx = e.clientX - g.x,
          dy = e.clientY - g.y;
        if (!g.active) {
          if (Math.hypot(dx, dy) > 8) {
            clearTimeout(g.timer);
            g.cancel = true;
            moved.current = true;
          }
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        flow.setNodes((nodes) =>
          nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  position: {
                    x: g.from.x + dx / zoom,
                    y: g.from.y + dy / zoom,
                  },
                }
              : n,
          ),
        );
      }}
      onPointerUp={(e) => {
        const g = gesture.current;
        if (!g) return;
        clearTimeout(g.timer);
        if (g.active) {
          e.stopPropagation();
          data.onMove(id, g.from, flow.getNode(id)!.position);
        }
        gesture.current = null;
        setArmed(false);
        data.onArm(false);
      }}
      onPointerCancel={() => {
        const g = gesture.current;
        if (g) {
          clearTimeout(g.timer);
          if (g.active)
            flow.setNodes((ns) =>
              ns.map((n) => (n.id === id ? { ...n, position: g.from } : n)),
            );
        }
        gesture.current = null;
        setArmed(false);
        data.onArm(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!moved.current) data.onOpen(id);
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Thumb id={data.card.cover_image_id} alt={data.card.display_id} />
      {zoom > 0.55 && (
        <div className="node-caption">
          <b>{data.card.display_id}</b>
          {data.card.image_count > 1 && (
            <span>
              {data.card.image_count}
              {t("detail_032")}
            </span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});
const nodeTypes = { card: Experiment };
function Canvas({ seriesId }: { seriesId: string }) {
  const { data, error, refresh } = useData<TreeData>(
    `/series/${seriesId}/tree`,
    () => treeRepository.get(seriesId),
  );
  const [nodes, setNodes] = useState<FlowNode[]>([]),
    [armed, setArmed] = useState(false),
    [message, setMessage] = useState(""),
    [edge, setEdge] = useState<Edge>(),
    [connecting, setConnecting] = useState(false),
    [source, setSource] = useState<string>(),
    [target, setTarget] = useState<string>(),
    [kind, setKind] = useState("parent"),
    [color, setColor] = useState("#668bd5"),
    [history, setHistory] = useState(historyState(seriesId));
  const flow = useReactFlow<FlowNode>();
  const nav = useNavigate(),
    location = useLocation();
  const [params] = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    latest = useRef<Viewport | undefined>(undefined),
    initialized = useRef(false),
    lastFocus = useRef<string | null>(null),
    container = useRef<HTMLDivElement>(null);
  const connection = useRef({ connecting, source });
  connection.current = { connecting, source };
  const savePos = useCallback(
    (id: string, pos: { x: number; y: number }) =>
      treeRepository.positions(seriesId, {
        positions: [{ id, ...pos }],
      }),
    [seriesId],
  );
  const open = useCallback(
    (id: string) => {
      if (connection.current.connecting) {
        if (!connection.current.source) setSource(id);
        else setTarget(id);
        return;
      }
      sessionStorage.setItem(
        `viewport:${seriesId}`,
        JSON.stringify(flow.getViewport()),
      );
      nav(`/cards/${id}`, { state: { background: location } });
    },
    [flow, nav, location, seriesId],
  );
  const move = useCallback(
    (
      id: string,
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) => {
      void savePos(id, to)
        .then(() =>
          record(seriesId, {
            undo: () => savePos(id, from),
            redo: () => savePos(id, to),
          }),
        )
        .catch((e) => {
          setMessage(e.message);
          void refresh();
        });
    },
    [savePos, seriesId, refresh],
  );
  useEffect(() => {
    if (data)
      setNodes(
        data.nodes.map((card) => ({
          id: card.id,
          type: "card",
          position: { x: card.canvas_x, y: card.canvas_y },
          data: { card, onOpen: open, onMove: move, onArm: setArmed },
        })),
      );
  }, [data, open, move]);
  const focus = useCallback(
    (id: string) => {
      const n = flow.getNode(id);
      if (n)
        void flow.setCenter(n.position.x + 75, n.position.y + 100, {
          zoom: 0.9,
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 200,
        });
    },
    [flow],
  );
  useEffect(() => {
    if (!data || !nodes.length) return;
    if (!initialized.current) {
      initialized.current = true;
      const saved = sessionStorage.getItem(`viewport:${seriesId}`);
      void flow.setViewport(
        saved
          ? JSON.parse(saved)
          : {
              x: data.series.viewport_x,
              y: data.series.viewport_y,
              zoom: data.series.viewport_zoom,
            },
      );
    }
    if (params.get("focus") && lastFocus.current !== params.get("focus")) {
      lastFocus.current = params.get("focus");
      requestAnimationFrame(() => focus(params.get("focus")!));
    }
  }, [data, nodes.length, params, seriesId, flow, focus]);
  useEffect(() => {
    sessionStorage.setItem("last-series", seriesId);
    const update = () => setHistory(historyState(seriesId));
    window.addEventListener("history-change", update);
    document.documentElement.classList.add("tree-active");
    return () => {
      document.documentElement.classList.remove("tree-active");
      window.removeEventListener("history-change", update);
      clearTimeout(timer.current);
      if (latest.current)
        void treeRepository
          .saveViewport(seriesId, latest.current)
          .catch(() => {});
    };
  }, [seriesId]);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let old = { w: el.clientWidth, h: el.clientHeight };
    const observer = new ResizeObserver(() => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      if (old.w && old.h) {
        const v = flow.getViewport();
        void flow.setViewport({
          ...v,
          x: v.x + (next.w - old.w) / 2,
          y: v.y + (next.h - old.h) / 2,
        });
      }
      old = next;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [flow]);
  function viewport(v: Viewport) {
    latest.current = v;
    sessionStorage.setItem(`viewport:${seriesId}`, JSON.stringify(v));
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        void treeRepository
          .saveViewport(seriesId, v)
          .catch((e) => setMessage(e.message)),
      650,
    );
  }
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      changed();
      setEdge(undefined);
      setSource(undefined);
      setTarget(undefined);
      setConnecting(false);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const edges =
    data?.edges.map((e) => ({
      id: e.id,
      source: e.source_card_id,
      target: e.target_card_id,
      style: {
        stroke: e.color,
        strokeWidth: e.is_primary ? 3 : 2,
        strokeDasharray: e.kind === "reference" ? "6 5" : undefined,
      },
      markerEnd:
        e.kind === "parent"
          ? { type: MarkerType.ArrowClosed, color: e.color }
          : undefined,
    })) ?? [];
  return (
    <main ref={container} className="tree-canvas" data-testid="tree-canvas">
      <UndoNotice />
      <ReactFlow<FlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) =>
          setNodes((ns) => applyNodeChanges(changes, ns))
        }
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={!armed}
        zoomOnPinch
        minZoom={0.08}
        maxZoom={2}
        onlyRenderVisibleElements
        onMoveEnd={(_, v) => viewport(v)}
        onEdgeClick={(_, e) => setEdge(data?.edges.find((x) => x.id === e.id))}
      >
        <Background color="#a3b4a8" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="tree-top">
        <b>{data?.series.display_id}</b>
        <button
          onClick={() => {
            setConnecting(!connecting);
            setSource(undefined);
            setTarget(undefined);
          }}
        >
          {connecting ? t("tree_158") : t("tree_159")}
        </button>
        <button
          disabled={!history.undo}
          onClick={() => void run(() => travel(seriesId, true))}
        >
          ↶
        </button>
        <button
          disabled={!history.redo}
          onClick={() => void run(() => travel(seriesId, false))}
        >
          ↷
        </button>
      </div>
      {(message || error || connecting) && (
        <p className="tree-message" role="status">
          {message || error || (source ? t("tree_160") : t("tree_161"))}
        </p>
      )}
      <div className="tree-tools">
        <button onClick={() => data && focus(data.series.root_card_id)}>
          {t("tree_162")}
        </button>
        <button onClick={() => void flow.fitView({ padding: 0.2 })}>
          {t("tree_163")}
        </button>
        <button
          className="primary"
          aria-label={t("editor_060")}
          onClick={() => {
            const v = flow.screenToFlowPosition({
              x: innerWidth / 2,
              y: innerHeight / 2,
            });
            nav(`/new?series=${seriesId}&x=${v.x}&y=${v.y}`, {
              state: { background: location },
            });
          }}
        >
          ＋
        </button>
      </div>
      {(target || edge) && (
        <div className="sheet">
          <h3>{edge ? t("tree_164") : t("tree_165")}</h3>
          {!edge && (
            <label>
              {t("tree_166")}
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="parent">{t("tree_167")}</option>
                <option value="reference">{t("detail_042")}</option>
              </select>
            </label>
          )}
          <label>
            {t("tree_168")}
            <input
              type="color"
              value={edge?.color ?? color}
              onChange={(e) =>
                edge
                  ? setEdge({ ...edge, color: e.target.value })
                  : setColor(e.target.value)
              }
            />
          </label>
          <div className="actions">
            <button
              className="primary"
              onClick={() =>
                void run(async () => {
                  if (edge) {
                    const before = data!.edges.find((e) => e.id === edge.id)!;
                    await treeRepository.updateEdge(edge.id, {
                      color: edge.color,
                      expectedVersion: edge.version,
                    });
                    record(seriesId, {
                      undo: async () => {
                        const graph = await treeRepository.get(seriesId);
                        return treeRepository.updateEdge(edge.id, {
                          color: before.color,
                          expectedVersion: graph.edges.find(
                            (e) => e.id === edge.id,
                          )!.version,
                        });
                      },
                      redo: async () => {
                        const graph = await treeRepository.get(seriesId);
                        return treeRepository.updateEdge(edge.id, {
                          color: edge.color,
                          expectedVersion: graph.edges.find(
                            (e) => e.id === edge.id,
                          )!.version,
                        });
                      },
                    });
                  } else {
                    const made = await treeRepository.createEdge({
                      source_card_id: source,
                      target_card_id: target,
                      kind,
                      color,
                    });
                    record(seriesId, {
                      undo: () => treeRepository.removeEdge(made.id),
                      redo: () => treeRepository.restoreEdge(made.id),
                    });
                  }
                })
              }
            >
              {t("tree_169")}
            </button>
            {edge?.kind === "parent" && (
              <button
                disabled={!!edge.is_primary}
                onClick={() =>
                  void run(async () => {
                    const previous = data!.edges.find(
                      (e) =>
                        e.target_card_id === edge.target_card_id &&
                        e.kind === "parent" &&
                        e.is_primary,
                    );
                    const switchTo = async (id: string, primary: boolean) => {
                      const graph = await treeRepository.get(seriesId);
                      const current = graph.edges.find((e) => e.id === id);
                      if (!current)
                        throw new Error(
                          "接続が変更されています。再読み込みしてください",
                        );
                      return treeRepository.updateEdge(id, {
                        is_primary: primary,
                        expectedVersion: current.version,
                      });
                    };
                    await switchTo(edge.id, true);
                    record(seriesId, {
                      undo: () =>
                        previous
                          ? switchTo(previous.id, true)
                          : switchTo(edge.id, false),
                      redo: () => switchTo(edge.id, true),
                    });
                  })
                }
              >
                {edge.is_primary ? t("detail_043") : t("tree_170")}
              </button>
            )}
            {edge && (
              <button
                onClick={() =>
                  void run(async () => {
                    await treeRepository.removeEdge(edge.id);
                    record(seriesId, {
                      undo: () => treeRepository.restoreEdge(edge.id),
                      redo: () => treeRepository.removeEdge(edge.id),
                    });
                  })
                }
              >
                {t("tree_171")}
              </button>
            )}
            <button
              onClick={() => {
                setEdge(undefined);
                setTarget(undefined);
              }}
            >
              {t("detail_038")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
export default function Tree() {
  const { seriesId } = useParams();
  return (
    <ReactFlowProvider>
      <Canvas key={seriesId} seriesId={seriesId!} />
    </ReactFlowProvider>
  );
}
export function TreePicker() {
  const { data } = useData<Series[]>("series", () => seriesRepository.list());
  const nav = useNavigate();
  useEffect(() => {
    const last = sessionStorage.getItem("last-series");
    if (last && data?.some((s) => s.id === last))
      nav(`/series/${last}/tree`, { replace: true });
  }, [data, nav]);
  return (
    <main className="page">
      <h2>{t("tree_172")}</h2>
      {data?.map((s) => (
        <button key={s.id} onClick={() => nav(`/series/${s.id}/tree`)}>
          {s.display_id}
        </button>
      ))}
    </main>
  );
}
