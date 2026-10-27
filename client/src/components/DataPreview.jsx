import { LIMITS } from '../../../shared/limits.js';
import { spreadsheetValue } from '../../../shared/export-policy.js';
import { number } from '../utils/format.js';

export default function DataPreview({
  dataset,
  title = 'Dataset preview',
  description,
  exportSafe = false,
}) {
  const rows = dataset.rows.slice(0, LIMITS.previewRows);
  const display = (value) => (exportSafe ? spreadsheetValue(value) : value);
  return (
    <section className="panel preview-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {description ||
              `First ${number(rows.length)} of ${number(dataset.rows.length)} rows · scroll to inspect`}
          </p>
        </div>
        <span className="tag">{exportSafe ? 'Export values' : 'Text values'}</span>
      </div>
      <div className="table-scroll data-scroll" tabIndex={0} role="region" aria-label={title}>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="row-index">
                #
              </th>
              {dataset.headers.map((header, index) => (
                <th scope="col" key={index}>
                  {display(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row" className="row-index">
                  {rowIndex + 1}
                </th>
                {row.map((value, columnIndex) => (
                  <td key={columnIndex} className={value.trim() === '' ? 'missing-cell' : ''}>
                    <span className="cell-value" title={display(value)}>
                      {value === '' ? (
                        <span className="empty-cell-label">empty</span>
                      ) : (
                        display(value)
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span className="legend-dot" />
        Shaded cells are missing. Surrounding whitespace is preserved in this preview.
      </div>
    </section>
  );
}
