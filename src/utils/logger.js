const chalk = require('chalk');

function timestamp() {
  return chalk.gray(new Date().toLocaleTimeString());
}

const logger = {
  info(msg) {
    console.log(chalk.yellow(' ℹ '), msg);
  },
  success(msg) {
    console.log(' ✅ ', msg);
  },
  error(msg) {
    console.log(' ❌ ', msg);
  },
  warn(msg) {
    console.log(chalk.yellow(' ⚠ '), msg);
  },
  watch(msg) {
    console.log(timestamp(), chalk.magenta(' ⟳ '), msg);
  },
  dim(msg) {
    console.log(chalk.dim('    ' + msg));
  },
  blank() {
    console.log();
  }
};

module.exports = logger;
