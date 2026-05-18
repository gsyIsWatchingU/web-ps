import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type MessageApi = {
  warning: (content: string, durationMs?: number) => void;
};

type MessageState = {
  id: number;
  type: "warning";
  content: string;
} | null;

const MessageContext = createContext<MessageApi | null>(null);

export function MessageProvider({ children }: { children: ReactNode }) {
  const [messageState, setMessageState] = useState<MessageState>(null);
  const timerRef = useRef<number | null>(null);

  const message = useMemo<MessageApi>(
    () => ({
      warning: (content, durationMs = 2200) => {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }

        setMessageState({
          id: Date.now(),
          type: "warning",
          content
        });

        timerRef.current = window.setTimeout(() => {
          setMessageState(null);
          timerRef.current = null;
        }, durationMs);
      }
    }),
    []
  );

  return (
    <MessageContext.Provider value={message}>
      {children}
      <div className="app-message-root" aria-live="assertive" aria-atomic="true">
        {messageState ? (
          <div className={`app-message app-message--${messageState.type}`} key={messageState.id} role="alert">
            {messageState.content}
          </div>
        ) : null}
      </div>
    </MessageContext.Provider>
  );
}

export function useMessage() {
  const context = useContext(MessageContext);

  if (!context) {
    throw new Error("useMessage must be used within MessageProvider.");
  }

  return context;
}
