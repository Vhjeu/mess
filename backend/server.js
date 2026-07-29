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
const http = require('http');
const { Server } = require('socket.io');
const setupSocket = require('./socket'); // Import module socket
const path = require('path');
const { UPLOAD_DIR } = require('./config/uploads');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

const app = express();
const encodeHeaderValue = value => encodeURIComponent(value)
    .replace(/[!'()*]/gu, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
// Cloudflare Tunnel là proxy duy nhất đứng trước Express. Thiết lập này giúp
// req.protocol nhận đúng HTTPS từ X-Forwarded-Proto khi tạo URL file upload.
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
app.use(cors(corsOptions));
app.use(express.json());
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
        if (res.req.query?.download === '1') {
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
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'messenger-backend'
    });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

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
setupSocket(io);

const PORT = getServerPort();
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Nickname = require('./models/Nickname');
const Message = require('./models/Message');
const AccountSecurity = require('./models/AccountSecurity');
const OnlineUser = require('./models/OnlineUser');
const { initializeMailTransport } = require('./services/mailService');

void initializeMailTransport().catch(error => {
    console.error(
        'SMTP connection check failed:',
        error.code || error.message
    );
});

Promise.all([
    User.initialize(),
    Conversation.initialize(),
    Nickname.initialize(),
    Message.initialize(),
    AccountSecurity.initialize(),
    OnlineUser.initialize()
])
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server đang chạy trên cổng ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Lỗi khởi tạo schema người dùng:', error);
        process.exit(1);
    });
