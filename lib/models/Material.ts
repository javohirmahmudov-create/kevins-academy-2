import mongoose, { Schema, Document } from 'mongoose';

export interface IMaterial extends Document {
  title: string;
  type: 'pdf' | 'video' | 'image' | 'text';
  url: string;
  description?: string;
  groupId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialSchema: Schema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['pdf', 'video', 'image', 'text'], required: true },
  url: { type: String, required: true },
  description: { type: String },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true
});

export default mongoose.models.Material || mongoose.model<IMaterial>('Material', MaterialSchema);
