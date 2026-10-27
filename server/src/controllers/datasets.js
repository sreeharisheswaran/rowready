import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { parseCsv, serializeCsv } from '../services/csv.js';
import { profileDataset } from '../services/profile.js';
import { cleanDataset } from '../services/clean.js';
import {
  operationSchema,
  parseRequest,
  safeFilename,
  validateDataset,
} from '../services/dataset.js';
import { digest, hashHeaders } from '../services/reports.js';
import { AppError } from '../middleware/errors.js';

export const reportIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);
const cleanSchema = z.object({ dataset: z.unknown(), operations: operationSchema }).strict();
const validateSchema = z
  .object({
    dataset: z.unknown(),
    reportId: reportIdSchema,
    editToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const exportSchema = z.object({ dataset: z.unknown() }).strict();

export function datasetControllers(reportStore) {
  return {
    analyze: async (req, res) => {
      if (!req.is('text/csv') && !req.is('application/octet-stream'))
        throw new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Upload CSV bytes with Content-Type: text/csv.',
        );
      let filename;
      try {
        filename = decodeURIComponent(req.get('X-Filename') || 'dataset.csv');
      } catch {
        throw new AppError(400, 'INVALID_FILENAME', 'The encoded filename is invalid.');
      }
      filename = safeFilename(filename);
      const dataset = parseCsv(req.body);
      const profile = profileDataset(dataset);
      const editToken = randomBytes(32).toString('hex');
      const report = await reportStore.create({
        filename,
        sourceBytes: req.body.length,
        original: profile,
        headerHash: hashHeaders(dataset),
        editTokenHash: digest(editToken),
        ...(req.user
          ? {
              userId: req.user.id,
              userEmail: req.user.email,
              userName: req.user.name,
            }
          : {}),
      });
      res.status(201).json({ dataset, profile, report, editToken });
    },
    clean: (req, res) => {
      const body = parseRequest(cleanSchema, req.body);
      const input = validateDataset(body.dataset);
      const result = cleanDataset(input, body.operations);
      res.json({ ...result, profile: profileDataset(result.dataset) });
    },
    validate: async (req, res) => {
      const body = parseRequest(validateSchema, req.body);
      const dataset = validateDataset(body.dataset);
      const profile = profileDataset(dataset);
      const report = await reportStore.validate(body.reportId, body.editToken, dataset, profile);
      res.json({ profile, report });
    },
    export: (req, res) => {
      const body = parseRequest(exportSchema, req.body);
      const dataset = validateDataset(body.dataset);
      // Safe mode is mandatory on the public API; users cannot disable it.
      const { csv, escapedCells } = serializeCsv(dataset);
      res.set('X-Protected-Cells', String(escapedCells));
      res.attachment('rowready-cleaned.csv').type('text/csv').send(csv);
    },
  };
}
