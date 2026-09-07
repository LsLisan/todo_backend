import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './core/config/swagger.js';
import authRoutes from './routes/auth_routes.js';
import morgan from 'morgan';
import { connectDB } from './core/config/database.js';
import cors from 'cors';
import profileRoutes from './routes/profile_routes.js';

dotenv.config();

const app = express();

app.use(express.json());

app.use(cors());

app.use(morgan('dev'));

const PORT = process.env.PORT || 3000;

app.use('/docs',swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Server startup failed:', error);
        process.exit(1);
    });