import { ObjectId, WithId } from "mongodb";

export type ReminderMessage = {
    id: number;
    chatID: string | number;
    createdAtMs: number;
    messageID: number;
    _id?: ObjectId;
};
export type ReminderMessageDoc = WithId<ReminderMessage>;
