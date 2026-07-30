const net = require('net');
const tls = require('tls');
require('../config/env');

const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
const timeoutMs = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 15_000;

const testConnection = ({ port, secure }) => new Promise(resolve => {
    const startedAt = process.hrtime.bigint();
    let settled = false;
    const finish = (connected, errorCode = null) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const result = {
            host,
            port,
            connected,
            duration_ms: Number(durationMs.toFixed(1)),
            error_code: errorCode
        };
        console.log(JSON.stringify(result));
        resolve(result);
    };

    const socket = secure
        ? tls.connect({
            host,
            port,
            servername: host,
            rejectUnauthorized: true
        }, () => finish(true))
        : net.connect({ host, port }, () => finish(true));

    socket.setTimeout(timeoutMs, () => finish(false, 'ETIMEDOUT'));
    socket.once('error', error => finish(false, error.code || error.name));
});

const run = async () => {
    const results = [];
    results.push(await testConnection({ port: 587, secure: false }));
    results.push(await testConnection({ port: 465, secure: true }));
    if (!results.some(result => result.connected)) {
        process.exitCode = 1;
    }
};

void run();
