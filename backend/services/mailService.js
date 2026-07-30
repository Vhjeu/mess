const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const {
    getEmailConfig,
    getMailConfig
} = require('../config/env');

let provider;
let transporterVerification;
let mailInitialization;
let transporterCreatedAt;
let transporterId;

const elapsedMilliseconds = startedAt => (
    Number(process.hrtime.bigint() - startedAt) / 1_000_000
);

const getSmtpModeWarning = config => {
    if (config.port === 465 && !config.secure) {
        return 'SMTP_PORT=465 yêu cầu SMTP_SECURE=true.';
    }
    if (config.port === 587 && config.secure) {
        return 'SMTP_PORT=587 yêu cầu SMTP_SECURE=false.';
    }
    return null;
};

const createSmtpTransport = mailConfig => nodemailer.createTransport({
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
    tls: {
        servername: mailConfig.host
    },
    auth: {
        user: mailConfig.user,
        pass: mailConfig.pass
    }
});

const createResendError = responseError => {
    const statusCode = Number(responseError?.statusCode);
    const error = new Error(responseError?.message || 'Resend không thể gửi email.');
    error.responseCode = Number.isFinite(statusCode) ? statusCode : undefined;
    error.command = 'POST /emails';

    if (
        [401, 403].includes(statusCode)
        || ['invalid_api_key', 'missing_api_key', 'restricted_api_key'].includes(responseError?.name)
    ) {
        error.code = 'EMAIL_API_AUTH_FAILED';
    } else if (statusCode === 429 || responseError?.name === 'rate_limit_exceeded') {
        error.code = 'EMAIL_API_RATE_LIMITED';
    } else {
        error.code = 'EMAIL_API_SEND_FAILED';
    }
    return error;
};

const createResendNetworkError = cause => {
    const sourceCode = cause?.code || cause?.cause?.code;
    const error = new Error('Không thể kết nối Resend Email API.', { cause });
    error.code = [
        'ETIMEDOUT',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT'
    ].includes(sourceCode)
        ? 'EMAIL_API_TIMEOUT'
        : 'EMAIL_API_SEND_FAILED';
    error.command = 'POST /emails';
    return error;
};

const getEmailProvider = () => {
    if (provider) return provider;

    const startedAt = process.hrtime.bigint();
    const config = getEmailConfig();
    if (config.provider === 'resend') {
        const resend = new Resend(config.apiKey);
        provider = {
            name: 'resend',
            config,
            async send(message, { idempotencyKey } = {}) {
                try {
                    const { data, error } = await resend.emails.send({
                        from: config.from,
                        to: [message.to],
                        subject: message.subject,
                        text: message.text,
                        html: message.html
                    }, idempotencyKey ? { idempotencyKey } : undefined);
                    if (error) throw createResendError(error);
                    return {
                        id: data?.id,
                        accepted: [message.to],
                        rejected: []
                    };
                } catch (error) {
                    if (error?.command === 'POST /emails') throw error;
                    throw createResendNetworkError(error);
                }
            },
            close() {}
        };
    } else {
        const modeWarning = getSmtpModeWarning(config);
        if (modeWarning) {
            console.warn('[email]', {
                operation: 'provider_configuration',
                stage: 'warning',
                provider: 'smtp',
                host: config.host,
                port: config.port,
                secure: config.secure,
                error_code: 'SMTP_MODE_MISMATCH',
                message: modeWarning
            });
        }
        const smtpTransporter = createSmtpTransport(config);
        provider = {
            name: 'smtp',
            config,
            send: message => smtpTransporter.sendMail({
                ...message,
                from: config.from
            }),
            verify: () => smtpTransporter.verify(),
            close: () => smtpTransporter.close()
        };
    }

    transporterCreatedAt = process.hrtime.bigint();
    transporterId = `${process.pid}:${Date.now()}`;
    console.info('[timing]', {
        operation: 'email:provider',
        stage: 'created',
        provider: provider.name,
        process_id: process.pid,
        transporter_id: transporterId,
        duration_ms: Number(elapsedMilliseconds(startedAt).toFixed(1)),
        host: provider.config.host,
        port: provider.config.port,
        secure: provider.config.secure,
        ...(provider.name === 'smtp'
            ? {
                pooled: true,
                pool_max_connections: provider.config.poolMaxConnections,
                pool_max_messages: provider.config.poolMaxMessages,
                socket_timeout_ms: provider.config.socketTimeoutMs
            }
            : {})
    });
    return provider;
};

const sendMailWithTiming = async (
    operation,
    emailProvider,
    message,
    { idempotencyKey } = {}
) => {
    const startedAt = process.hrtime.bigint();
    console.info('[timing]', {
        operation: `${emailProvider.name}:${operation}`,
        stage: 'send_started',
        provider: emailProvider.name,
        process_id: process.pid,
        transporter_id: transporterId,
        transporter_age_ms: transporterCreatedAt
            ? Number(elapsedMilliseconds(transporterCreatedAt).toFixed(1))
            : null,
        host: emailProvider.config.host,
        port: emailProvider.config.port,
        secure: emailProvider.config.secure
    });
    try {
        const info = await emailProvider.send(message, { idempotencyKey });
        const durationMs = elapsedMilliseconds(startedAt);
        console.info('[timing]', {
            operation: `${emailProvider.name}:${operation}`,
            stage: 'send_complete',
            provider: emailProvider.name,
            process_id: process.pid,
            transporter_id: transporterId,
            duration_ms: Number(durationMs.toFixed(1)),
            host: emailProvider.config.host,
            port: emailProvider.config.port,
            secure: emailProvider.config.secure,
            accepted_count: info.accepted?.length || 0,
            rejected_count: info.rejected?.length || 0
        });
        return info;
    } catch (error) {
        const durationMs = elapsedMilliseconds(startedAt);
        console.error('[timing]', {
            operation: `${emailProvider.name}:${operation}`,
            stage: 'send_failed',
            provider: emailProvider.name,
            process_id: process.pid,
            transporter_id: transporterId,
            duration_ms: Number(durationMs.toFixed(1)),
            error_code: error.code || error.name || 'EMAIL_SEND_FAILED',
            command: error.command,
            responseCode: error.responseCode,
            host: emailProvider.config.host,
            port: emailProvider.config.port,
            secure: emailProvider.config.secure
        });
        throw error;
    }
};

const verifyMailTransport = () => {
    if (transporterVerification) return transporterVerification;

    const emailProvider = getEmailProvider();
    if (emailProvider.name !== 'smtp') {
        return Promise.resolve(true);
    }

    const startedAt = process.hrtime.bigint();
    transporterVerification = emailProvider.verify()
        .then(() => {
            const durationMs = elapsedMilliseconds(startedAt);
            console.info('[timing]', {
                operation: 'smtp:verify',
                stage: 'connection_ready',
                provider: 'smtp',
                process_id: process.pid,
                transporter_id: transporterId,
                duration_ms: Number(durationMs.toFixed(1)),
                host: emailProvider.config.host,
                port: emailProvider.config.port,
                secure: emailProvider.config.secure
            });
            return true;
        })
        .catch(error => {
            const durationMs = elapsedMilliseconds(startedAt);
            console.error('[timing]', {
                operation: 'smtp:verify',
                stage: 'connection_failed',
                provider: 'smtp',
                process_id: process.pid,
                transporter_id: transporterId,
                duration_ms: Number(durationMs.toFixed(1)),
                error_code: error.code || error.name || 'SMTP_ERROR',
                command: error.command,
                responseCode: error.responseCode,
                host: emailProvider.config.host,
                port: emailProvider.config.port,
                secure: emailProvider.config.secure
            });
            transporterVerification = null;
            throw error;
        });

    return transporterVerification;
};

const initializeMailTransport = () => {
    if (mailInitialization) return mailInitialization;

    const emailProvider = getEmailProvider();
    if (emailProvider.name === 'resend') {
        console.info('[timing]', {
            operation: 'email:provider',
            stage: 'configuration_ready',
            provider: 'resend',
            process_id: process.pid,
            transporter_id: transporterId,
            host: emailProvider.config.host,
            port: emailProvider.config.port,
            secure: emailProvider.config.secure
        });
        mailInitialization = Promise.resolve(true);
        return mailInitialization;
    }
    if (!emailProvider.config.verifyOnStart) {
        console.info('[timing]', {
            operation: 'smtp:verify',
            stage: 'startup_check_skipped',
            provider: 'smtp',
            process_id: process.pid,
            transporter_id: transporterId,
            host: emailProvider.config.host,
            port: emailProvider.config.port,
            secure: emailProvider.config.secure
        });
        mailInitialization = Promise.resolve(false);
        return mailInitialization;
    }
    mailInitialization = verifyMailTransport();
    return mailInitialization;
};

const closeMailTransport = async () => {
    const activeProvider = provider;
    provider = undefined;
    transporterVerification = undefined;
    mailInitialization = undefined;
    transporterCreatedAt = undefined;
    transporterId = undefined;
    if (activeProvider) {
        await Promise.resolve(activeProvider.close());
    }
};

const sendOtpEmail = async ({
    email,
    otp,
    subject,
    heading,
    description,
    idempotencyKey
}) => {
    const emailProvider = getEmailProvider();
    await sendMailWithTiming('otp', emailProvider, {
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
    }, { idempotencyKey });
};

exports.sendEmailVerification = (email, otp, {
    idempotencyKey,
    isEmailChange = false
} = {}) => (
    sendOtpEmail({
        email,
        otp,
        subject: isEmailChange ? 'Xác minh email mới' : 'Mã xác minh email',
        heading: isEmailChange ? 'Xác minh email mới' : 'Xác minh email',
        description: isEmailChange
            ? 'Dùng mã dưới đây để xác minh email mới cho tài khoản của bạn.'
            : 'Dùng mã dưới đây để xác minh email cho tài khoản của bạn.',
        idempotencyKey
    })
);

exports.sendCurrentEmailChangeConfirmation = (email, otp, { idempotencyKey } = {}) => (
    sendOtpEmail({
        email,
        otp,
        subject: 'Xác nhận yêu cầu đổi email',
        heading: 'Xác nhận email hiện tại',
        description: 'Có yêu cầu đổi email khôi phục. Dùng mã dưới đây để xác nhận bạn vẫn kiểm soát email hiện tại.',
        idempotencyKey
    })
);

const sendEmailChangeNotice = async ({ email, subject, heading, description }) => {
    const emailProvider = getEmailProvider();
    await sendMailWithTiming('email-change-notice', emailProvider, {
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

exports.sendPasswordReset = async (email, token, { idempotencyKey } = {}) => {
    const emailProvider = getEmailProvider();
    const resetUrl = `${emailProvider.config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await sendMailWithTiming('password-reset', emailProvider, {
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
    }, { idempotencyKey });
};

exports.createSmtpTransport = createSmtpTransport;
exports.getSmtpModeWarning = getSmtpModeWarning;
exports.verifyMailTransport = verifyMailTransport;
exports.initializeMailTransport = initializeMailTransport;
exports.closeMailTransport = closeMailTransport;
