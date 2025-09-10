import cron from "node-cron";
import { Telegraf } from "telegraf";
import dayjs from "dayjs";
import "dotenv/config";
import tz from "dayjs/plugin/timezone.js";

import { ReminderMessage } from "./types";

dayjs.extend(tz);

const BOT_TOKEN: string = process.env.Telegram_Bot_Token || "";
console.log(
    BOT_TOKEN,
    "process.env.BOT_TOKEN ",
    process.env.Telegram_Bot_Token
);
if (!BOT_TOKEN || BOT_TOKEN === "") {
    throw new Error("BOT_TOKEN is not defined");
}
// ================== CHANGE TO DINAMIC VALUES ==================
const RUN_HOUR = 13;
const TIMEZONE = "Europe/Kyiv";
const DAYS_RANGE = [0, 1, 3, 7, 14];
// ==============================================================

//helpers
const startOfLocalDay = (d: dayjs.Dayjs) => d.tz(TIMEZONE).startOf("day");
const todayLocal = () => startOfLocalDay(dayjs());

const bot = new Telegraf(BOT_TOKEN);
let reminders: ReminderMessage[] = [];

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
        console.log(ctx.message);
        const m = ctx.message as any;

        const createdAtMs = dayjs.unix(m.date).valueOf();
        console.log("i recieved chat");
        reminders.push({
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

bot.launch();

function main(): void {
    try {
        cron.schedule(
            "0 13 * * *",
            async () => {
                const nowDay = todayLocal();

                const dueReminders: ReminderMessage[] = reminders.filter(
                    (r: ReminderMessage) => {
                        const origDay = startOfLocalDay(dayjs(r.createdAtMs));
                        const diffDays = nowDay.diff(origDay, "day");
                        return DAYS_RANGE.includes(diffDays);
                    }
                );

                for (const r of dueReminders) {
                    try {
                        let localDay = startOfLocalDay(dayjs(r.createdAtMs));
                        let stage = nowDay.diff(localDay, "day");
                        await bot.telegram.sendMessage(
                            r.chatID,
                            `🕑 Нагадування ${stage} днів . Маєш прочитати ось це!`,
                            {
                                reply_parameters: { message_id: r.messageID },
                            }
                        );
                    } catch (e) {
                        console.error("Send error", e);
                    }
                }
                reminders = reminders.filter((r: ReminderMessage) => {
                    const origDay = startOfLocalDay(dayjs(r.createdAtMs));
                    const difference = nowDay.diff(origDay, "day");
                    return difference <= 14;
                });
            },
            { timezone: TIMEZONE }
        );
        console.log(
            `Scheduler running. Digest at ${RUN_HOUR}:00 ${TIMEZONE} daily. Press Ctrl+C to exit.`
        );
    } catch (e) {
        console.error(e);
    }
}

main();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
