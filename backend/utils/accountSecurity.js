const crypto = require('crypto');
const { getEmailTokenSecret } = require('../config/env');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

exports.normalizeEmail = value => (
    typeof value === 'string' ? value.trim().toLowerCase() : ''
);

exports.isValidEmail = email => (
    email.length <= 254 && EMAIL_PATTERN.test(email)
);

exports.maskEmail = email => {
    if (!email) return null;
    const [localPart, domain] = email.split('@');
    if (!domain) return null;
    const visibleLength = Math.min(3, Math.max(1, localPart.length - 1));
    return `${localPart.slice(0, visibleLength)}***@${domain}`;
};

exports.generateOtp = () => String(crypto.randomInt(100000, 1000000));

exports.generateResetToken = () => crypto.randomBytes(32).toString('hex');

exports.hashAccountSecret = (value, purpose, userId = '') => (
    crypto
        .createHmac('sha256', getEmailTokenSecret())
        .update(`${purpose}:${userId}:${value}`)
        .digest('hex')
);
