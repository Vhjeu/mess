const { getMailConfig } = require('../config/env');
const {
    createSmtpTransport,
    getSmtpModeWarning
} = require('../services/mailService');

const run = async () => {
    let transporter;
    const startedAt = process.hrtime.bigint();
    try {
        const config = getMailConfig();
        const warning = getSmtpModeWarning(config);
        if (warning) {
            console.warn(JSON.stringify({
                operation: 'smtp:verify',
                stage: 'configuration_warning',
                host: config.host,
                port: config.port,
                secure: config.secure,
                error_code: 'SMTP_MODE_MISMATCH',
                message: warning
            }));
        }

        transporter = createSmtpTransport(config);
        await transporter.verify();
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        console.log(JSON.stringify({
            operation: 'smtp:verify',
            stage: 'complete',
            host: config.host,
            port: config.port,
            secure: config.secure,
            connected: true,
            duration_ms: Number(durationMs.toFixed(1)),
            error_code: null,
            command: null,
            responseCode: null
        }));
    } catch (error) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const config = (() => {
            try {
                return getMailConfig();
            } catch {
                return {};
            }
        })();
        console.error(JSON.stringify({
            operation: 'smtp:verify',
            stage: 'failed',
            host: config.host || null,
            port: config.port || null,
            secure: config.secure ?? null,
            connected: false,
            duration_ms: Number(durationMs.toFixed(1)),
            error_code: error.code || error.name || 'SMTP_VERIFY_FAILED',
            command: error.command || null,
            responseCode: error.responseCode || null
        }));
        process.exitCode = 1;
    } finally {
        transporter?.close();
    }
};

void run();
