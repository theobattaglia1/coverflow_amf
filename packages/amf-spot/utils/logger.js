const { createLogger, format, transports } = require('winston');

module.exports = createLogger({
  format: format.combine(
    format.timestamp(),
    format.simple()
  ),
  transports: [
    new transports.Console()
  ]
});
