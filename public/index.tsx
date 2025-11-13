import { useState, useEffect, useRef } from "react";

import { createRoot } from "react-dom/client";

import "@public/styles/global.css";

// ⚙️ CONFIGURACIÓN
const ADMIN_PASSWORD = "admin123"; // Contraseña secreta del admin
const MODERATION_TIME = 5; // Tiempo en segundos para aprobar/rechazar

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

interface WebSocketMessage {
  type: "message" | "join" | "user_joined" | "user_left" | "online_users" | 
        "message_pending" | "message_approved" | "message_rejected" | "pending_message";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
  messageId?: string;
  pendingMessage?: PendingMessage;
}

export default function App() {
  const [username, setUsername] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearInterval(timer));
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectToChat = async () => {
    if (!username.trim()) return;

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
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);

      if (data.type === "pending_message" && data.pendingMessage) {
        const pending = { ...data.pendingMessage, remainingTime: MODERATION_TIME };
        setPendingQueue((prev) => [...prev, pending]);
        startCountdown(pending.id);
      }
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
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);

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
            msg.messageId === data.messageId ? { ...msg, status: "approved" } : msg
          )
        );
      }

      if (data.type === "message_rejected" && data.messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === data.messageId ? { ...msg, status: "rejected" } : msg
          )
        );
      }

      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          {
            username: data.username || "",
            message: data.message || "",
            timestamp: data.timestamp || new Date().toISOString(),
            isOwn: data.username === username,
            status: "approved",
          },
        ]);
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
    };

    wsRef.current = ws;
  };

  const startCountdown = (messageId: string) => {
    const timer = setInterval(() => {
      setPendingQueue((prev) => {
        const updated = prev.map((msg) => {
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
        }).filter(Boolean) as PendingMessage[];
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

  // Atajos de teclado para admin
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
    if (!inputMessage.trim() || !wsRef.current) return;

    const messageData: WebSocketMessage = {
      type: "message",
      message: inputMessage,
    };
    wsRef.current.send(JSON.stringify(messageData));
    setInputMessage("");
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
    timersRef.current.forEach(timer => clearInterval(timer));
    timersRef.current.clear();
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Vista de Login
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Chat Moderado</h1>
            <p className="text-gray-600">Ingresa tu nombre para comenzar</p>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tu nombre..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                maxLength={20}
              />
            </div>
            <button
              onClick={connectToChat}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
            >
              Entrar al Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vista de Admin
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Panel de Moderación</h1>
                <p className="text-gray-600 text-sm mt-1">Mensajes en cola: {pendingQueue.length}</p>
              </div>
              <button
                onClick={disconnectFromChat}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Salir
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Cola de Mensajes</h2>
              <div className="text-sm text-gray-600">
                Atajos: <kbd className="px-2 py-1 bg-gray-100 rounded">A</kbd> Aprobar · 
                <kbd className="px-2 py-1 bg-gray-100 rounded ml-1">R</kbd> Rechazar
              </div>
            </div>

            {pendingQueue.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No hay mensajes pendientes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingQueue.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={`border-2 rounded-xl p-4 ${
                      idx === 0 ? "border-purple-500 bg-purple-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold text-gray-800">{msg.username}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-700">{msg.message}</p>
                      </div>
                      <div className="ml-4 flex flex-col items-center">
                        <div className={`text-2xl font-bold ${
                          msg.remainingTime <= 1 ? "text-red-500" : "text-purple-600"
                        }`}>
                          {msg.remainingTime}s
                        </div>
                        <div className="text-xs text-gray-500">restantes</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => approveMessage(msg.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold transition-colors"
                      >
                        ✓ Aprobar {idx === 0 && "(A)"}
                      </button>
                      <button
                        onClick={() => rejectMessage(msg.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-semibold transition-colors"
                      >
                        ✕ Rechazar {idx === 0 && "(R)"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista de Usuario (Chat normal)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-xl overflow-hidden flex">
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 hidden md:block">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">En línea</h2>
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              {onlineUsers.length}
            </span>
          </div>
          <div className="space-y-2">
            {onlineUsers.map((user: string, idx: number) => (
              <div key={idx} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">{user}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                <span className="font-semibold">{username[0]?.toUpperCase()}</span>
              </div>
              <div>
                <h3 className="font-semibold">{username}</h3>
                <p className="text-xs text-indigo-200">Conectado</p>
              </div>
            </div>
            <button
              onClick={disconnectFromChat}
              className="bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Salir
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg: Message, idx: number) => (
              <div key={idx} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs lg:max-w-md ${
                    msg.isSystem
                      ? "bg-gray-200 text-gray-700 text-center px-4 py-2 rounded-full text-sm"
                      : msg.status === "rejected"
                      ? "bg-red-500 text-white rounded-2xl rounded-tr-sm opacity-75"
                      : msg.status === "pending"
                      ? "bg-gray-400 text-white rounded-2xl rounded-tr-sm animate-pulse"
                      : msg.isOwn
                      ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm"
                      : "bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-sm"
                  } px-4 py-2 relative`}
                >
                  {!msg.isSystem && (
                    <div className="text-xs font-semibold mb-1 opacity-80">{msg.username}</div>
                  )}
                  <div className={msg.isSystem ? "" : "mb-1"}>{msg.message}</div>
                  {!msg.isSystem && (
                    <div className="text-xs opacity-70 text-right flex items-center justify-end space-x-1">
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.status === "pending" && <span className="ml-1">⏳</span>}
                      {msg.status === "rejected" && <span className="ml-1">✕</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={sendMessage}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("elysia")!);
root.render(<App />
);
