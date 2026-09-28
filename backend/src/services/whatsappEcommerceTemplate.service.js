/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { storage } from '../storage/whatsappStorage';
import { WhatsAppApiService } from '../integrations/whatsapp/api';
/* ------------------------------------------------------------
    HELPERS
------------------------------------------------------------ */
async function templateExistsForChannel(channelId, name) {
    const existingTemplates = await storage.getAllTemplatesByChannel(channelId);
    const normalizedName = name.trim().toLowerCase();
    return (existingTemplates || []).some((t) => t?.name?.trim().toLowerCase() === normalizedName);
}
async function createEcommerceTemplate(channel, userId, definition) {
    try {
        const exists = await templateExistsForChannel(channel.id, definition.name);
        if (exists) {
            console.log(`[Ecommerce Templates] Skipping "${definition.name}" — already exists for channel ${channel.id}`);
            return { name: definition.name, status: 'SKIPPED' };
        }
        const whatsappApi = new WhatsAppApiService(channel);
        const metaPayload = {
            name: definition.name,
            category: definition.category,
            language: definition.language,
            components: definition.metaComponents,
        };
        const result = await whatsappApi.createTemplate(metaPayload);
        if (!result?.id) {
            throw new Error('WhatsApp did not return template ID');
        }
        const created = await storage.createTemplate({
            name: definition.name,
            category: definition.category,
            language: definition.language,
            header: definition.localData.header || '',
            body: definition.localData.body,
            footer: definition.localData.footer || '',
            buttons: definition.localData.buttons || [],
            mediaType: definition.localData.mediaType || 'text',
            variables: [],
            channelId: channel.id,
            createdBy: userId || channel.createdBy || '',
            status: (result.status || 'PENDING').toUpperCase(),
            whatsappTemplateId: result.id,
        });
        console.log(`[Ecommerce Templates] Created "${definition.name}" → ${result.status || 'PENDING'}`);
        return {
            name: definition.name,
            status: 'CREATED',
            templateId: created?.id,
            whatsappTemplateId: result.id,
        };
    }
    catch (err) {
        const errorMsg = err?.response?.data?.error?.error_user_msg ||
            err?.response?.data?.error?.message ||
            err?.message ||
            'Template creation failed';
        console.error(`[Ecommerce Templates] Failed to create "${definition.name}":`, errorMsg);
        return { name: definition.name, status: 'FAILED', error: errorMsg };
    }
}
/* ------------------------------------------------------------
    TEMPLATE DEFINITIONS (PROFESSIONAL & META-COMPLIANT)
------------------------------------------------------------ */
function orderCreatedDefinition() {
    // Bold styling on dynamic parameters (*#{{2}}*) helps draw attention to critical details.
    const body = "Hello {{1}},\n\nThank you for shopping with us! 🎉 Your order *#{{2}}* has been successfully received and is currently being processed by our team.";
    return {
        name: 'ecom_order_created',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'We will notify you once your order is ready to ship.' },
        ],
        localData: { body, footer: 'We will notify you once your order is ready to ship.', mediaType: 'text' },
    };
}
function orderPaidDefinition() {
    const body = "Hi {{1}},\n\nPayment Confirmed! 💳 We have successfully received your payment for order *#{{2}}*. Your order is officially confirmed and is being packed with care.";
    return {
        name: 'ecom_order_paid',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'Thank you for your trust in us!' },
        ],
        localData: { body, footer: 'Thank you for your trust in us!', mediaType: 'text' },
    };
}
function orderFulfilledDefinition() {
    const body = "Great news, {{1}}! 🚚\n\nYour order *#{{2}}* has been packed and handed over to our courier partner. It is now on its way to you!";
    return {
        name: 'ecom_order_fulfilled',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'Get ready to unwrap your goodies soon!' },
        ],
        localData: { body, footer: 'Get ready to unwrap your goodies soon!', mediaType: 'text' },
    };
}
function orderCompletedDefinition() {
    const body = "Hi {{1}},\n\nYour order *#{{2}}* has been delivered! 📦 We hope you absolutely love your purchase. Thank you for choosing us today!";
    return {
        name: 'ecom_order_completed',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'Have a wonderful day ahead!' },
        ],
        localData: { body, footer: 'Have a wonderful day ahead!', mediaType: 'text' },
    };
}
function orderCancelledDefinition() {
    const body = "Hello {{1}},\n\nAs requested, your order *#{{2}}* has been cancelled. Any payment processed will be refunded as per our standard policy.";
    return {
        name: 'ecom_order_cancelled',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'Need help? Reply to this message to chat with support.' },
        ],
        localData: { body, footer: 'Need help? Reply to this message to chat with support.', mediaType: 'text' },
    };
}
function codVerificationDefinition() {
    const body = "Hello {{1}},\n\nPlease confirm your Cash on Delivery (COD) order *#{{2}}* valued at *{{3}}*. Tap one of the options below to proceed.";
    const buttons = [
        { type: 'QUICK_REPLY', text: 'Confirm Order' },
        { type: 'QUICK_REPLY', text: 'Cancel Order' },
    ];
    return {
        name: 'ecom_cod_verification',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023', '$49.00']] },
            },
            { type: 'FOOTER', text: 'Please verify to help us dispatch your package quickly.' },
            {
                type: 'BUTTONS',
                buttons: buttons.map(b => ({ type: b.type, text: b.text }))
            },
        ],
        localData: {
            body,
            footer: 'Please verify to help us dispatch your package quickly.',
            mediaType: 'text',
            buttons,
        },
    };
}
function codConfirmedDefinition() {
    const body = "Thank you, {{1}}!\n\nYour Cash on Delivery order *#{{2}}* has been confirmed successfully. We will notify you as soon as it ships.";
    return {
        name: 'ecom_cod_confirmed',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'Thank you for verifying your order.' },
        ],
        localData: { body, footer: 'Thank you for verifying your order.', mediaType: 'text' },
    };
}
function codCancelledDefinition() {
    const body = "Hello {{1}},\n\nYour Cash on Delivery order *#{{2}}* has been cancelled as requested. No package will be shipped.";
    return {
        name: 'ecom_cod_cancelled',
        category: 'UTILITY',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John', '1023']] },
            },
            { type: 'FOOTER', text: 'Changed your mind? Feel free to place a new order anytime!' },
        ],
        localData: {
            body,
            footer: 'Changed your mind? Feel free to place a new order anytime!',
            mediaType: 'text',
        },
    };
}
function abandonedCartDefinition() {
    const body = "Hi {{1}},\n\nYou left some great items waiting in your cart! 🛒 Complete your purchase today before stock runs out.";
    // Marketing templates require opt-out buttons/text under modern Meta rules.
    // "Stop Promotions" button acts as a compliance guardrail.
    const buttons = [
        { type: 'QUICK_REPLY', text: 'Checkout Now' },
        { type: 'QUICK_REPLY', text: 'Stop Promotions' },
    ];
    return {
        name: 'ecom_abandoned_cart',
        category: 'MARKETING',
        language: 'en_US',
        metaComponents: [
            {
                type: 'BODY',
                text: body,
                example: { body_text: [['John']] },
            },
            { type: 'FOOTER', text: 'To stop receiving marketing updates, tap Stop Promotions.' },
            {
                type: 'BUTTONS',
                buttons: buttons.map(b => ({ type: b.type, text: b.text }))
            },
        ],
        localData: { body, footer: 'To stop receiving marketing updates, tap Stop Promotions.', mediaType: 'text', buttons },
    };
}
/* ------------------------------------------------------------
    PUBLIC PER-TEMPLATE FUNCTIONS
------------------------------------------------------------ */
export async function createOrderCreatedTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, orderCreatedDefinition());
}
export async function createOrderPaidTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, orderPaidDefinition());
}
export async function createOrderFulfilledTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, orderFulfilledDefinition());
}
export async function createOrderCompletedTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, orderCompletedDefinition());
}
export async function createOrderCancelledTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, orderCancelledDefinition());
}
export async function createCodVerificationTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, codVerificationDefinition());
}
export async function createCodConfirmedTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, codConfirmedDefinition());
}
export async function createCodCancelledTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, codCancelledDefinition());
}
export async function createAbandonedCartTemplate(channel, userId) {
    return createEcommerceTemplate(channel, userId, abandonedCartDefinition());
}
/* ------------------------------------------------------------
    WRAPPER
------------------------------------------------------------ */
export async function createDefaultEcommerceTemplates(channel, userId) {
    const creators = [
        createOrderCreatedTemplate,
        createOrderPaidTemplate,
        createOrderFulfilledTemplate,
        createOrderCompletedTemplate,
        createOrderCancelledTemplate,
        createCodVerificationTemplate,
        createCodConfirmedTemplate,
        createCodCancelledTemplate,
        createAbandonedCartTemplate,
    ];
    const results = [];
    for (const create of creators) {
        const result = await create(channel, userId);
        results.push(result);
    }
    const createdCount = results.filter((r) => r.status === 'CREATED').length;
    const skippedCount = results.filter((r) => r.status === 'SKIPPED').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    console.log(`[Ecommerce Templates] Done for channel ${channel.id} — created: ${createdCount}, skipped: ${skippedCount}, failed: ${failedCount}`);
    return results;
}
