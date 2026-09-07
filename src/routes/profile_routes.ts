import { Router } from "express";
import { getMyInfo } from "../features/profile/controller/profile_controller.js";

const router = Router();

/**
 * @openapi
 * /api/profile/me:
 *   get:
 *     summary: Get the authenticated user's information
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: 64f1a2b3c4d5e6f7a8b9c0d1
 *                 username:
 *                   type: string
 *                   example: johndoe
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: user@example.com
 *                 role:
 *                   type: string
 *                   enum: [USER, ADMIN]
 *                   example: USER
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Missing, invalid, or expired authorization token
 *       404:
 *         description: User not found
 */
router.get("/me", getMyInfo);

export default router;