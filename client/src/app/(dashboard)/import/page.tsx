'use client';

import { useCallback, useRef, useState } from 'react';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { productImportApi, type CandidateOverride, type CommitResponse } from '@/lib/api/productImport';
import type {
  ImportCandidate,
  ImportFileStatus,
} from '@/types/productImport';
import styles from './page.module.css';

// Matches the multipart field constraints on POST /product-import/preview.
const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.png', '.jpg', '.webp', '.pdf'];
const FILE_INPUT_ACCEPT = ACCEPTED_EXTENSIONS.join(',');

type Phase = 'upload' | 'previewing' | 'review' | 'committing' | 'results';

/** Candidate row with string-backed editable fields (raw input values). */
interface EditableRow {
  candidateId: number;
  name: string;
  sku: string;
  unit: string;
  basePrice: string;
  defaultCost: string;
  categoryName: string | null;
  barcodes: string[];
  sourceFile: string;
  issues: string[];
}

function toEditableRow(candidate: ImportCandidate): EditableRow {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    sku: candidate.sku ?? '',
    unit: candidate.unit,
    basePrice: String(candidate.basePrice ?? ''),
    defaultCost: candidate.defaultCost == null ? '' : String(candidate.defaultCost),
    categoryName: candidate.categoryName,
    barcodes: candidate.barcodes,
    sourceFile: candidate.sourceFile,
    issues: candidate.issues,
  };
}

function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/**
 * Diff the editable rows against the untouched preview snapshot and emit one
 * override per changed, checked row. Only name/sku/unit/basePrice are
 * committable (matches CandidateOverrideDto); a price field the user cleared
 * is omitted so the server keeps its cached preview price.
 */
function buildOverrides(
  rows: EditableRow[],
  pristine: EditableRow[],
  checked: Set<number>,
): CandidateOverride[] {
  const baseById = new Map(pristine.map(row => [row.candidateId, row]));
  const overrides: CandidateOverride[] = [];
  for (const row of rows) {
    if (!checked.has(row.candidateId)) continue;
    const base = baseById.get(row.candidateId);
    if (!base) continue;
    const override: CandidateOverride = { candidateId: row.candidateId };
    if (row.name !== base.name) override.name = row.name;
    if (row.sku !== base.sku) override.sku = row.sku;
    if (row.unit !== base.unit) override.unit = row.unit;
    if (row.basePrice !== base.basePrice && row.basePrice.trim() !== '') {
      override.basePrice = Number(row.basePrice);
    }
    if (Object.keys(override).length > 1) overrides.push(override);
  }
  return overrides;
}

export default function ProductImportPage() {
  const { user, isLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [fileStatuses, setFileStatuses] = useState<ImportFileStatus[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [pristineRows, setPristineRows] = useState<EditableRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<CommitResponse | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFiles(prev => {
      const seen = new Set(prev.map(fileKey));
      const merged = [...prev];
      Array.from(incoming).forEach(file => {
        const key = fileKey(file);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      });
      return merged;
    });
    setError(null);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handlePreview = async () => {
    if (files.length === 0) return;
    setPhase('previewing');
    setError(null);
    try {
      const preview = await productImportApi.preview(files);
      setUploadId(preview.uploadId);
      setFileStatuses(preview.files);
      const snapshot = preview.candidates.map(toEditableRow);
      setRows(snapshot);
      setPristineRows(snapshot);
      // Default: import everything the server parsed without a hard error.
      setChecked(new Set(preview.candidates.map(c => c.candidateId)));
      setPhase('review');
    } catch (err) {
      // client.ts normalises network/API failures into Error with a readable
      // message (e.g. "Network error. Please check your connection...").
      setError(err instanceof Error ? err.message : 'Preview failed. Please try again.');
      setPhase('upload');
    }
  };

  const toggleRow = (candidateId: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked(prev =>
      prev.size === rows.length ? new Set<number>() : new Set(rows.map(r => r.candidateId)),
    );
  };

  const updateRow = (candidateId: number, field: 'name' | 'sku' | 'unit' | 'basePrice' | 'defaultCost', value: string) => {
    setRows(prev => prev.map(row => (row.candidateId === candidateId ? { ...row, [field]: value } : row)));
  };

  const handleCommit = async () => {
    if (!uploadId) return;
    const candidateIds = rows.map(r => r.candidateId).filter(id => checked.has(id));
    if (candidateIds.length === 0) return;
    const invalidPrice = rows.find(r => {
      if (!checked.has(r.candidateId)) return false;
      const text = r.basePrice.trim();
      return text !== '' && (!Number.isFinite(Number(text)) || Number(text) < 0);
    });
    if (invalidPrice) {
      setError(`"${invalidPrice.name}" has an invalid price. Enter a number of 0 or more, or clear the field.`);
      return;
    }
    setPhase('committing');
    setError(null);
    try {
      const overrides = buildOverrides(rows, pristineRows, checked);
      const res = await productImportApi.commit(uploadId, candidateIds, overrides);
      setResult(res);
      setPhase('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
      setPhase('review');
    }
  };

  const startOver = () => {
    setPhase('upload');
    setFiles([]);
    setUploadId(null);
    setFileStatuses([]);
    setRows([]);
    setPristineRows([]);
    setChecked(new Set());
    setResult(null);
    setError(null);
  };

  if (isLoading || !user) {
    return <LoadingSpinner fullPage text="Loading import..." />;
  }

  const allChecked = rows.length > 0 && checked.size === rows.length;
  const busy = phase === 'previewing' || phase === 'committing';
  const checkedCount = checked.size;

  return (
    <RoleGuard allowedRoles={['owner', 'manager']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Product Import</h1>
        <p className={styles.subtitle}>
          Upload spreadsheets (.csv, .xlsx) or product photos (.png, .jpg, .webp, .pdf) to
          create products in bulk.
        </p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* Step 1 — file selection */}
        {(phase === 'upload' || phase === 'previewing') && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>1. Select files</h2>

            <div
              className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
              }}
              onDragOver={e => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              Drag &amp; drop files here, or click to browse
              <span className={styles.dropzoneHint}>
                Accepted: {ACCEPTED_EXTENSIONS.join(', ')} — multiple files allowed
              </span>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              multiple
              hidden
              onChange={e => {
                if (e.target.files?.length) addFiles(e.target.files);
                // Allow re-selecting the same file later.
                e.target.value = '';
              }}
            />

            {files.length > 0 && (
              <ul className={styles.fileList}>
                {files.map((file, index) => (
                  <li key={fileKey(file)} className={styles.fileListItem}>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className={styles.removeFileButton}
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={handlePreview}
                disabled={files.length === 0 || busy}
              >
                {phase === 'previewing' ? 'Previewing…' : 'Preview'}
              </button>
            </div>

            {phase === 'previewing' && (
              <p className={styles.center}>
                Uploading files — image files are processed with OCR and may take a while.
              </p>
            )}
          </div>
        )}

        {/* Step 2 — review candidates */}
        {(phase === 'review' || phase === 'committing') && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h2 className={styles.cardTitle}>2. Review candidates</h2>
              <span className={styles.selectionBadge}>
                {checkedCount} of {rows.length} selected
              </span>
            </div>

            {fileStatuses.length > 0 && (
              <ul className={styles.fileStatusList}>
                {fileStatuses.map(status => (
                  <li key={status.name} className={styles.fileStatusItem}>
                    <span
                      className={`${styles.badge} ${
                        status.kind === 'sheet' ? styles.badgeSheet : styles.badgeOcr
                      }`}
                    >
                      {status.kind}
                    </span>
                    <span>{status.name}</span>
                    {status.error && (
                      <span className={styles.fileStatusError}>— {status.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {rows.length === 0 ? (
              <p className={styles.empty}>No product candidates were found in these files.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.cellCheck}>
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleAll}
                          aria-label="Select all candidates"
                        />
                      </th>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Unit</th>
                      <th>Barcodes</th>
                      <th>Issues</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.candidateId}>
                        <td className={styles.cellCheck}>
                          <input
                            type="checkbox"
                            checked={checked.has(row.candidateId)}
                            onChange={() => toggleRow(row.candidateId)}
                            aria-label={`Select ${row.name}`}
                          />
                        </td>
                        <td className={styles.cellInput}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={e => updateRow(row.candidateId, 'name', e.target.value)}
                            aria-label={`Name for ${row.name}`}
                          />
                        </td>
                        <td className={styles.cellInput}>
                          <input
                            type="text"
                            value={row.sku}
                            placeholder="—"
                            onChange={e => updateRow(row.candidateId, 'sku', e.target.value)}
                            aria-label={`SKU for ${row.name}`}
                          />
                        </td>
                        <td className={styles.cellInput}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.basePrice}
                            onChange={e => updateRow(row.candidateId, 'basePrice', e.target.value)}
                            aria-label={`Price for ${row.name}`}
                          />
                        </td>
                        <td className={styles.cellInput}>
                          <input
                            type="text"
                            value={row.unit}
                            onChange={e => updateRow(row.candidateId, 'unit', e.target.value)}
                            aria-label={`Unit for ${row.name}`}
                          />
                        </td>
                        <td>
                          {row.barcodes.length > 0 ? (
                            <span className={styles.chips}>
                              {row.barcodes.map(code => (
                                <span key={code} className={styles.chip}>
                                  {code}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td>
                          {row.issues.length > 0 ? (
                            <span className={styles.issueBadges}>
                              {row.issues.map(issue => (
                                <span key={issue} className={styles.issueBadge}>
                                  {issue}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className={styles.muted}>OK</span>
                          )}
                        </td>
                        <td className={styles.cellSource}>{row.sourceFile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={startOver}
                disabled={busy}
              >
                Start over
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={handleCommit}
                disabled={checkedCount === 0 || busy}
              >
                {phase === 'committing' ? 'Importing…' : `Import selected (${checkedCount})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — results */}
        {phase === 'results' && result && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>3. Import results</h2>

            <div className={styles.resultCounts}>
              <div className={`${styles.countCard} ${styles.countCreated}`}>
                <div className={styles.countValue}>{result.created.length}</div>
                <div className={styles.countLabel}>Created</div>
              </div>
              <div className={`${styles.countCard} ${styles.countConflicts}`}>
                <div className={styles.countValue}>{result.conflicts.length}</div>
                <div className={styles.countLabel}>Conflicts</div>
              </div>
              <div className={`${styles.countCard} ${styles.countSkipped}`}>
                <div className={styles.countValue}>{result.skipped.length}</div>
                <div className={styles.countLabel}>Skipped</div>
              </div>
            </div>

            <div className={styles.resultSection}>
              <h3 className={styles.resultSectionTitle}>Created</h3>
              {result.created.length === 0 ? (
                <p className={styles.muted}>None.</p>
              ) : (
                <ul className={styles.resultList}>
                  {result.created.map(item => (
                    <li key={item.id} className={styles.resultListItem}>
                      <span>{item.name}</span>
                      <span className={styles.muted}>{item.sku ?? 'no SKU'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.resultSection}>
              <h3 className={styles.resultSectionTitle}>Conflicts</h3>
              {result.conflicts.length === 0 ? (
                <p className={styles.muted}>None.</p>
              ) : (
                <ul className={styles.resultList}>
                  {result.conflicts.map(item => (
                    <li key={item.candidateId} className={styles.resultListItem}>
                      <span>{item.name}</span>
                      <span className={styles.resultReason}>{item.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.resultSection}>
              <h3 className={styles.resultSectionTitle}>Skipped</h3>
              {result.skipped.length === 0 ? (
                <p className={styles.muted}>None.</p>
              ) : (
                <ul className={styles.resultList}>
                  {result.skipped.map((item, index) => (
                    <li key={`${item.candidateId ?? 'x'}-${index}`} className={styles.resultListItem}>
                      <span>{item.name ?? `Candidate ${item.candidateId ?? '—'}`}</span>
                      {item.reason && <span className={styles.resultReason}>{item.reason}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={startOver}>
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
