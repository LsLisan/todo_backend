import type { Request, Response } from "express";
import { Types } from "mongoose";
import { ChatRoom } from "../../../mesaging/model/chat_room_model.js";
import { User } from "../../../profile/model/user_model.js";
import { Todo, type ITodo, type ISubTodo, type IWorkItem, type TodoScope } from "../model/todo_model.js";
import { TodoHistory, type TodoParticipantRole } from "../model/todo_history_model.js";

type Handler = (req: Request, res: Response) => Promise<unknown>;
const idValid = (value: string) => Types.ObjectId.isValid(value);
const idsValid = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === "string" && idValid(id));
const idsOf = (values: Types.ObjectId[]) => values.map((value) => value.toString());
const routeParam = (req: Request, key: string) => {
    const value = req.params[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

function endpoint(handler: Handler) {
    return (req: Request, res: Response) => {
        handler(req, res).catch((error: unknown) => {
            console.error("Todo API error:", error);
            if (!res.headersSent) res.status(500).json({ message: "Internal server error" });
        });
    };
}

function currentUserId(req: Request) {
    return req.userId!;
}

function sameId(left: Types.ObjectId | string, right: string) {
    return left.toString() === right;
}

function isTodoManager(todo: ITodo, userId: string) {
    return sameId(todo.creator, userId) || (todo.scope === "group" && todo.moderatorIds.some((id) => sameId(id, userId)));
}

function isSubTodoManager(todo: ITodo, subTodo: ISubTodo, userId: string) {
    return isTodoManager(todo, userId) || subTodo.moderatorIds.some((id) => sameId(id, userId));
}

function getProgress(workItems: IWorkItem[]) {
    const total = workItems.length;
    const completed = workItems.filter((item) => item.completed).length;
    return { completed, total, percent: total === 0 ? 0 : Math.round(completed * 100 / total) };
}

function publicWorkItem(item: IWorkItem) {
    return { id: item._id.toString(), title: item.title, completed: item.completed, completedBy: item.completedBy?.toString(), completedAt: item.completedAt };
}

function publicSubTodo(subTodo: ISubTodo, canSeeDetails: boolean) {
    const result: Record<string, unknown> = {
        id: subTodo._id.toString(),
        title: subTodo.title,
        progress: getProgress(subTodo.workItems),
        createdAt: subTodo.createdAt,
        updatedAt: subTodo.updatedAt,
    };
    if (canSeeDetails) {
        result.description = subTodo.description;
        result.memberIds = idsOf(subTodo.memberIds);
        result.moderatorIds = idsOf(subTodo.moderatorIds);
        result.chatRoomId = subTodo.chatRoom.toString();
        result.workItems = subTodo.workItems.map(publicWorkItem);
    }
    return result;
}

function publicTodo(todo: ITodo, userId: string) {
    const canManage = isTodoManager(todo, userId);
    return {
        id: todo._id.toString(),
        title: todo.title,
        description: todo.description,
        scope: todo.scope,
        status: todo.status,
        creatorId: todo.creator.toString(),
        memberIds: idsOf(todo.memberIds),
        moderatorIds: idsOf(todo.moderatorIds),
        chatRoomId: todo.chatRoom?.toString(),
        workItems: todo.workItems.map(publicWorkItem),
        subtodos: todo.subtodos.map((subTodo) => publicSubTodo(
            subTodo,
            canManage || subTodo.memberIds.some((id) => sameId(id, userId)) || subTodo.moderatorIds.some((id) => sameId(id, userId)),
        )),
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        endedAt: todo.endedAt,
    };
}

async function getTodo(req: Request, res: Response) {
    const todoId = routeParam(req, "todoId");
    if (!idValid(todoId)) return res.status(400).json({ message: "Invalid todo ID" });
    const todo = await Todo.findById(todoId);
    if (!todo) return res.status(404).json({ message: "Todo not found" });
    const userId = currentUserId(req);
    if (!todo.memberIds.some((id) => sameId(id, userId))) return res.status(403).json({ message: "You are not a member of this todo" });
    return res.status(200).json({ todo: publicTodo(todo, userId) });
}

async function loadTodo(req: Request, res: Response, allowEnded = false) {
    const todoId = routeParam(req, "todoId");
    if (!idValid(todoId)) {
        res.status(400).json({ message: "Invalid todo ID" });
        return undefined;
    }
    const todo = await Todo.findById(todoId);
    if (!todo) {
        res.status(404).json({ message: "Todo not found" });
        return undefined;
    }
    const userId = currentUserId(req);
    if (!todo.memberIds.some((id) => sameId(id, userId))) {
        res.status(403).json({ message: "You are not a member of this todo" });
        return undefined;
    }
    if (!allowEnded && todo.status === "ended") {
        res.status(409).json({ message: "This todo has ended and is read-only" });
        return undefined;
    }
    return todo;
}

function loadSubTodo(todo: ITodo, subTodoId: string, res: Response) {
    if (!idValid(subTodoId)) {
        res.status(400).json({ message: "Invalid subtask ID" });
        return undefined;
    }
    const subTodo = todo.subtodos.id(subTodoId);
    if (!subTodo) {
        res.status(404).json({ message: "Subtask not found" });
        return undefined;
    }
    return subTodo;
}

async function validateUsers(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds));
    const count = await User.countDocuments({ _id: { $in: uniqueIds } });
    return count === uniqueIds.length ? uniqueIds : undefined;
}

async function createRoom(name: string, participantIds: string[]) {
    const participants = Array.from(new Set(participantIds)).map((id) => new Types.ObjectId(id));
    return ChatRoom.create({ type: "group", access: "invite", name, participants, createdBy: participants[0] });
}

async function syncRoomMembers(roomId: Types.ObjectId, memberIds: string[]) {
    await ChatRoom.updateOne({ _id: roomId }, { $set: { participants: Array.from(new Set(memberIds)).map((id) => new Types.ObjectId(id)) } });
}

function subTodoRoomMembers(todo: ITodo, subTodo: ISubTodo) {
    return [todo.creator.toString(), ...idsOf(todo.moderatorIds), ...idsOf(subTodo.memberIds), ...idsOf(subTodo.moderatorIds)];
}

function participantRoles(todo: ITodo, userId: string): TodoParticipantRole[] {
    const roles: TodoParticipantRole[] = [];
    if (sameId(todo.creator, userId)) roles.push("creator");
    if (todo.moderatorIds.some((id) => sameId(id, userId))) roles.push("moderator");
    if (!sameId(todo.creator, userId) && todo.memberIds.some((id) => sameId(id, userId)) && !roles.includes("moderator")) roles.push("member");
    if (todo.subtodos.some((subTodo) => subTodo.moderatorIds.some((id) => sameId(id, userId)))) roles.push("subtodo_moderator");
    if (todo.subtodos.some((subTodo) => subTodo.memberIds.some((id) => sameId(id, userId)))) roles.push("subtodo_member");
    if (roles.length === 0) roles.push("member");
    return roles;
}

export const createTodo = endpoint(async (req, res) => {
    const { title, description = "", scope = "personal", memberIds = [], workItems = [] } = req.body as {
        title?: string; description?: string; scope?: TodoScope; memberIds?: unknown; workItems?: unknown;
    };
    const userId = currentUserId(req);
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "A title is required" });
    if (scope !== "personal" && scope !== "group") return res.status(400).json({ message: "Scope must be personal or group" });
    if (typeof description !== "string" || description.length > 5000) return res.status(400).json({ message: "Description must be at most 5000 characters" });
    if (!Array.isArray(workItems) || workItems.some((item) => typeof item !== "string" || !item.trim())) return res.status(400).json({ message: "workItems must be an array of non-empty titles" });
    if (scope === "personal" && (!Array.isArray(memberIds) || memberIds.length > 0)) return res.status(400).json({ message: "Personal todos do not accept additional members" });
    if (scope === "group" && !idsValid(memberIds)) return res.status(400).json({ message: "memberIds must be an array of valid user IDs" });
    const members = scope === "group" ? await validateUsers([userId, ...(memberIds as string[])]) : [userId];
    if (!members) return res.status(400).json({ message: "One or more users do not exist" });

    let roomId: Types.ObjectId | undefined;
    if (scope === "group") roomId = (await createRoom(title.trim(), members))._id;
    try {
        const todo = await Todo.create({
            title: title.trim(), description: description.trim(), scope, creator: userId,
            memberIds: members, historyUserIds: members, moderatorIds: [], chatRoom: roomId,
            workItems: (workItems as string[]).map((item) => ({ title: item.trim() })),
        });
        return res.status(201).json({ todo: publicTodo(todo, userId) });
    } catch (error) {
        if (roomId) await ChatRoom.deleteOne({ _id: roomId });
        throw error;
    }
});

export const listTodos = endpoint(async (req, res) => {
    const userId = currentUserId(req);
    const todos = await Todo.find({ memberIds: userId, status: "active" }).sort({ updatedAt: -1 });
    return res.status(200).json({ todos: todos.map((todo) => publicTodo(todo, userId)) });
});

export const endTodo = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res, true);
    if (!todo) return;
    const userId = currentUserId(req);
    if (!sameId(todo.creator, userId)) return res.status(403).json({ message: "Only the todo creator can end it" });

    if (todo.status !== "ended") {
        const endedAt = new Date();
        const ended = await Todo.findOneAndUpdate(
            { _id: todo._id, status: "active", creator: userId },
            { $set: { status: "ended", endedAt, endedBy: userId } },
            { new: true },
        );
        if (!ended) return res.status(409).json({ message: "Todo has already ended" });
        todo.status = ended.status;
        todo.endedAt = ended.endedAt;
        todo.endedBy = ended.endedBy;
    }

    const participantIds = new Set([
        todo.creator.toString(),
        ...idsOf(todo.historyUserIds ?? todo.memberIds),
        ...todo.subtodos.flatMap((subTodo) => [...idsOf(subTodo.memberIds), ...idsOf(subTodo.moderatorIds)]),
    ]);
    const endedAt = todo.endedAt ?? new Date();
    const endedBy = todo.endedBy ?? todo.creator;
    await Promise.all(Array.from(participantIds, async (participantId) => {
        await TodoHistory.updateOne(
            { todoId: todo._id, userId: participantId },
            { $setOnInsert: {
                todoId: todo._id,
                userId: participantId,
                roles: participantRoles(todo, participantId),
                endedBy,
                endedAt,
                snapshot: publicTodo(todo, participantId),
            } },
            { upsert: true },
        );
    }));
    return res.status(200).json({ message: "Todo ended and participant history saved", endedAt });
});

export const listTodoHistory = endpoint(async (req, res) => {
    const userId = currentUserId(req);
    const history = await TodoHistory.find({ userId }).sort({ endedAt: -1 }).lean();
    return res.status(200).json({ history: history.map((entry) => ({
        id: entry._id.toString(),
        todoId: entry.todoId.toString(),
        roles: entry.roles,
        endedBy: entry.endedBy.toString(),
        endedAt: entry.endedAt,
        todo: entry.snapshot,
    })) });
});

export const getTodoById = endpoint(getTodo);

export const updateTodo = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    if (!isTodoManager(todo, currentUserId(req))) return res.status(403).json({ message: "Only the creator or a todo moderator can update this todo" });
    const { title, description } = req.body as { title?: unknown; description?: unknown };
    if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "Title must be a non-empty string" });
        todo.title = title.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string" || description.length > 5000) return res.status(400).json({ message: "Description must be at most 5000 characters" });
        todo.description = description.trim();
    }
    await todo.save();
    return res.status(200).json({ todo: publicTodo(todo, currentUserId(req)) });
});

export const deleteTodo = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res, true);
    if (!todo) return;
    if (!sameId(todo.creator, currentUserId(req))) return res.status(403).json({ message: "Only the todo creator can delete it" });
    const roomIds = [todo.chatRoom, ...todo.subtodos.map((subTodo) => subTodo.chatRoom)].filter((id): id is Types.ObjectId => Boolean(id));
    await Todo.deleteOne({ _id: todo._id });
    await ChatRoom.deleteMany({ _id: { $in: roomIds } });
    return res.status(200).json({ message: "Todo deleted" });
});

export const addTodoMember = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    if (todo.scope !== "group" || !isTodoManager(todo, currentUserId(req))) return res.status(403).json({ message: "Only group todo managers can add members" });
    const memberId = req.body.userId as string;
    if (!idValid(memberId)) return res.status(400).json({ message: "A valid userId is required" });
    if (!await User.exists({ _id: memberId })) return res.status(404).json({ message: "User not found" });
    if (!todo.memberIds.some((id) => sameId(id, memberId))) todo.memberIds.push(new Types.ObjectId(memberId));
    if (!todo.historyUserIds.some((id) => sameId(id, memberId))) todo.historyUserIds.push(new Types.ObjectId(memberId));
    await todo.save();
    if (todo.chatRoom) await syncRoomMembers(todo.chatRoom, idsOf(todo.memberIds));
    return res.status(200).json({ todo: publicTodo(todo, currentUserId(req)) });
});

export const removeTodoMember = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    if (todo.scope !== "group" || !isTodoManager(todo, currentUserId(req))) return res.status(403).json({ message: "Only group todo managers can remove members" });
    const memberId = routeParam(req, "userId");
    if (!idValid(memberId)) return res.status(400).json({ message: "Invalid user ID" });
    if (sameId(todo.creator, memberId)) return res.status(400).json({ message: "The todo creator cannot be removed" });
    todo.memberIds = todo.memberIds.filter((id) => !sameId(id, memberId)) as typeof todo.memberIds;
    todo.moderatorIds = todo.moderatorIds.filter((id) => !sameId(id, memberId)) as typeof todo.moderatorIds;
    todo.subtodos.forEach((subTodo) => {
        subTodo.memberIds = subTodo.memberIds.filter((id) => !sameId(id, memberId)) as typeof subTodo.memberIds;
        subTodo.moderatorIds = subTodo.moderatorIds.filter((id) => !sameId(id, memberId)) as typeof subTodo.moderatorIds;
    });
    await todo.save();
    if (todo.chatRoom) await syncRoomMembers(todo.chatRoom, idsOf(todo.memberIds));
    for (const subTodo of todo.subtodos) await syncRoomMembers(subTodo.chatRoom, subTodoRoomMembers(todo, subTodo));
    return res.status(200).json({ todo: publicTodo(todo, currentUserId(req)) });
});

export const setTodoModerators = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    if (todo.scope !== "group" || !isTodoManager(todo, currentUserId(req))) return res.status(403).json({ message: "Only group todo managers can assign moderators" });
    const { moderatorIds } = req.body as { moderatorIds?: unknown };
    if (!idsValid(moderatorIds)) return res.status(400).json({ message: "moderatorIds must be an array of valid user IDs" });
    if (moderatorIds.some((id) => !todo.memberIds.some((member) => sameId(member, id)) || sameId(todo.creator, id))) return res.status(400).json({ message: "Moderators must be group members other than the creator" });
    todo.moderatorIds = Array.from(new Set(moderatorIds)).map((id) => new Types.ObjectId(id)) as typeof todo.moderatorIds;
    await todo.save();
    for (const subTodo of todo.subtodos) await syncRoomMembers(subTodo.chatRoom, subTodoRoomMembers(todo, subTodo));
    return res.status(200).json({ todo: publicTodo(todo, currentUserId(req)) });
});

export const createSubTodo = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    if (!isTodoManager(todo, currentUserId(req))) return res.status(403).json({ message: "Only todo managers can create subtasks" });
    const { title, description = "", memberIds = [], workItems = [] } = req.body as { title?: string; description?: string; memberIds?: unknown; workItems?: unknown };
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "A title is required" });
    if (typeof description !== "string" || description.length > 5000) return res.status(400).json({ message: "Description must be at most 5000 characters" });
    if (!idsValid(memberIds) || memberIds.some((id) => !todo.memberIds.some((member) => sameId(member, id)))) return res.status(400).json({ message: "Subtask members must be members of the parent group todo" });
    if (!Array.isArray(workItems) || workItems.some((item) => typeof item !== "string" || !item.trim())) return res.status(400).json({ message: "workItems must be an array of non-empty titles" });
    const moderatorIds = idsOf(todo.moderatorIds);
    const room = await createRoom(`${todo.title}: ${title.trim()}`, [todo.creator.toString(), ...moderatorIds, ...(memberIds as string[])]);
    todo.subtodos.push({
        title: title.trim(), description: description.trim(), memberIds: (memberIds as string[]).map((id) => new Types.ObjectId(id)),
        moderatorIds: [], chatRoom: room._id,
        workItems: (workItems as string[]).map((item) => ({ title: item.trim() })),
    } as unknown as ISubTodo);
    try {
        await todo.save();
        const subTodo = todo.subtodos[todo.subtodos.length - 1]!;
        return res.status(201).json({ subTodo: publicSubTodo(subTodo, true) });
    } catch (error) {
        await ChatRoom.deleteOne({ _id: room._id });
        throw error;
    }
});

export const updateSubTodo = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    const subTodo = loadSubTodo(todo, routeParam(req, "subTodoId"), res);
    if (!subTodo) return;
    if (!isSubTodoManager(todo, subTodo, currentUserId(req))) return res.status(403).json({ message: "Only todo or subtask moderators can update this subtask" });
    const { title, description } = req.body as { title?: unknown; description?: unknown };
    if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "Title must be a non-empty string" });
        subTodo.title = title.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string" || description.length > 5000) return res.status(400).json({ message: "Description must be at most 5000 characters" });
        subTodo.description = description.trim();
    }
    await todo.save();
    return res.status(200).json({ subTodo: publicSubTodo(subTodo, true) });
});

export const deleteSubTodo = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    const subTodo = loadSubTodo(todo, routeParam(req, "subTodoId"), res);
    if (!subTodo) return;
    if (!isTodoManager(todo, currentUserId(req))) return res.status(403).json({ message: "Only parent todo managers can delete subtasks" });
    const roomId = subTodo.chatRoom;
    subTodo.deleteOne();
    await todo.save();
    await ChatRoom.deleteOne({ _id: roomId });
    return res.status(200).json({ message: "Subtask deleted" });
});

export const setSubTodoMembers = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    const subTodo = loadSubTodo(todo, routeParam(req, "subTodoId"), res);
    if (!subTodo) return;
    if (!isSubTodoManager(todo, subTodo, currentUserId(req))) return res.status(403).json({ message: "Only todo or subtask moderators can assign members" });
    const { memberIds } = req.body as { memberIds?: unknown };
    if (!idsValid(memberIds) || memberIds.some((id) => !todo.memberIds.some((member) => sameId(member, id)))) return res.status(400).json({ message: "Subtask members must be members of the parent group todo" });
    subTodo.memberIds = Array.from(new Set(memberIds)).map((id) => new Types.ObjectId(id)) as typeof subTodo.memberIds;
    for (const memberId of memberIds) {
        if (!todo.historyUserIds.some((id) => sameId(id, memberId))) todo.historyUserIds.push(new Types.ObjectId(memberId));
    }
    subTodo.moderatorIds = subTodo.moderatorIds.filter((id) => subTodo.memberIds.some((member) => sameId(member, id.toString()))) as typeof subTodo.moderatorIds;
    await todo.save();
    await syncRoomMembers(subTodo.chatRoom, subTodoRoomMembers(todo, subTodo));
    return res.status(200).json({ subTodo: publicSubTodo(subTodo, true) });
});

export const setSubTodoModerators = endpoint(async (req, res) => {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    const subTodo = loadSubTodo(todo, routeParam(req, "subTodoId"), res);
    if (!subTodo) return;
    if (!isSubTodoManager(todo, subTodo, currentUserId(req))) return res.status(403).json({ message: "Only todo or subtask moderators can assign moderators" });
    const { moderatorIds } = req.body as { moderatorIds?: unknown };
    if (!idsValid(moderatorIds) || moderatorIds.some((id) => !subTodo.memberIds.some((member) => sameId(member, id)))) return res.status(400).json({ message: "Subtask moderators must be assigned subtask members" });
    subTodo.moderatorIds = Array.from(new Set(moderatorIds)).map((id) => new Types.ObjectId(id)) as typeof subTodo.moderatorIds;
    await todo.save();
    await syncRoomMembers(subTodo.chatRoom, subTodoRoomMembers(todo, subTodo));
    return res.status(200).json({ subTodo: publicSubTodo(subTodo, true) });
});

async function addWorkItem(req: Request, res: Response, subtask: boolean) {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    let subTodo: ISubTodo | undefined;
    if (subtask) {
        subTodo = loadSubTodo(todo, routeParam(req, "subTodoId"), res);
        if (!subTodo) return;
    }
    const userId = currentUserId(req);
    if (subTodo ? !isSubTodoManager(todo, subTodo, userId) : !isTodoManager(todo, userId)) return res.status(403).json({ message: "Only managers can add work items" });
    const { title } = req.body as { title?: unknown };
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "A title is required" });
    const workItems = subTodo ? subTodo.workItems : todo.workItems;
    workItems.push({ title: title.trim() } as IWorkItem);
    await todo.save();
    return res.status(201).json(subTodo ? { subTodo: publicSubTodo(subTodo, true) } : { todo: publicTodo(todo, userId) });
}

async function changeWorkItem(req: Request, res: Response, subtask: boolean, remove: boolean) {
    const todo = await loadTodo(req, res);
    if (!todo) return;
    let subTodo: ISubTodo | undefined;
    if (subtask) {
        subTodo = loadSubTodo(todo, routeParam(req, "subTodoId"), res);
        if (!subTodo) return;
    }
    const userId = currentUserId(req);
    const workItems = subTodo ? subTodo.workItems : todo.workItems;
    const itemId = routeParam(req, "itemId");
    const item = workItems.id(itemId);
    if (!item) return res.status(404).json({ message: "Work item not found" });
    const isManager = subTodo ? isSubTodoManager(todo, subTodo, userId) : isTodoManager(todo, userId);
    const isAssigned = subTodo ? subTodo.memberIds.some((id) => sameId(id, userId)) : todo.memberIds.some((id) => sameId(id, userId));
    if (remove ? !isManager : !isManager && !isAssigned) return res.status(403).json({ message: "You cannot update this work item" });
    if (remove) workItems.id(itemId)?.deleteOne();
    else {
        const { title, completed } = req.body as { title?: unknown; completed?: unknown };
        if (title !== undefined) {
            if (!isManager) return res.status(403).json({ message: "Only managers can rename work items" });
            if (typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "Title must be a non-empty string" });
            item.title = title.trim();
        }
        if (completed !== undefined) {
            if (typeof completed !== "boolean") return res.status(400).json({ message: "completed must be a boolean" });
            item.completed = completed;
            item.completedBy = completed ? new Types.ObjectId(userId) : undefined;
            item.completedAt = completed ? new Date() : undefined;
        }
        if (title === undefined && completed === undefined) return res.status(400).json({ message: "Provide title or completed" });
    }
    await todo.save();
    return res.status(200).json(subTodo ? { subTodo: publicSubTodo(subTodo, true) } : { todo: publicTodo(todo, userId) });
}

export const addTodoWorkItem = endpoint((req, res) => addWorkItem(req, res, false));
export const updateTodoWorkItem = endpoint((req, res) => changeWorkItem(req, res, false, false));
export const deleteTodoWorkItem = endpoint((req, res) => changeWorkItem(req, res, false, true));
export const addSubTodoWorkItem = endpoint((req, res) => addWorkItem(req, res, true));
export const updateSubTodoWorkItem = endpoint((req, res) => changeWorkItem(req, res, true, false));
export const deleteSubTodoWorkItem = endpoint((req, res) => changeWorkItem(req, res, true, true));