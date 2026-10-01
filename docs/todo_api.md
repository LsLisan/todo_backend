# Todo API

All routes use `Authorization: Bearer <token>` from `/api/auth/login` or `/api/auth/register`. IDs are MongoDB ObjectId strings. The current Swagger UI is available at `/docs` while the server is running; this guide documents the Todo routes and payloads.

## Roles and visibility

- A personal todo is visible only to its creator. The creator manages its details, checklist, and subtasks.
- A group todo creator can add/remove members and assign todo moderators. Todo moderators can manage the group todo and its subtasks, but cannot remove the creator. Only the creator can delete the parent todo.
- A subtask has its own member list and moderators. Subtask moderators must be assigned members of that subtask.
- Group members see each subtask's title and progress. Only the parent todo creator/moderators and members/moderators assigned to that subtask see its description, work items, membership, and chat room ID.
- Group todos automatically create a group chat. Each subtask automatically creates a separate invite-only group chat. Removed users lose database access; private room broadcasts also re-check membership and evict stale socket connections.
- Progress is calculated from completed checklist items: `completed / total`. An empty checklist reports `0%`.

## Todo endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/todos` | Create a personal or group todo |
| `GET` | `/api/todos` | List todos where the caller is a member |
| `GET` | `/api/todos/:todoId` | Get a todo, with subtask details filtered by access |
| `PATCH` | `/api/todos/:todoId` | Update title/description (creator or todo moderator) |
| `DELETE` | `/api/todos/:todoId` | Delete todo and its chat rooms (creator only) |
| `POST` | `/api/todos/:todoId/members` | Add a group member (`{ "userId": "..." }`) |
| `DELETE` | `/api/todos/:todoId/members/:userId` | Remove a group member and revoke subtask membership |
| `PUT` | `/api/todos/:todoId/moderators` | Replace moderators (`{ "moderatorIds": ["..."] }`) |
| `POST` | `/api/todos/:todoId/work-items` | Add a parent checklist item (`{ "title": "..." }`) |
| `PATCH` | `/api/todos/:todoId/work-items/:itemId` | Rename or complete an item (`{ "title": "...", "completed": true }`) |
| `DELETE` | `/api/todos/:todoId/work-items/:itemId` | Delete a parent checklist item |

Example personal todo:

```json
{
  "title": "Plan the trip",
  "description": "Book transport and lodging",
  "scope": "personal",
  "workItems": ["Choose dates", "Book train"]
}
```

Example group todo (the creator is included automatically):

```json
{
  "title": "Launch the project",
  "description": "Prepare the first release",
  "scope": "group",
  "memberIds": ["64f1a2b3c4d5e6f7a8b9c0d1"],
  "workItems": ["Finalize scope", "Publish release"]
}
```

## Subtask endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/todos/:todoId/subtodos` | Create a subtask with optional `title`, `description`, `memberIds`, and `workItems` |
| `PATCH` | `/api/todos/:todoId/subtodos/:subTodoId` | Update subtask title/description |
| `DELETE` | `/api/todos/:todoId/subtodos/:subTodoId` | Delete subtask and its chat room (parent creator/moderator) |
| `PUT` | `/api/todos/:todoId/subtodos/:subTodoId/members` | Replace assigned members (`{ "memberIds": ["..."] }`) |
| `PUT` | `/api/todos/:todoId/subtodos/:subTodoId/moderators` | Replace assigned moderators (`{ "moderatorIds": ["..."] }`) |
| `POST` | `/api/todos/:todoId/subtodos/:subTodoId/work-items` | Add a checklist item (`{ "title": "..." }`) |
| `PATCH` | `/api/todos/:todoId/subtodos/:subTodoId/work-items/:itemId` | Rename or complete a checklist item |
| `DELETE` | `/api/todos/:todoId/subtodos/:subTodoId/work-items/:itemId` | Delete a checklist item |

Todo managers and the assigned subtask moderator manage its details and checklist. Assigned subtask members can mark checklist items complete or incomplete. Each work-item update returns the current subtask `progress` object, for example `{ "completed": 2, "total": 4, "percent": 50 }`.

## Chat

Create a Socket.IO connection with the JWT as described in [messaging.md](messaging.md). The parent room ID is returned as `chatRoomId` for group todos; each authorized subtask response contains its own `chatRoomId`. These room IDs work with the existing `message:send`, `message:history`, and typing events. Todo-linked rooms are invite-only and their participants are maintained by the Todo APIs.