import { Schema, model, Document, Types } from "mongoose";

export interface IDuelInvite extends Document {
  hostId: Types.ObjectId;
  guestId: Types.ObjectId;
  gameId: string;
  roomCode: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: Date;
}

const duelInviteSchema = new Schema<IDuelInvite>(
  {
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    gameId: { type: String, default: "test" }, // У майбутньому сюди піде ID конкретної гри
    roomCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
    },
    // TTL-індекс: MongoDB автоматично видалить цей документ через 5 хвилин (300 секунд)
    createdAt: { type: Date, default: Date.now, expires: 300 },
  },
  { timestamps: true },
);

export const DuelInvite = model<IDuelInvite>("DuelInvite", duelInviteSchema);
