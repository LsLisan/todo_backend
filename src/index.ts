import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './core/config/swagger.js';
import authRoutes from './routes/auth_routes.js';
import morgan from 'morgan';
import { connectDB } from './core/config/database.js';
import cors from 'cors';
import profileRoutes from './routes/profile_routes.js';
import todoRoutes from './routes/todo_routes.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { registerMessagingSocket } from './features/mesaging/socket/messaging_socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()) ?? '*' },
});

registerMessagingSocket(io);

app.use(express.json());

app.use(cors());

app.use(morgan('dev'));

const PORT = process.env.PORT || 3000;

app.use('/docs',swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/todos', todoRoutes);

connectDB()
    .then(() => {
        httpServer.listen(PORT, () => {
            console.log(`Server is running on port http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Server startup failed:', error);
        process.exit(1);
    });