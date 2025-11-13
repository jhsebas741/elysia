# Documentación Completa del Proyecto Elysia Chat

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Configuración y Dependencias](#configuración-y-dependencias)
6. [Backend - Servidor Elysia](#backend---servidor-elysia)
7. [Frontend - Aplicación React](#frontend---aplicación-react)
8. [Funcionalidades](#funcionalidades)
9. [Protocolo WebSocket](#protocolo-websocket)
10. [Instalación y Uso](#instalación-y-uso)
11. [Configuración de TypeScript](#configuración-de-typescript)
12. [Estilos y UI](#estilos-y-ui)

---

## 📖 Descripción General

Este proyecto es una **aplicación de chat en tiempo real** construida con tecnologías modernas. Permite a múltiples usuarios conectarse simultáneamente y comunicarse mediante mensajes instantáneos a través de WebSockets. La aplicación está diseñada con un backend robusto usando Elysia y un frontend interactivo con React.

### Características Principales:
- ✅ Chat en tiempo real con WebSockets
- ✅ Lista de usuarios en línea
- ✅ Notificaciones de entrada/salida de usuarios
- ✅ Interfaz de usuario moderna y responsiva
- ✅ Documentación OpenAPI automática
- ✅ Servidor de archivos estáticos integrado

---

## 🏗️ Arquitectura del Proyecto

El proyecto sigue una arquitectura **full-stack** con separación clara entre backend y frontend:

```
┌─────────────────────────────────────────┐
│         Cliente (Navegador)             │
│  ┌───────────────────────────────────┐  │
│  │   React + TypeScript + Tailwind   │  │
│  │   (Frontend - public/index.tsx)   │  │
│  └───────────────────────────────────┘  │
│              ↕ WebSocket                 │
└─────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────┐
│         Servidor Elysia (Bun)           │
│  ┌───────────────────────────────────┐  │
│  │   Elysia Framework + WebSockets   │  │
│  │   (Backend - src/index.ts)        │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   Archivos Estáticos              │  │
│  │   (public/)                       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Flujo de Comunicación:

1. **Cliente → Servidor**: El usuario ingresa su nombre y se conecta al WebSocket
2. **Servidor → Cliente**: El servidor registra al usuario y notifica a todos los demás
3. **Cliente ↔ Cliente**: Los mensajes se envían a través del servidor que los distribuye a todos los clientes conectados

---

## 🛠️ Tecnologías Utilizadas

### Runtime y Entorno
- **Bun** (v1.x): Runtime de JavaScript/TypeScript ultra-rápido que reemplaza a Node.js
  - Compilación nativa de TypeScript
  - Gestor de paquetes integrado
  - Hot reload automático

### Backend
- **Elysia** (latest): Framework web minimalista y rápido para Bun
  - Sintaxis similar a Express pero más performante
  - Soporte nativo para TypeScript
  - Middleware system potente

- **@elysiajs/openapi** (^1.4.11): Plugin para generar documentación OpenAPI automáticamente
  - Genera especificación OpenAPI desde tipos TypeScript
  - Endpoint `/swagger` para ver la documentación

- **@elysiajs/static** (^1.4.2): Plugin para servir archivos estáticos
  - Sirve archivos HTML, CSS, JS desde la carpeta `public/`

### Frontend
- **React** (^19.2.0): Biblioteca de JavaScript para construir interfaces de usuario
  - Versión más reciente con mejoras de rendimiento
  - Hooks para manejo de estado

- **React DOM** (^19.2.0): Renderizador de React para el navegador

- **TypeScript**: Lenguaje de programación tipado que se compila a JavaScript
  - Mejora la calidad del código
  - Detección temprana de errores
  - Mejor autocompletado en IDEs

### Estilos
- **Tailwind CSS** (^4.1.14): Framework de CSS utility-first
  - Clases utilitarias para diseño rápido
  - Diseño responsivo integrado
  - Purge automático de CSS no utilizado

- **bun-plugin-tailwind** (^0.1.2): Plugin de Bun para procesar Tailwind CSS

### Utilidades
- **clsx** (^2.1.1): Utilidad para construir strings de clases CSS condicionalmente
- **@tanstack/react-query** (^5.90.2): Biblioteca para manejo de estado del servidor (instalada pero no utilizada actualmente)
- **@elysiajs/eden** (^1.4.3): Cliente type-safe para Elysia (instalado pero no utilizado actualmente)

---

## 📁 Estructura del Proyecto

```
elysia/
├── src/
│   └── index.ts              # Servidor principal Elysia
├── public/
│   ├── index.html            # Página HTML principal
│   ├── index.tsx             # Componente React del chat
│   └── styles/
│       └── global.css        # Estilos globales (Tailwind)
├── node_modules/             # Dependencias instaladas
├── package.json              # Configuración del proyecto y dependencias
├── tsconfig.json             # Configuración de TypeScript
├── bunfig.toml              # Configuración de Bun
├── bun.lock                  # Lock file de dependencias
└── README.md                 # Documentación básica
```

### Descripción de Directorios:

- **`src/`**: Contiene el código del servidor backend
- **`public/`**: Contiene todos los archivos estáticos que se sirven al cliente
- **`node_modules/`**: Dependencias instaladas por Bun
- **Archivos de configuración**: Configuran el entorno de desarrollo y compilación

---

## ⚙️ Configuración y Dependencias

### package.json

El archivo `package.json` define la configuración del proyecto:

```json
{
  "name": "elysia",
  "version": "1.0.50",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "bun run --watch src/index.ts"
  },
  "dependencies": { ... },
  "devDependencies": { ... },
  "module": "src/index.js"
}
```

**Scripts disponibles:**
- `bun run dev`: Inicia el servidor en modo desarrollo con hot reload
- `bun run test`: Script de prueba (no implementado actualmente)

**Dependencias de Producción:**
- `elysia`: Framework web principal
- `@elysiajs/openapi`: Documentación API
- `@elysiajs/static`: Servidor de archivos estáticos
- `react` y `react-dom`: Framework frontend
- `tailwindcss`: Framework CSS
- `clsx`: Utilidad para clases CSS
- `@tanstack/react-query`: Manejo de estado (no usado)
- `@elysiajs/eden`: Cliente type-safe (no usado)

**Dependencias de Desarrollo:**
- `@types/react` y `@types/react-dom`: Tipos TypeScript para React
- `bun-plugin-tailwind`: Plugin para procesar Tailwind
- `bun-types`: Tipos TypeScript para Bun

### bunfig.toml

Configuración específica de Bun:

```toml
[serve.static]
plugins = ["bun-plugin-tailwind"]
```

Esta configuración indica a Bun que use el plugin de Tailwind cuando sirva archivos estáticos.

---

## 🔧 Backend - Servidor Elysia

### Archivo: `src/index.ts`

El servidor está implementado en un solo archivo que contiene toda la lógica del backend.

#### Interfaces TypeScript

```typescript
interface User {
  username: string;
  ws: any;  // WebSocket connection
}

interface ChatMessage {
  type: "message" | "join" | "user_joined" | "user_left" | "online_users";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
}
```

**Explicación:**
- `User`: Representa un usuario conectado con su nombre y conexión WebSocket
- `ChatMessage`: Define la estructura de los mensajes que se intercambian

#### Almacenamiento de Usuarios

```typescript
const users = new Map<string, User>();
```

Se utiliza un `Map` para almacenar los usuarios conectados, donde:
- **Clave**: ID único de la conexión WebSocket (`ws.id`)
- **Valor**: Objeto `User` con el nombre y la conexión

#### Configuración de la Aplicación Elysia

```typescript
const app = new Elysia()
  .use(openapi({ references: fromTypes() }))
  .use(await staticPlugin({ prefix: "/" }))
  .ws("/chat", { ... })
  .listen({ hostname: '0.0.0.0', port: 3000 });
```

**Plugins utilizados:**
1. **OpenAPI**: Genera documentación automática de la API
2. **Static Plugin**: Sirve archivos estáticos desde `public/` en la ruta raíz `/`

#### WebSocket Endpoint: `/chat`

El endpoint WebSocket maneja tres eventos principales:

##### 1. `open(ws)` - Cuando un cliente se conecta

```typescript
open(ws) {
  console.log("Cliente conectado");
  ws.subscribe("chat");
}
```

- Registra la conexión en la consola
- Suscribe al cliente al canal "chat" para recibir mensajes broadcast

##### 2. `message(ws, message)` - Cuando llega un mensaje

Maneja dos tipos de mensajes:

**a) Mensaje tipo "join":**
```typescript
if (data.type === "join" && data.username) {
  // Registrar usuario
  users.set(ws.id, { username: data.username, ws: ws });
  
  // Notificar a todos que se unió un usuario
  ws.publish("chat", JSON.stringify(joinMessage));
  
  // Enviar lista de usuarios en línea a todos
  // ...
}
```

**b) Mensaje tipo "message":**
```typescript
if (data.type === "message" && data.message) {
  const user = users.get(ws.id);
  if (!user) return;
  
  const chatMessage = { ... };
  ws.publish("chat", JSON.stringify(chatMessage));
}
```

##### 3. `close(ws)` - Cuando un cliente se desconecta

```typescript
close(ws) {
  const user = users.get(ws.id);
  if (user) {
    // Notificar que el usuario se fue
    ws.publish("chat", JSON.stringify(leaveMessage));
    
    // Remover usuario
    users.delete(ws.id);
    
    // Actualizar lista de usuarios en línea
    // ...
  }
}
```

#### Inicio del Servidor

```typescript
.listen({
  hostname: '0.0.0.0',  // Escucha en todas las interfaces de red
  port: 3000            // Puerto 3000
});
```

El servidor escucha en `0.0.0.0:3000`, lo que significa que está accesible desde cualquier interfaz de red en el puerto 3000.

---

## 🎨 Frontend - Aplicación React

### Archivo: `public/index.html`

HTML básico que carga la aplicación React:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Elysia Static</title>
  </head>
  <body>
    <div id="elysia"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
```

**Características:**
- Punto de montaje: `<div id="elysia">`
- Carga el script TypeScript como módulo ES6

### Archivo: `public/index.tsx`

Componente principal de React que implementa la interfaz del chat.

#### Interfaces TypeScript

```typescript
interface Message {
  username: string;
  message: string;
  timestamp: string;
  isOwn?: boolean;      // Si el mensaje es del usuario actual
  isSystem?: boolean;   // Si es un mensaje del sistema
}

interface WebSocketMessage {
  type: "message" | "join" | "user_joined" | "user_left" | "online_users";
  username?: string;
  message?: string;
  timestamp?: string;
  users?: string[];
}
```

#### Estado del Componente

```typescript
const [username, setUsername] = useState<string>("");
const [isConnected, setIsConnected] = useState<boolean>(false);
const [messages, setMessages] = useState<Message[]>([]);
const [inputMessage, setInputMessage] = useState<string>("");
const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
const wsRef = useRef<WebSocket | null>(null);
const messagesEndRef = useRef<HTMLDivElement>(null);
```

**Estados:**
- `username`: Nombre del usuario actual
- `isConnected`: Estado de conexión WebSocket
- `messages`: Array de mensajes mostrados
- `inputMessage`: Texto del input de mensaje
- `onlineUsers`: Lista de usuarios conectados

**Refs:**
- `wsRef`: Referencia a la conexión WebSocket
- `messagesEndRef`: Referencia al final del contenedor de mensajes (para auto-scroll)

#### Funciones Principales

##### `connectToChat()`

Establece la conexión WebSocket:

```typescript
const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsUrl = `${protocol}://${window.location.host}/chat`;
const ws = new WebSocket(wsUrl);
```

**Características:**
- Detecta automáticamente si usar `ws://` o `wss://` según el protocolo
- Envía mensaje de tipo "join" al conectarse
- Configura handlers para `onopen`, `onmessage`

##### `sendMessage()`

Envía un mensaje al servidor:

```typescript
const messageData: WebSocketMessage = {
  type: "message",
  message: inputMessage,
};
wsRef.current.send(JSON.stringify(messageData));
```

##### `disconnectFromChat()`

Cierra la conexión y limpia el estado.

##### `formatTime()`

Formatea timestamps a formato de hora legible (HH:MM).

#### Renderizado Condicional

El componente renderiza dos vistas diferentes:

**1. Vista de Conexión** (cuando `!isConnected`):
- Formulario para ingresar nombre de usuario
- Botón "Entrar al Chat"
- Diseño centrado con gradiente

**2. Vista del Chat** (cuando `isConnected`):
- **Sidebar izquierdo**: Lista de usuarios en línea
- **Área principal**: 
  - Header con nombre de usuario y botón salir
  - Contenedor de mensajes con scroll automático
  - Input y botón para enviar mensajes

#### Estilos con Tailwind CSS

El componente utiliza clases de Tailwind para el diseño:

- **Gradientes**: `bg-gradient-to-br from-blue-50 to-indigo-100`
- **Sombras**: `shadow-xl`, `shadow-lg`
- **Responsive**: `hidden md:block` para ocultar sidebar en móviles
- **Transiciones**: `transition-colors`, `hover:bg-indigo-700`
- **Flexbox**: `flex`, `flex-col`, `items-center`, `justify-between`

### Archivo: `public/styles/global.css`

```css
@import 'tailwindcss';
```

Importa Tailwind CSS para que las clases estén disponibles en toda la aplicación.

---

## 🚀 Funcionalidades

### 1. Sistema de Autenticación/Registro

- Los usuarios ingresan un nombre de usuario antes de conectarse
- El nombre se valida (no puede estar vacío)
- Se registra en el servidor al conectarse

### 2. Chat en Tiempo Real

- Los mensajes se envían y reciben instantáneamente
- Todos los usuarios conectados ven los mensajes en tiempo real
- Los mensajes muestran:
  - Nombre del usuario
  - Contenido del mensaje
  - Hora de envío

### 3. Lista de Usuarios en Línea

- Muestra todos los usuarios conectados en tiempo real
- Se actualiza automáticamente cuando alguien se conecta o desconecta
- Muestra el contador de usuarios en línea

### 4. Notificaciones del Sistema

- Notifica cuando un usuario se une al chat
- Notifica cuando un usuario abandona el chat
- Los mensajes del sistema tienen un estilo diferente

### 5. Interfaz de Usuario

- **Diseño moderno**: Gradientes, sombras, bordes redondeados
- **Responsive**: Se adapta a diferentes tamaños de pantalla
- **Auto-scroll**: Los mensajes nuevos hacen scroll automático
- **Diferencia visual**: Los mensajes propios se muestran a la derecha con color diferente

### 6. Manejo de Errores

- Validación de nombre de usuario
- Validación de mensajes vacíos
- Manejo de errores en el procesamiento de mensajes WebSocket

---

## 🔌 Protocolo WebSocket

### Tipos de Mensajes

#### 1. `join` - Unirse al chat
**Cliente → Servidor:**
```json
{
  "type": "join",
  "username": "Juan"
}
```

**Efecto:**
- Registra al usuario en el servidor
- Notifica a todos los demás usuarios
- Envía lista actualizada de usuarios en línea

#### 2. `message` - Enviar mensaje
**Cliente → Servidor:**
```json
{
  "type": "message",
  "message": "Hola a todos!"
}
```

**Servidor → Todos los clientes:**
```json
{
  "type": "message",
  "username": "Juan",
  "message": "Hola a todos!",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 3. `user_joined` - Usuario se unió
**Servidor → Todos los clientes:**
```json
{
  "type": "user_joined",
  "username": "María",
  "timestamp": "2024-01-15T10:31:00.000Z"
}
```

#### 4. `user_left` - Usuario se desconectó
**Servidor → Todos los clientes:**
```json
{
  "type": "user_left",
  "username": "Pedro",
  "timestamp": "2024-01-15T10:32:00.000Z"
}
```

#### 5. `online_users` - Lista de usuarios en línea
**Servidor → Todos los clientes:**
```json
{
  "type": "online_users",
  "users": ["Juan", "María", "Pedro"]
}
```

### Flujo de Comunicación Completo

```
1. Cliente abre conexión WebSocket → ws://localhost:3000/chat
2. Servidor ejecuta open() → Suscribe al canal "chat"
3. Cliente envía {"type": "join", "username": "Juan"}
4. Servidor:
   - Registra usuario en Map
   - Publica {"type": "user_joined", "username": "Juan"} a todos
   - Envía {"type": "online_users", "users": [...]} a todos
5. Cliente envía {"type": "message", "message": "Hola"}
6. Servidor publica mensaje completo a todos en el canal "chat"
7. Cuando cliente cierra conexión:
   - Servidor ejecuta close()
   - Publica {"type": "user_left", "username": "Juan"}
   - Actualiza lista de usuarios
```

---

## 📦 Instalación y Uso

### Requisitos Previos

- **Bun**: Runtime de JavaScript/TypeScript
  - Instalación: https://bun.sh/docs/installation

### Pasos de Instalación

1. **Clonar o descargar el proyecto**

2. **Instalar dependencias:**
```bash
bun install
```

3. **Iniciar el servidor de desarrollo:**
```bash
bun run dev
```

4. **Abrir en el navegador:**
```
http://localhost:3000
```

### Comandos Disponibles

- `bun run dev`: Inicia el servidor con hot reload
- `bun install`: Instala todas las dependencias
- `bun add <paquete>`: Añade una nueva dependencia
- `bun remove <paquete>`: Elimina una dependencia

### Producción

Para ejecutar en producción:

```bash
bun run src/index.ts
```

O compilar y ejecutar:

```bash
bun build src/index.ts --outdir ./dist
```

---

## ⚙️ Configuración de TypeScript

### Archivo: `tsconfig.json`

Configuración completa de TypeScript para el proyecto:

#### Configuraciones Importantes:

**Target y Module:**
```json
"target": "ES2021",
"module": "ES2022"
```
- Compila a ES2021
- Usa módulos ES2022

**JSX:**
```json
"jsx": "preserve"
```
- Preserva JSX para que Bun lo procese

**Strict Mode:**
```json
"strict": true
```
- Habilita todas las verificaciones estrictas de TypeScript

**Path Aliases:**
```json
"paths": {
  "@server": ["./src/index.ts"],
  "@server/*": ["./src/*"],
  "@public/*": ["./public/*"]
}
```
- Permite importar con alias:
  - `@server` → `src/index.ts`
  - `@server/utils` → `src/utils`
  - `@public/styles` → `public/styles`

**Tipos:**
```json
"types": ["bun-types"]
```
- Incluye tipos de Bun automáticamente

---

## 🎨 Estilos y UI

### Framework: Tailwind CSS v4.1.14

Tailwind CSS es un framework utility-first que permite construir interfaces rápidamente usando clases predefinidas.

### Paleta de Colores Utilizada

- **Indigo**: Color principal (botones, header)
  - `indigo-600`: Color principal
  - `indigo-700`: Hover states
  - `indigo-500`: Variaciones
  - `indigo-200`: Texto secundario

- **Gris**: Fondos y bordes
  - `gray-50`: Fondos claros
  - `gray-100`: Hover states
  - `gray-200`: Bordes
  - `gray-700`: Texto
  - `gray-800`: Texto oscuro

- **Verde**: Indicadores de estado
  - `green-500`: Indicador de usuario en línea

- **Blanco**: Fondos de contenedores

### Componentes de UI

#### 1. Pantalla de Conexión
- Fondo con gradiente azul
- Card centrado con sombra
- Input con focus states
- Botón con efectos hover

#### 2. Chat Principal
- Layout de dos columnas (sidebar + chat)
- Header fijo con información del usuario
- Área de mensajes con scroll
- Input fijo en la parte inferior

#### 3. Mensajes
- **Mensajes propios**: Fondo indigo, alineados a la derecha
- **Mensajes de otros**: Fondo blanco, alineados a la izquierda
- **Mensajes del sistema**: Fondo gris, centrados, sin nombre de usuario

#### 4. Sidebar de Usuarios
- Lista de usuarios con indicador verde
- Contador de usuarios en línea
- Oculto en pantallas pequeñas (`hidden md:block`)

### Responsive Design

- **Móvil**: Sidebar oculto, chat a pantalla completa
- **Tablet/Desktop**: Sidebar visible, layout de dos columnas

---

## 🔍 Detalles Técnicos Adicionales

### Gestión de Memoria

- Los usuarios se almacenan en un `Map` en memoria
- Al desconectarse, se eliminan del Map
- No hay persistencia de datos (todos los datos se pierden al reiniciar el servidor)

### Escalabilidad

**Limitaciones actuales:**
- Todos los usuarios están en un solo servidor
- No hay balanceo de carga
- No hay persistencia de mensajes

**Mejoras posibles:**
- Implementar Redis para compartir estado entre servidores
- Base de datos para persistir mensajes
- Sistema de salas/canales
- Autenticación y autorización

### Seguridad

**Consideraciones:**
- No hay validación de entrada robusta
- No hay límite de longitud de mensajes
- No hay protección contra spam
- No hay autenticación de usuarios

**Mejoras recomendadas:**
- Validar y sanitizar todos los inputs
- Implementar rate limiting
- Añadir autenticación (JWT, OAuth)
- Validar nombres de usuario únicos

### Performance

**Optimizaciones actuales:**
- Bun es extremadamente rápido
- WebSockets son eficientes para comunicación en tiempo real
- Tailwind CSS se purga automáticamente

**Métricas esperadas:**
- Latencia de mensajes: < 10ms en red local
- Soporte de usuarios concurrentes: Depende del hardware, pero Bun puede manejar miles de conexiones

---

## 📚 Recursos y Referencias

### Documentación Oficial

- **Elysia**: https://elysiajs.com
- **Bun**: https://bun.sh/docs
- **React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

### Extensiones y Plugins

- `@elysiajs/openapi`: Documentación automática de API
- `@elysiajs/static`: Servidor de archivos estáticos
- `bun-plugin-tailwind`: Procesamiento de Tailwind CSS

---

## 🎯 Resumen Ejecutivo

Este proyecto es una **aplicación de chat en tiempo real** construida con tecnologías modernas:

- **Backend**: Elysia (framework web para Bun) con WebSockets
- **Frontend**: React 19 con TypeScript y Tailwind CSS
- **Runtime**: Bun (alternativa rápida a Node.js)
- **Características**: Chat en tiempo real, lista de usuarios, notificaciones

**Puntos fuertes:**
- ✅ Código limpio y bien estructurado
- ✅ TypeScript para type safety
- ✅ UI moderna y responsiva
- ✅ Performance excelente con Bun
- ✅ Fácil de extender y modificar

**Áreas de mejora:**
- ⚠️ Persistencia de datos
- ⚠️ Autenticación y seguridad
- ⚠️ Manejo de errores más robusto
- ⚠️ Tests automatizados

---

## 📝 Notas Finales

Este documento proporciona una visión completa del proyecto. Para más detalles sobre cualquier sección específica, consulta el código fuente comentado o la documentación oficial de las tecnologías utilizadas.

**Versión del Proyecto**: 1.0.50  
**Última actualización**: 2024

---

*Documentación generada para el proyecto Elysia Chat*
