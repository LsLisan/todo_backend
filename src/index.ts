import { createServer } from 'http';

const PORT = 3000;

const server = createServer((req, res) => {
    // set header content type
    res.setHeader('Content-Type', 'application/json');

    // handling the request and response
    if (req.url === '/') {
        res.statusCode = 200;
        res.end(JSON.stringify({ message: 'Welcome to our API' }));
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Page not found' }));
    }
});

// Add this section at the bottom:
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});