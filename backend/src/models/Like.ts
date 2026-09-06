import { Schema, model, Document, Types } from "mongoose";

export interface ILike extends Document {
  likerId: Types.ObjectId;
  targetId: Types.ObjectId;
}

const likeSchema = new Schema<ILike>(
  {
    likerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Унікальний індекс, щоб один користувач міг лайкнути іншого лише один раз
likeSchema.index({ likerId: 1, targetId: 1 }, { unique: true });

export const Like = model<ILike>("Like", likeSchema);
