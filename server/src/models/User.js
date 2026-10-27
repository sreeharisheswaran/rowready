import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true, strict: false, versionKey: false, bufferCommands: false },
);

export const User = mongoose.model('User', userSchema);
