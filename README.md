# Omnichannel SaaS (Voice + WhatsApp)

This project combines **AgentLabs** (AI voice calling) and **WhatsWay** (WhatsApp marketing) under one login.

This is a JavaScript-only npm workspace. Layout:

```
omnichannel-saas/
├── backend/                 # Express API
│   ├── index.js, app.js, package.json
│   ├── .env.example
│   ├── docker-compose.yml   # local Postgres
│   ├── drizzle.config.js
│   ├── migrations/
│   ├── tests/
│   └── src/                 # routes, controllers, services, integrations
├── frontend/                # React (Vite) UI
│   ├── package.json, vite.config.js, index.html
│   ├── public/
│   └── src/features + src/shared
├── packages/
│   ├── diploy-core/         # @diploy/core
│   └── shared/              # roles, error codes, constants (@shared/*)
├── infra/
│   ├── docker/              # Dockerfile, .dockerignore
│   └── pm2/                 # ecosystem.config.cjs
├── scripts/
├── docs/                    # INSTALLATION.md, architecture notes
├── storage/                 # runtime only (gitignored)
└── dist/                    # build output (gitignored)
```

Build the app image from the repo root:

`docker build -f infra/docker/Dockerfile .`

See [docs/architecture.md](docs/architecture.md) for request flow.

Request flow:

`HTTP → Route → Controller → Service → Repository → Database`

External providers:

`Service → Integration → External API`

Runtime directories (not source code; created at startup and gitignored):

| Folder | Purpose |
|--------|---------|
| `storage/data/` | Generated invoices and refund notes |
| `storage/uploads/` | User-uploaded files such as profile photos |
| `storage/logs/` | Application and PM2 logs |
| `storage/kyc/` | KYC document storage |
| `storage/exports/` | Generated export files |

- Voice UI: `/app/agents`, `/app/campaigns`, `/app/calls`, ...
- WhatsApp UI: `/app/whatsapp/inbox`, `/app/whatsapp/campaigns`, ...
- WhatsApp API: `/api/whatsapp/...`
- Shared auth: `/api/auth/...` (JWT)

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run setup
npm run db:up
npm run db:push
npm run dev
```

Install once at the repo root. npm workspaces then install `frontend/` and `backend/` from their own `package.json` files.

---

# AgentLabs - AI-Powered Bulk Calling Platform


**Version:** 5.4.1  
**Last Updated:** May 2026  
**License:** Regular/Extended License (CodeCanyon)

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Key Features](#key-features)
3. [AI Engine Options](#ai-engine-options)
4. [Multi-Language Support](#multi-language-support)
6. [System Requirements](#system-requirements)
7. [Quick Start Guide](#quick-start-guide)
8. [Environment Variables](#environment-variables)
9. [Configuration Guide](#configuration-guide)
10. [Admin Panel Features](#admin-panel-features)
11. [Security Features](#security-features)
12. [Troubleshooting](#troubleshooting)
13. [Support & License](#support--license)

---

## Product Overview

AgentLabs is a multi-tenant SaaS platform for AI-powered bulk calling, supporting multiple AI engines and telephony providers. The platform enables businesses to automate outbound calls, handle incoming inquiries, gather feedback, qualify leads, and manage comprehensive calling campaigns.

### What Can You Do With AgentLabs?

- **Automated Calling Campaigns** - Launch bulk outbound calls with AI agents
- **24/7 Virtual Receptionist** - Handle incoming calls automatically
- **Lead Qualification** - Screen and score leads based on custom criteria
- **Appointment Setting** - Automate meeting scheduling and confirmations
- **Customer Surveys** - Collect feedback through natural conversations
- **Customer Service** - Provide instant, scalable AI-powered support
- **Payment Collection** - Automate payment reminders and processing
- **Multi-Region Operations** - Support for 100+ countries and 11 languages

---

## Key Features

### AI Agent Types

#### Natural Agents
LLM-powered open-ended conversations with:
- Customizable personality and speaking style
- Knowledge base integration (RAG) for accurate answers
- Voice selection from 100+ natural voices
- Temperature and stability controls
- Background sound customization

#### Flow Agents
Visual drag-and-drop scripted call flows with:
- **Message Nodes** - Speak pre-defined messages
- **Question Nodes** - Gather input from callers
- **Condition Nodes** - Branch based on responses
- **Transfer Nodes** - Connect to human agents
- **Tool Nodes** - Execute custom functions
- **API Call Nodes** - Integrate with external services
- **Delay Nodes** - Add timing between actions
- **Webhook Nodes** - Send real-time notifications
- **End Call Nodes** - Gracefully terminate calls

#### Incoming Agents
Handle inbound calls with:
- 24/7 availability
- Automatic call routing
- Pre-transfer information collection
- Self-service options

### Campaign Management

- **Bulk Contact Import** - Upload CSV files with thousands of contacts
- **Scheduled Execution** - Set start times and calling windows
- **Timezone Awareness** - Call at appropriate local times
- **Concurrent Calling** - Multiple simultaneous calls
- **Real-time Monitoring** - Track progress live
- **Pause and Resume** - Control campaigns on the fly
- **Automatic Retry** - Retry failed calls automatically
- **Visual Flow Logging** - See conversation flow execution in real-time
- **Detailed Analytics** - Success rates, durations, outcomes

### Phone Number Management

Purchase and manage phone numbers from 100+ countries:
- Local numbers, toll-free, and mobile
- Instant provisioning
- Caller ID configuration
- Inbound routing
- Monthly billing tracking
- KYC verification for compliance

### Knowledge Base (RAG)

Upload documents to give agents accurate information:
- PDF documents
- Word documents (DOCX)
- Text files (TXT)
- Website URLs
- Plain text entries

Content is automatically processed, chunked, and indexed for real-time reference during calls.

### Credit System

Simple pay-as-you-go pricing:
- **1 Credit = 1 Minute** of call time
- Real-time credit deduction
- Low credit warnings
- Auto-pause when depleted
- Credit packages for bulk purchases
- Subscription plans with monthly credits

### Webhook System

Integrate with external systems:
- `call.started` - When a call begins
- `call.completed` - When a call ends
- `campaign.started` - When a campaign begins
- `campaign.completed` - When a campaign finishes
- `subscription.updated` - When plans change

Features:
- HMAC-SHA256 signature verification
- Automatic retry with exponential backoff
- Delivery logs and debugging

### Email Notifications

Automatic notifications for:
- Welcome emails for new users
- Purchase confirmations
- Low credit warnings
- Campaign completion notices
- Password reset links
- Subscription updates

---

## AI Engine Options

AgentLabs supports three AI engine configurations to match your needs:

### 1. ElevenLabs + Twilio (Default)

| Feature | Details |
|---------|---------|
| **Best For** | High-quality natural voices, global coverage |
| **AI Provider** | ElevenLabs Conversational AI |
| **Telephony** | Twilio Voice API |
| **Voice Options** | 100+ premium voices |
| **Coverage** | 100+ countries |

### 2. Plivo + OpenAI Realtime

| Feature | Details |
|---------|---------|
| **Best For** | India and regions where Twilio is limited |
| **AI Provider** | OpenAI Realtime API |
| **Telephony** | Plivo Voice API |
| **Voice Options** | OpenAI natural voices |
| **Special** | Better India coverage, competitive pricing |

### 3. Twilio + OpenAI Realtime

| Feature | Details |
|---------|---------|
| **Best For** | OpenAI voice quality with Twilio reliability |
| **AI Provider** | OpenAI Realtime API |
| **Telephony** | Twilio Voice API |
| **Voice Options** | OpenAI natural voices |
| **Coverage** | 100+ countries |

---

## Multi-Language Support

AgentLabs supports 11 languages with full interface translation:

| Language | Code | RTL Support |
|----------|------|-------------|
| English | en | No |
| Spanish | es | No |
| French | fr | No |
| German | de | No |
| Portuguese | pt | No |
| Italian | it | No |
| Dutch | nl | No |
| Polish | pl | No |
| Turkish | tr | No |
| Arabic | ar | Yes |
| Hindi | hi | No |

The interface automatically adjusts for right-to-left (RTL) languages.

---

## System Requirements

### Minimum Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Node.js** | 18.x | 20.x LTS |
| **PostgreSQL** | 14.x | 15.x or 16.x |
| **RAM** | 2 GB | 4 GB |
| **Storage** | 10 GB | 20 GB |
| **CPU** | 1 vCPU | 2 vCPU |

### Required Services

| Service | Purpose | Required |
|---------|---------|----------|
| **PostgreSQL Database** | Data storage | Yes |
| **At least one AI Engine** | ElevenLabs or OpenAI | Yes |
| **At least one Telephony** | Twilio or Plivo | Yes |
| **SMTP Server** | Email notifications | Yes |

### Supported Hosting Platforms

- **VPS/Dedicated Servers** - Ubuntu 20.04+, Debian 11+, CentOS 8+
- **Platform-as-a-Service** - Railway, Render, Heroku, Fly.io
- **Containerized** - Docker with Docker Compose
- **Cloud Providers** - AWS, Google Cloud, Azure, DigitalOcean

---

## Quick Start Guide

### 1. Upload Files
```bash
# Upload all files to your server or hosting platform
unzip AgentLabs-Production-v5.4.1.zip
cd AgentLabs
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
nano backend/.env  # Edit with your values
```

### 4. Initialize Database
```bash
npm run db:push
```

### 5. Start Application
```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

### 6. Complete Setup Wizard
Open your browser and navigate to your application URL. The setup wizard will:
- Verify system requirements
- Create your admin account
- Seed initial data (plans, templates, settings)
- Configure company information

For detailed installation instructions, see [docs/INSTALLATION.md](docs/INSTALLATION.md).

---

## Environment Variables

Backend secrets and database settings live in `backend/.env`. Vite public variables live in `frontend/.env` (`VITE_*` only).

### Required Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database

# Application Configuration
NODE_ENV=production
PORT=5000
APP_URL=https://yourdomain.com

# Session Security (generate with: openssl rand -base64 32)
SESSION_SECRET=your_session_secret_minimum_32_characters
JWT_SECRET=your_jwt_secret_minimum_32_characters
```

### AI Engine Variables

```bash
# ElevenLabs (for ElevenLabs + Twilio engine)
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# OpenAI (for Plivo + OpenAI or Twilio + OpenAI engines)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
```

### Telephony Variables

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Plivo (alternative to Twilio)
PLIVO_AUTH_ID=your_plivo_auth_id
PLIVO_AUTH_TOKEN=your_plivo_auth_token
```

### SMTP Variables

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

---

## Configuration Guide

### 1. AI Engine Setup

#### ElevenLabs Configuration
1. Create account at [elevenlabs.io](https://elevenlabs.io)
2. Navigate to Profile > API Keys
3. Generate and copy your API key
4. Add via Admin Panel > ElevenLabs Pool
5. Multiple keys can be added for load balancing

#### OpenAI Configuration
1. Create account at [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys
3. Create and copy your API key
4. Add via Admin Panel > OpenAI Keys
5. Ensure Realtime API access is enabled

### 2. Telephony Setup

#### Twilio Configuration
1. Create account at [twilio.com](https://twilio.com)
2. Navigate to Console Dashboard
3. Copy Account SID and Auth Token
4. Add to environment variables
5. Purchase phone numbers through Admin Panel

#### Plivo Configuration
1. Create account at [plivo.com](https://plivo.com)
2. Navigate to Dashboard
3. Copy Auth ID and Auth Token
4. Add to environment variables
5. Purchase phone numbers through Admin Panel

### 3. Email (SMTP) Setup

#### Gmail Setup
1. Enable 2-Step Verification in Google Account
2. Generate App Password (Security > App Passwords)
3. Use the app password as `SMTP_PASS`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

#### Other SMTP Providers
- **SendGrid**: smtp.sendgrid.net, port 587
- **Mailgun**: smtp.mailgun.org, port 587
- **AWS SES**: email-smtp.region.amazonaws.com, port 587

---

## Admin Panel Features

### User Management
- View and manage all registered users
- Approve/reject user registrations
- Reset user passwords
- Adjust user credits and plan types
- View user call history and activity
- Soft delete users (data preserved for recovery)

### Platform Settings
- Company branding (name, logo, favicon)
- Default agent configurations
- Email template customization with variables
- System-wide default settings
- Currency configuration (locks after first transaction)

### API Key Management
- **ElevenLabs Pool** - Add multiple keys with load balancing, concurrency limits per key
- **OpenAI Keys** - Manage OpenAI API keys with tier-based rate limits
- **Twilio Credentials** - Configure Account SID and Auth Token
- **Plivo Credentials** - Configure Auth ID and Auth Token

### LLM Model Configuration
- Add/edit available LLM models
- Configure model display names
- Set model availability per plan tier
- Manage voice options

### Campaign Analytics
- View all campaigns across users
- Campaign performance metrics
- Call success/failure rates
- Duration and credit usage statistics
- Visual flow execution logs

### System Monitoring
- Health checks for Twilio, ElevenLabs, Plivo, OpenAI
- Connection status indicators (green/red)
- Resource usage monitoring
- Error logs with correlation IDs
- Version display in dashboard header
- External service connectivity testing

### KYC Management
- Review submitted verification documents
- Approve or reject applications
- Configure which documents are required
- Document storage and viewing
- User verification status tracking

### Plans & Credit Packages
- Create and edit subscription plans
- Configure plan limits (agents, campaigns, calls)
- Set credit packages with bulk pricing
- Configure monthly credit allocations
- Manage plan upgrade/downgrade rules

### Infrastructure Settings (10 Configurable Limits)
- `ws_max_connections_per_process` (default: 1000)
- `ws_max_connections_per_user` (default: 5)
- `ws_max_connections_per_ip` (default: 10)
- `openai_max_connections_per_credential` (default: 50)
- `openai_connection_timeout_ms` (default: 30000)
- `openai_idle_timeout_ms` (default: 300000)
- `db_pool_min_connections` (default: 2)
- `db_pool_max_connections` (default: 20)
- `campaign_max_concurrent_jobs` (default: 10)
- `campaign_job_timeout_ms` (default: 600000)

---

## Security Features

### Authentication & Authorization
- Secure password hashing (bcrypt with salt rounds)
- JWT token-based sessions with configurable expiry
- Email verification with OTP codes
- Password reset with secure tokens
- Multi-tier role system (User, Admin, Super Admin)
- Plan-based feature access control
- Session management with secure cookies

### Webhook Security
All webhook endpoints verify authenticity before processing:
- **Twilio** - Request signature validation using auth token
- **ElevenLabs** - HMAC-SHA256 signature verification
- **Stripe** - Webhook signature verification with signing secret
- **PayPal** - Webhook signature verification
- **Paystack** - Hash verification using secret key
- **MercadoPago** - X-Signature header verification
- **Razorpay** - Webhook signature verification
- **WebSocket Streams** - Call record validation before connection

### Data Protection
- GDPR compliance fields for data handling
- Soft delete for user accounts (data recovery)
- Audit trails with createdAt/updatedAt timestamps
- Secure file storage with access controls
- Encrypted storage for sensitive API keys
- KYC document secure storage

### Rate Limiting & Resource Protection
- API rate limiting on sensitive endpoints
- Per-user WebSocket connection limits (default: 5)
- Per-IP connection limits (default: 10)
- Per-process connection limits (default: 1000)
- Per-credential OpenAI connection limits (default: 50)
- Automatic cleanup of idle connections
- Database connection pooling with limits

### Infrastructure Security
- Correlation IDs for request tracing and debugging
- PostgreSQL advisory locks for credit operations
- Row-level locking for concurrent transactions
- Campaign job queue with worker isolation
- Automatic crash recovery for interrupted campaigns
- Health checks for external service monitoring

---

## Troubleshooting

### Database Issues

**Error: Connection refused to PostgreSQL**
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure firewall allows port 5432
- Verify user credentials

**Error: relation does not exist**
- Run `npm run db:push` before starting

### Email Issues

**Error: SMTP connection failed**
- Verify SMTP credentials
- For Gmail, ensure App Password is used
- Check if port 587 is open
- Try port 465 with SSL

### AI Engine Issues

**Error: ElevenLabs 401 Unauthorized**
- Verify API key is correct
- Check if API key has sufficient credits
- Ensure key is not expired

**Error: OpenAI connection failed**
- Verify API key permissions
- Ensure Realtime API access is enabled
- Check API key usage limits

### Telephony Issues

**Error: Failed to purchase number**
- Verify account has sufficient balance
- Check if account is verified for the country
- Ensure credentials are correct

**Error: Call failed to connect**
- Verify webhook URLs are accessible
- Check TwiML/XML response format
- Ensure phone numbers are properly configured

### Application Issues

**Error: Port already in use**
- Kill existing process: `pkill -f node`
- Change PORT in environment variables

**Error: 502 Bad Gateway**
- Run `npm run db:push` first
- Check application logs
- Verify all environment variables

### Debug Mode

Enable verbose logging:
```bash
NODE_ENV=development npm run dev
```

---

## Support & License

### License Information

This product is licensed under the CodeCanyon/Envato Regular or Extended License.

**Regular License:**
- Use in a single end product
- End product is free to end users

**Extended License:**
- Use in a single end product
- End product can be sold to end users

### License Terms
- You cannot redistribute the source code
- You cannot include this product in other products for resale
- License includes 6 months of support from purchase date

### Support Channels
- **Documentation**: This README, [docs/INSTALLATION.md](docs/INSTALLATION.md), and [docs/architecture.md](docs/architecture.md)
- **CodeCanyon Comments**: Leave questions on the item page
- **Email Support**: Contact via CodeCanyon author profile

### What's Included in Support
- Answers to questions about how to use the product
- Assistance with reported bugs and issues
- Help with included third-party assets

### What's NOT Included in Support
- Customization or modification of the product
- Installation on your server (installation guide provided)
- Third-party plugin or service support

---

## Version Information

- **Current Version**: 5.4.1
- **Node.js**: 18+ required, 20+ recommended
- **PostgreSQL**: 14+ required
- **Last Updated**: May 2026

Check version via API: `GET /api/system/version`

---

**Thank you for purchasing AgentLabs!**

If you find this product helpful, please consider leaving a rating on CodeCanyon. Your feedback helps us improve and continue development.
