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
    user: readRequired('SMTP_USER'),
    pass: readRequired('SMTP_PASS'),
    from: readRequired('SMTP_FROM'),
    frontendUrl: readUrl('FRONTEND_URL')
});

const assertCoreEnvironment = () => {
    getServerPort();
    getJwtSecret();
    getDatabaseConfig();
    getEmailTokenSecret();
};

module.exports = {
    assertCoreEnvironment,
    getDatabaseConfig,
    getEmailTokenSecret,
    getJwtSecret,
    getMailConfig,
    getServerPort
};
