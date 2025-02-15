#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyze } from './analyzer';
import { formatTree } from './formatters/tree';
import { formatDot } from './formatters/dot';
import { formatMermaid } from './formatters/mermaid';
import { formatJson } from './formatters/json';
import { CLIOptions } from './types';

const program = new Command();

program
  .name('depgraph')
  .description('Dependency graph analyzer for Node.js projects')
  .version('1.0.0');

program
  .command('analyze [dir]')
  .description('Analyze dependencies of a Node.js project')
  .option('-d, --depth <n>', 'Maximum depth to traverse', '10')
  .option('--dev', 'Include devDependencies', false)
  .option('-f, --format <type>', 'Output format: tree, json, dot, mermaid', 'tree')
  .option('--circular', 'Check for circular dependencies', false)
  .option('--unused', 'Check for unused dependencies', false)
  .option('--duplicates', 'Check for duplicate dependencies', false)
  .action(async (dir: string | undefined, opts) => {
    const targetDir = dir ?? process.cwd();
    const options: CLIOptions = {
      depth: parseInt(opts.depth, 10),
      dev: opts.dev,
      format: opts.format,
      circular: opts.circular,
      unused: opts.unused,
      duplicates: opts.duplicates,
    };

    console.log(chalk.cyan(`\nDependency Graph Analyzer v1.0.0`));
    console.log(chalk.gray(`Analyzing: ${targetDir}\n`));

    try {
      const result = analyze(targetDir, options);

      // Output the formatted graph
      switch (options.format) {
        case 'tree':
          console.log(formatTree(result, options.depth));
          break;
        case 'dot':
          console.log(formatDot(result));
          break;
        case 'mermaid':
          console.log(formatMermaid(result));
          break;
        case 'json':
          console.log(formatJson(result));
          break;
      }

      // Summary
      console.log(chalk.bold('\n  Summary'));
      console.log(`  Direct dependencies: ${chalk.cyan(String(result.directDependencies))}`);
      console.log(`  Transitive dependencies: ${chalk.cyan(String(result.transitiveDependencies))}`);
      console.log(`  Total: ${chalk.cyan(String(result.totalDependencies))}`);
      console.log(`  Max depth: ${chalk.cyan(String(result.maxDepth))}`);
      console.log(`  Estimated size: ${chalk.cyan(`${(result.estimatedSizeKb / 1024).toFixed(1)} MB`)}`);

      // Issues
      if (options.circular && result.circularDependencies.length > 0) {
        console.log(chalk.red(`\n  Circular dependencies: ${result.circularDependencies.length}`));
        for (const circ of result.circularDependencies) {
          console.log(chalk.red(`    ${circ.cycle.join(' -> ')} -> ${circ.cycle[0]}`));
        }
      }

      if (options.unused && result.unusedDependencies.length > 0) {
        console.log(chalk.yellow(`\n  Potentially unused dependencies: ${result.unusedDependencies.length}`));
        for (const unused of result.unusedDependencies) {
          console.log(chalk.yellow(`    ${unused.name}@${unused.version} (${unused.scope})`));
        }
      }

      if (options.duplicates && result.duplicateDependencies.length > 0) {
        console.log(chalk.yellow(`\n  Duplicate dependencies: ${result.duplicateDependencies.length}`));
        for (const dup of result.duplicateDependencies) {
          console.log(chalk.yellow(`    ${dup.name}: ${dup.versions.join(', ')}`));
        }
      }

      console.log('');
    } catch (err) {
      console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
