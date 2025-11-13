import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "@public/styles/global.css";

// ⚙️ CONFIGURACIÓN
const ADMIN_PASSWORD = "4dm1n_Chat$";
const MODERATION_TIME = 5;

interface Message {
  username: string;
  message: string;
  timestamp: string;
  isOwn?: boolean;
  isSystem?: boolean;
  status?: "pending" | "approved" | "rejected";
  messageId?: string;
}

interface PendingMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  remainingTime: number;
}

interface HistoryMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  status: "approved" | "rejected";
}

interface WebSocketMessage {
  type:
    | "message"
    | "join"
    | "join_success"
    | "join_error"
    | "user_joined"
    | "user_left"
    | "online_users"
    | "message_pending"
    | "message_approved"
    | "message_rejected"
    | "pending_message"
    | "chat_history"
    | "cooldown_error";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
  messageId?: string;
  pendingMessage?: PendingMessage;
  error?: string;
  history?: HistoryMessage[];
  cooldownRemaining?: number;
}

export default function App() {
  const [username, setUsername] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<HistoryMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [showCooldownError, setShowCooldownError] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearInterval(timer));
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectToChat = async () => {
    if (!username.trim() || isConnecting) return;

    setConnectionError("");
    setIsConnecting(true);

    // Verificar si es el admin
    if (username === ADMIN_PASSWORD) {
      try {
        const response = await fetch("/api/admin/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: username }),
        });

        const data = await response.json();

        if (data.valid) {
          setIsAdmin(true);
          connectAdminWebSocket();
          return;
        }
      } catch (err) {
        console.error("Error validando admin:", err);
        setConnectionError("Error al conectar. Intenta de nuevo.");
        setIsConnecting(false);
        return;
      }
    }

    // Conectar como usuario normal
    connectUserWebSocket();
  };

  const connectAdminWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/chat`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const joinMessage: WebSocketMessage = {
        type: "join",
        username: "__ADMIN__",
      };
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);

      if (data.type === "join_success") {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError("");
      }

      if (data.type === "chat_history" && data.history) {
        setChatHistory(data.history);
      }

      if (data.type === "pending_message" && data.pendingMessage) {
        const pending = {
          ...data.pendingMessage,
          remainingTime: MODERATION_TIME,
        };
        setPendingQueue((prev) => [...prev, pending]);
        startCountdown(pending.id);
      }
    };

    ws.onerror = () => {
      setConnectionError("Error de conexión. Intenta de nuevo.");
      setIsConnecting(false);
    };

    wsRef.current = ws;
  };

  const connectUserWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/chat`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      const joinMessage: WebSocketMessage = {
        type: "join",
        username: username,
      };
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);

      if (data.type === "join_success") {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError("");
      }

      if (data.type === "join_error" && data.error) {
        setConnectionError(data.error);
        setIsConnecting(false);
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }

      if (data.type === "message_pending" && data.messageId) {
        setMessages((prev) => [
          ...prev,
          {
            username: username,
            message: data.message || "",
            timestamp: data.timestamp || new Date().toISOString(),
            isOwn: true,
            status: "pending",
            messageId: data.messageId,
          },
        ]);
      }

      if (data.type === "message_approved" && data.messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === data.messageId
              ? { ...msg, status: "approved" }
              : msg
          )
        );
      }

      if (data.type === "message_rejected" && data.messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === data.messageId
              ? { ...msg, status: "rejected" }
              : msg
          )
        );
      }

      if (data.type === "message") {
        setMessages((prev) => {
          if (data.username === username) {
            return prev;
          }

          return [
            ...prev,
            {
              username: data.username || "",
              message: data.message || "",
              timestamp: data.timestamp || new Date().toISOString(),
              isOwn: false,
              status: "approved",
            },
          ];
        });
      }

      if (data.type === "user_joined") {
        setMessages((prev) => [
          ...prev,
          {
            username: "Sistema",
            message: `${data.username} se ha unido al chat`,
            timestamp: data.timestamp || new Date().toISOString(),
            isSystem: true,
          },
        ]);
      }

      if (data.type === "user_left") {
        setMessages((prev) => [
          ...prev,
          {
            username: "Sistema",
            message: `${data.username} ha salido del chat`,
            timestamp: data.timestamp || new Date().toISOString(),
            isSystem: true,
          },
        ]);
      }

      if (data.type === "online_users" && data.users) {
        setOnlineUsers(data.users);
      }

      if (data.type === "cooldown_error" && data.cooldownRemaining) {
        setCooldownRemaining(data.cooldownRemaining);
        setShowCooldownError(true);

        // Iniciar countdown visual
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
        }

        let remaining = data.cooldownRemaining;
        cooldownTimerRef.current = setInterval(() => {
          remaining--;
          setCooldownRemaining(remaining);

          if (remaining <= 0) {
            setShowCooldownError(false);
            if (cooldownTimerRef.current) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
          }
        }, 1000);
      }
    };

    ws.onerror = () => {
      setConnectionError("Error de conexión. Intenta de nuevo.");
      setIsConnecting(false);
    };

    wsRef.current = ws;
  };

  const startCountdown = (messageId: string) => {
    const timer = setInterval(() => {
      setPendingQueue((prev) => {
        const updated = prev
          .map((msg) => {
            if (msg.id === messageId) {
              const newTime = msg.remainingTime - 1;
              if (newTime <= 0) {
                clearInterval(timer);
                timersRef.current.delete(messageId);
                return null;
              }
              return { ...msg, remainingTime: newTime };
            }
            return msg;
          })
          .filter(Boolean) as PendingMessage[];
        return updated;
      });
    }, 1000);

    timersRef.current.set(messageId, timer);
  };

  const approveMessage = (messageId: string) => {
    if (!wsRef.current) return;

    const message: WebSocketMessage = {
      type: "message_approved",
      messageId: messageId,
    };
    wsRef.current.send(JSON.stringify(message));

    const timer = timersRef.current.get(messageId);
    if (timer) {
      clearInterval(timer);
      timersRef.current.delete(messageId);
    }
    setPendingQueue((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  const rejectMessage = (messageId: string) => {
    if (!wsRef.current) return;

    const message: WebSocketMessage = {
      type: "message_rejected",
      messageId: messageId,
    };
    wsRef.current.send(JSON.stringify(message));

    const timer = timersRef.current.get(messageId);
    if (timer) {
      clearInterval(timer);
      timersRef.current.delete(messageId);
    }
    setPendingQueue((prev) => prev.filter((msg) => msg.id !== messageId));
  };

  useEffect(() => {
    if (!isAdmin || !isConnected) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (pendingQueue.length === 0) return;

      const firstMessage = pendingQueue[0];

      if (e.key === "a" || e.key === "A") {
        approveMessage(firstMessage.id);
      } else if (e.key === "r" || e.key === "R") {
        rejectMessage(firstMessage.id);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [pendingQueue, isAdmin, isConnected]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || cooldownRemaining > 0) return;

    const messageData: WebSocketMessage = {
      type: "message",
      message: inputMessage,
    };
    wsRef.current.send(JSON.stringify(messageData));
    setInputMessage("");

    // Iniciar cooldown inmediatamente después de enviar
    setCooldownRemaining(5);
    setShowCooldownError(false);

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }

    let remaining = 5;
    cooldownTimerRef.current = setInterval(() => {
      remaining--;
      setCooldownRemaining(remaining);

      if (remaining <= 0) {
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
      }
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (isConnected) {
        sendMessage();
      } else {
        connectToChat();
      }
    }
  };

  const disconnectFromChat = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsAdmin(false);
    setMessages([]);
    setOnlineUsers([]);
    setPendingQueue([]);
    setUsername("");
    setConnectionError("");
    setCooldownRemaining(0);
    setShowCooldownError(false);
    timersRef.current.forEach((timer) => clearInterval(timer));
    timersRef.current.clear();
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div
            className="absolute bottom-10 right-10 w-32 h-32 bg-rose-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"
            style={{ animationDelay: "700ms" }}
          ></div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md relative z-10 border-4 border-amber-400">
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg transform hover:scale-110 transition-transform">
                <span className="text-4xl">👂</span>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 rounded-full animate-ping"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 rounded-full"></div>
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-rose-600 mb-2">
              El Chismógrafo
            </h1>
            <p className="text-gray-600 font-medium">¡Aquí se habla de todo!</p>
            <p className="text-sm text-amber-700 mt-2 bg-amber-50 px-3 py-1 rounded-full inline-block">
              Chat moderado
            </p>
          </div>

          {connectionError && (
            <div className="mb-5 bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-in slide-in-from-top">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-red-800 text-sm">Error</p>
                  <p className="text-red-700 text-sm">{connectionError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tu Apodo
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setConnectionError("");
                }}
                onKeyPress={handleKeyPress}
                placeholder="Ej: ChismosoAnónimo..."
                className="w-full px-4 py-3 border-3 border-amber-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-200 focus:border-amber-500 transition-all text-gray-800 placeholder-gray-400 font-medium"
                maxLength={20}
                disabled={isConnecting}
              />
            </div>
            <button
              onClick={connectToChat}
              disabled={!username.trim() || isConnecting}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none text-lg"
            >
              {isConnecting ? (
                <span className="flex items-center justify-center space-x-2">
                  <span className="animate-spin">⏳</span>
                  <span>Conectando...</span>
                </span>
              ) : (
                "¡Entrar al Chisme!"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-3 sm:p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 mb-4 border border-slate-600">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-3">
                <div className="bg-amber-500 p-2 sm:p-3 rounded-xl">
                  <span className="text-2xl sm:text-3xl">🔍</span>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white">
                    Panel del Moderador
                  </h1>
                  <p className="text-amber-400 text-xs sm:text-sm font-semibold">
                    Chismes en revisión: {pendingQueue.length} | Historial:{" "}
                    {chatHistory.length}
                  </p>
                </div>
              </div>
              <button
                onClick={disconnectFromChat}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg text-sm sm:text-base"
              >
                Salir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cola de Mensajes Pendientes */}
            <div className="bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 border border-slate-700">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2 mb-2">
                  <span>📋</span>
                  <span>Cola de Moderación</span>
                </h2>
                <div className="text-xs sm:text-sm text-slate-300 bg-slate-700 px-3 py-2 rounded-lg inline-block">
                  <kbd className="px-2 py-1 bg-slate-600 rounded font-bold text-amber-400">
                    A
                  </kbd>{" "}
                  Aprobar ·
                  <kbd className="px-2 py-1 bg-slate-600 rounded font-bold text-red-400 ml-1">
                    R
                  </kbd>{" "}
                  Rechazar
                </div>
              </div>

              <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-3 pr-2">
                {pendingQueue.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="text-5xl mb-3">🤐</div>
                    <p className="text-base font-semibold">
                      Todo tranquilo por ahora...
                    </p>
                    <p className="text-xs mt-1">No hay chismes pendientes</p>
                  </div>
                ) : (
                  pendingQueue.map((msg, idx) => (
                    <div
                      key={msg.id}
                      className={`border-3 rounded-xl p-3 sm:p-4 transition-all ${
                        idx === 0
                          ? "border-amber-500 bg-gradient-to-br from-amber-900/20 to-orange-900/20 shadow-lg shadow-amber-500/20"
                          : "border-slate-600 bg-slate-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-2">
                            <span className="font-bold text-amber-400 flex items-center space-x-1 text-sm">
                              <span>💬</span>
                              <span className="truncate">{msg.username}</span>
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-white text-sm break-words">
                            {msg.message}
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center min-w-[50px]">
                          <div
                            className={`text-2xl font-black ${
                              msg.remainingTime <= 1
                                ? "text-red-500 animate-pulse"
                                : "text-amber-400"
                            }`}
                          >
                            {msg.remainingTime}s
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => approveMessage(msg.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold transition-all text-xs sm:text-sm"
                        >
                          ✓ {idx === 0 && "(A)"}
                        </button>
                        <button
                          onClick={() => rejectMessage(msg.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold transition-all text-xs sm:text-sm"
                        >
                          ✕ {idx === 0 && "(R)"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Historial de Chat */}
            <div className="bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 border border-slate-700">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
                  <span>📜</span>
                  <span>Historial del Chat</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Mensajes aprobados y rechazados
                </p>
              </div>

              <div className="max-h-[calc(100vh-20rem)] overflow-y-auto space-y-2 pr-2">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="text-5xl mb-3">📭</div>
                    <p className="text-base font-semibold">Sin historial aún</p>
                    <p className="text-xs mt-1">
                      Los mensajes moderados aparecerán aquí
                    </p>
                  </div>
                ) : (
                  [...chatHistory].reverse().map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-3 border-l-4 ${
                        msg.status === "approved"
                          ? "bg-green-900/20 border-green-500"
                          : "bg-red-900/20 border-red-500"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`text-lg flex-shrink-0 ${
                              msg.status === "approved"
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {msg.status === "approved" ? "✓" : "✕"}
                          </span>
                          <span className="font-bold text-white text-sm truncate">
                            {msg.username}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-200 text-sm break-words ml-7">
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] bg-white rounded-xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col sm:flex-row border-4 border-amber-400">
        <div className="w-full sm:w-64 lg:w-72 bg-gradient-to-b from-amber-100 to-orange-100 border-b sm:border-b-0 sm:border-r-4 border-amber-400 p-3 sm:p-4 max-h-24 sm:max-h-none overflow-hidden sm:overflow-visible">
          <div className="flex sm:flex-col justify-between items-center sm:items-start">
            <div className="flex items-center space-x-2 sm:justify-between sm:w-full mb-0 sm:mb-4">
              <h2 className="text-base sm:text-lg font-black text-amber-800 flex items-center space-x-1">
                <span className="text-xl">👥</span>
                <span>Chismosos</span>
              </h2>
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                {onlineUsers.length}
              </span>
            </div>
            <div className="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 overflow-x-auto sm:overflow-visible max-w-[60%] sm:max-w-full">
              {onlineUsers.slice(0, 3).map((user: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center space-x-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow whitespace-nowrap"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">
                    {user}
                  </span>
                </div>
              ))}
              {onlineUsers.length > 3 && (
                <div className="text-xs text-amber-700 font-semibold px-2 py-1 hidden sm:block">
                  +{onlineUsers.length - 3} más...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 sm:p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-lg sm:text-xl font-bold">
                  {username[0]?.toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base truncate">
                  {username}
                </h3>
                <p className="text-xs text-amber-100 flex items-center space-x-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span>Chismeando...</span>
                </p>
              </div>
            </div>
            <button
              onClick={disconnectFromChat}
              className="bg-red-600 hover:bg-red-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg flex-shrink-0"
            >
              Salir
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-amber-50/50 to-orange-50/50"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width="20" height="20" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M0 0h20v20H0z" fill="none"/%3E%3Cpath d="M10 0L9 9l-9 1 9 1 1 9 1-9 9-1-9-1z" fill="%23fbbf24" fill-opacity="0.05"/%3E%3C/svg%3E")',
            }}
          >
            {messages.length === 0 && (
              <div className="text-center py-12 text-amber-600">
                <div className="text-5xl mb-3">👂</div>
                <p className="font-bold text-lg">¡Comienza el chisme!</p>
                <p className="text-sm mt-1">Escribe tu primer mensaje...</p>
              </div>
            )}
            {messages.map((msg: Message, idx: number) => (
              <div
                key={idx}
                className={`flex ${
                  msg.isOwn ? "justify-end" : "justify-start"
                } animate-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-xs lg:max-w-md ${
                    msg.isSystem
                      ? "bg-amber-200 text-amber-900 text-center px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-sm"
                      : msg.status === "rejected"
                      ? "bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl rounded-tr-sm opacity-75 shadow-lg"
                      : msg.status === "pending"
                      ? "bg-gradient-to-br from-gray-400 to-gray-500 text-white rounded-2xl rounded-tr-sm animate-pulse shadow-lg"
                      : msg.isOwn
                      ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl rounded-tr-sm shadow-lg"
                      : "bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-md border-2 border-amber-200"
                  } px-3 sm:px-4 py-2 sm:py-2.5 relative`}
                >
                  {!msg.isSystem && (
                    <div className="text-xs font-bold mb-1 flex items-center space-x-1">
                      <span className="opacity-80">{msg.username}</span>
                    </div>
                  )}
                  <div
                    className={`${
                      msg.isSystem ? "" : "mb-1"
                    } text-sm sm:text-base break-words`}
                  >
                    {msg.message}
                  </div>
                  {!msg.isSystem && (
                    <div
                      className={`text-xs text-right flex items-center justify-end space-x-1 ${
                        msg.isOwn ? "opacity-80" : "opacity-60"
                      }`}
                    >
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.status === "pending" && (
                        <span className="ml-1">⏳</span>
                      )}
                      {msg.status === "rejected" && (
                        <span className="ml-1">✕</span>
                      )}
                      {msg.status === "approved" && msg.isOwn && (
                        <span className="ml-1">✓</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-100 to-orange-100 border-t-4 border-amber-400 shadow-lg">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Cuéntanos el chisme... 🗣️"
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border-3 border-amber-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-200 focus:border-amber-500 transition-all text-sm sm:text-base font-medium placeholder-amber-500/60 shadow-inner"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || cooldownRemaining > 0}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none text-sm sm:text-base flex-shrink-0"
              >
                <span className="hidden sm:inline">Enviar</span>
                <span className="sm:hidden">📤</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("elysia")!);
root.render(<App />);
