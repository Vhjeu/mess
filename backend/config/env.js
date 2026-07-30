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
    const frontendUrls = readRequired('FRONTEND_URL').split(',');
    const extraOrigins = typeof process.env.CORS_ORIGINS === 'string'
        ? process.env.CORS_ORIGINS.split(',')
        : [];
    const values = [...frontendUrls, ...extraOrigins]
        .map(value => value.trim())
        .filter(Boolean);

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

const getJwtSecret = () => {
    const secret = readRequired('JWT_SECRET');
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
        throw createConfigurationError(
            'JWT_SECRET phải có ít nhất 32 ký tự trong môi trường production.'
        );
    }
    return secret;
};

const getServerPort = () => readInteger('PORT', { defaultValue: 5000 });

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
    frontendUrl: normalizeHttpUrl(
        readRequired('FRONTEND_URL').split(',')[0],
        'FRONTEND_URL'
    ),
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
    const databaseConfig = getDatabaseConfig();
    if (
        process.env.NODE_ENV === 'production'
        && ['localhost', '127.0.0.1', '::1'].includes(databaseConfig.host.toLowerCase())
    ) {
        throw createConfigurationError(
            'DB_HOST không được trỏ tới localhost trong môi trường production.'
        );
    }
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
