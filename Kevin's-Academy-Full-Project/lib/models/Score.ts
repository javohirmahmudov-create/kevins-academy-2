import mongoose, { Schema, Document } from 'mongoose';

export interface IScore extends Document {
  studentId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  vocabulary?: number;
  grammar?: number;
  speaking?: number;
  reading?: number;
  writing?: number;
  listening?: number;
  tasks?: { name: string; score: number }[];
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScoreSchema: Schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  vocabulary: { type: Number, min: 0, max: 100 },
  grammar: { type: Number, min: 0, max: 100 },
  speaking: { type: Number, min: 0, max: 100 },
  reading: { type: Number, min: 0, max: 100 },
  writing: { type: Number, min: 0, max: 100 },
  listening: { type: Number, min: 0, max: 100 },
  tasks: [{ 
    name: String, 
    score: { type: Number, min: 0, max: 100 } 
  }],
  feedback: { type: String },
}, {
  timestamps: true
});

export default mongoose.models.Score || mongoose.model<IScore>('Score', ScoreSchema);
