import { Schema, model, type Document, type Types } from "mongoose";

export type TodoScope = "personal" | "group";

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
    creator: Types.ObjectId;
    memberIds: Types.ObjectId[];
    moderatorIds: Types.ObjectId[];
    chatRoom?: Types.ObjectId;
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
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderatorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    chatRoom: { type: Schema.Types.ObjectId, ref: "ChatRoom" },
    workItems: { type: [workItemSchema], default: [] },
    subtodos: { type: [subTodoSchema], default: [] },
}, { timestamps: true });

todoSchema.index({ creator: 1, updatedAt: -1 });
todoSchema.index({ memberIds: 1, updatedAt: -1 });

export const Todo = model<ITodo>("Todo", todoSchema);
export default Todo;