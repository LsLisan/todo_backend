import { Schema, model, type Document, type Types } from "mongoose";

export type TodoScope = "personal" | "group";
export type TodoStatus = "active" | "ended";

export interface IWorkItem {
    _id: Types.ObjectId;
    title: string;
    completed: boolean;
    completedBy?: Types.ObjectId;
    completedAt?: Date;
}

export interface ISubTodo {
    _id: Types.ObjectId;
    title: string;
    description: string;
    memberIds: Types.ObjectId[];
    moderatorIds: Types.ObjectId[];
    chatRoom: Types.ObjectId;
    workItems: Types.DocumentArray<IWorkItem>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITodo extends Document {
    title: string;
    description: string;
    scope: TodoScope;
    status: TodoStatus;
    creator: Types.ObjectId;
    memberIds: Types.ObjectId[];
    historyUserIds: Types.ObjectId[];
    moderatorIds: Types.ObjectId[];
    chatRoom?: Types.ObjectId;
    endedBy?: Types.ObjectId;
    endedAt?: Date;
    workItems: Types.DocumentArray<IWorkItem>;
    subtodos: Types.DocumentArray<ISubTodo>;
    createdAt: Date;
    updatedAt: Date;
}

const workItemSchema = new Schema<IWorkItem>({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    completed: { type: Boolean, default: false, required: true },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    completedAt: Date,
}, { timestamps: true });

const subTodoSchema = new Schema<ISubTodo>({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderatorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    chatRoom: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true },
    workItems: { type: [workItemSchema], default: [] },
}, { timestamps: true });

const todoSchema = new Schema<ITodo>({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    scope: { type: String, enum: ["personal", "group"], required: true },
    status: { type: String, enum: ["active", "ended"], default: "active", required: true },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    historyUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderatorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    chatRoom: { type: Schema.Types.ObjectId, ref: "ChatRoom" },
    endedBy: { type: Schema.Types.ObjectId, ref: "User" },
    endedAt: Date,
    workItems: { type: [workItemSchema], default: [] },
    subtodos: { type: [subTodoSchema], default: [] },
}, { timestamps: true });

todoSchema.index({ creator: 1, updatedAt: -1 });
todoSchema.index({ memberIds: 1, updatedAt: -1 });

export const Todo = model<ITodo>("Todo", todoSchema);
export default Todo;