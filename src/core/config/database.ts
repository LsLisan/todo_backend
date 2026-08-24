import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";

export const connectDB = async (): Promise<void> =>{
    try {
        const mongoUrl = process.env.MONGODB_URL;

        if (!mongoUrl || mongoUrl.includes("<db_password>")) {
            throw new Error("Set MONGODB_URL in .env with the real MongoDB Atlas password. Replace <db_password>.");
        }

        const connectionUrl = new URL(mongoUrl);
        if (!connectionUrl.username || !connectionUrl.password) {
            throw new Error("MONGODB_URL must include the MongoDB database username and password.");
        }

        dns.setServers(["1.1.1.1", "8.8.8.8"]);

        const conn = await mongoose.connect(mongoUrl);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
        });
    }catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

export const disconnectDB = async (): Promise<void> => {
    try {
        await mongoose.connection.close();
    }catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
    }
}