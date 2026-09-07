import { Router } from "express";
import { registerUser, loginUser } from "../features/authentication/controller/auth_controller.js";

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Authentication
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: StrongP@ssw0rd!
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 token:
 *                   type: string
 *                   description: JWT bearer token
 *                 id:
 *                   type: string
 *                   example: 64f1a2b3c4d5e6f7a8b9c0d1
 *                 role:
 *                   type: string
 *                   enum: [USER, ADMIN]
 *                   example: USER
 *       400:
 *         description: Bad request (validation errors)
 *       409:
 *         description: Email already in use
 */
router.post("/register", registerUser);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in an existing user
 *     tags:
 *       - Authentication
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: StrongP@ssw0rd!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 id:
 *                   type: string
 *                   example: 64f1a2b3c4d5e6f7a8b9c0d1
 *                 role:
 *                   type: string
 *                   enum: [USER, ADMIN]
 *                   example: USER
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", loginUser);

export default router;