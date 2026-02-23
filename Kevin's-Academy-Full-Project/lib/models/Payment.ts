import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  studentId: mongoose.Types.ObjectId;
  amount: number;
  month: string;
  year: number;
  status: 'paid' | 'pending' | 'overdue';
  paidDate?: Date;
  dueDate: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true },
  year: { type: Number, required: true },
  status: { type: String, enum: ['paid', 'pending', 'overdue'], required: true, default: 'pending' },
  paidDate: { type: Date },
  dueDate: { type: Date, required: true },
  note: { type: String },
}, {
  timestamps: true
});

export default mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
