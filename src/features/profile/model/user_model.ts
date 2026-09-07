import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'USER' | 'ADMIN';

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    role: UserRole;
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
    role: {
        type: String,
        enum: ['USER', 'ADMIN'],
        default: 'USER',
        required: true,
    },
}, {
    timestamps: true,
})

export const User = mongoose.model<IUser>('User', userSchema);

export default User;