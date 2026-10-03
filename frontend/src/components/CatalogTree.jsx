const headingStyle = {
  cursor: 'pointer',
  padding: '12px',
  background: '#181818',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#e0e0e0',
  overflowWrap: 'anywhere',
};

const contentStyle = {
  marginTop: 6,
  marginLeft: 8,
  paddingLeft: 8,
  borderLeft: '2px solid #333',
};

const emptyStyle = {
  color: '#888',
  padding: '10px 4px',
  fontSize: 13,
};

// Отбираем предметы и дочерние разделы.
// Во вкладке «Всё» сохраняем даже пустые разделы.
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

function CategoryNode({ node, renderItems }) {
  return (
    <details style={{ marginBottom: 6 }}>
      <summary style={headingStyle}>
        {node.name}
        <span style={{ color: '#999', marginLeft: 8 }}>
          {node.itemCount}
        </span>
      </summary>

      <div style={contentStyle}>
        {node.items.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 6,
            }}
          >
            {renderItems(node.items)}
          </div>
        )}

        {node.children.map(child => (
          <CategoryNode
            key={child.id}
            node={child}
            renderItems={renderItems}
          />
        ))}

        {node.items.length === 0 && node.children.length === 0 && (
          <p style={emptyStyle}>Пока нет оборудования.</p>
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
      // Новый сервер возвращает дерево.
      // Для старого API оставляем временную совместимость.
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

  if (categories.length === 0) {
    return (
      <p style={{ ...emptyStyle, textAlign: 'center' }}>
        {activeTab === 'repair'
          ? 'Нет оборудования в ремонте.'
          : 'Нет разделов для отображения.'}
      </p>
    );
  }

  return (
    <div>
      {categories.map(main => (
        <details key={main.id} style={{ marginBottom: 10 }}>
          <summary
            style={{
              ...headingStyle,
              background: '#222',
              fontWeight: 600,
            }}
          >
            {main.name}
            <span style={{ color: '#aaa', marginLeft: 8 }}>
              {main.itemCount}
            </span>
          </summary>

          <div style={contentStyle}>
            {main.children.map(node => (
              <CategoryNode
                key={node.id}
                node={node}
                renderItems={renderItems}
              />
            ))}

            {main.children.length === 0 && (
              <p style={emptyStyle}>Пока нет подразделов.</p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
