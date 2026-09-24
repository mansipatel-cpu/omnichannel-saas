import { db, pool } from "../backend/db";
import { and, eq, sql } from "drizzle-orm";
import { agents, calls, campaigns, contacts, users } from "../shared/schema";

const DUMMY_SOURCE = "dummy-calls";

const samples = [
  {
    firstName: "Ava",
    lastName: "Shah",
    phone: "+14155550101",
    direction: "outgoing",
    status: "completed",
    classification: "hot",
    sentiment: "positive",
    duration: 186,
    summary: "Ava asked for a product demo next Tuesday and confirmed the decision maker will join.",
    transcript: "Agent: Hi Ava, this is a follow-up about the platform demo.\nAva: Yes, Tuesday at 11 works. Please include our operations lead.",
  },
  {
    firstName: "Noah",
    lastName: "Patel",
    phone: "+14155550102",
    direction: "incoming",
    status: "completed",
    classification: "warm",
    sentiment: "neutral",
    duration: 94,
    summary: "Noah called about pricing for a 10-seat plan and asked for a written quote.",
    transcript: "Noah: I need pricing for about ten users.\nAgent: I can send a quote today. What email should I use?",
  },
  {
    firstName: "Mia",
    lastName: "Chen",
    phone: "+14155550103",
    direction: "outgoing",
    status: "completed",
    classification: "hot",
    sentiment: "positive",
    duration: 241,
    summary: "Mia agreed to start a two-week trial and wants WhatsApp plus voice calling.",
    transcript: "Agent: Would a trial help the team evaluate both channels?\nMia: Yes, start us on a two-week trial.",
  },
  {
    firstName: "Liam",
    lastName: "Brooks",
    phone: "+14155550104",
    direction: "outgoing",
    status: "no-answer",
    classification: "cold",
    sentiment: null,
    duration: 0,
    summary: null,
    transcript: null,
  },
  {
    firstName: "Sofia",
    lastName: "Reyes",
    phone: "+14155550105",
    direction: "incoming",
    status: "completed",
    classification: "successful",
    sentiment: "positive",
    duration: 132,
    summary: "Sofia confirmed an appointment for Thursday and asked for a reminder text.",
    transcript: "Sofia: Thursday at 3pm is fine.\nAgent: I will send a reminder the morning of the appointment.",
  },
  {
    firstName: "Ethan",
    lastName: "Kim",
    phone: "+14155550106",
    direction: "outgoing",
    status: "failed",
    classification: "lost",
    sentiment: "negative",
    duration: 18,
    summary: "Call dropped after Ethan said they already chose another vendor.",
    transcript: "Ethan: We already signed with someone else.\nAgent: Understood, I will close this follow-up.",
  },
  {
    firstName: "Priya",
    lastName: "Nair",
    phone: "+14155550107",
    direction: "outgoing",
    status: "completed",
    classification: "warm",
    sentiment: "positive",
    duration: 157,
    summary: "Priya wants a callback after her team reviews the proposal on Friday.",
    transcript: "Priya: Send the proposal and call me Friday afternoon.\nAgent: I will schedule that follow-up.",
  },
  {
    firstName: "Owen",
    lastName: "Clarke",
    phone: "+14155550108",
    direction: "incoming",
    status: "busy",
    classification: "cold",
    sentiment: null,
    duration: 0,
    summary: null,
    transcript: null,
  },
  {
    firstName: "Hannah",
    lastName: "Wright",
    phone: "+14155550109",
    direction: "outgoing",
    status: "completed",
    classification: "hot",
    sentiment: "positive",
    duration: 208,
    summary: "Hannah requested onboarding for two agents and a shared inbox.",
    transcript: "Hannah: We can start onboarding this week if you include the shared inbox.\nAgent: I will set that up.",
  },
  {
    firstName: "Arjun",
    lastName: "Mehta",
    phone: "+14155550110",
    direction: "outgoing",
    status: "completed",
    classification: "warm",
    sentiment: "neutral",
    duration: 76,
    summary: "Arjun asked how call recordings and transcripts are stored.",
    transcript: "Arjun: Do you keep recordings?\nAgent: Yes, completed calls can include a transcript and summary.",
  },
  {
    firstName: "Elena",
    lastName: "Vargas",
    phone: "+14155550111",
    direction: "incoming",
    status: "completed",
    classification: "hot",
    sentiment: "positive",
    duration: 163,
    summary: "Elena called to upgrade the plan and add more calling credits.",
    transcript: "Elena: We are out of credits. Can we upgrade today?\nAgent: Yes, I can move you to the next plan.",
  },
  {
    firstName: "Jack",
    lastName: "Murphy",
    phone: "+14155550112",
    direction: "outgoing",
    status: "completed",
    classification: "cold",
    sentiment: "negative",
    duration: 41,
    summary: "Jack is not interested right now and asked not to be called this month.",
    transcript: "Jack: Not a good time. Please try again next month.\nAgent: I will pause outreach until then.",
  },
];

async function seedDummyCalls() {
  const allUsers = await db.select().from(users);
  if (allUsers.length === 0) {
    throw new Error("No users found. Sign in once, then run this script again.");
  }

  for (const user of allUsers) {
    let [agent] = await db.select().from(agents).where(eq(agents.userId, user.id)).limit(1);
    if (!agent) {
      [agent] = await db.insert(agents).values({
        userId: user.id,
        name: "Demo Voice Agent",
        type: "incoming",
        systemPrompt: "You are a helpful voice agent for product demos.",
        firstMessage: "Hello, thanks for taking the call.",
        telephonyProvider: "twilio",
      }).returning();
    }

    const campaignName = "Demo Call Campaign";
    let [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.userId, user.id), eq(campaigns.name, campaignName)))
      .limit(1);

    if (!campaign) {
      [campaign] = await db.insert(campaigns).values({
        userId: user.id,
        agentId: agent.id,
        name: campaignName,
        type: "outbound",
        status: "completed",
        totalContacts: samples.length,
        completedCalls: samples.filter((s) => s.status === "completed").length,
        successfulCalls: samples.filter((s) => s.classification === "hot" || s.classification === "successful").length,
        failedCalls: samples.filter((s) => s.status === "failed").length,
      }).returning();
    }

    await db.delete(calls).where(sql`${calls.userId} = ${user.id} AND ${calls.metadata}->>'source' = ${DUMMY_SOURCE}`);
    await db.delete(contacts).where(and(eq(contacts.campaignId, campaign.id), sql`${contacts.customFields}->>'source' = ${DUMMY_SOURCE}`));

    const now = Date.now();
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      const started = new Date(now - (i + 1) * 45 * 60 * 1000);
      const ended = new Date(started.getTime() + sample.duration * 1000);

      const [contact] = await db.insert(contacts).values({
        campaignId: campaign.id,
        firstName: sample.firstName,
        lastName: sample.lastName,
        phone: sample.phone,
        email: `${sample.firstName.toLowerCase()}.${sample.lastName.toLowerCase()}@example.com`,
        status: sample.status === "completed" ? "completed" : sample.status,
        customFields: { source: DUMMY_SOURCE },
      }).returning();

      await db.insert(calls).values({
        userId: user.id,
        agentId: agent.id,
        campaignId: campaign.id,
        contactId: contact.id,
        phoneNumber: sample.phone,
        fromNumber: sample.direction === "incoming" ? sample.phone : "+14155550000",
        toNumber: sample.direction === "incoming" ? "+14155550000" : sample.phone,
        status: sample.status,
        callDirection: sample.direction,
        duration: sample.duration,
        transcript: sample.transcript,
        aiSummary: sample.summary,
        classification: sample.classification,
        sentiment: sample.sentiment,
        recordingUrl: sample.status === "completed" ? "https://example.com/recordings/dummy-call.mp3" : null,
        startedAt: started,
        endedAt: sample.duration > 0 ? ended : started,
        createdAt: started,
        engineType: "twilio-openai",
        creditsUsed: sample.duration > 0 ? Math.ceil(sample.duration / 60) : 0,
        metadata: { source: DUMMY_SOURCE },
      });
    }

    console.log(`Seeded ${samples.length} dummy calls for ${user.email}`);
  }
}

seedDummyCalls()
  .catch((error) => {
    console.error("Failed to seed dummy calls:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
