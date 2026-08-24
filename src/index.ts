import express from 'express';

const app = express();

const PORT = process.env.PORT || 3000;

// Connect to MongoDB

app.get('/',(req,res)=>{
    res.status(200).json({message: 'Hello World'});
})

app.listen(PORT,()=>{
    console.log(`Server is running on port http://localhost:${PORT}`);
})