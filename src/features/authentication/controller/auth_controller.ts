import type { Request, Response } from "express";
import { User } from "../../profile/model/user_model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


//Register User
export async function registerUser(req: Request, res: Response) {
    try {
        const { username, email, password } = req.body as{
            username: string;
            email: string;
            password: string;
        };
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: passwordHash });
        
        const token = jwt.sign({
            userId: newUser._id,
            username: newUser.username,
            email: newUser.email
        }, process.env.JWT_SECRET as string, { expiresIn: '15d' })

        return res.status(201).json({
             message: "User registered successfully",
                token: token,
                id: newUser._id,

        });
    }catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

//login User

export async function loginUser(req: Request, res: Response) {
    try {
        const {email, password} = req.body as {
            email: string;
            password: string;
        };
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const token = jwt.sign({
            userId: user._id,
            username: user.username,
            email: user.email
        }, process.env.JWT_SECRET as string, { 
            expiresIn: '15d' 
        })
        return res.status(200).json({
            message: "User logged in successfully",
            token: token,
            id: user._id,
        });

    }catch (error) {
        console.error("Error logging in user:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export default {registerUser, loginUser};