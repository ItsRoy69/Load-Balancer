import express from 'express';
import http from 'http';

const app = express();
const port = process.argv[2];

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/', (req, res) => {
    res.send(`Hello from backend server on port ${port}`);
});

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
});