//Database connection
import mongoose from "mongoose";

const connectDB = async (): Promise<void> =>{
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URL as string);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
        });
    }catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

export const disconnectDB = async (): Promise<void> => {
    try {
        await mongoose.connection.close();
    }catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
    }
}

connectDB().catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});