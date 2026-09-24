import { db, pool } from "../backend/db";
import { eq, sql } from "drizzle-orm";
import { campaigns, leads, users } from "../shared/schema";

const DUMMY_SOURCE = "dummy-crm";

const samples = [
  {
    firstName: "Ava",
    lastName: "Shah",
    phone: "+1919428134872",
    email: "ava.shah@example.com",
    aiCategory: "warm",
    stage: "hot",
    leadScore: 71,
    sentiment: "positive",
    aiSummary: "The conversation involves a user interacting with Experimind Technologies, a company exploring WhatsApp and voice automation.",
    tags: ["demo", "whatsapp"],
    hoursAgo: 15,
  },
  {
    firstName: "Noah",
    lastName: "Patel",
    phone: "+1915006699050",
    email: "noah.patel@example.com",
    aiCategory: "warm",
    stage: "appointment",
    leadScore: 64,
    sentiment: "neutral",
    aiSummary: "The user wanted to schedule an appointment. The agent greeted the user and started collecting availability.",
    tags: ["appointment"],
    hoursAgo: 27,
    hasAppointment: true,
  },
  {
    firstName: "Mia",
    lastName: "Chen",
    phone: "+1918990068089",
    email: "mia.chen@example.com",
    aiCategory: "hot",
    stage: "hot",
    leadScore: 91,
    sentiment: "positive",
    aiSummary: "The conversation began with an agent attempting to assist the user, but the user is ready to buy this week.",
    tags: ["hot", "ready"],
    hoursAgo: 12,
  },
  {
    firstName: "Liam",
    lastName: "Brooks",
    phone: "+1918001577653",
    email: "liam.brooks@example.com",
    aiCategory: "hot",
    stage: "hot",
    leadScore: 84,
    sentiment: "neutral",
    aiSummary: "The user initiated a conversation to schedule something, but asked for a same-day callback from sales.",
    tags: ["callback"],
    hoursAgo: 20,
    hasCallback: true,
  },
  {
    firstName: "Priya",
    lastName: "Nair",
    phone: "+1918001577603",
    email: "priya.nair@example.com",
    aiCategory: "hot",
    stage: "follow_up",
    leadScore: 78,
    sentiment: "positive",
    aiSummary: "The user requested pricing details and follow-up regarding the enterprise subscription.",
    tags: ["enterprise", "pricing"],
    hoursAgo: 9,
  },
  {
    firstName: "Sofia",
    lastName: "Reyes",
    phone: "+14155550121",
    email: "sofia.reyes@example.com",
    aiCategory: "appointment_booked",
    stage: "appointment",
    leadScore: 88,
    sentiment: "positive",
    aiSummary: "Sofia confirmed a product demo for Thursday at 3pm and asked for a reminder.",
    tags: ["demo"],
    hoursAgo: 6,
    hasAppointment: true,
  },
  {
    firstName: "Ethan",
    lastName: "Kim",
    phone: "+14155550122",
    email: "ethan.kim@example.com",
    aiCategory: "appointment_booked",
    stage: "appointment",
    leadScore: 73,
    sentiment: "positive",
    aiSummary: "Ethan booked an onboarding call for two agents and a shared inbox walkthrough.",
    tags: ["onboarding"],
    hoursAgo: 18,
    hasAppointment: true,
  },
  {
    firstName: "Hannah",
    lastName: "Wright",
    phone: "+14155550123",
    email: "hannah.wright@example.com",
    aiCategory: "form_submitted",
    stage: "form_submitted",
    leadScore: 69,
    sentiment: "neutral",
    aiSummary: "Hannah submitted the contact form after asking how recordings and transcripts are stored.",
    tags: ["form"],
    hoursAgo: 11,
    hasFormSubmission: true,
  },
  {
    firstName: "Arjun",
    lastName: "Mehta",
    phone: "+14155550124",
    email: "arjun.mehta@example.com",
    aiCategory: "form_submitted",
    stage: "form_submitted",
    leadScore: 61,
    sentiment: "positive",
    aiSummary: "Arjun filled the trial request form and wants WhatsApp plus voice calling.",
    tags: ["trial"],
    hoursAgo: 30,
    hasFormSubmission: true,
  },
  {
    firstName: "Elena",
    lastName: "Vargas",
    phone: "+14155550125",
    email: "elena.vargas@example.com",
    aiCategory: "call_transfer",
    stage: "hot",
    leadScore: 82,
    sentiment: "positive",
    aiSummary: "Elena asked to upgrade the plan and was transferred to billing to add calling credits.",
    tags: ["upgrade"],
    hoursAgo: 8,
    hasTransfer: true,
  },
  {
    firstName: "Owen",
    lastName: "Clarke",
    phone: "+14155550126",
    email: "owen.clarke@example.com",
    aiCategory: "need_follow_up",
    stage: "follow_up",
    leadScore: 55,
    sentiment: "neutral",
    aiSummary: "Owen asked for a written quote and wants a callback after his team reviews it on Friday.",
    tags: ["quote"],
    hoursAgo: 14,
    hasCallback: true,
  },
  {
    firstName: "Jack",
    lastName: "Murphy",
    phone: "+14155550127",
    email: "jack.murphy@example.com",
    aiCategory: "need_follow_up",
    stage: "follow_up",
    leadScore: 42,
    sentiment: "negative",
    aiSummary: "Jack is not ready this month and asked to be contacted again after the next planning cycle.",
    tags: ["later"],
    hoursAgo: 36,
  },
];

async function seedDummyCrm() {
  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) {
    throw new Error("No users found. Sign in once, then run this script again.");
  }

  for (const user of allUsers) {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.userId, user.id)).limit(1);

    await db.delete(leads).where(sql`${leads.userId} = ${user.id} AND ${leads.customFields}->>'source' = ${DUMMY_SOURCE}`);

    const now = Date.now();
    for (const sample of samples) {
      const lastCallAt = new Date(now - sample.hoursAgo * 60 * 60 * 1000);
      await db.insert(leads).values({
        userId: user.id,
        sourceType: campaign ? "campaign" : "incoming",
        campaignId: campaign?.id,
        firstName: sample.firstName,
        lastName: sample.lastName,
        phone: sample.phone,
        email: sample.email,
        company: "Demo Company",
        stage: sample.stage,
        leadScore: sample.leadScore,
        aiSummary: sample.aiSummary,
        sentiment: sample.sentiment,
        aiCategory: sample.aiCategory,
        hasAppointment: Boolean(sample.hasAppointment),
        hasFormSubmission: Boolean(sample.hasFormSubmission),
        hasTransfer: Boolean(sample.hasTransfer),
        hasCallback: Boolean(sample.hasCallback),
        tags: sample.tags,
        totalCalls: 1,
        lastCallAt,
        createdAt: lastCallAt,
        updatedAt: lastCallAt,
        customFields: { source: DUMMY_SOURCE },
      });
    }

    console.log(`Seeded ${samples.length} dummy CRM leads for ${user.email}`);
  }
}

seedDummyCrm()
  .catch((error) => {
    console.error("Failed to seed dummy CRM leads:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
