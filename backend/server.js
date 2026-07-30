const {
    assertCoreEnvironment,
    getCorsOrigins,
    getServerPort
} = require('./config/env');

try {
    assertCoreEnvironment();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const setupSocket = require('./socket'); // Import module socket
const path = require('path');
const { IMAGE_EXTENSIONS, UPLOAD_DIR } = require('./config/uploads');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

const app = express();
let shuttingDown = false;
const imageExtensions = new Set(IMAGE_EXTENSIONS.values());
const encodeHeaderValue = value => encodeURIComponent(value)
    .replace(/[!'()*]/gu, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
// Railway/Cloudflare chuyển tiếp qua reverse proxy; chỉ tin hop gần nhất để
// nhận đúng HTTPS và địa chỉ IP cho logging/rate limit.
app.set('trust proxy', 1);
const server = http.createServer(app);
const corsOrigins = getCorsOrigins();
const corsOptions = {
    origin(origin, callback) {
        callback(null, !origin || corsOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Dùng chung một danh sách origin cho REST và Socket.IO.
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        console.info('[http]', {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: Number(durationMs.toFixed(1)),
            origin: req.get('origin') || null
        });
    });
    next();
});
app.use('/uploads', express.static(UPLOAD_DIR, {
    acceptRanges: true,
    dotfiles: 'deny',
    etag: true,
    fallthrough: false,
    immutable: true,
    lastModified: true,
    maxAge: '1y',
    setHeaders(res, filePath) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const mustDownload = !imageExtensions.has(path.extname(filePath).toLowerCase());
        if (mustDownload || res.req.query?.download === '1') {
            const requestedName = String(res.req.query.name || path.basename(filePath))
                .replace(/[\r\n"]/gu, '')
                .slice(0, 255);
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="download"; filename*=UTF-8''${encodeHeaderValue(requestedName)}`
            );
        }
    }
}));

// Routes
const healthHandler = async (_req, res) => {
    if (shuttingDown) {
        return res.status(503).json({ success: false, status: 'shutting_down' });
    }
    try {
        await pool.query('SELECT 1');
        return res.json({ success: true, status: 'ok' });
    } catch (error) {
        console.error('Database health check failed:', error.code || error.message);
        return res.status(503).json({ success: false, status: 'unavailable' });
    }
};

app.get('/health', healthHandler);
app.get('/api/health', async (_req, res) => {
    if (shuttingDown) {
        return res.status(503).json({
            status: 'shutting_down',
            service: 'messenger-backend'
        });
    }
    try {
        await pool.query('SELECT 1');
        return res.json({
            status: 'ok',
            service: 'messenger-backend'
        });
    } catch (error) {
        console.error('Database health check failed:', error.code || error.message);
        return res.status(503).json({
            status: 'unavailable',
            service: 'messenger-backend'
        });
    }
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

app.use((_req, res) => {
    res.status(404).json({ message: 'Không tìm thấy tài nguyên' });
});

app.use((error, _req, res, _next) => {
    const status = Number(error.status || error.statusCode);
    const safeStatus = Number.isInteger(status) && status >= 400 && status < 600
        ? status
        : 500;
    console.error('[http:error]', {
        code: error.code || error.name || 'INTERNAL_ERROR',
        status: safeStatus
    });
    const clientMessage = safeStatus === 404
        ? 'Không tìm thấy tài nguyên'
        : (safeStatus < 500 && error.expose === true
            ? error.message
            : (safeStatus < 500 ? 'Yêu cầu không hợp lệ' : 'Lỗi máy chủ'));
    res.status(safeStatus).json({
        message: clientMessage
    });
});

// Khởi tạo Socket.IO
const io = new Server(server, {
    cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization']
    }
});

io.engine.on('connection_error', error => {
    console.error('[socket.io]', {
        stage: 'connection_error',
        code: error.code,
        message: error.message,
        origin: error.req?.headers?.origin || null
    });
});

// Gắn io vào app nếu cần dùng ở nơi khác
app.set('io', io);

// Setup các sự kiện socket
const cleanupSocketState = setupSocket(io);

const PORT = getServerPort();
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Nickname = require('./models/Nickname');
const Message = require('./models/Message');
const AccountSecurity = require('./models/AccountSecurity');
const BlockedUser = require('./models/BlockedUser');
const {
    closeMailTransport,
    initializeMailTransport
} = require('./services/mailService');

const initializeDatabase = async () => {
    await pool.query('SELECT 1');
    // Chạy tuần tự để tránh các ALTER TABLE trên cùng bảng cạnh tranh metadata lock.
    await User.initialize();
    await Conversation.initialize();
    await Nickname.initialize();
    await Message.initialize();
    await AccountSecurity.initialize();
    await BlockedUser.initialize();
};

const start = async () => {
    await initializeDatabase();
    await new Promise((resolve, reject) => {
        const handleListenError = error => reject(error);
        server.once('error', handleListenError);
        server.listen(PORT, '0.0.0.0', () => {
            server.off('error', handleListenError);
            console.log(`Server đang chạy trên 0.0.0.0:${PORT}`);
            resolve();
        });
    });

    void Promise.resolve()
        .then(() => initializeMailTransport())
        .catch(error => {
            console.error(
                'SMTP connection check failed:',
                error.code || error.message
            );
        });
};

let shutdownPromise;
const closeResources = async () => {
    cleanupSocketState();
    await Promise.allSettled([
        closeMailTransport(),
        pool.end()
    ]);
};

const shutdown = signal => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    console.info(`Received ${signal}; shutting down gracefully.`);

    shutdownPromise = new Promise(resolve => {
        const forceTimer = setTimeout(() => {
            console.error('Graceful shutdown timed out.');
            server.closeAllConnections?.();
            process.exit(1);
        }, 10_000);
        forceTimer.unref();

        const finish = async error => {
            clearTimeout(forceTimer);
            io.disconnectSockets(true);
            await closeResources();
            if (error) {
                console.error('HTTP server shutdown failed:', error.code || error.message);
                process.exitCode = 1;
            }
            resolve();
        };

        if (!server.listening) {
            void finish();
            return;
        }
        server.close(error => {
            void finish(error);
        });
        io.disconnectSockets(true);
    });

    return shutdownPromise;
};

process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.once('SIGINT', () => {
    void shutdown('SIGINT');
});

void start().catch(async error => {
    console.error('Không thể khởi động backend:', error.code || error.message);
    process.exitCode = 1;
    await closeResources();
});
