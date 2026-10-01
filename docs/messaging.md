# Messaging API

Messaging uses Socket.IO and requires the same JWT returned by `/api/auth/login` or `/api/auth/register`.

## Connection

Install the client package in the app:

```bash
npm install socket.io-client
```

Connect with the token in the Socket.IO `auth` object:

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: { token },
});
```

The server also accepts `Authorization: Bearer <token>` in the handshake headers. An invalid, expired, or missing token rejects the connection.

## Room types

- `normal`: a private one-to-one room. It must contain the creator and exactly one other user. Only its two participants can join it, and it cannot be left.
- `group`: a room with two or more participants. The creator may provide a name. Any authenticated user can join a group when they know its room ID; membership is persisted.

Room and message IDs are MongoDB ObjectId strings.

## Events sent by the client

The optional last argument on command events is a Socket.IO acknowledgement callback. Successful acknowledgements contain `{ ok: true, ... }`; failures contain `{ ok: false, message }` and are also emitted as `messaging:error`.

### `room:create`

```ts
socket.emit("room:create", {
  type: "normal" | "group",
  name?: string,
  participantIds: string[],
}, (response) => {});
```

The current user is automatically added to `participantIds`. A normal room needs exactly one other participant; a group needs at least one other participant.

### `room:join`

```ts
socket.emit("room:join", { roomId }, (response) => {});
```

Joins the Socket.IO room and emits `room:member_joined` to its members.

### `room:leave`

```ts
socket.emit("room:leave", { roomId }, (response) => {});
```

Only group rooms can be left. The user is removed from persisted membership.

### `room:list`

```ts
socket.emit("room:list", (response) => {
  // response.rooms
});
```

Returns the authenticated user's rooms, newest activity first. On reconnect, existing rooms are subscribed automatically.

### `message:send`

```ts
socket.emit("message:send", {
  roomId,
  body: "Hello",
  images: ["https://cdn.example.com/photo.jpg"],
}, (response) => {});
```

Send text only, up to 10 images only, or both. Images must be `http(s)` URLs or base64 image data URLs. The server derives the message type as `text`, `images`, or `images+text`, stores the message, and broadcasts `message:new` to all connected members.

### `message:history`

```ts
socket.emit("message:history", { roomId, limit?: 50 }, (response) => {
  // response.messages, oldest first
});
```

`limit` is clamped to 1-100. Only room members can read history.

### `typing:start` and `typing:stop`

```ts
socket.emit("typing:start", { roomId });
socket.emit("typing:stop", { roomId });
```

These are transient events and are not stored.

## Events received by the client

### `room:created`

Sent to every currently connected participant after a room is created. Payload:

```ts
{
  id: string;
  type: "normal" | "group";
  name?: string;
  participants: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### `room:member_joined` and `room:member_left`

Room membership change notifications. `room:member_joined` contains `{ room, userId }`; `room:member_left` contains `{ roomId, userId }`.

### `message:new`

```ts
{
  id: string;
  roomId: string;
  senderId: string;
  type: "text" | "images" | "images+text";
  body?: string;
  images: string[];
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### `typing:start` and `typing:stop`

Typing notifications contain `roomId`, `userId`, and, for `typing:start`, `username`.

### `messaging:error`

```ts
{ ok: false, message: string }
```

## Suggested client flow

1. Connect with the JWT in `auth.token`.
2. Request `room:list` and render the returned rooms.
3. Create a room with `room:create`, or join a known group with `room:join`.
4. Load older messages with `message:history`.
5. Send new messages with `message:send` and listen for `message:new`.
6. Display typing events as temporary UI state and clear it on `typing:stop` or a timeout.