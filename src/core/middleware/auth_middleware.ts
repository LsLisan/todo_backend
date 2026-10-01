import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return res.status(401).json({ message: "Authorization token is required" });

    try {
        const payload = jwt.verify(token, secret);
        if (typeof payload === "string" || typeof payload.userId !== "string" || !Types.ObjectId.isValid(payload.userId)) {
            return res.status(401).json({ message: "Invalid authorization token" });
        }
        req.userId = payload.userId;
        return next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired authorization token" });
    }
}