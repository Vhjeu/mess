const {
    assertCoreEnvironment,
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

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

// Cấu hình CORS cho Express
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Khởi tạo Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
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
const { verifyMailTransport } = require('./services/mailService');

Promise.all([
    User.initialize(),
    Conversation.initialize(),
    Nickname.initialize(),
    Message.initialize(),
    AccountSecurity.initialize()
])
    .then(() => {
        server.listen(PORT, () => {
            void verifyMailTransport().catch(error => {
                console.error(
                    'SMTP connection check failed:',
                    error.code || error.message
                );
            });
            console.log(`Server đang chạy trên cổng ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Lỗi khởi tạo schema người dùng:', error);
        process.exit(1);
    });
