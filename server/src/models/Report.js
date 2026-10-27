import mongoose from 'mongoose';

const { Schema } = mongoose;
const warningSchema = new Schema({ code: String, count: Number, message: String }, { _id: false });
const columnSchema = new Schema(
  {
    name: String,
    index: Number,
    inferredType: String,
    missing: Number,
    missingPercentage: Number,
    whitespace: Number,
    uniqueValues: Number,
    typeCounts: { number: Number, boolean: Number, date: Number, string: Number },
    numeric: {
      type: new Schema({ min: Number, max: Number, mean: Number }, { _id: false }),
      default: null,
    },
  },
  { _id: false },
);
const profileSchema = new Schema(
  {
    rowCount: Number,
    columnCount: Number,
    cellCount: Number,
    missingCells: Number,
    missingPercentage: Number,
    duplicateRows: Number,
    duplicatePercentage: Number,
    whitespaceCells: Number,
    formulaCells: Number,
    mixedColumns: Number,
    whitespaceHeaders: Number,
    columns: [columnSchema],
    warnings: [warningSchema],
  },
  { _id: false },
);
const reportSchema = new Schema(
  {
    filename: { type: String, required: true, maxlength: 120 },
    sourceBytes: { type: Number, required: true },
    original: { type: profileSchema, required: true },
    lastValidation: {
      type: new Schema({ profile: profileSchema, validatedAt: Date }, { _id: false }),
      default: null,
    },
    headerHash: { type: String, required: true, select: false },
    editTokenHash: { type: String, required: true, select: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    userEmail: { type: String, default: null },
    userName: { type: String, default: null },
  },
  { timestamps: true, strict: 'throw', versionKey: false, bufferCommands: false },
);

reportSchema.index({ createdAt: -1, _id: -1 });
reportSchema.index({ userId: 1, createdAt: -1 });
export const Report = mongoose.model('Report', reportSchema);
