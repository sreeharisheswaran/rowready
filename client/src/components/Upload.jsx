import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { LIMITS } from '../../../shared/limits.js';
import { downloadBlob } from '../utils/format.js';

export default function Upload({ onUpload, pending, onError }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  function select(files) {
    setDragging(false);
    if (pending) return;
    if (files.length !== 1) return onError('Choose one CSV file at a time.');
    const file = files[0];
    if (!/\.csv$/i.test(file.name))
      return onError('Choose a .csv file. Excel workbooks and other file types are not supported.');
    if (file.size === 0)
      return onError('This file is empty. Include a header and at least one data row.');
    if (file.size > LIMITS.fileBytes)
      return onError('This CSV is larger than 2 MiB. Split it into smaller files and try again.');
    onUpload(file);
  }
  async function sample() {
    try {
      const response = await fetch('/sample.csv');
      if (!response.ok) throw new Error();
      downloadBlob(await response.blob(), 'rowready-sample.csv');
    } catch {
      onError('Could not download the sample. Please try again.');
    }
  }
  return (
    <section className="panel upload-panel">
      <div className="panel-heading">
        <div>
          <h2>Start with a dataset</h2>
          <p>A clearer view of your data is one upload away.</p>
        </div>
        <span className="tag">CSV only</span>
      </div>
      <div
        className={`dropzone ${dragging ? 'dragging' : ''} ${pending ? 'is-busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!pending) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          select(event.dataTransfer.files);
        }}
        aria-busy={pending}
      >
        <div className="upload-illustration">
          <Icon name="file" size={45} />
          <span>CSV</span>
          <i>
            <Icon name="upload" size={17} />
          </i>
        </div>
        <h3>{pending ? 'Reading your rows…' : 'Drop your CSV here'}</h3>
        <p>
          {pending
            ? 'Analyzing the file and saving your report.'
            : 'or browse your files to get started'}
        </p>
        <input
          ref={input}
          type="file"
          id="csv-upload"
          tabIndex={-1}
          aria-label="Choose CSV file"
          accept=".csv,text/csv"
          disabled={pending}
          className="visually-hidden"
          onChange={(event) => {
            select(event.target.files);
            event.target.value = '';
          }}
        />
        <button className="button primary" onClick={() => input.current.click()} disabled={pending}>
          {pending ? <span className="spinner" /> : <Icon name="upload" size={17} />}
          {pending ? 'Analyzing…' : 'Choose CSV file'}
        </button>
        <span className="dropzone-limits">UTF-8 · Up to 2 MiB · 10,000 rows · 100 columns</span>
      </div>
      <div className="sample-row">
        <span>Just exploring?</span>
        <button className="text-button" onClick={sample} disabled={pending}>
          Download a sample CSV <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="privacy-note">
        <Icon name="shield" size={18} />
        <p>
          Files are processed by the API, then kept only in this browser session. Saved reports
          contain metadata and findings and are visible to everyone using this instance. Use
          non-sensitive data.
        </p>
      </div>
    </section>
  );
}
