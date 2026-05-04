import log4js from 'log4js';

log4js.configure({
  appenders: {
    access: {
      type: 'dateFile',
      filename: 'logs/access.log',
      pattern: 'yyyy-MM-dd',
      maxLogSize: 104857600,
      backups: 30,
      keepFileExt: true,
      alwaysIncludePattern: true,
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
  categories: {
    default: {
      appenders: ['error', 'out'],
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
  },
});

const logger = {
  access: log4js.getLogger('access'),
  error: (...args: any[]) => {
    log4js.getLogger('error').error(args);
  },
};

export default logger;
