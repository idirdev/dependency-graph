import { AnalysisResult } from '../types';

export function formatDot(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push('digraph dependencies {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, style=filled, fontname="Arial", fontsize=10];');
  lines.push('  edge [fontsize=8, fontname="Arial"];');
  lines.push('');

  // Depth color mapping
  const depthColors: Record<number, string> = {
    0: '#4ade80', // green - root
    1: '#60a5fa', // blue - direct
    2: '#a78bfa', // purple - level 2
    3: '#f97316', // orange - level 3
    4: '#ef4444', // red - deep
  };

  const getColor = (depth: number): string => depthColors[Math.min(depth, 4)] ?? '#94a3b8';

  // Root node
  const rootId = sanitizeId(result.root.name);
  lines.push(`  ${rootId} [label="${result.root.name}\\n${result.root.version}", fillcolor="${depthColors[0]}", fontcolor="white"];`);
  lines.push('');

  // Cluster by scope
  const prodEdges: string[] = [];
  const devEdges: string[] = [];
  const nodeSet = new Set<string>();

  for (const edge of result.edges) {
    const fromId = sanitizeId(edge.from);
    const toId = sanitizeId(edge.to);

    if (!nodeSet.has(edge.to)) {
      const node = result.nodes.get(`${edge.to}@${edge.version}`);
      const depth = node?.depth ?? 1;
      const color = getColor(depth);
      lines.push(`  ${toId} [label="${edge.to}\\n${edge.version}", fillcolor="${color}"];`);
      nodeSet.add(edge.to);
    }

    const edgeLine = `  ${fromId} -> ${toId} [label="${edge.version}"];`;
    if (edge.scope === 'dev') {
      devEdges.push(edgeLine);
    } else {
      prodEdges.push(edgeLine);
    }
  }

  if (prodEdges.length > 0) {
    lines.push('');
    lines.push('  // Production dependencies');
    lines.push(...prodEdges);
  }

  if (devEdges.length > 0) {
    lines.push('');
    lines.push('  // Dev dependencies');
    lines.push('  edge [style=dashed, color=gray];');
    lines.push(...devEdges);
  }

  // Highlight circular dependencies
  if (result.circularDependencies.length > 0) {
    lines.push('');
    lines.push('  // Circular dependencies (highlighted in red)');
    lines.push('  edge [color=red, penwidth=2, style=bold];');
    for (const circ of result.circularDependencies) {
      for (let i = 0; i < circ.cycle.length; i++) {
        const from = sanitizeId(circ.cycle[i]);
        const to = sanitizeId(circ.cycle[(i + 1) % circ.cycle.length]);
        lines.push(`  ${from} -> ${to};`);
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, 'pkg_');
}
