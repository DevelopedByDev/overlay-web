"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const INITIAL: Message[] = [
  {
    id: "init",
    role: "assistant",
    content: "Ask me anything — I'm powered by a free model via OpenRouter.",
  },
];

export function ChatDemo({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const containerBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const userBubbleBg = isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-100 text-zinc-900";
  const assistantBubbleBg = isDark
    ? "bg-zinc-800 border-zinc-700 text-zinc-100"
    : "bg-white border-zinc-200 text-zinc-900";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const inputBg = isDark
    ? "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500"
    : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400";

  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);
    setError(null);

    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + parsed.delta } : m
                )
              );
            } else if (parsed.type === "error") {
              throw new Error(parsed.errorText || "Model error");
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className={`flex flex-col border ${containerBg}`} style={{ height: "400px" }}>
      {/* Header */}
      <div
        className={`flex items-center gap-2 border-b px-4 py-2 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
      >
        <div className="h-2 w-2 bg-green-500" />
        <span className={`text-xs font-medium ${muted}`}>live demo · openrouter free</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? userBubbleBg
                    : `border ${assistantBubbleBg}`
                }`}
              >
                <span className="whitespace-pre-wrap">{msg.content}</span>
                {msg.role === "assistant" &&
                  isStreaming &&
                  msg.id === messages[messages.length - 1]?.id && (
                    <span className="ml-0.5 inline-block animate-pulse">▋</span>
                  )}
              </div>
            </div>
          ))}
          {error && (
            <p className="text-center text-xs text-red-500">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className={`flex items-end gap-2 border-t px-3 py-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ask anything..."
          rows={1}
          className={`overlay-interactive flex-1 resize-none border px-3 py-2 text-sm focus:outline-none ${inputBg}`}
          style={{ maxHeight: "96px" }}
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className={`overlay-interactive inline-flex h-9 w-9 flex-shrink-0 items-center justify-center border disabled:opacity-40 ${
            isDark ? "border-zinc-600 text-zinc-300" : "border-zinc-300 text-zinc-700"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
