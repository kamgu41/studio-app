export function getEditorCategoryRows(main) {
  const subs = main.subCategories || [];
  const byId = new Map(subs.map(sub => [sub.id, sub]));
  const children = new Map();
  const roots = [];

  for (const sub of subs) {
    if (sub.parent_id == null) {
      roots.push(sub);
    } else {
      if (!byId.has(sub.parent_id)) {
        throw new Error(
          `Не найден родитель раздела «${sub.name}».`
        );
      }

      if (!children.has(sub.parent_id)) {
        children.set(sub.parent_id, []);
      }

      children.get(sub.parent_id).push(sub);
    }
  }

  const rows = [];
  const visited = new Set();

  function visit(sub, depth, ancestors, names) {
    if (visited.has(sub.id)) {
      throw new Error(
        'Обнаружен цикл или повтор ID подраздела.'
      );
    }

    visited.add(sub.id);

    const pathNames = [...names, sub.name];

    rows.push({
      ...sub,
      editorDepth: depth,
      editorAncestors: ancestors,
      editorPath: pathNames.join(' → '),
      editorHasChildren:
        (children.get(sub.id) || []).length > 0,
    });

    for (const child of children.get(sub.id) || []) {
      visit(
        child,
        depth + 1,
        [...ancestors, sub.id],
        pathNames
      );
    }
  }

  for (const root of roots) {
    visit(root, 0, [], []);
  }

  if (visited.size !== subs.length) {
    throw new Error(
      'Часть подразделов не связана с корнем дерева.'
    );
  }

  return rows;
}
