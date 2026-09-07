import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../model/user_model.js";

export async function getMyInfo(req: Request, res: Response) {
    try {
        const authorization = req.headers.authorization;
        const token = authorization?.startsWith("Bearer ")
            ? authorization.slice(7)
            : undefined;
        const secret = process.env.JWT_SECRET;

        if (!token || !secret) {
            return res.status(401).json({ message: "Authorization token is required" });
        }

        const payload = jwt.verify(token, secret);
        if (typeof payload === "string" || typeof payload.userId !== "string") {
            return res.status(401).json({ message: "Invalid authorization token" });
        }

        const user = await User.findById(payload.userId).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role ?? "USER",
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: "Invalid or expired authorization token" });
        }

        console.error("Error fetching user profile:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export default { getMyInfo };