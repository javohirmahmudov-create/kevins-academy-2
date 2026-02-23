import mongoose, { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  level: 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced';
  description?: string;
  students: mongoose.Types.ObjectId[];
  materials: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema: Schema = new Schema({
  name: { type: String, required: true },
  level: { 
    type: String, 
    enum: ['Beginner', 'Elementary', 'Intermediate', 'Advanced'], 
    required: true 
  },
  description: { type: String },
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  materials: [{ type: Schema.Types.ObjectId, ref: 'Material' }],
}, {
  timestamps: true
});

export default mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema);
