import { Schema, model, Document, Types } from "mongoose";

export type StoryNodeStatus = "locked" | "active" | "completed";

export interface IUserStoryProgress extends Document {
    userId: Types.ObjectId;
    chapterId: Types.ObjectId;
    nodeId: Types.ObjectId;
    status: StoryNodeStatus;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const userStoryProgressSchema = new Schema<IUserStoryProgress>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
        nodeId: { type: Schema.Types.ObjectId, ref: "StoryNode", required: true },
        status: {
            type: String,
            enum: ["locked", "active", "completed"],
            default: "locked",
        },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

// Один запис прогресу на (юзер, розділ, вузол). Префікс { userId, chapterId }
// також покриває запити "весь прогрес юзера в розділі" та агрегацію по юзеру.
userStoryProgressSchema.index(
    { userId: 1, chapterId: 1, nodeId: 1 },
    { unique: true },
);

export const UserStoryProgress = model<IUserStoryProgress>(
    "UserStoryProgress",
    userStoryProgressSchema,
);