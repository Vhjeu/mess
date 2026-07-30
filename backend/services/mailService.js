const nodemailer = require('nodemailer');
const { getMailConfig } = require('../config/env');

let transporter;
let mailConfig;
let transporterVerification;
let mailInitialization;
let transporterCreatedAt;
let transporterId;

const elapsedMilliseconds = startedAt => (
    Number(process.hrtime.bigint() - startedAt) / 1_000_000
);

const getTransporter = () => {
    if (transporter) return { transporter, mailConfig };

    const startedAt = process.hrtime.bigint();
    mailConfig = getMailConfig();
    transporter = nodemailer.createTransport({
        pool: true,
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        maxConnections: mailConfig.poolMaxConnections,
        maxMessages: mailConfig.poolMaxMessages,
        connectionTimeout: mailConfig.connectionTimeoutMs,
        greetingTimeout: mailConfig.greetingTimeoutMs,
        socketTimeout: mailConfig.socketTimeoutMs,
        dnsTimeout: mailConfig.connectionTimeoutMs,
        auth: {
            user: mailConfig.user,
            pass: mailConfig.pass
        }
    });
    transporterCreatedAt = process.hrtime.bigint();
    transporterId = `${process.pid}:${Date.now()}`;
    console.info('[timing]', {
        operation: 'smtp:transporter',
        stage: 'created',
        process_id: process.pid,
        transporter_id: transporterId,
        duration_ms: Number(elapsedMilliseconds(startedAt).toFixed(1)),
        pooled: true,
        pool_max_connections: mailConfig.poolMaxConnections,
        pool_max_messages: mailConfig.poolMaxMessages,
        socket_timeout_ms: mailConfig.socketTimeoutMs
    });
    return { transporter, mailConfig };
};

const sendMailWithTiming = async (operation, mailer, message) => {
    const startedAt = process.hrtime.bigint();
    console.info('[timing]', {
        operation: `smtp:${operation}`,
        stage: 'send_started',
        process_id: process.pid,
        transporter_id: transporterId,
        transporter_age_ms: transporterCreatedAt
            ? Number(elapsedMilliseconds(transporterCreatedAt).toFixed(1))
            : null
    });
    try {
        const info = await mailer.transporter.sendMail(message);
        const durationMs = elapsedMilliseconds(startedAt);
        console.info('[timing]', {
            operation: `smtp:${operation}`,
            stage: 'send_complete',
            process_id: process.pid,
            transporter_id: transporterId,
            duration_ms: Number(durationMs.toFixed(1)),
            accepted_count: info.accepted?.length || 0,
            rejected_count: info.rejected?.length || 0
        });
        return info;
    } catch (error) {
        const durationMs = elapsedMilliseconds(startedAt);
        console.error('[timing]', {
            operation: `smtp:${operation}`,
            stage: 'send_failed',
            process_id: process.pid,
            transporter_id: transporterId,
            duration_ms: Number(durationMs.toFixed(1)),
            error_code: error.code || error.name || 'SMTP_ERROR',
            smtp_command: error.command
        });
        throw error;
    }
};

const verifyMailTransport = () => {
    if (transporterVerification) return transporterVerification;

    const mailer = getTransporter();
    const startedAt = process.hrtime.bigint();
    transporterVerification = mailer.transporter.verify()
        .then(() => {
            const durationMs = elapsedMilliseconds(startedAt);
            console.info('[timing]', {
                operation: 'smtp:verify',
                stage: 'connection_ready',
                process_id: process.pid,
                transporter_id: transporterId,
                duration_ms: Number(durationMs.toFixed(1))
            });
            return true;
        })
        .catch(error => {
            const durationMs = elapsedMilliseconds(startedAt);
            console.error('[timing]', {
                operation: 'smtp:verify',
                stage: 'connection_failed',
                process_id: process.pid,
                transporter_id: transporterId,
                duration_ms: Number(durationMs.toFixed(1)),
                error_code: error.code || error.name || 'SMTP_ERROR',
                smtp_command: error.command
            });
            transporterVerification = null;
            throw error;
        });

    return transporterVerification;
};

const initializeMailTransport = () => {
    if (mailInitialization) return mailInitialization;

    const mailer = getTransporter();
    if (!mailer.mailConfig.verifyOnStart) {
        console.info('[timing]', {
            operation: 'smtp:verify',
            stage: 'startup_check_skipped',
            process_id: process.pid,
            transporter_id: transporterId
        });
        mailInitialization = Promise.resolve(false);
        return mailInitialization;
    }
    mailInitialization = verifyMailTransport();
    return mailInitialization;
};

const closeMailTransport = async () => {
    const activeTransporter = transporter;
    transporter = undefined;
    mailConfig = undefined;
    transporterVerification = undefined;
    mailInitialization = undefined;
    transporterCreatedAt = undefined;
    transporterId = undefined;
    if (activeTransporter) {
        await Promise.resolve(activeTransporter.close());
    }
};

const sendOtpEmail = async ({
    email,
    otp,
    subject,
    heading,
    description
}) => {
    const mailer = getTransporter();
    await sendMailWithTiming('otp', mailer, {
        from: mailer.mailConfig.from,
        to: email,
        subject,
        text: `${description} Mã của bạn là ${otp}. Mã có hiệu lực trong 10 phút.`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">${heading}</h2>
                <p>${description}</p>
                <div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px 0">${otp}</div>
                <p style="color:#667085">Mã có hiệu lực trong 10 phút và chỉ dùng được một lần.</p>
            </div>
        `
    });
};

exports.sendEmailVerification = (email, otp, { isEmailChange = false } = {}) => (
    sendOtpEmail({
        email,
        otp,
        subject: isEmailChange ? 'Xác minh email mới' : 'Mã xác minh email',
        heading: isEmailChange ? 'Xác minh email mới' : 'Xác minh email',
        description: isEmailChange
            ? 'Dùng mã dưới đây để xác minh email mới cho tài khoản của bạn.'
            : 'Dùng mã dưới đây để xác minh email cho tài khoản của bạn.'
    })
);

exports.sendCurrentEmailChangeConfirmation = (email, otp) => (
    sendOtpEmail({
        email,
        otp,
        subject: 'Xác nhận yêu cầu đổi email',
        heading: 'Xác nhận email hiện tại',
        description: 'Có yêu cầu đổi email khôi phục. Dùng mã dưới đây để xác nhận bạn vẫn kiểm soát email hiện tại.'
    })
);

const sendEmailChangeNotice = async ({ email, subject, heading, description }) => {
    const mailer = getTransporter();
    await sendMailWithTiming('email-change-notice', mailer, {
        from: mailer.mailConfig.from,
        to: email,
        subject,
        text: description,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">${heading}</h2>
                <p>${description}</p>
                <p style="color:#667085">Nếu bạn không thực hiện thay đổi này, hãy đổi mật khẩu tài khoản ngay lập tức.</p>
            </div>
        `
    });
};

exports.sendEmailChangedNoticeToOld = email => sendEmailChangeNotice({
    email,
    subject: 'Email khôi phục của tài khoản đã được thay đổi',
    heading: 'Email đã được thay đổi',
    description: 'Email này không còn là email khôi phục của tài khoản.'
});

exports.sendEmailChangedNoticeToNew = email => sendEmailChangeNotice({
    email,
    subject: 'Email khôi phục mới đã được xác minh',
    heading: 'Đổi email thành công',
    description: 'Email này hiện là email khôi phục đã xác minh của tài khoản.'
});

exports.sendPasswordReset = async (email, token) => {
    const mailer = getTransporter();
    const resetUrl = `${mailer.mailConfig.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await sendMailWithTiming('password-reset', mailer, {
        from: mailer.mailConfig.from,
        to: email,
        subject: 'Khôi phục mật khẩu',
        text: `Mở liên kết sau để đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút: ${resetUrl}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
                <h2 style="margin:0 0 12px">Khôi phục mật khẩu</h2>
                <p>Nhấn nút dưới đây để đặt lại mật khẩu của bạn.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#3e59d6;color:#fff;text-decoration:none;font-weight:700">
                    Đặt lại mật khẩu
                </a>
                <p style="color:#667085;margin-top:20px">Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.</p>
            </div>
        `
    });
};

exports.verifyMailTransport = verifyMailTransport;
exports.initializeMailTransport = initializeMailTransport;
exports.closeMailTransport = closeMailTransport;
