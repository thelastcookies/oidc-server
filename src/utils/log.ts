import log4js from 'log4js';

log4js.configure({
  /**
   * Appenders serialise log events to some form of output.
   * They can write to files, send emails, send data over the network.
   * All appenders have a type which determines which appender gets used.
   */
  appenders: {
    access: {
      type: 'dateFile',
      filename: 'logs/access.log',
      pattern: 'yyyy-MM-dd',
      maxLogSize: 104857600,
      backups: 30,
      category: 'http',
      keepFileExt: true,
      alwaysIncludePattern: true,
    },
    app: {
      type: 'file',
      filename: 'logs/app.log',
      maxLogSize: 10485760,
      numBackups: 3,
    },
    info: {
      type: 'file',
      filename: 'logs/info.log',
      maxLogSize: 1073741824,
      backups: 5,
      compress: true,
    },
    error: {
      type: 'file',
      filename: 'logs/error.log',
      maxLogSize: 1073741824,
      backups: 5,
      compress: true,
    },
    out: {
      type: 'stdout',
    },
  },
  /**
   * Categories are groups of log events.
   * The category for log events is defined when you get a Logger from log4js (log4js.getLogger('somecategory')).
   * Log events with the same category will go to the same appenders.
   */
  categories: {
    default: {
      appenders: ['error', 'info', 'out'],
      level: 'all',
    },
    access: {
      appenders: ['access', 'out'],
      level: 'all',
    },
    error: {
      appenders: ['error', 'out'],
      level: 'all',
    },
    info: {
      appenders: ['info', 'out'],
      level: 'all',
    },
  },
});

const logger = {
  access: log4js.getLogger('access'),
  default: log4js.getLogger(),
  error: (...args: any[]) => {
    log4js.getLogger('error').error(args);
  },
  info: (...args: any[]) => {
    log4js.getLogger('info').info(args);
  },
};

export default logger;
