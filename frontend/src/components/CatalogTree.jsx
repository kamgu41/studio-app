import './CatalogTree.css';

// Сохраняем прежнюю фильтрацию и подсчёт оборудования.
function prepareNode(node, activeTab) {
  const items = (node.items || []).filter(
    item => activeTab === 'all' || item.status === activeTab
  );

  const children = (node.children || [])
    .map(child => prepareNode(child, activeTab))
    .filter(Boolean);

  const itemCount = items.length + children.reduce(
    (sum, child) => sum + child.itemCount,
    0
  );

  if (activeTab !== 'all' && itemCount === 0) {
    return null;
  }

  return {
    ...node,
    items,
    children,
    itemCount,
  };
}

function SectionHeading({ name, count }) {
  return (
    <summary className="catalog-tree__heading">
      <svg
        className="catalog-tree__arrow"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6 3.5 10.5 8 6 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span className="catalog-tree__name">{name}</span>

      <span
        className="catalog-tree__count"
        aria-label={`Предметов: ${count}`}
        title="Количество предметов, включая вложенные разделы"
      >
        {count}
      </span>
    </summary>
  );
}

function CategoryNode({ node, renderItems, depth = 1 }) {
  const levelClass = depth === 1
    ? 'catalog-tree__section--sub'
    : 'catalog-tree__section--nested';

  return (
    <details className={`catalog-tree__section ${levelClass}`}>
      <SectionHeading name={node.name} count={node.itemCount} />

      <div className="catalog-tree__content">
        {node.items.length > 0 && (
          <div className="catalog-tree__items">
            {renderItems(node.items)}
          </div>
        )}

        {node.children.map(child => (
          <CategoryNode
            key={child.id}
            node={child}
            renderItems={renderItems}
            depth={depth + 1}
          />
        ))}

        {node.items.length === 0 && node.children.length === 0 && (
          <p className="catalog-tree__empty">
            Пока нет оборудования.
          </p>
        )}
      </div>
    </details>
  );
}

export default function CatalogTree({
  mainCategories,
  activeTab,
  renderItems,
}) {
  const categories = mainCategories
    .map(main => {
      const source = Array.isArray(main.subCategoryTree)
        ? main.subCategoryTree
        : (main.subCategories || []).map(sub => ({
            ...sub,
            children: [],
          }));

      const children = source
        .map(node => prepareNode(node, activeTab))
        .filter(Boolean);

      return {
        ...main,
        children,
        itemCount: children.reduce(
          (sum, child) => sum + child.itemCount,
          0
        ),
      };
    })
    .filter(main => activeTab === 'all' || main.itemCount > 0);

  return (
    <div className="catalog-tree">
      {categories.length === 0 ? (
        <p className="catalog-tree__empty catalog-tree__empty--center">
          {activeTab === 'repair'
            ? 'Нет оборудования в ремонте.'
            : 'Нет разделов для отображения.'}
        </p>
      ) : (
        categories.map(main => (
          <details
            key={main.id}
            className="catalog-tree__section catalog-tree__section--main"
          >
            <SectionHeading
              name={main.name}
              count={main.itemCount}
            />

            <div className="catalog-tree__content">
              {main.children.map(node => (
                <CategoryNode
                  key={node.id}
                  node={node}
                  renderItems={renderItems}
                />
              ))}

              {main.children.length === 0 && (
                <p className="catalog-tree__empty">
                  Пока нет подразделов.
                </p>
              )}
            </div>
          </details>
        ))
      )}
    </div>
  );
}
