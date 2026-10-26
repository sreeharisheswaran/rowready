// Deliberate test double. The application always uses MongoDB; this is never
// imported by production code and does not stand in for the integration tests.
import { randomBytes } from 'node:crypto';
import { AppError } from '../../server/src/middleware/errors.js';
import { assertEditable, publicReport } from '../../server/src/services/reports.js';

export function memoryReportStore() {
  const documents = new Map();
  return {
    documents,
    ready: () => true,
    async create(input) {
      const report = {
        ...structuredClone(input),
        _id: randomBytes(12).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastValidation: null,
      };
      documents.set(report._id, report);
      return publicReport(structuredClone(report));
    },
    async list({ limit, offset }) {
      const reports = [...documents.values()].reverse();
      return {
        reports: reports
          .slice(offset, offset + limit)
          .map((item) => publicReport(structuredClone(item))),
        hasMore: reports.length > offset + limit,
      };
    },
    async get(id) {
      const report = documents.get(id);
      if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'This saved report was not found.');
      return publicReport(structuredClone(report));
    },
    async validate(id, editToken, dataset, profile) {
      const report = documents.get(id);
      if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'This saved report was not found.');
      assertEditable(report, editToken, dataset);
      report.lastValidation = { profile, validatedAt: new Date() };
      report.updatedAt = new Date();
      return publicReport(structuredClone(report));
    },
  };
}
