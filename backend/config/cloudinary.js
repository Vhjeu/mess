const { v2: cloudinary } = require('cloudinary');
const { getCloudinaryConfig } = require('./env');

const configuration = getCloudinaryConfig({ required: false });

if (configuration) {
    cloudinary.config({
        cloud_name: configuration.cloudName,
        api_key: configuration.apiKey,
        api_secret: configuration.apiSecret,
        secure: true,
        hide_sensitive: true
    });
}

const createCloudinaryConfigurationError = () => {
    const error = new Error(
        'Cloudinary chưa được cấu hình. Hãy kiểm tra các biến CLOUDINARY_* trên máy chủ.'
    );
    error.code = 'CLOUDINARY_CONFIGURATION_ERROR';
    error.status = 503;
    error.expose = true;
    return error;
};

const assertCloudinaryConfigured = () => {
    if (!configuration) {
        throw createCloudinaryConfigurationError();
    }
    return configuration;
};

const isCloudinaryConfigured = () => Boolean(configuration);

const pingCloudinary = async ({ timeoutMs = 10_000 } = {}) => {
    assertCloudinaryConfigured();

    let timeout;
    try {
        return await Promise.race([
            cloudinary.api.ping(),
            new Promise((_resolve, reject) => {
                timeout = setTimeout(() => {
                    const error = new Error('Cloudinary ping quá thời gian chờ.');
                    error.code = 'CLOUDINARY_PING_TIMEOUT';
                    reject(error);
                }, timeoutMs);
                timeout.unref?.();
            })
        ]);
    } finally {
        clearTimeout(timeout);
    }
};

module.exports = {
    assertCloudinaryConfigured,
    cloudinary,
    isCloudinaryConfigured,
    pingCloudinary
};
