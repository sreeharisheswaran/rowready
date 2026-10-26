import Icon from './Icon.jsx';
import { number } from '../utils/format.js';

export function Metrics({ profile }) {
  const metrics = [
    {
      label: 'Data rows',
      value: number(profile.rowCount),
      detail: `${number(profile.columnCount)} columns in this dataset`,
      icon: 'rows',
    },
    {
      label: 'Complete cells',
      value: `${number(100 - profile.missingPercentage)}%`,
      detail: `${number(profile.cellCount - profile.missingCells)} of ${number(profile.cellCount)} cells`,
      icon: 'check',
      tone: 'green',
    },
    {
      label: 'Missing cells',
      value: number(profile.missingCells),
      detail: `${number(profile.missingPercentage)}% of all data cells`,
      icon: 'alert',
      tone: profile.missingCells ? 'amber' : '',
    },
    {
      label: 'Duplicate rows',
      value: number(profile.duplicateRows),
      detail: 'Exact matches beyond the first',
      icon: 'copy',
      tone: profile.duplicateRows ? 'amber' : '',
    },
  ];
  return (
    <div className="metrics">
      {metrics.map((metric) => (
        <article className="metric" key={metric.label}>
          <div className="metric-label">
            {metric.label}
            <span className={`metric-icon ${metric.tone || ''}`}>
              <Icon name={metric.icon} size={18} />
            </span>
          </div>
          <strong>{metric.value}</strong>
          <span className="muted small">{metric.detail}</span>
        </article>
      ))}
    </div>
  );
}

export function Warnings({ profile, compact = false }) {
  if (profile.warnings.length === 0)
    return (
      <div className="clear-state">
        <Icon name="shield" size={24} />
        <div>
          <strong>No warnings in the supported checks</strong>
          <p>
            Completeness, exact duplicates, whitespace, mixed types, and formula risks have been
            checked. Domain-specific correctness still needs your review.
          </p>
        </div>
      </div>
    );
  return (
    <div className={compact ? 'warnings compact' : 'warnings'}>
      {profile.warnings.map((warning) => (
        <div className="warning-row" key={warning.code}>
          <span className="warning-dot" />
          <p>{warning.message}</p>
        </div>
      ))}
    </div>
  );
}

export function ColumnProfile({ profile }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Column profile</h2>
          <p>Inferred from nonmissing values. Your values stay as text.</p>
        </div>
        <span className="tag">{profile.columnCount} columns</span>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Column statistics">
        <table>
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">Inferred type</th>
              <th scope="col">Missing</th>
              <th scope="col">Distinct values</th>
              <th scope="col">Whitespace</th>
              <th scope="col">Numeric statistics</th>
            </tr>
          </thead>
          <tbody>
            {profile.columns.map((column) => (
              <tr key={column.index}>
                <th scope="row" className="column-name">
                  {column.name}
                </th>
                <td>
                  <span className={`type-badge type-${column.inferredType}`}>
                    {column.inferredType}
                  </span>
                </td>
                <td>
                  <span className={column.missing ? 'amber-text' : ''}>
                    {number(column.missing)}
                  </span>{' '}
                  <span className="muted small">({number(column.missingPercentage)}%)</span>
                </td>
                <td>{number(column.uniqueValues)}</td>
                <td>{number(column.whitespace)}</td>
                <td className="small muted">
                  {column.numeric
                    ? `Min ${number(column.numeric.min)} · Max ${number(column.numeric.max)} · Mean ${number(column.numeric.mean)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
