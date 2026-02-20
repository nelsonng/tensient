"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";
import { VoiceRecorder } from "@/components/voice-recorder";

// ── Types ──────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: string;
  content: string;
  audioUrl: string | null;
  attachments: Array<{ url: string; filename: string; contentType: string }> | null;
  metadata: Record<string, unknown> | null;
  coachIds: string[] | null;
  createdAt: string;
}

interface Coach {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface ConversationViewProps {
  workspaceId: string;
  conversation: {
    id: string;
    title: string | null;
    createdAt: string;
  };
  initialMessages: Message[];
  coaches: Coach[];
}

// ── Component ──────────────────────────────────────────────────────────

export function ConversationViewClient({
  workspaceId,
  conversation,
  initialMessages,
  coaches,
}: ConversationViewProps) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showCoaches, setShowCoaches] = useState(false);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{ url: string; filename: string; contentType: string; sizeBytes: number }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [msgs, scrollToBottom]);

  // ── Send message ────────────────────────────────────────────────────

  async function handleSend() {
    if ((!input.trim() && pendingAttachments.length === 0) || sending) return;

    const content = input.trim() || "(attached files)";
    setSending(true);
    setInput("");

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      role: "user",
      content,
      audioUrl: null,
      attachments: pendingAttachments.length > 0 ? pendingAttachments : null,
      metadata: null,
      coachIds: selectedCoachIds.length > 0 ? selectedCoachIds : null,
      createdAt: new Date().toISOString(),
    };
    setMsgs((prev) => [...prev, optimisticMsg]);
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
            coachIds: selectedCoachIds.length > 0 ? selectedCoachIds : undefined,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }

      const data = await res.json();

      // Replace optimistic message with real ones
      setMsgs((prev) => {
        const filtered = prev.filter((m) => m.id !== tempId);
        return [
          ...filtered,
          {
            ...data.userMessage,
            createdAt: data.userMessage.createdAt,
          },
          {
            ...data.assistantMessage,
            createdAt: data.assistantMessage.createdAt,
          },
        ];
      });

      // If title was generated, refresh it
      if (!title) {
        router.refresh();
      }
    } catch (error) {
      // Remove optimistic message on error
      setMsgs((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
      console.error("Send failed:", error);
    } finally {
      setSending(false);
    }
  }

  // ── Voice transcription callback ────────────────────────────────────

  function handleTranscription(text: string, audioUrl: string) {
    setInput(text);
    setShowVoice(false);
    // Auto-send after transcription for a smooth conversational flow
    // User can edit before it sends
  }

  // ── File upload ─────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `files/${workspaceId}/${conversation.id}/${Date.now()}-${file.name}`;
        const result = await upload(path, file, {
          access: "public",
          handleUploadUrl: "/api/uploads/token",
        });
        setPendingAttachments((prev) => [
          ...prev,
          {
            url: result.url,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          },
        ]);
      }
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Title editing ───────────────────────────────────────────────────

  async function handleTitleSave(newTitle: string) {
    setEditingTitle(false);
    if (!newTitle.trim() || newTitle === title) return;
    setTitle(newTitle);

    await fetch(
      `/api/workspaces/${workspaceId}/conversations/${conversation.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      }
    );
  }

  // ── Coach toggle ────────────────────────────────────────────────────

  function toggleCoach(coachId: string) {
    setSelectedCoachIds((prev) =>
      prev.includes(coachId)
        ? prev.filter((id) => id !== coachId)
        : [...prev, coachId]
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1200px] px-6 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Title */}
      <div className="mb-4">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={title || ""}
            className="font-display text-xl font-bold tracking-tight bg-transparent border-b border-primary text-foreground outline-none w-full"
            onBlur={(e) => handleTitleSave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave(e.currentTarget.value);
              if (e.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            className="font-display text-xl font-bold tracking-tight text-foreground cursor-pointer hover:text-primary transition-colors"
          >
            {title || "Untitled conversation"}
          </h1>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {msgs.length === 0 && (
          <div className="text-center py-16">
            <MonoLabel className="text-muted block mb-2">Start the conversation</MonoLabel>
            <p className="text-sm text-muted">Type a message, record your voice, or attach files.</p>
          </div>
        )}

        {msgs.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] ${
                msg.role === "user"
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-panel border border-border"
              } rounded-lg px-4 py-3`}
            >
              <MonoLabel className="text-[10px] mb-1 block">
                {msg.role === "user" ? "YOU" : "TENSIENT"}
              </MonoLabel>
              <div className="text-sm text-foreground whitespace-pre-wrap">
                {msg.content}
              </div>

              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-info hover:underline font-mono"
                    >
                      📎 {att.filename}
                    </a>
                  ))}
                </div>
              )}

              {/* Metadata: actions, coaching questions */}
              {msg.metadata && msg.role === "assistant" && (() => {
                const meta = msg.metadata as { actions?: Array<{ task: string }>; coachingQuestions?: string[] };
                return (
                  <div className="mt-3 space-y-2">
                    {meta.actions && meta.actions.length > 0 && (
                      <div>
                        <MonoLabel className="text-[9px] text-warning">ACTION ITEMS</MonoLabel>
                        <ul className="text-xs text-muted mt-1 space-y-0.5">
                          {meta.actions.map((a, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-warning">→</span> {a.task}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {meta.coachingQuestions && meta.coachingQuestions.length > 0 && (
                      <div>
                        <MonoLabel className="text-[9px] text-secondary">REFLECT</MonoLabel>
                        <ul className="text-xs text-muted mt-1 space-y-0.5">
                          {meta.coachingQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-secondary">?</span> {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              <span className="font-mono text-[9px] text-muted mt-2 block">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-panel border border-border rounded-lg px-4 py-3">
              <MonoLabel className="text-[10px] mb-1 block">TENSIENT</MonoLabel>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse delay-100" />
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice recorder overlay */}
      {showVoice && (
        <div className="mb-4">
          <PanelCard>
            <VoiceRecorder
              workspaceId={workspaceId}
              onTranscription={handleTranscription}
              onError={(err) => {
                console.error("Voice error:", err);
                setShowVoice(false);
              }}
            />
            <button
              onClick={() => setShowVoice(false)}
              className="mt-2 font-mono text-xs text-muted hover:text-destructive transition-colors"
            >
              Cancel
            </button>
          </PanelCard>
        </div>
      )}

      {/* Coach selector */}
      {showCoaches && (
        <div className="mb-3">
          <PanelCard className="p-3">
            <MonoLabel className="text-[10px] mb-2 block">SELECT COACHES</MonoLabel>
            <div className="flex flex-wrap gap-2">
              {coaches.map((coach) => (
                <button
                  key={coach.id}
                  onClick={() => toggleCoach(coach.id)}
                  className={`px-3 py-1 rounded font-mono text-[10px] tracking-wider border transition-colors ${
                    selectedCoachIds.includes(coach.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/30"
                  }`}
                >
                  {coach.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCoaches(false)}
              className="mt-2 font-mono text-[10px] text-muted hover:text-foreground"
            >
              Done
            </button>
          </PanelCard>
        </div>
      )}

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((att, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-panel border border-border font-mono text-[10px] text-muted"
            >
              📎 {att.filename}
              <button
                onClick={() =>
                  setPendingAttachments((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-destructive hover:text-destructive/80 ml-1"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border pt-3 pb-4">
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-muted hover:text-foreground transition-colors shrink-0"
            title="Attach file"
          >
            {uploading ? (
              <span className="w-5 h-5 block border-2 border-muted border-t-primary rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Voice button */}
          <button
            onClick={() => setShowVoice(!showVoice)}
            className={`p-2 transition-colors shrink-0 ${
              showVoice ? "text-primary" : "text-muted hover:text-foreground"
            }`}
            title="Voice input"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Coach button */}
          <button
            onClick={() => setShowCoaches(!showCoaches)}
            className={`p-2 transition-colors shrink-0 ${
              selectedCoachIds.length > 0
                ? "text-secondary"
                : "text-muted hover:text-foreground"
            }`}
            title={`Coaches${selectedCoachIds.length > 0 ? ` (${selectedCoachIds.length})` : ""}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            {selectedCoachIds.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary text-[8px] text-white flex items-center justify-center font-mono">
                {selectedCoachIds.length}
              </span>
            )}
          </button>

          {/* Text input */}
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-panel border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-primary/30 resize-none font-body"
              style={{ minHeight: "40px", maxHeight: "120px" }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
            className="p-2 text-primary hover:text-primary/80 disabled:text-muted disabled:cursor-not-allowed transition-colors shrink-0"
            title="Send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
