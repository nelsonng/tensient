"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatAbsoluteDateTime } from "@/lib/utils";

export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "testing" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";

export interface TaskRow {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  assigneeId: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneeEmail: string | null;
  createdById: string;
  position: number;
  dueDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

const STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "testing", "done"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "Doing",
  in_review: "In Review",
  testing: "Testing",
  done: "Done",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "text-muted",
  todo: "text-primary",
  in_progress: "text-warning",
  in_review: "text-warning",
  testing: "text-primary/80",
  done: "text-success",
};

const STATUS_HEADER_COLORS: Record<TaskStatus, string> = {
  backlog: "border-border/50 text-muted",
  todo: "border-primary/30 text-primary",
  in_progress: "border-warning/40 text-warning",
  in_review: "border-warning/30 text-warning/80",
  testing: "border-primary/20 text-primary/70",
  done: "border-success/30 text-success",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  critical: "text-destructive font-bold",
  high: "text-warning",
  medium: "text-muted/80",
  low: "text-muted/40",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

type ViewMode = "list" | "board";

// ── Shared helpers ─────────────────────────────────────────────────────

function assigneeName(row: TaskRow): string {
  const name = [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(" ");
  return name || row.assigneeEmail || "";
}

function compareTasksByBoardOrder(a: TaskRow, b: TaskRow): number {
  const statusDiff = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
  if (statusDiff !== 0) return statusDiff;
  const positionDiff = a.position - b.position;
  if (positionDiff !== 0) return positionDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function hydrateAssigneeDisplay(task: TaskRow, members: Member[]): TaskRow {
  if (!task.assigneeId) {
    return {
      ...task,
      assigneeFirstName: task.assigneeFirstName ?? null,
      assigneeLastName: task.assigneeLastName ?? null,
      assigneeEmail: task.assigneeEmail ?? null,
    };
  }

  const member = members.find((m) => m.id === task.assigneeId);
  return {
    ...task,
    assigneeFirstName: task.assigneeFirstName ?? member?.firstName ?? null,
    assigneeLastName: task.assigneeLastName ?? member?.lastName ?? null,
    assigneeEmail: task.assigneeEmail ?? member?.email ?? null,
  };
}

function positionForIndex(rows: TaskRow[], index: number): number {
  const previous = rows[index - 1]?.position;
  const next = rows[index + 1]?.position;

  if (previous !== undefined && next !== undefined) return (previous + next) / 2;
  if (previous !== undefined) return previous + 1000;
  if (next !== undefined) return next - 1000;
  return 1000;
}

function getTargetStatus(overId: string, rows: TaskRow[]): TaskStatus | null {
  const overTask = rows.find((row) => row.id === overId);
  if (overTask) return overTask.status;
  return STATUSES.includes(overId as TaskStatus) ? (overId as TaskStatus) : null;
}

// ── Create Task Modal ──────────────────────────────────────────────────

interface CreateTaskModalProps {
  workspaceId: string;
  members: Member[];
  initialStatus?: TaskStatus;
  onCreated: (task: TaskRow) => void;
  onClose: () => void;
}

function CreateTaskModal({ workspaceId, members, initialStatus = "backlog", onCreated, onClose }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority: priority || null,
          assigneeId: assigneeId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const task = await res.json();
      onCreated(task);
      onClose();
    } catch {
      alert("Failed to create task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">New Task</h2>
          <button onClick={onClose} className="font-mono text-xs text-muted hover:text-foreground">✕</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Task title…"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description…"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority | "")}
                className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">None</option>
                {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Unassigned</option>
                {members.map((m) => {
                  const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.id;
                  return <option key={m.id} value={m.id}>{name}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="rounded border border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs tracking-wider text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "CREATING…" : "CREATE TASK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Task Card (used in board view + overlay) ───────────────────────────

function TaskCard({
  task,
  workspaceId,
  overlay = false,
}: {
  task: TaskRow;
  workspaceId: string;
  overlay?: boolean;
}) {
  const router = useRouter();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  function handleClick(e: React.MouseEvent) {
    // Avoid navigation when dragging
    if (isDragging) return;
    e.stopPropagation();
    router.push(`/dashboard/${workspaceId}/tasks/${task.id}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors select-none ${
        overlay ? "shadow-xl opacity-95 rotate-1" : ""
      }`}
    >
      <p className="text-sm text-foreground font-medium leading-snug">{task.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`font-mono text-[10px] ${task.priority ? PRIORITY_STYLES[task.priority] : "text-muted/30"}`}>
          {task.priority ? PRIORITY_LABELS[task.priority] : "NO PRI"}
        </span>
        <span className={`font-mono text-[10px] truncate max-w-[100px] ${assigneeName(task) ? "text-muted" : "text-muted/40"}`}>
          {assigneeName(task) || "Unassigned"}
        </span>
        {task.dueDate && (
          <span className="font-mono text-[10px] text-muted/60 ml-auto">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Board Column ───────────────────────────────────────────────────────

function BoardColumn({
  status,
  tasks,
  workspaceId,
  onAddTask,
}: {
  status: TaskStatus;
  tasks: TaskRow[];
  workspaceId: string;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  });

  return (
    <div className="flex flex-col min-w-[220px] max-w-[260px] shrink-0">
      <div className={`flex items-center justify-between mb-2 pb-2 border-b ${STATUS_HEADER_COLORS[status]}`}>
        <span className="font-mono text-[11px] uppercase tracking-widest">
          {STATUS_LABELS[status]}
        </span>
        <span className="font-mono text-[10px] opacity-60">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 flex-1 min-h-[140px] rounded-lg border border-dashed p-1 transition-colors ${
            isOver ? "border-primary/40 bg-primary/5" : "border-transparent"
          }`}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} workspaceId={workspaceId} />
          ))}
        </div>
      </SortableContext>
      <button
        type="button"
        onClick={() => onAddTask(status)}
        className="mt-3 rounded border border-dashed border-border/50 px-2 py-1.5 font-mono text-[10px] text-muted/50 hover:border-primary/30 hover:text-primary/60 transition-colors text-left"
      >
        + Add task
      </button>
    </div>
  );
}

// ── Main TasksClient Component ─────────────────────────────────────────

export function TasksClient({
  workspaceId,
  initialRows,
  members,
}: {
  workspaceId: string;
  initialRows: TaskRow[];
  members: Member[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus>("backlog");
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const orderedRows = useMemo(() => [...rows].sort(compareTasksByBoardOrder), [rows]);

  const filteredRows = useMemo(() => {
    return orderedRows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return row.title.toLowerCase().includes(q) || (row.description ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [orderedRows, statusFilter, search]);

  const rowsByStatus = useMemo(() => {
    const map = {} as Record<TaskStatus, TaskRow[]>;
    for (const s of STATUSES) map[s] = [];
    for (const row of orderedRows) {
      if (row.status in map) map[row.status].push(row);
    }
    return map;
  }, [orderedRows]);

  function openCreateModal(status: TaskStatus = "backlog") {
    setCreateModalStatus(status);
    setShowCreateModal(true);
  }

  function handleCreated(task: TaskRow) {
    setRows((prev) => [...prev, hydrateAssigneeDisplay(task, members)]);
  }

  async function patchTask(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${id}?workspaceId=${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Failed to update task");
    return res.json();
  }

  // ── DnD handlers ────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const task = rows.find((r) => r.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeTop = active.rect.current.translated?.top;
    const overMidpoint = over.rect.top + over.rect.height / 2;
    const activeRow = rows.find((r) => r.id === activeId);
    const targetStatus = getTargetStatus(overId, rows);
    if (!activeRow || !targetStatus) return;

    const rowsWithoutActive = rows.filter((row) => row.id !== activeId);
    const targetRows = rowsWithoutActive
      .filter((row) => row.status === targetStatus)
      .sort(compareTasksByBoardOrder);
    const overIndex = targetRows.findIndex((row) => row.id === overId);
    const insertIndex =
      overIndex >= 0
        ? overIndex + (activeTop !== undefined && activeTop > overMidpoint ? 1 : 0)
        : targetRows.length;

    const nextTargetRows = [...targetRows];
    nextTargetRows.splice(insertIndex, 0, { ...activeRow, status: targetStatus });
    const boundedIndex = nextTargetRows.findIndex((row) => row.id === activeId);
    const position = positionForIndex(nextTargetRows, boundedIndex);
    const patch = { status: targetStatus, position };

    setRows((prev) =>
      prev.map((row) =>
        row.id === activeId ? { ...row, status: targetStatus, position } : row
      )
    );

    void patchTask(activeId, patch).catch(() => {
      setRows(initialRows);
    });
  }

  // ── List view columns ───────────────────────────────────────────────

  const listSubtitle = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => r.status === "done").length;
    return `${total} task${total !== 1 ? "s" : ""} · ${done} done`;
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1400px] px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="mt-1 font-mono text-xs text-muted">{listSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
                viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              LIST
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`px-3 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
                viewMode === "board" ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              BOARD
            </button>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="rounded border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs tracking-wider text-primary hover:bg-primary/20 transition-colors"
          >
            + NEW TASK
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {(["all", ...STATUSES] as Array<"all" | TaskStatus>).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 font-mono text-[10px] tracking-wider transition-colors ${
                statusFilter === s
                  ? "text-primary border-b border-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s === "all" ? "ALL" : STATUS_LABELS[s].toUpperCase()}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto rounded border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted/40 focus:border-primary focus:outline-none"
        />
      </div>

      {/* ── List View ── */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-lg border border-border bg-panel">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-border/80">
              <tr>
                {["Title", "Status", "Priority", "Assignee", "Due", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="font-mono text-sm tracking-wider text-muted">No tasks yet</p>
                    <p className="mt-2 text-sm text-muted">Create your first task to get started.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/dashboard/${workspaceId}/tasks/${row.id}`)}
                    className="border-b border-border/40 last:border-b-0 hover:bg-muted/10 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm text-foreground max-w-[320px]">
                      <span className="block truncate">{row.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-[11px] uppercase tracking-wide ${STATUS_COLORS[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.priority ? (
                        <span className={`font-mono text-[10px] ${PRIORITY_STYLES[row.priority]}`}>
                          {PRIORITY_LABELS[row.priority]}
                        </span>
                      ) : (
                        <span className="text-muted/30 font-mono text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-muted">
                        {assigneeName(row) || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-muted">
                        {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] text-muted">
                        {formatAbsoluteDateTime(row.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Board View ── */}
      {viewMode === "board" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                tasks={rowsByStatus[status]}
                workspaceId={workspaceId}
                onAddTask={openCreateModal}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <TaskCard task={activeTask} workspaceId={workspaceId} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {showCreateModal && (
        <CreateTaskModal
          workspaceId={workspaceId}
          members={members}
          initialStatus={createModalStatus}
          onCreated={handleCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
