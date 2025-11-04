import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import "@public/styles/global.css";

interface Message {
  username: string;
  message: string;
  timestamp: string;
  isOwn?: boolean;
  isSystem?: boolean;
}

interface WebSocketMessage {
  type: "message" | "join" | "user_joined" | "user_left" | "online_users";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
}

export default function LiveChat() {
  const [username, setUsername] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  /* const connectToChat = (): void => {
    if (!username.trim()) return;

    // Simulación de conexión WebSocket
    // En producción: const ws = new WebSocket('ws://localhost:3000/chat');
    const mockWs = {
      connected: true,
      send: (data: string) => {
        const msg: WebSocketMessage = JSON.parse(data);
        if (msg.type === "message") {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                username: username,
                message: msg.message || "",
                timestamp: new Date().toISOString(),
                isOwn: true,
              },
            ]);
          }, 100);
        }
      },
      close: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as WebSocket;

    wsRef.current = mockWs;

    setIsConnected(true);
    setOnlineUsers([username, "Usuario Demo"]);

    // Mensaje de bienvenida
    setTimeout(() => {
      setMessages([
        {
          username: "Sistema",
          message: `¡Bienvenido ${username}! 👋`,
          timestamp: new Date().toISOString(),
          isSystem: true,
        },
      ]);
    }, 300);
  }; */

  const connectToChat = (): void => {
    if (!username.trim()) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/chat`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Conectado al servidor");
      const joinMessage: WebSocketMessage = {
        type: "join",
        username: username,
      };
      ws.send(JSON.stringify(joinMessage));
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      console.log("Mensaje recibido:", event.data); // Para debug
      const data: WebSocketMessage = JSON.parse(event.data);

      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          {
            username: data.username || "",
            message: data.message || "",
            timestamp: data.timestamp || new Date().toISOString(),
            isOwn: data.username === username,
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

      if (data.type === "online_users" && data.users) {
        setOnlineUsers(data.users);
      }
    };

    wsRef.current = ws;
  };

  const sendMessage = (): void => {
    if (!inputMessage.trim() || !wsRef.current) return;

    const messageData: WebSocketMessage = {
      type: "message",
      message: inputMessage,
    };

    wsRef.current.send(JSON.stringify(messageData));
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      if (isConnected) {
        sendMessage();
      } else {
        connectToChat();
      }
    }
  };

  const disconnectFromChat = (): void => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setMessages([]);
    setOnlineUsers([]);
    setUsername("");
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Chat en Vivo
            </h1>
            <p className="text-gray-600">Ingresa tu nombre para comenzar</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUsername(e.target.value)
                }
                onKeyPress={handleKeyPress}
                placeholder="Tu nombre..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                maxLength={20}
              />
            </div>

            <button
              onClick={connectToChat}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Entrar al Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-xl overflow-hidden flex">
        {/* Sidebar - Usuarios en línea */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 hidden md:block">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">En línea</h2>
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              {onlineUsers.length}
            </span>
          </div>
          <div className="space-y-2">
            {onlineUsers.map((user: string, idx: number) => (
              <div
                key={idx}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">{user}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                <span className="font-semibold">
                  {username[0]?.toUpperCase()}
                </span>
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

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg: Message, idx: number) => (
              <div
                key={idx}
                className={`flex ${
                  msg.isOwn ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md ${
                    msg.isSystem
                      ? "bg-gray-200 text-gray-700 text-center px-4 py-2 rounded-full text-sm"
                      : msg.isOwn
                      ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm"
                      : "bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-sm"
                  } px-4 py-2`}
                >
                  {!msg.isSystem && (
                    <div className="text-xs font-semibold mb-1 opacity-80">
                      {msg.username}
                    </div>
                  )}
                  <div className={msg.isSystem ? "" : "mb-1"}>
                    {msg.message}
                  </div>
                  {!msg.isSystem && (
                    <div className="text-xs opacity-70 text-right">
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInputMessage(e.target.value)
                }
                onKeyPress={handleKeyPress}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={sendMessage}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
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
root.render(<LiveChat />
);
