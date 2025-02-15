import { AnalysisResult } from '../types';

export function formatMermaid(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push('```mermaid');
  lines.push('flowchart LR');
  lines.push('');

  const rootId = mermaidId(result.root.name);
  lines.push(`  ${rootId}["${result.root.name}@${result.root.version}"]`);
  lines.push('');

  // Collect circular dep names for highlighting
  const circularNames = new Set<string>();
  for (const circ of result.circularDependencies) {
    for (const name of circ.cycle) {
      circularNames.add(name);
    }
  }

  // Track rendered nodes to avoid duplicates
  const renderedNodes = new Set<string>();
  renderedNodes.add(rootId);

  // Render edges
  const edgeLines: string[] = [];
  const circularEdgeLines: string[] = [];

  for (const edge of result.edges) {
    const fromId = mermaidId(edge.from);
    const toId = mermaidId(edge.to);

    // Declare node if not already declared
    if (!renderedNodes.has(toId)) {
      const label = `${edge.to}@${edge.version}`;
      if (edge.scope === 'dev') {
        lines.push(`  ${toId}["${label} (dev)"]`);
      } else {
        lines.push(`  ${toId}["${label}"]`);
      }
      renderedNodes.add(toId);
    }

    // Check if this edge is part of a circular dependency
    const isCircularEdge = circularNames.has(edge.to) && circularNames.has(extractName(edge.from));

    if (isCircularEdge) {
      circularEdgeLines.push(`  ${fromId} -.->|"${edge.version}"| ${toId}`);
    } else if (edge.scope === 'dev') {
      edgeLines.push(`  ${fromId} -.->|"${edge.version}"| ${toId}`);
    } else {
      edgeLines.push(`  ${fromId} -->|"${edge.version}"| ${toId}`);
    }
  }

  lines.push('');
  if (edgeLines.length > 0) {
    lines.push('  %% Dependencies');
    lines.push(...edgeLines);
  }

  if (circularEdgeLines.length > 0) {
    lines.push('');
    lines.push('  %% Circular dependencies');
    lines.push(...circularEdgeLines);
  }

  // Style circular nodes in red
  if (circularNames.size > 0) {
    lines.push('');
    lines.push('  %% Highlight circular dependencies');
    for (const name of circularNames) {
      const id = mermaidId(name);
      if (renderedNodes.has(id)) {
        lines.push(`  style ${id} fill:#fee2e2,stroke:#ef4444,color:#991b1b`);
      }
    }
  }

  // Style root node
  lines.push(`  style ${rootId} fill:#dcfce7,stroke:#22c55e,color:#166534`);

  lines.push('```');
  return lines.join('\n');
}

function mermaidId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, 'pkg_');
}

function extractName(nodeKey: string): string {
  // "package@version" -> "package"
  const atIndex = nodeKey.lastIndexOf('@');
  return atIndex > 0 ? nodeKey.substring(0, atIndex) : nodeKey;
}
