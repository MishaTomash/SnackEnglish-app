import { Schema, model, Document, Types } from "mongoose";

/**
 * Крок сцени. Форма payload різна для кожного з 10 типів кроків,
 * тому в Mongoose зберігаємо як Mixed — строга типізація живе на фронті.
 */
export interface IStoryStep {
    type: string;
    [key: string]: unknown;
}

export interface IStoryCliffhanger {
    text: string;
}

export interface IStoryNode extends Document {
    chapterId: Types.ObjectId;
    slug: string; // стабільна ідентичність уроку = ім'я файлу контенту без номера
    order: number;
    icon: string;
    label: string;
    npc: string; // Ключ NPC (аватар/спрайт на фронті)
    npcName: string; // Ім'я NPC для відображення
    isBoss: boolean;
    cliffhanger?: IStoryCliffhanger;
    steps: IStoryStep[];
    createdAt: Date;
    updatedAt: Date;
}

const cliffhangerSchema = new Schema<IStoryCliffhanger>(
    { text: { type: String, required: true, trim: true } },
    { _id: false },
);

const storyNodeSchema = new Schema<IStoryNode>(
    {
        chapterId: {
            type: Schema.Types.ObjectId,
            ref: "Chapter",
            required: true,
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        },
        order: { type: Number, required: true },
        icon: { type: String, default: "⭐" },
        label: { type: String, required: true, trim: true },
        npc: { type: String, default: "" },
        npcName: { type: String, default: "" },
        isBoss: { type: Boolean, default: false },
        cliffhanger: { type: cliffhangerSchema, default: undefined },
        steps: {
            type: [{ type: Schema.Types.Mixed }],
            default: [],
            validate: {
                validator: (steps: unknown[]) =>
                    steps.every(
                        (s) =>
                            typeof s === "object" &&
                            s !== null &&
                            typeof (s as { type?: unknown }).type === "string",
                    ),
                message: "Each step must be an object with a string 'type'",
            },
        },
    },
    { timestamps: true },
);

// Порядок вузлів унікальний у межах розділу — "наступний вузол" визначається однозначно
storyNodeSchema.index({ chapterId: 1, order: 1 }, { unique: true });
// За slug сідер знаходить урок при оновленні контенту — прогрес юзерів зберігається
storyNodeSchema.index({ chapterId: 1, slug: 1 }, { unique: true });

export const StoryNode = model<IStoryNode>("StoryNode", storyNodeSchema);