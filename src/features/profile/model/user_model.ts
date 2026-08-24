import e from 'express';
import mongoose, { Schema, Document,model } from 'mongoose';

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema: Schema<IUser> = new Schema<IUser>({
    username: { type: String, required: true,trim:true },
    email: { 
        type: String, 
        required: true,
         unique: true, 
         trim:true,
         lowercase:true
    },
    password: { 
        type: String, 
        required: true, 
        trim:true 
    },
}, {
    timestamps: true,
})

export const User = mongoose.model<IUser>('User', userSchema);

export default User;