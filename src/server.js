const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const debug = require('debug')('app:server');

const app = express();
const server = http.createServer(app);

// Serve custom images from the /images directory at the repo root
app.use('/images', express.static(path.join(__dirname, '../images'), { maxAge: '1d' }));

const PORT = process.env.PORT || 3005;
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ["http://localhost:3000", "http://localhost:3001"];

const io = new Server(server, {
    cors: {
        origin: corsOrigins,
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {

    const roomKey = socket.handshake.query.key;

    if (roomKey) {
        socket.join(roomKey);
        console.log(`✅ Socket ${socket.id} se unió a la sala: ${roomKey}`);
    } else {
        console.log(`✅ Socket ${socket.id} conectado sin una key de sala.`);
    }

    socket.on('send_message', (data) => {
        debug(`Message received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('receive_message', data);
    });
    socket.on('handshake', (data) => {
        debug(`handshake received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('handshake', data);
    });
    socket.on('handshake-response', (data) => {
        debug(`handshake-response received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('handshake-response', data);
    });
    socket.on('matchDetails', (data) => {
        debug(`matchDetails received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('matchDetails', data);
    });

    socket.on('matchData', (data) => {
        debug(`matchData received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('matchData', data);
    });

    socket.on('matchEvent', (data) => {
        debug(`matchEvent received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('matchEvent', data);
    });

    socket.on('overlaySetup', (data) => {
        debug(`overlaySetup received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('overlaySetup', data);
    });

    socket.on('updateConfig', (data) => {
        debug(`updateConfig received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('updateConfig', data);
    });

    socket.on('reload', (data) => {
        debug(`reload received from ${socket.id}: ${JSON.stringify(data)}`);
        io.to(roomKey).emit('reload', data);
    });

    // Handle ping for heartbeat
    socket.on('ping', () => {
        socket.emit('pong');
    });



    socket.on('disconnect', () => {
        console.log('❌ User Disconnected', socket.id);
    });
});

// Keep the server alive (prevent Render from sleeping)
const keepAlive = () => {
    console.log('💓 Server heartbeat - staying alive');
};

// Log every 5 minutes to show activity
setInterval(keepAlive, 5 * 60 * 1000);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: io.engine.clientsCount
  });
});

// Proxy for esvoley.es — bypasses CORS restrictions for the tracker client
app.get('/proxy/esvoley', (req, res, next) => {
    const origin = req.headers.origin;
    if (corsOrigins.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    }
    next();
}, async (req, res) => {
    const { path: esvoleyPath } = req.query;
    if (!esvoleyPath || !String(esvoleyPath).startsWith('/')) {
        return res.status(400).json({ error: 'Missing or invalid path parameter' });
    }
    try {
        const upstream = await fetch(`https://esvoley.es${esvoleyPath}`);
        const text = await upstream.text();
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(text);
    } catch (err) {
        res.status(502).json({ error: 'Upstream fetch failed', detail: String(err) });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 