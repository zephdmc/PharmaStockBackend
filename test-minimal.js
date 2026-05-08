console.log('Starting minimal server...');
const express = require('express');
const app = express();

console.log('Express loaded');

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

const port = 5000;
console.log(Attempting to listen on port ...);
const server = app.listen(port, 'localhost', () => {
    console.log(✅ Server running on http://localhost:);
    console.log(✅ Health: http://localhost:/api/health);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});
