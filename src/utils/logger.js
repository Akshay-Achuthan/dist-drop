const chalk = require('chalk');

function timestamp() {
  return chalk.gray(new Date().toLocaleTimeString());
}

const logger = {
  info(msg) {
    console.log(chalk.cyan('ℹ'), msg);
  },
  success(msg) {
    console.log(chalk.green('✔'), msg);
  },
  error(msg) {
    console.log(chalk.red('✖'), msg);
  },
  warn(msg) {
    console.log(chalk.yellow('⚠'), msg);
  },
  watch(msg) {
    console.log(timestamp(), chalk.magenta('⟳'), msg);
  },
  dim(msg) {
    console.log(chalk.dim('  ' + msg));
  },
  blank() {
    console.log();
  }
};

module.exports = logger;
