const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./env');

const pool = mysql.createPool({
    ...getDatabaseConfig(),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

module.exports = pool;
