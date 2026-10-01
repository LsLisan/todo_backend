import mongoose, { Schema, Document, Types } from "mongoose";

export type MessageType = "text" | "images" | "images+text";

export interface IMessage extends Document {
    room: Types.ObjectId;
    sender: Types.ObjectId;
    type: MessageType;
    body?: string;
    images: string[];
    editedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
    room: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["text", "images", "images+text"], required: true },
    body: { type: String, trim: true, maxlength: 5000 },
    images: { type: [String], default: [], validate: [(images: string[]) => images.length <= 10, "A message can contain at most 10 images"] },
    editedAt: Date,
}, { timestamps: true });

messageSchema.index({ room: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);

export default Message;