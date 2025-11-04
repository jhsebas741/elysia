import openapi, { fromTypes } from "@elysiajs/openapi";
import staticPlugin from "@elysiajs/static";
import { Elysia } from "elysia";

interface User {
  username: string;
  ws: any;
}

interface ChatMessage {
  type: "message" | "join" | "user_joined" | "user_left" | "online_users";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
}

const users = new Map<string, User>();

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
  .ws("/chat", {
    open(ws) {
      console.log("Cliente conectado");
      ws.subscribe("chat");
    },

    message(ws, message: ChatMessage) {
      try {
        //const data: ChatMessage = JSON.parse(message);
        const data: ChatMessage = message;

        if (data.type === "join" && data.username) {
          // Registrar usuario
          users.set(ws.id, {
            username: data.username,
            ws: ws,
          });

          // Notificar a todos que se unió un usuario
          const joinMessage: ChatMessage = {
            type: "user_joined",
            username: data.username,
            timestamp: new Date().toISOString(),
          };
          ws.publish("chat", JSON.stringify(joinMessage));

          // Enviar lista de usuarios en línea
          const onlineUsers = Array.from(users.values()).map((u) => u.username);
          const usersMessage: ChatMessage = {
            type: "online_users",
            users: onlineUsers,
          };

          // Enviar a todos
          users.forEach((user) => {
            user.ws.send(JSON.stringify(usersMessage));
          });
        }

        if (data.type === "message" && data.message) {
          const user = users.get(ws.id);
          if (!user) return;

          const chatMessage: ChatMessage = {
            type: "message",
            username: user.username,
            message: data.message,
            timestamp: new Date().toISOString(),
          };

          // Enviar a todos
          ws.publish("chat", JSON.stringify(chatMessage));

          user.ws.send(chatMessage);
        }
      } catch (error) {
        console.error("Error procesando mensaje:", error);
      }
    },

    close(ws) {
      const user = users.get(ws.id);
      if (user) {
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
        const onlineUsers = Array.from(users.values()).map((u) => u.username);
        const usersMessage: ChatMessage = {
          type: "online_users",
          users: onlineUsers,
        };

        users.forEach((u) => {
          u.ws.send(JSON.stringify(usersMessage));
        });
      }
    },
  })
  .listen({
    hostname: '0.0.0.0',
    port: 3000
  });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
