'use client';

import { useMemo, useState, useEffect, useId } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X, Download, SlidersHorizontal } from 'lucide-react';
import { SkeletonTable, EmptyState, ErrorState } from './StateViews';
import { exportToCsv } from '../../services/reportService';

/**
 * The one table used across the app.
 *
 * Handles search, sorting, filters, pagination, row actions,
 * loading / empty / error states and CSV export, so every list
 * screen behaves identically.
 *
 * columns: [{
 *   key, header, accessor(row), render(row), sortable, align,
 *   width, exportValue(row), hideBelow: 'md'
 * }]
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  getRowId = (row) => row.id,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search…',
  searchKeys,
  filters = [],
  toolbarExtra,
  actions,
  pageSize = 12,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  exportFileName,
  dense = false,
  initialSort,
  stickyHeader = true,
  selectedRowId,
  rowClassName,
  footerNote,
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const searchId = useId();

  const activeFilterCount = filters.filter((f) => f.value && f.value !== 'all').length;

  // Any change to the inputs resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, rows.length, activeFilterCount]);

  const searched = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    const keys = searchKeys || columns.filter((c) => c.accessor).map((c) => c.key);
    return rows.filter((row) =>
      keys.some((key) => {
        const column = columns.find((c) => c.key === key);
        const raw = column?.accessor ? column.accessor(row) : row[key];
        return raw !== null && raw !== undefined && String(raw).toLowerCase().includes(q);
      }),
    );
  }, [rows, search, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sort) return searched;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return searched;
    const get = column.sortValue || column.accessor || ((row) => row[sort.key]);

    return [...searched].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'desc' ? -result : result;
    });
  }, [searched, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sorted, currentPage, pageSize]);

  const toggleSort = (column) => {
    if (!column.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== column.key) return { key: column.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: column.key, dir: 'desc' };
      return null;
    });
  };

  const handleExport = () => {
    exportToCsv(
      exportFileName || 'export.csv',
      columns
        .filter((c) => c.key !== 'actions')
        .map((c) => ({ header: c.header, value: c.exportValue || c.accessor || ((row) => row[c.key]) })),
      sorted,
    );
  };

  const hasToolbar = searchable || filters.length > 0 || actions || toolbarExtra || exportFileName;

  const pageNumbers = useMemo(() => {
    const span = 5;
    let start = Math.max(1, currentPage - Math.floor(span / 2));
    const end = Math.min(totalPages, start + span - 1);
    start = Math.max(1, end - span + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <div className="data-table">
      {hasToolbar && (
        <div className="data-table-toolbar">
          {searchable && (
            <div className="search-field">
              <Search size={15} className="search-field-icon" aria-hidden="true" />
              <input
                id={searchId}
                type="search"
                className="form-input search-field-input"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={searchPlaceholder}
              />
              {search && (
                <button type="button" className="search-field-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {filters.length > 0 && (
            <>
              <button
                type="button"
                className={`btn btn-secondary btn-sm filter-toggle ${showFilters || activeFilterCount ? 'is-active' : ''}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal size={14} /> Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </button>
              <div className={`data-table-filters ${showFilters ? 'is-open' : ''}`}>
                {filters.map((filter) => (
                  <label key={filter.key} className="inline-field">
                    <span className="inline-field-label">{filter.label}</span>
                    <select className="form-select form-select-sm" value={filter.value} onChange={(e) => filter.onChange(e.target.value)}>
                      {filter.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {activeFilterCount > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => filters.forEach((f) => f.onChange('all'))}>
                    Clear
                  </button>
                )}
              </div>
            </>
          )}

          {toolbarExtra}

          <div className="data-table-toolbar-right">
            {exportFileName && !loading && sorted.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
                <Download size={14} /> Export
              </button>
            )}
            {actions}
          </div>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <SkeletonTable rows={Math.min(pageSize, 8)} columns={columns.length} />
        ) : error ? (
          <ErrorState description={error.message} onRetry={onRetry} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={search ? `No results for “${search}”` : emptyTitle}
            description={search ? 'Try a different search term or clear the filters.' : emptyDescription}
            action={search ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear search</button> : emptyAction}
          />
        ) : (
          <div className="table-scroll">
            <table className={`${dense ? 'table-dense' : ''} ${stickyHeader ? 'table-sticky' : ''}`}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      style={{ width: column.width, textAlign: column.align || 'left' }}
                      className={[column.sortable ? 'is-sortable' : '', column.hideBelow ? `hide-below-${column.hideBelow}` : ''].join(' ').trim()}
                      onClick={() => toggleSort(column)}
                      aria-sort={sort?.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <span className="th-inner" style={{ justifyContent: column.align === 'right' ? 'flex-end' : undefined }}>
                        {column.header}
                        {column.sortable &&
                          (sort?.key === column.key ? (
                            sort.dir === 'asc' ? (
                              <ChevronUp size={13} className="sort-icon is-active" />
                            ) : (
                              <ChevronDown size={13} className="sort-icon is-active" />
                            )
                          ) : (
                            <ChevronsUpDown size={13} className="sort-icon" />
                          ))}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => {
                  const id = getRowId(row);
                  return (
                    <tr
                      key={id}
                      className={[onRowClick ? 'is-clickable' : '', selectedRowId === id ? 'is-selected' : '', rowClassName?.(row) || ''].join(' ').trim()}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          style={{ textAlign: column.align || 'left' }}
                          className={[column.className || '', column.hideBelow ? `hide-below-${column.hideBelow}` : ''].join(' ').trim()}
                          onClick={column.stopPropagation ? (e) => e.stopPropagation() : undefined}
                        >
                          {column.render ? column.render(row) : column.accessor ? column.accessor(row) : row[column.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && sorted.length > 0 && (
          <div className="pagination">
            <span className="pagination-info">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
              {footerNote && <span className="pagination-note"> · {footerNote}</span>}
            </span>
            {totalPages > 1 && (
              <div className="pagination-pages">
                <button type="button" className="pagination-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  Prev
                </button>
                {pageNumbers[0] > 1 && (
                  <>
                    <button type="button" className="pagination-btn" onClick={() => setPage(1)}>1</button>
                    {pageNumbers[0] > 2 && <span className="pagination-ellipsis">…</span>}
                  </>
                )}
                {pageNumbers.map((n) => (
                  <button key={n} type="button" className={`pagination-btn ${n === currentPage ? 'active' : ''}`} onClick={() => setPage(n)}>
                    {n}
                  </button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
                    <button type="button" className="pagination-btn" onClick={() => setPage(totalPages)}>{totalPages}</button>
                  </>
                )}
                <button type="button" className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}