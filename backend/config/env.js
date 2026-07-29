const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../.env'),
    quiet: true
});
dotenv.config({
    path: path.resolve(__dirname, '../../.env'),
    quiet: true
});

const createConfigurationError = message => {
    const error = new Error(`Lỗi cấu hình môi trường: ${message}`);
    error.code = 'CONFIGURATION_ERROR';
    return error;
};

const readRequired = name => {
    const value = process.env[name];
    if (typeof value !== 'string' || !value.trim()) {
        throw createConfigurationError(
            `thiếu biến ${name}. Hãy khai báo biến này trong file .env.`
        );
    }
    return value;
};

const readDefined = name => {
    if (!Object.prototype.hasOwnProperty.call(process.env, name)) {
        throw createConfigurationError(
            `thiếu biến ${name}. Hãy khai báo biến này trong file .env.`
        );
    }
    return process.env[name];
};

const readInteger = (name, { defaultValue, min = 1, max = 65535 } = {}) => {
    const rawValue = process.env[name];
    if ((rawValue === undefined || rawValue === '') && defaultValue !== undefined) {
        return defaultValue;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw createConfigurationError(
            `${name} phải là số nguyên từ ${min} đến ${max}.`
        );
    }
    return value;
};

const readBoolean = name => {
    const value = readRequired(name).trim().toLowerCase();
    if (value !== 'true' && value !== 'false') {
        throw createConfigurationError(`${name} chỉ nhận giá trị true hoặc false.`);
    }
    return value === 'true';
};

const readOptionalBoolean = (name, defaultValue) => {
    const value = process.env[name];
    if (value === undefined || value.trim() === '') return defaultValue;

    const normalized = value.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
        throw createConfigurationError(`${name} chỉ nhận giá trị true hoặc false.`);
    }
    return normalized === 'true';
};

const readUrl = name => {
    const value = readRequired(name).trim().replace(/\/+$/u, '');
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('invalid protocol');
        }
    } catch {
        throw createConfigurationError(`${name} phải là URL HTTP/HTTPS hợp lệ.`);
    }
    return value;
};

const normalizeHttpUrl = (value, label) => {
    const normalized = value.trim().replace(/\/+$/u, '');
    try {
        const url = new URL(normalized);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('invalid protocol');
        }
    } catch {
        throw createConfigurationError(`${label} phải là URL HTTP/HTTPS hợp lệ.`);
    }
    return normalized;
};

const getCorsOrigins = () => {
    const configured = process.env.CORS_ORIGINS;
    const values = typeof configured === 'string' && configured.trim()
        ? configured.split(',')
        : [readUrl('FRONTEND_URL')];

    const origins = values
        .map((value, index) => normalizeHttpUrl(value, `CORS_ORIGINS[${index}]`))
        .filter(Boolean);

    if (origins.length === 0) {
        throw createConfigurationError('CORS_ORIGINS phải có ít nhất một URL hợp lệ.');
    }
    return [...new Set(origins)];
};

const getDatabaseConfig = () => ({
    host: readRequired('DB_HOST'),
    port: readInteger('DB_PORT', { defaultValue: 3306 }),
    user: readRequired('DB_USER'),
    password: readDefined('DB_PASSWORD'),
    database: readRequired('DB_NAME')
});

const getJwtSecret = () => readRequired('JWT_SECRET');

const getServerPort = () => readInteger('PORT');

const getEmailTokenSecret = () => {
    const dedicatedSecret = process.env.EMAIL_TOKEN_SECRET;
    return typeof dedicatedSecret === 'string' && dedicatedSecret.trim()
        ? dedicatedSecret
        : getJwtSecret();
};

const getMailConfig = () => ({
    host: readRequired('SMTP_HOST'),
    port: readInteger('SMTP_PORT'),
    secure: readBoolean('SMTP_SECURE'),
    verifyOnStart: readOptionalBoolean(
        'SMTP_VERIFY_ON_START',
        process.env.NODE_ENV !== 'production'
    ),
    user: readRequired('SMTP_USER'),
    pass: readRequired('SMTP_PASS'),
    from: readRequired('SMTP_FROM'),
    frontendUrl: readUrl('FRONTEND_URL'),
    connectionTimeoutMs: readInteger('SMTP_CONNECTION_TIMEOUT_MS', {
        defaultValue: 10000,
        max: 120000
    }),
    greetingTimeoutMs: readInteger('SMTP_GREETING_TIMEOUT_MS', {
        defaultValue: 10000,
        max: 120000
    }),
    socketTimeoutMs: readInteger('SMTP_SOCKET_TIMEOUT_MS', {
        defaultValue: 600000,
        max: 3600000
    }),
    poolMaxConnections: readInteger('SMTP_POOL_MAX_CONNECTIONS', {
        defaultValue: 3,
        max: 20
    }),
    poolMaxMessages: readInteger('SMTP_POOL_MAX_MESSAGES', {
        defaultValue: 100,
        max: 10000
    })
});

const assertCoreEnvironment = () => {
    getServerPort();
    getJwtSecret();
    getDatabaseConfig();
    getEmailTokenSecret();
    getCorsOrigins();
};

module.exports = {
    assertCoreEnvironment,
    getDatabaseConfig,
    getEmailTokenSecret,
    getJwtSecret,
    getMailConfig,
    getCorsOrigins,
    getServerPort
};
