const elapsedMilliseconds = startedAt => (
    Number(process.hrtime.bigint() - startedAt) / 1_000_000
);

const createOperationTimer = (operation, context = {}) => {
    const startedAt = process.hrtime.bigint();
    let previousMarkAt = startedAt;

    const write = (level, stage, details = {}) => {
        const now = process.hrtime.bigint();
        const stageDurationMs = Number(now - previousMarkAt) / 1_000_000;
        const totalDurationMs = elapsedMilliseconds(startedAt);
        previousMarkAt = now;

        console[level]('[timing]', {
            operation,
            stage,
            stage_duration_ms: Number(stageDurationMs.toFixed(1)),
            total_duration_ms: Number(totalDurationMs.toFixed(1)),
            ...context,
            ...details
        });
    };

    return {
        mark: (stage, details) => write('info', stage, details),
        fail: (stage, error) => write('error', stage, {
            error_code: error?.code || error?.name || 'UNKNOWN_ERROR'
        })
    };
};

module.exports = { createOperationTimer };
