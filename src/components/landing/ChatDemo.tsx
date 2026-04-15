"use client";

import { useChat } from "@ai-sdk/react";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";

export function ChatDemo({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const containerBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const userBubbleBg = isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-100 text-zinc-900";
  const assistantBubbleBg = isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const inputBg = isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400";

  const { messages, input, handleInputChange, handleSubmit, status, error } = useChat({
    api: "/api/demo/chat",
    initialMessages: [
      {
        id: "init",
        role: "assistant",
        content: "Ask me anything — I'm powered by a free model via OpenRouter.",
      },
    ],
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className={`flex flex-col border ${containerBg}`} style={{ height: "400px" }}>
      {/* Header */}
      <div className={`flex items-center gap-2 border-b px-4 py-2 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
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
                {msg.role === "assistant" && isStreaming && msg.id === messages[messages.length - 1]?.id && (
                  <span className="ml-0.5 inline-block animate-pulse">▋</span>
                )}
              </div>
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className={`border px-3 py-2 text-sm ${assistantBubbleBg}`}>
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          )}
          {error && (
            <p className="text-center text-xs text-red-500">{error.message}</p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`flex items-end gap-2 border-t px-3 py-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
      >
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
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
          disabled={isStreaming || !input?.trim()}
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
