import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { ChatRoom, type ChatRoomType } from "../model/chat_room_model.js";
import { Message, type MessageType } from "../model/message_model.js";
import { User } from "../../profile/model/user_model.js";

type SocketUser = { userId: string; username: string; email: string; role: string };
type Ack = (response: Record<string, unknown>) => void;

const userRoom = (userId: string) => `user:${userId}`;
const roomId = (value: unknown): value is string => typeof value === "string" && Types.ObjectId.isValid(value);

function validImageReference(value: unknown): value is string {
    if (typeof value !== "string" || value.length === 0 || value.length > 10_000_000) return false;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return true;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function reply(ack: Ack | undefined, response: Record<string, unknown>) {
    ack?.(response);
}

function error(socket: Socket, message: string, ack?: Ack) {
    const response = { ok: false, message };
    socket.emit("messaging:error", response);
    reply(ack, response);
}

function publicRoom(room: {
    _id: Types.ObjectId;
    type: ChatRoomType;
    name?: string;
    participants: Types.ObjectId[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: room._id.toString(),
        type: room.type,
        name: room.name,
        participants: room.participants.map((participant) => participant.toString()),
        createdBy: room.createdBy.toString(),
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
    };
}

function publicMessage(message: {
    _id: Types.ObjectId;
    room: Types.ObjectId;
    sender: Types.ObjectId;
    type: MessageType;
    body?: string;
    images: string[];
    editedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: message._id.toString(),
        roomId: message.room.toString(),
        senderId: message.sender.toString(),
        type: message.type,
        body: message.body,
        images: message.images,
        editedAt: message.editedAt,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
    };
}

async function getMemberRoom(socket: Socket, value: unknown) {
    if (!roomId(value)) return undefined;
    const user = socket.data.user as SocketUser;
    return ChatRoom.findOne({ _id: value, participants: user.userId });
}

async function emitToCurrentRoomMembers(io: Server, room: { _id: Types.ObjectId; participants: Types.ObjectId[] }, event: string, payload: unknown, excludeSocketId?: string) {
    const allowedUserIds = new Set(room.participants.map((participant) => participant.toString()));
    const sockets = await io.in(room._id.toString()).fetchSockets();
    for (const memberSocket of sockets) {
        const member = memberSocket.data.user as SocketUser | undefined;
        if (!member || !allowedUserIds.has(member.userId)) {
            await memberSocket.leave(room._id.toString());
        } else if (memberSocket.id !== excludeSocketId) {
            memberSocket.emit(event, payload);
        }
    }
}

export function registerMessagingSocket(io: Server) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token
                ?? socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
            const secret = process.env.JWT_SECRET;
            if (!token || !secret) return next(new Error("Authorization token is required"));

            const payload = jwt.verify(token, secret);
            if (typeof payload === "string" || typeof payload.userId !== "string") {
                return next(new Error("Invalid authorization token"));
            }

            const user = await User.findById(payload.userId).select("_id username email role").lean();
            if (!user) return next(new Error("User not found"));

            socket.data.user = {
                userId: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
            } satisfies SocketUser;
            next();
        } catch {
            next(new Error("Invalid or expired authorization token"));
        }
    });

    io.on("connection", (socket) => {
        const user = socket.data.user as SocketUser;
        socket.join(userRoom(user.userId));
        ChatRoom.find({ participants: user.userId }).select("_id").then((rooms) => {
            rooms.forEach((room) => socket.join(room._id.toString()));
        }).catch(() => {
            error(socket, "Could not load your rooms");
        });

        socket.on("room:create", async (payload: {
            type?: ChatRoomType;
            name?: string;
            participantIds?: string[];
        }, ack?: Ack) => {
            try {
                const type = payload?.type;
                const participantIds = Array.from(new Set([user.userId, ...(payload?.participantIds ?? [])]));
                if (type !== "normal" && type !== "group") return error(socket, "Room type must be normal or group", ack);
                if (type === "normal" && participantIds.length !== 2) return error(socket, "A normal room must have exactly two participants", ack);
                if (type === "group" && participantIds.length < 2) return error(socket, "A group room must have at least two participants", ack);
                if (!participantIds.every((id) => Types.ObjectId.isValid(id))) return error(socket, "All participant IDs must be valid", ack);

                const users = await User.countDocuments({ _id: { $in: participantIds } });
                if (users !== participantIds.length) return error(socket, "One or more participants do not exist", ack);

                const room = await ChatRoom.create({ type, name: type === "group" ? payload.name?.trim() : undefined, participants: participantIds, createdBy: user.userId });
                const result = publicRoom(room);
                participantIds.forEach((participantId) => io.to(userRoom(participantId)).emit("room:created", result));
                reply(ack, { ok: true, room: result });
            } catch {
                error(socket, "Could not create room", ack);
            }
        });

        socket.on("room:join", async (payload: { roomId?: string }, ack?: Ack) => {
            try {
                if (!roomId(payload?.roomId)) return error(socket, "A valid roomId is required", ack);
                const room = await ChatRoom.findById(payload.roomId);
                if (!room) return error(socket, "Room not found", ack);
                const alreadyMember = room.participants.some((participant) => participant.toString() === user.userId);
                    if (room.access === "invite" && !alreadyMember) return error(socket, "You are not invited to this room", ack);
                if (room.type === "normal" && !alreadyMember) return error(socket, "You cannot join this normal room", ack);
                if (!alreadyMember) {
                    room.participants.push(new Types.ObjectId(user.userId));
                    await room.save();
                }
                await socket.join(room._id.toString());
                const result = publicRoom(room);
                io.to(room._id.toString()).emit("room:member_joined", { room: result, userId: user.userId });
                reply(ack, { ok: true, room: result });
            } catch {
                error(socket, "Could not join room", ack);
            }
        });

        socket.on("room:leave", async (payload: { roomId?: string }, ack?: Ack) => {
            try {
                const room = await getMemberRoom(socket, payload?.roomId);
                if (!room) return error(socket, "Room not found or you are not a member", ack);
                if (room.type === "normal") return error(socket, "Normal rooms cannot be left", ack);
                room.participants = room.participants.filter((participant) => participant.toString() !== user.userId);
                await room.save();
                await socket.leave(room._id.toString());
                io.to(room._id.toString()).emit("room:member_left", { roomId: room._id.toString(), userId: user.userId });
                reply(ack, { ok: true });
            } catch {
                error(socket, "Could not leave room", ack);
            }
        });

        socket.on("room:list", async (ack?: Ack) => {
            const rooms = await ChatRoom.find({ participants: user.userId }).sort({ updatedAt: -1 });
            reply(ack, { ok: true, rooms: rooms.map(publicRoom) });
        });

        socket.on("message:send", async (payload: { roomId?: string; body?: string; images?: string[] }, ack?: Ack) => {
            try {
                const room = await getMemberRoom(socket, payload?.roomId);
                const body = payload?.body?.trim();
            const images = payload?.images ?? [];
                if (!room) return error(socket, "Room not found or you are not a member", ack);
            if (!Array.isArray(images) || images.length > 10) return error(socket, "A message can contain at most 10 images", ack);
            if (!images.every(validImageReference)) return error(socket, "Each image must be an http(s) URL or a base64 image data URL", ack);
            if ((!body && images.length === 0) || (body && body.length > 5000)) return error(socket, "A message needs text, images, or both; text is limited to 5000 characters", ack);
                await socket.join(room._id.toString());
            const type: MessageType = body && images.length > 0 ? "images+text" : images.length > 0 ? "images" : "text";
            const message = await Message.create({ room: room._id, sender: user.userId, type, body, images });
                const result = publicMessage(message);
                await emitToCurrentRoomMembers(io, room, "message:new", result);
                reply(ack, { ok: true, message: result });
            } catch {
                error(socket, "Could not send message", ack);
            }
        });

        socket.on("message:history", async (payload: { roomId?: string; limit?: number }, ack?: Ack) => {
            const room = await getMemberRoom(socket, payload?.roomId);
            if (!room) return error(socket, "Room not found or you are not a member", ack);
            const limit = Math.min(Math.max(Number(payload?.limit) || 50, 1), 100);
            const messages = await Message.find({ room: room._id }).sort({ createdAt: -1 }).limit(limit);
            reply(ack, { ok: true, messages: messages.reverse().map(publicMessage) });
        });

        socket.on("typing:start", async (payload: { roomId?: string }) => {
            const room = await getMemberRoom(socket, payload?.roomId);
            if (room) await emitToCurrentRoomMembers(io, room, "typing:start", { roomId: room._id.toString(), userId: user.userId, username: user.username }, socket.id);
        });

        socket.on("typing:stop", async (payload: { roomId?: string }) => {
            const room = await getMemberRoom(socket, payload?.roomId);
            if (room) await emitToCurrentRoomMembers(io, room, "typing:stop", { roomId: room._id.toString(), userId: user.userId }, socket.id);
        });
    });
}