import { useMemo, useState } from 'react';
import { Empty, Skeleton } from './kit';

/**
 * Sortable table.
 *   <DataTable
 *     rows={rows}
 *     columns={[{ key: 'title', label: 'Title', sort: true, render: (r) => <b>{r.title}</b> }]}
 *     onRowClick={(r) => edit(r)}
 *   />
 * `sortValue` on a column lets you sort by something other than row[key].
 */
export default function DataTable({ rows, columns, loading, onRowClick, empty = 'Nothing here yet', initialSort }) {
  const [sort, setSort] = useState(initialSort || null); // [key, asc]

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort[0]);
    const val = col?.sortValue || ((r) => r[sort[0]]);
    return [...rows].sort((a, b) => {
      const x = val(a) ?? '';
      const y = val(b) ?? '';
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort[1] ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  if (loading) return <Skeleton rows={5} />;
  if (!rows.length) return <Empty title={empty} />;

  const click = (c) => {
    if (!c.sort) return;
    setSort((s) => (s && s[0] === c.key ? [c.key, !s[1]] : [c.key, true]));
  };

  return (
    <div className="dt-wrap" data-lenis-prevent>
      <table className="dt">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.sort ? 'sortable' : ''}
                style={{ width: c.width, textAlign: c.align }}
                onClick={() => click(c)}
                aria-sort={sort?.[0] === c.key ? (sort[1] ? 'ascending' : 'descending') : undefined}
              >
                {c.label}
                {sort?.[0] === c.key && <span style={{ color: 'var(--blue-glow)' }}>{sort[1] ? ' ↑' : ' ↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.id ?? i}
              className={onRowClick ? 'clickable' : ''}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align }}>
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
