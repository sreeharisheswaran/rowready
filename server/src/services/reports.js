import { createHash, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { AppError } from '../middleware/errors.js';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const hashHeaders = (dataset) => digest(JSON.stringify(dataset.headers));

export function publicReport(document) {
  const object = typeof document.toObject === 'function' ? document.toObject() : document;
  return {
    id: String(object._id),
    filename: object.filename,
    sourceBytes: object.sourceBytes,
    original: object.original,
    lastValidation: object.lastValidation,
    userId: object.userId ? String(object.userId) : null,
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
  };
}

async function query(operation) {
  if (mongoose.connection.readyState !== 1)
    throw new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'Report storage is unavailable. Please try again when the database is connected.',
    );
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'The report could not be saved or loaded. Please retry; your current browser session is unchanged.',
    );
  }
}

export function assertEditable(report, editToken, dataset) {
  const actual = Buffer.from(digest(editToken), 'hex');
  const expected = Buffer.from(report.editTokenHash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError(
      403,
      'INVALID_SESSION',
      'Only the browser session that uploaded this dataset can save its validation. Upload the CSV again to start a new session.',
    );
  }
  if (
    hashHeaders(dataset) !== report.headerHash ||
    dataset.rows.length > report.original.rowCount
  ) {
    throw new AppError(
      409,
      'DATASET_MISMATCH',
      'The dataset does not match this report’s columns or original row limit. Upload it as a new report.',
    );
  }
}

export const mongoReportStore = {
  ready: () => mongoose.connection.readyState === 1,
  create: (input) => query(async () => publicReport(await Report.create(input))),
  list: ({ limit, offset, userId }) =>
    query(async () => {
      const filter = userId ? { userId } : {};
      const documents = await Report.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit + 1)
        .select('-original.columns -lastValidation.profile.columns')
        .maxTimeMS(5000)
        .lean();
      return {
        reports: documents.slice(0, limit).map(publicReport),
        hasMore: documents.length > limit,
      };
    }),
  get: (id) =>
    query(async () => {
      const report = await Report.findById(id).maxTimeMS(5000).lean();
      if (!report)
        throw new AppError(
          404,
          'REPORT_NOT_FOUND',
          'This saved report was not found. It may have been removed.',
        );
      return publicReport(report);
    }),
  validate: (id, editToken, dataset, profile) =>
    query(async () => {
      const report = await Report.findById(id)
        .select('+editTokenHash +headerHash')
        .maxTimeMS(5000)
        .lean();
      if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'This saved report was not found.');
      assertEditable(report, editToken, dataset);
      const updated = await Report.findByIdAndUpdate(
        id,
        { $set: { lastValidation: { profile, validatedAt: new Date() } } },
        { new: true, runValidators: true, maxTimeMS: 5000 },
      );
      if (!updated) throw new AppError(404, 'REPORT_NOT_FOUND', 'This saved report was not found.');
      return publicReport(updated);
    }),
};
