import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './core/config/swagger.js';
import authRoutes from './routes/auth_routes.js';

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

app.use('/docs',swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);

app.listen(PORT,()=>{
    console.log(`Server is running on port http://localhost:${PORT}`);
})