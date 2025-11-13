import openapi, { fromTypes } from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";

// ⚙️ CONFIGURACIÓN
const ADMIN_PASSWORD = "admin123"; // Contraseña secreta del admin
const MODERATION_TIME = 3000; // Tiempo en milisegundos para aprobar/rechazar (3000ms = 3s)

interface User {
  username: string;
  ws: any;
  isAdmin?: boolean;
}

interface PendingMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  userId: string;
  timer?: NodeJS.Timeout;
}

interface ChatMessage {
  type: "message" | "join" | "user_joined" | "user_left" | "online_users" | 
        "message_pending" | "message_approved" | "message_rejected" | 
        "pending_message" | "admin_joined";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
  messageId?: string;
  pendingMessage?: PendingMessage;
  remainingTime?: number;
}

const users = new Map<string, User>();
const pendingMessages = new Map<string, PendingMessage>();
let adminWs: any = null;

const app = new Elysia()
  .use(
    openapi({
      references: fromTypes(),
    })
  )
  .use(
    await staticPlugin({
      prefix: "/",
    })
  )
  // Endpoint para validar contraseña de admin
  .post("/api/admin/validate", ({ body }: any) => {
    const { password } = body;
    return { valid: password === ADMIN_PASSWORD };
  })
  .ws("/chat", {
    open(ws) {
      console.log("Cliente conectado");
      ws.subscribe("chat");
    },

    message(ws, message: ChatMessage) {
      try {
        const data: ChatMessage = message;

        if (data.type === "join" && data.username) {
          const isAdmin = data.username === "__ADMIN__";
          
          users.set(ws.id, {
            username: data.username,
            ws: ws,
            isAdmin: isAdmin,
          });

          if (isAdmin) {
            adminWs = ws;
            console.log("Admin conectado");
            
            // Enviar mensajes pendientes actuales al admin
            pendingMessages.forEach((pending) => {
              const adminMessage: ChatMessage = {
                type: "pending_message",
                pendingMessage: pending,
              };
              ws.send(JSON.stringify(adminMessage));
            });
          } else {
            // Notificar a todos que se unió un usuario
            const joinMessage: ChatMessage = {
              type: "user_joined",
              username: data.username,
              timestamp: new Date().toISOString(),
            };
            ws.publish("chat", JSON.stringify(joinMessage));

            // Enviar lista de usuarios en línea (sin incluir admin)
            const onlineUsers = Array.from(users.values())
              .filter(u => !u.isAdmin)
              .map((u) => u.username);
            const usersMessage: ChatMessage = {
              type: "online_users",
              users: onlineUsers,
            };

            users.forEach((user) => {
              if (!user.isAdmin) {
                user.ws.send(JSON.stringify(usersMessage));
              }
            });
          }
        }

        if (data.type === "message" && data.message) {
          const user = users.get(ws.id);
          if (!user || user.isAdmin) return;

          // Crear mensaje pendiente
          const messageId = `${ws.id}-${Date.now()}`;
          const pendingMessage: PendingMessage = {
            id: messageId,
            username: user.username,
            message: data.message,
            timestamp: new Date().toISOString(),
            userId: ws.id,
          };

          pendingMessages.set(messageId, pendingMessage);

          // Notificar al usuario que su mensaje está pendiente
          const pendingNotification: ChatMessage = {
            type: "message_pending",
            messageId: messageId,
            message: data.message,
            timestamp: pendingMessage.timestamp,
          };
          ws.send(JSON.stringify(pendingNotification));

          // Enviar al admin para moderación
          if (adminWs) {
            const adminMessage: ChatMessage = {
              type: "pending_message",
              pendingMessage: pendingMessage,
            };
            adminWs.send(JSON.stringify(adminMessage));
          }

          // Timer de auto-aprobación
          const timer = setTimeout(() => {
            if (pendingMessages.has(messageId)) {
              approveMessage(messageId);
            }
          }, MODERATION_TIME);

          pendingMessage.timer = timer;
        }

        // Admin aprueba mensaje
        if (data.type === "message_approved" && data.messageId) {
          const user = users.get(ws.id);
          if (!user || !user.isAdmin) return;

          approveMessage(data.messageId);
        }

        // Admin rechaza mensaje
        if (data.type === "message_rejected" && data.messageId) {
          const user = users.get(ws.id);
          if (!user || !user.isAdmin) return;

          rejectMessage(data.messageId);
        }
      } catch (error) {
        console.error("Error procesando mensaje:", error);
      }
    },

    close(ws) {
      const user = users.get(ws.id);
      if (user) {
        if (user.isAdmin) {
          adminWs = null;
          console.log("Admin desconectado");
        } else {
          // Notificar que el usuario se fue
          const leaveMessage: ChatMessage = {
            type: "user_left",
            username: user.username,
            timestamp: new Date().toISOString(),
          };
          ws.publish("chat", JSON.stringify(leaveMessage));

          // Remover usuario
          users.delete(ws.id);

          // Actualizar lista de usuarios en línea
          const onlineUsers = Array.from(users.values())
            .filter(u => !u.isAdmin)
            .map((u) => u.username);
          const usersMessage: ChatMessage = {
            type: "online_users",
            users: onlineUsers,
          };

          users.forEach((u) => {
            if (!u.isAdmin) {
              u.ws.send(JSON.stringify(usersMessage));
            }
          });
        }
      }
    },
  })
  .listen({
    hostname: '0.0.0.0',
    port: 3000
  });

function approveMessage(messageId: string) {
  const pending = pendingMessages.get(messageId);
  if (!pending) return;

  // Limpiar timer
  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  // Enviar mensaje aprobado a todos los usuarios
  const chatMessage: ChatMessage = {
    type: "message",
    username: pending.username,
    message: pending.message,
    timestamp: pending.timestamp,
  };

  users.forEach((user) => {
    if (!user.isAdmin) {
      user.ws.send(JSON.stringify(chatMessage));
    }
  });

  // Notificar al usuario que envió que fue aprobado
  const senderUser = users.get(pending.userId);
  if (senderUser) {
    const approvedNotification: ChatMessage = {
      type: "message_approved",
      messageId: messageId,
    };
    senderUser.ws.send(JSON.stringify(approvedNotification));
  }

  // Remover de pendientes
  pendingMessages.delete(messageId);
}

function rejectMessage(messageId: string) {
  const pending = pendingMessages.get(messageId);
  if (!pending) return;

  // Limpiar timer
  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  // Notificar al usuario que su mensaje fue rechazado
  const senderUser = users.get(pending.userId);
  if (senderUser) {
    const rejectedNotification: ChatMessage = {
      type: "message_rejected",
      messageId: messageId,
    };
    senderUser.ws.send(JSON.stringify(rejectedNotification));
  }

  // Remover de pendientes
  pendingMessages.delete(messageId);
}

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`Admin password: ${ADMIN_PASSWORD}`);