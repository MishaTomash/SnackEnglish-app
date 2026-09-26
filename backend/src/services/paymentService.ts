// 📁 Файл: SnackEnglish-app/backend/src/services/paymentService.ts
import { bot } from "../bot.js";
import { ManualPaymentRequest } from "../models/ManualPaymentRequest.js";
import { UserGamePurchase } from "../models/UserGamePurchase.js";

export type PaymentAction = "approve" | "reject";

/**
 * Підтвердження / відхилення ручної оплати з адмін-панелі.
 * Та сама логіка, що й у кнопках бота: атомарно pending -> approved/rejected
 * (подвійне натискання не обробить заявку двічі), доступ до гри — upsert.
 * Повертає null, якщо заявку вже оброблено або її немає.
 */
export const resolveManualPayment = async (requestId: string, action: PaymentAction) => {
    const request = await ManualPaymentRequest.findOneAndUpdate(
        { _id: requestId, status: "pending" },
        { $set: { status: action === "approve" ? "approved" : "rejected" } },
        { returnDocument: "after" },
    );
    if (!request) return null;

    if (action === "approve") {
        await UserGamePurchase.updateOne(
            { telegramId: request.telegramId, gameId: request.gameId },
            { $setOnInsert: { purchasedAt: new Date() } },
            { upsert: true },
        );
    }

    try {
        await bot.telegram.sendMessage(
            request.telegramId,
            action === "approve"
                ? "✅ Вашу оплату підтверджено! Гра розблокована."
                : "❌ Вашу оплату відхилено. Зверніться до підтримки, якщо сталася помилка.",
        );
    } catch {
        // Юзер міг заблокувати бота — статус однаково змінено
    }

    return request;
};