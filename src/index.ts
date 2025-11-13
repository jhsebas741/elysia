import openapi, { fromTypes } from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";
import { Context, Elysia, t } from "elysia";
import { Prettify, RouteBase } from "elysia/dist/types";
import { ElysiaWS } from "elysia/dist/ws";

// ⚙️ CONFIGURACIÓN
const ADMIN_PASSWORD = "4dm1n_Chat$"; // Contraseña secreta del admin
const MODERATION_TIME = 5000; // Tiempo en milisegundos para aprobar/rechazar (5000ms = 5s)
const MESSAGE_COOLDOWN = 5000; // Tiempo en milisegundos entre mensajes (5000ms = 5s)

interface User {
  username: string;
  ws: Prettify<ElysiaWS<Context, RouteBase>>;
  isAdmin?: boolean;
  lastMessageTime?: number;
}

interface PendingMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  userId: string;
  timer?: NodeJS.Timeout;
}

interface HistoryMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  status: "approved" | "rejected";
}

interface ChatMessage {
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
    | "admin_joined"
    | "chat_history"
    | "cooldown_error"
    | "clear_history"
    | "kick_all_users";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
  messageId?: string;
  pendingMessage?: PendingMessage;
  remainingTime?: number;
  error?: string;
  history?: HistoryMessage[];
  cooldownRemaining?: number;
}

const users = new Map<string, User>();
const pendingMessages = new Map<string, PendingMessage>();
const messageHistory: HistoryMessage[] = [];
let adminWs: Prettify<ElysiaWS<Context, RouteBase>> | null = null;

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
  .post(
    "/api/admin/validate",
    ({ body }) => {
      const { password } = body;
      return { valid: password === ADMIN_PASSWORD };
    },
    {
      body: t.Object({
        password: t.String(),
      }),
    }
  )
  .ws("/chat", {
    open(ws) {
      console.log("Cliente conectado");
    },

    message(ws, message: ChatMessage) {
      try {
        const data: ChatMessage = message;

        if (data.type === "join" && data.username) {
          const isAdmin = data.username === "__ADMIN__";

          // Validar que el nombre de usuario no esté en uso
          if (!isAdmin) {
            const usernameExists = Array.from(users.values()).some(
              (u) =>
                !u.isAdmin &&
                u.username.toLowerCase() === data.username!.toLowerCase()
            );

            if (usernameExists) {
              // Enviar error al cliente
              const errorMessage: ChatMessage = {
                type: "join_error",
                error:
                  "El nombre de usuario ya está en uso. Por favor elige otro.",
              };
              ws.send(JSON.stringify(errorMessage));
              return;
            }
          }

          users.set(ws.id, {
            username: data.username,
            ws: ws,
            isAdmin: isAdmin,
          });

          if (isAdmin) {
            adminWs = ws;
            console.log("Admin conectado");

            // Enviar confirmación de conexión exitosa
            const successMessage: ChatMessage = {
              type: "join_success",
            };
            ws.send(JSON.stringify(successMessage));

            // Enviar historial completo al admin
            const historyMessage: ChatMessage = {
              type: "chat_history",
              history: messageHistory,
            };
            ws.send(JSON.stringify(historyMessage));

            // Enviar mensajes pendientes actuales al admin
            pendingMessages.forEach((pending) => {
              const adminMessage: ChatMessage = {
                type: "pending_message",
                pendingMessage: pending,
              };
              ws.send(JSON.stringify(adminMessage));
            });
          } else {
            // Enviar confirmación de conexión exitosa al usuario
            const successMessage: ChatMessage = {
              type: "join_success",
            };
            ws.send(JSON.stringify(successMessage));

            // Notificar a todos que se unió un usuario
            const joinMessage: ChatMessage = {
              type: "user_joined",
              username: data.username,
              timestamp: new Date().toISOString(),
            };
            ws.publish("chat", JSON.stringify(joinMessage));

            // Enviar lista de usuarios en línea (sin incluir admin)
            const onlineUsers = Array.from(users.values())
              .filter((u) => !u.isAdmin)
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

          // Verificar cooldown
          const now = Date.now();
          if (user.lastMessageTime) {
            const timeSinceLastMessage = now - user.lastMessageTime;
            const cooldownRemaining = MESSAGE_COOLDOWN - timeSinceLastMessage;

            if (cooldownRemaining > 0) {
              // Enviar error de cooldown
              const cooldownError: ChatMessage = {
                type: "cooldown_error",
                cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
              };
              ws.send(JSON.stringify(cooldownError));
              return;
            }
          }

          // Actualizar tiempo del último mensaje
          user.lastMessageTime = now;

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

        // Admin limpia el historial
        if (data.type === "clear_history") {
          const user = users.get(ws.id);
          if (!user || !user.isAdmin) return;

          // Limpiar el historial del servidor
          messageHistory.length = 0;

          // Notificar al admin que el historial se limpió
          const historyMessage: ChatMessage = {
            type: "chat_history",
            history: [],
          };
          ws.send(JSON.stringify(historyMessage));

          console.log("Admin limpió el historial");
        }

        // Admin expulsa a todos los usuarios
        if (data.type === "kick_all_users") {
          const user = users.get(ws.id);
          if (!user || !user.isAdmin) return;

          console.log("Admin expulsando a todos los usuarios...");

          // Enviar mensaje de expulsión a todos los usuarios (excepto admin)
          const kickMessage: ChatMessage = {
            type: "kick_all_users",
          };

          users.forEach((u) => {
            if (!u.isAdmin) {
              u.ws.send(JSON.stringify(kickMessage));
              // Cerrar la conexión después de enviar el mensaje
              setTimeout(() => {
                u.ws.close();
              }, 100);
            }
          });

          // Limpiar usuarios (mantener solo admin)
          const adminUser = Array.from(users.entries()).find(
            ([_, u]) => u.isAdmin
          );
          users.clear();
          if (adminUser) {
            users.set(adminUser[0], adminUser[1]);
          }

          // Limpiar mensajes pendientes
          pendingMessages.forEach((pending) => {
            if (pending.timer) {
              clearTimeout(pending.timer);
            }
          });
          pendingMessages.clear();

          console.log("Todos los usuarios fueron expulsados");
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
            .filter((u) => !u.isAdmin)
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
    hostname: "0.0.0.0",
    port: 3000,
  });

function approveMessage(messageId: string) {
  const pending = pendingMessages.get(messageId);
  if (!pending) return;

  // Limpiar timer
  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  // Agregar al historial
  messageHistory.push({
    id: messageId,
    username: pending.username,
    message: pending.message,
    timestamp: pending.timestamp,
    status: "approved",
  });

  // Enviar mensaje aprobado a todos los usuarios EXCEPTO al que lo envió
  const chatMessage: ChatMessage = {
    type: "message",
    username: pending.username,
    message: pending.message,
    timestamp: pending.timestamp,
  };

  users.forEach((user) => {
    if (!user.isAdmin && user.ws.id !== pending.userId) {
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

  // Notificar al admin con el historial actualizado
  if (adminWs) {
    const historyMessage: ChatMessage = {
      type: "chat_history",
      history: messageHistory,
    };
    adminWs.send(JSON.stringify(historyMessage));
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

  // Agregar al historial
  messageHistory.push({
    id: messageId,
    username: pending.username,
    message: pending.message,
    timestamp: pending.timestamp,
    status: "rejected",
  });

  // Notificar al usuario que su mensaje fue rechazado
  const senderUser = users.get(pending.userId);
  if (senderUser) {
    const rejectedNotification: ChatMessage = {
      type: "message_rejected",
      messageId: messageId,
    };
    senderUser.ws.send(JSON.stringify(rejectedNotification));
  }

  // Notificar al admin con el historial actualizado
  if (adminWs) {
    const historyMessage: ChatMessage = {
      type: "chat_history",
      history: messageHistory,
    };
    adminWs.send(JSON.stringify(historyMessage));
  }

  // Remover de pendientes
  pendingMessages.delete(messageId);
}

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(`Admin password: ${ADMIN_PASSWORD}`);
