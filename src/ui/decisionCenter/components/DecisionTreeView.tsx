import type { DecisionCenterLocale, DecisionTreeNode } from '../types'

export function DecisionTreeView({
  tree,
  locale = 'ar',
}: {
  tree: DecisionTreeNode
  locale?: DecisionCenterLocale
}) {
  return (
    <section data-testid="dc-decision-tree" className="rahhal-dc-panel">
      <h2>{locale === 'en' ? 'Decision tree' : 'شجرة القرار'}</h2>
      <TreeNode node={tree} depth={0} />
    </section>
  )
}

function TreeNode({ node, depth }: { node: DecisionTreeNode; depth: number }) {
  return (
    <div
      className="rahhal-dc-tree-node"
      data-testid="dc-tree-node"
      data-node-id={node.id}
      style={{ marginInlineStart: `${depth * 0.85}rem` }}
    >
      <span>{node.label}</span>
      {node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}
