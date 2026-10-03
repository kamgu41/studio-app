// Формирует два представления каталога:
// subCategories — прежний плоский список;
// subCategoryTree — дерево с массивами children.
//
// Функция ничего не записывает в базу.

function buildCatalogHierarchy(mainCategories, subCategories, equipment) {
  const mainIds = new Set(mainCategories.map(main => main.id));

  const subsById = new Map();
  const itemsBySub = new Map();

  for (const sub of subCategories) {
    if (subsById.has(sub.id)) {
      throw new Error('В каталоге повторяется ID подраздела.');
    }

    if (!mainIds.has(sub.main_category_id)) {
      throw new Error(
        `У подраздела «${sub.name}» отсутствует основная категория.`
      );
    }

    subsById.set(sub.id, sub);
  }

  // Проверяем родительские связи.
  for (const sub of subCategories) {
    if (sub.parent_id == null) continue;

    const parent = subsById.get(sub.parent_id);

    if (!parent) {
      throw new Error(
        `Не найден родитель подраздела «${sub.name}».`
      );
    }

    if (parent.main_category_id !== sub.main_category_id) {
      throw new Error(
        `Подраздел «${sub.name}» связан с другой основной категорией.`
      );
    }
  }

  // Защита формирования ответа от циклической структуры.
  // Это НЕ заменяет будущую защиту записи в базе.
  for (const sub of subCategories) {
    const visited = new Set();
    let current = sub;

    while (current) {
      if (visited.has(current.id)) {
        throw new Error(
          `Обнаружен цикл подразделов рядом с «${sub.name}».`
        );
      }

      visited.add(current.id);

      current = current.parent_id == null
        ? null
        : subsById.get(current.parent_id);
    }
  }

  for (const item of equipment) {
    if (!itemsBySub.has(item.sub_category_id)) {
      itemsBySub.set(item.sub_category_id, []);
    }

    itemsBySub.get(item.sub_category_id).push(item);
  }

  // Плоское представление для прежнего интерфейса.
  const flatSubs = subCategories.map(sub => ({
    ...sub,
    items: itemsBySub.get(sub.id) || [],
  }));

  // Отдельные объекты дерева, чтобы не менять плоский список.
  const treeNodes = new Map(
    flatSubs.map(sub => [
      sub.id,
      {
        ...sub,
        children: [],
      },
    ])
  );

  const rootsByMain = new Map(
    mainCategories.map(main => [main.id, []])
  );

  for (const sub of flatSubs) {
    const node = treeNodes.get(sub.id);

    if (sub.parent_id == null) {
      rootsByMain.get(sub.main_category_id).push(node);
    } else {
      treeNodes.get(sub.parent_id).children.push(node);
    }
  }

  return mainCategories.map(main => ({
    ...main,

    // Оставляем прежнее поле для совместимости.
    subCategories: flatSubs.filter(
      sub => sub.main_category_id === main.id
    ),

    // Новое поле для вложенного каталога.
    subCategoryTree: rootsByMain.get(main.id),
  }));
}

module.exports = buildCatalogHierarchy;
