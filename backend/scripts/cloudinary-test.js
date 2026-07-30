const { pingCloudinary } = require('../config/cloudinary');

const run = async () => {
    const startedAt = Date.now();
    try {
        await pingCloudinary({ timeoutMs: 10_000 });
        console.info('[cloudinary]', {
            operation: 'configuration_test',
            stage: 'ping',
            status: 'ok',
            duration_ms: Date.now() - startedAt
        });
    } catch (error) {
        console.error('[cloudinary]', {
            operation: 'configuration_test',
            stage: 'ping',
            status: 'failed',
            duration_ms: Date.now() - startedAt,
            error_code: error.code || error.name
        });
        process.exitCode = 1;
    }
};

void run();
