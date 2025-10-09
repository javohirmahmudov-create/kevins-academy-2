import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  role: 'admin' | 'student' | 'parent';
  fullName: string;
  email?: string;
  phone?: string;
  groupId?: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId;
  studentIds?: mongoose.Types.ObjectId[];
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student', 'parent'], required: true },
  fullName: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
  parentId: { type: Schema.Types.ObjectId, ref: 'User' },
  studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  avatar: { type: String },
}, {
  timestamps: true
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
