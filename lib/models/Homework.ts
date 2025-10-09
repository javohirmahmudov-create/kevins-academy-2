import mongoose, { Schema, Document } from 'mongoose';

export interface IHomework extends Document {
  studentId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  fileUrl?: string;
  submittedAt: Date;
  status: 'submitted' | 'graded' | 'pending';
  grade?: number;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HomeworkSchema: Schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  title: { type: String, required: true },
  description: { type: String },
  fileUrl: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['submitted', 'graded', 'pending'], default: 'submitted' },
  grade: { type: Number, min: 0, max: 100 },
  feedback: { type: String },
}, {
  timestamps: true
});

export default mongoose.models.Homework || mongoose.model<IHomework>('Homework', HomeworkSchema);
