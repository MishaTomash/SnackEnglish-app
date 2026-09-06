import { Schema, model, Document, Types } from "mongoose";

export interface IFriendship extends Document {
  userId: Types.ObjectId;
  friendId: Types.ObjectId;
  status: "pending" | "accepted";
  requestedBy: Types.ObjectId;
  pairId: string; // Для унікального індексу неупорядкованої пари
}

const friendshipSchema = new Schema<IFriendship>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    friendId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pairId: { type: String, unique: true, required: true },
  },
  { timestamps: true },
);

export const Friendship = model<IFriendship>("Friendship", friendshipSchema);
