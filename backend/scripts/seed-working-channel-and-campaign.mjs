/**
 * Seed Working Channel, Agent, Numbers & Contacts for Campaigns
 *
 * Creates:
 * 1. A verified WhatsApp Business Channel (channels)
 * 2. An approved WhatsApp Template (templates)
 * 3. An AI Voice Agent (agents)
 * 4. An Active Phone Number (phone_numbers)
 * 5. A Contact Group with sample contacts (contacts, contact_groups, contact_group_members)
 * 6. WhatsApp Contact Channel opt-ins (whatsapp_contact_channels)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Load .env
const envPath = resolve(rootDir, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set.');
  process.exit(1);
}

const { default: pg } = await import('pg');
const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function seedWorkingData() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding sample Channel, Agent, Contacts & Campaign dataset...\n');

    // 1. Get or create primary user
    let userRes = await client.query(`SELECT id, email FROM users WHERE role IN ('admin', 'superadmin', 'user') ORDER BY created_at ASC LIMIT 1;`);
    let userId;
    if (userRes.rows.length === 0) {
      const { default: bcrypt } = await import('bcryptjs');
      const hash = await bcrypt.hash('Admin@123', 10);
      const newUser = await client.query(`
        INSERT INTO users (id, email, password, name, role, is_active, credits)
        VALUES (gen_random_uuid(), 'admin@platform.com', $1, 'Admin User', 'admin', true, 10000)
        RETURNING id, email;
      `, [hash]);
      userId = newUser.rows[0].id;
      console.log(`👤 Created user: ${newUser.rows[0].email} (${userId})`);
    } else {
      userId = userRes.rows[0].id;
      console.log(`👤 Using user: ${userRes.rows[0].email} (${userId})`);
    }

    // 2. WhatsApp Channel
    const channelRes = await client.query(`
      INSERT INTO channels (
        id, name, phone_number_id, access_token, whatsapp_business_account_id,
        phone_number, app_id, is_active, health_status, connection_method, created_by
      ) VALUES (
        gen_random_uuid(),
        'Official WhatsApp Business Channel',
        '109876543210123',
        'EAAG_mock_access_token_for_campaign_testing',
        '209876543210456',
        '+15551234567',
        '998877665544',
        true,
        'healthy',
        'embedded',
        $1
      )
      RETURNING id, name, phone_number;
    `, [userId]);
    const channelId = channelRes.rows[0].id;
    console.log(`📱 WhatsApp Channel created: "${channelRes.rows[0].name}" (${channelId})`);

    // 3. WhatsApp Template
    const templateContent = {
      header: { type: 'text', text: 'Special Offer' },
      body: 'Hello {{1}}, we are excited to share an exclusive update with you! Reply YES to learn more.',
      footer: 'Reply STOP to opt out',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Interested' },
        { type: 'QUICK_REPLY', text: 'Not Now' }
      ],
      variables: ['name']
    };
    const templateRes = await client.query(`
      INSERT INTO templates (
        id, user_id, channel_type, name, category, language, status,
        content, provider_template_id, provider_status, created_by
      ) VALUES (
        gen_random_uuid(),
        $1,
        'whatsapp',
        'special_offer_broadcast',
        'MARKETING',
        'en_US',
        'approved',
        $2::jsonb,
        'waba_template_special_offer_01',
        'APPROVED',
        $1
      )
      RETURNING id, name;
    `, [userId, JSON.stringify(templateContent)]);
    console.log(`📄 WhatsApp Template created: "${templateRes.rows[0].name}" (${templateRes.rows[0].id})`);

    // 4. Voice AI Agent
    const agentRes = await client.query(`
      INSERT INTO agents (
        id, user_id, name, type, voice_tone, personality, system_prompt,
        first_message, llm_model, temperature, telephony_provider, is_active
      ) VALUES (
        gen_random_uuid(),
        $1,
        'Sales Outreach Voice Agent',
        'incoming',
        'professional',
        'friendly and persuasive',
        'You are an outbound sales representative calling to qualify prospective enterprise clients for the omnichannel platform. Be professional, attentive, and concise.',
        'Hi there! This is Alex calling from Diploy Omnichannel. How are you doing today?',
        'gpt-4o-mini',
        0.5,
        'twilio',
        true
      )
      RETURNING id, name;
    `, [userId]);
    console.log(`🤖 Voice Agent created: "${agentRes.rows[0].name}" (${agentRes.rows[0].id})`);

    // 5. Phone Number for Calling
    const phoneRes = await client.query(`
      INSERT INTO phone_numbers (
        id, user_id, phone_number, twilio_sid, friendly_name, country, status
      ) VALUES (
        gen_random_uuid(),
        $1,
        '+15559876543',
        'PN_mock_sid_' || substr(md5(random()::text), 1, 24),
        'Sales Outreach Direct Line',
        'US',
        'active'
      )
      RETURNING id, phone_number;
    `, [userId]);
    console.log(`📞 Phone Number created: ${phoneRes.rows[0].phone_number} (${phoneRes.rows[0].id})`);

    // 6. Contact Group
    const groupRes = await client.query(`
      INSERT INTO contact_groups (id, user_id, name, description, created_by)
      VALUES (
        gen_random_uuid(),
        $1,
        'Q4 Product Launch Audience',
        'Test audience for WhatsApp & Auto-Calling marketing campaigns',
        $1
      )
      RETURNING id, name;
    `, [userId]);
    const groupId = groupRes.rows[0].id;
    console.log(`👥 Contact Group created: "${groupRes.rows[0].name}" (${groupId})`);

    // 7. Sample Contacts
    const sampleContacts = [
      { firstName: 'John', lastName: 'Doe', phone: '+15550001111', email: 'john.doe@example.com' },
      { firstName: 'Sarah', lastName: 'Smith', phone: '+15550002222', email: 'sarah.smith@example.com' },
      { firstName: 'Michael', lastName: 'Johnson', phone: '+15550003333', email: 'michael.j@example.com' }
    ];

    for (const c of sampleContacts) {
      const contactRes = await client.query(`
        INSERT INTO contacts (
          id, user_id, phone, name, first_name, last_name, email,
          whatsapp_opt_in, do_not_call, tags
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          true,
          false,
          '["vip", "q4_campaign"]'::jsonb
        )
        ON CONFLICT (user_id, phone) DO UPDATE
        SET name = EXCLUDED.name
        RETURNING id, name, phone;
      `, [userId, c.phone, `${c.firstName} ${c.lastName}`, c.firstName, c.lastName, c.email]);

      const contactId = contactRes.rows[0].id;

      // Add to Contact Group
      await client.query(`
        INSERT INTO contact_group_members (group_id, contact_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [groupId, contactId]);

      // Add to WhatsApp Channel presence
      await client.query(`
        INSERT INTO whatsapp_contact_channels (id, user_id, contact_id, channel_id, status)
        VALUES (gen_random_uuid(), $1, $2, $3, 'active')
        ON CONFLICT (channel_id, contact_id) DO NOTHING;
      `, [userId, contactId, channelId]);

      console.log(`   👤 Contact added: ${c.firstName} ${c.lastName} (${c.phone})`);
    }

    console.log('\n=============================================================');
    console.log('✅ Seed Complete! You now have:');
    console.log(`   • Channel: "${channelRes.rows[0].name}" (ID: ${channelId})`);
    console.log(`   • Template: "${templateRes.rows[0].name}" (ID: ${templateRes.rows[0].id})`);
    console.log(`   • Agent: "${agentRes.rows[0].name}" (ID: ${agentRes.rows[0].id})`);
    console.log(`   • Phone: "${phoneRes.rows[0].phone_number}" (ID: ${phoneRes.rows[0].id})`);
    console.log(`   • Group: "${groupRes.rows[0].name}" (ID: ${groupId}) with 3 contacts`);
    console.log('=============================================================\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedWorkingData().catch(console.error);
