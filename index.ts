import cron from "node-cron";
import { Telegraf } from "telegraf";
import dayjs from "dayjs";
import "dotenv/config";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { Collection, MongoClient } from "mongodb";
import type { ReminderMessage, ReminderMessageDoc } from "./types";

const TIMEZONE = "Europe/Madrid";
const DAYS_RANGE = [3, 7, 14];
const BOT_TOKEN: string = process.env["Telegram_Bot_Token"] ?? "";
const MONGODB_URL: string = process.env["MONGO_URL"] ?? "";
if (!BOT_TOKEN || BOT_TOKEN === "" || !MONGODB_URL || MONGODB_URL === "") {
    throw new Error("BOT_TOKEN is not defined");
}

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(TIMEZONE);

//helpers
const startOfLocalDay = (d: dayjs.Dayjs) => d.tz(TIMEZONE).startOf("day");
const todayLocal = () => startOfLocalDay(dayjs());

const bot = new Telegraf(BOT_TOKEN);

(async () => {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
})();

const client = new MongoClient(MONGODB_URL);
client
    .connect()
    .then(() => console.log("connected to MongoDB"))
    .catch((e) => console.error(e));

const messageCollection: Collection<ReminderMessage> = client
    .db("remindmetelegrambot")
    .collection<ReminderMessage>("messages");

bot.start(async (ctx) => {
    try {
        await ctx.reply(
            "👋 Привіт! Я Telegram-бот, який нагадує тебе про нагадування."
        );
    } catch (e) {
        console.error(e);
    }
});

bot.on("message", async (ctx) => {
    try {
        const m = ctx.message as any;

        const createdAtMs = dayjs.unix(m.date).valueOf();
        messageCollection.insertOne({
            id: Date.now() + Math.floor(Math.random() * 1000),
            chatID: m.chat.id,
            createdAtMs,
            messageID: m.message_id,
        });
        ctx.reply("✅ Нагадування успішно додано.");
    } catch (e) {
        console.error(e);
    }
});

function main(): void {
    try {
        cron.schedule(
            "0 00 14 * * *",
            async () => {
                const nowDay = todayLocal();
                const ranges = DAYS_RANGE.map((d) => {
                    const start = nowDay.clone().subtract(d, "day").valueOf();
                    const end = nowDay
                        .clone()
                        .subtract(d - 1, "day")
                        .valueOf();
                    return { start, end };
                });
                const orClauses = ranges.map(({ start, end }) => ({
                    createdAtMs: { $gte: start, $lt: end },
                }));

                const dueReminders: ReminderMessageDoc[] = orClauses.length
                    ? await messageCollection.find({ $or: orClauses }).toArray()
                    : [];

                for (const r of dueReminders) {
                    try {
                        let localDay = startOfLocalDay(dayjs(r.createdAtMs));
                        let stage = nowDay.diff(localDay, "day");
                        await bot.telegram.sendMessage(
                            r.chatID,
                            `🕑 Нагадування ${stage} днів. Маєш прочитати ось це!`,
                            { reply_parameters: { message_id: r.messageID } }
                        );
                    } catch (e) {
                        console.error("Send error", e);
                    }
                }
                const threshold = nowDay.subtract(14, "day").valueOf();

                await messageCollection.deleteMany({
                    createdAtMs: { $lt: threshold },
                });
            },
            { timezone: TIMEZONE }
        );
    } catch (e) {
        console.error(e);
    }
}

main();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
process.once("SIGUSR2", () => bot.stop("SIGUSR2"));
