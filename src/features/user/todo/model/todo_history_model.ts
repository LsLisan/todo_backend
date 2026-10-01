import { Schema, model, type Document, type Types } from "mongoose";

export type TodoParticipantRole = "creator" | "moderator" | "member" | "subtodo_moderator" | "subtodo_member";

export interface ITodoHistory extends Document {
    todoId: Types.ObjectId;
    userId: Types.ObjectId;
    roles: TodoParticipantRole[];
    endedBy: Types.ObjectId;
    endedAt: Date;
    snapshot: Record<string, unknown>;
    createdAt: Date;
}

const todoHistorySchema = new Schema<ITodoHistory>({
    todoId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roles: [{ type: String, enum: ["creator", "moderator", "member", "subtodo_moderator", "subtodo_member"], required: true }],
    endedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    endedAt: { type: Date, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

todoHistorySchema.index({ userId: 1, endedAt: -1 });
todoHistorySchema.index({ todoId: 1, userId: 1 }, { unique: true });

export const TodoHistory = model<ITodoHistory>("TodoHistory", todoHistorySchema);
export default TodoHistory;