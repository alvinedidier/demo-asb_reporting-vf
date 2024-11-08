// utils/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'data/logs/error.log', level: 'error' }),
        new transports.File({ filename: 'data/logs/combined.log' })
    ],
});

module.exports = logger;
