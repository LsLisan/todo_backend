import mongoose, { Schema, Document, Types } from "mongoose";

export type ChatRoomType = "normal" | "group";
export type ChatRoomAccess = "open" | "invite";

export interface IChatRoom extends Document {
    type: ChatRoomType;
    access: ChatRoomAccess;
    name?: string;
    participants: Types.ObjectId[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const chatRoomSchema = new Schema<IChatRoom>({
    type: { type: String, enum: ["normal", "group"], required: true },
    access: { type: String, enum: ["open", "invite"], default: "open", required: true },
    name: { type: String, trim: true, maxlength: 100 },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

chatRoomSchema.index({ participants: 1 });

export const ChatRoom = mongoose.model<IChatRoom>("ChatRoom", chatRoomSchema);

export default ChatRoom;