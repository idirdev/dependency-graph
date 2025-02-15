import chalk from 'chalk';
import { AnalysisResult } from '../types';

export function formatTree(result: AnalysisResult, maxDepth: number): string {
  const lines: string[] = [];
  const rootLabel = `${result.root.name}@${result.root.version}`;
  lines.push(chalk.bold.cyan(rootLabel));

  // Group edges by parent
  const childrenOf = new Map<string, Array<{ name: string; version: string; scope: string }>>();
  for (const edge of result.edges) {
    const children = childrenOf.get(edge.from) ?? [];
    children.push({ name: edge.to, version: edge.version, scope: edge.scope });
    childrenOf.set(edge.from, children);
  }

  // Detect circular references
  const circularSet = new Set<string>();
  for (const circ of result.circularDependencies) {
    for (const name of circ.cycle) {
      circularSet.add(name);
    }
  }

  const visited = new Set<string>();

  function printNode(nodeKey: string, prefix: string, isLast: boolean, depth: number): void {
    if (depth > maxDepth) return;

    const children = childrenOf.get(nodeKey) ?? [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const last = i === children.length - 1;
      const connector = last ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
      const newPrefix = prefix + (last ? '    ' : '\u2502   ');

      let label = `${child.name}@${child.version}`;

      // Color by scope
      if (child.scope === 'dev') {
        label = chalk.yellow(label) + chalk.gray(' (dev)');
      } else if (child.scope === 'peer') {
        label = chalk.magenta(label) + chalk.gray(' (peer)');
      } else {
        label = chalk.white(label);
      }

      // Mark circular references
      const isCircular = circularSet.has(child.name);
      if (isCircular) {
        label += chalk.red(' [CIRCULAR]');
      }

      // Mark deduplication
      const childKey = `${child.name}@${child.version}`;
      if (visited.has(childKey)) {
        label += chalk.gray(' [deduped]');
        lines.push(prefix + connector + label);
        continue;
      }

      visited.add(childKey);
      lines.push(prefix + connector + label);

      if (!isCircular) {
        printNode(childKey, newPrefix, last, depth + 1);
      }
    }
  }

  const rootKey = `${result.root.name}@${result.root.version}`;
  printNode(rootKey, '', true, 1);

  return lines.join('\n');
}
