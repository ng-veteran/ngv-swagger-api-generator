#! /usr/bin/env node

import commander from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Generator } from './generator';

const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), { encoding: 'utf8' }));
const generator = new Generator();

commander
  .version(version)
  .name('swagger-api-ts-generator')
  .arguments('<uri>')
  .option('-o, --output [dir], default', 'Api output dir, default: "./api"')
  .action((uri: string, options) => {
    if (uri) {
      const { output } = options;
      generator.generate(uri, output)
    } else {
      commander.outputHelp()
    }
  })
  .parse(process.argv);

if (!process.argv.slice(2).length) {
  commander.outputHelp();
}
