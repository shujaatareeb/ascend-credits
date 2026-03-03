# Ascend Rewards Bot

Discord bot that rewards engagement with Ascend Credits (AC), supports a stock-based shop, and runs moderator-approved redemption tickets.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` with:
   - DISCORD_BOT_TOKEN
   - DISCORD_GUILD_ID
   - MODERATOR_ROLE_ID
   - ADMIN_ROLE_ID
   - REWARDS_CHANNEL_ID
   - TICKET_CATEGORY_ID
   - DATABASE_URL
3. Run SQL migration in `migrations/001_init.sql`.
4. Start bot:
   ```bash
   npm start
   ```

## Commands
- `/balance`
- `/shop`
- `/redeem item_id:<id>`
- `/leaderboard`
- `/adjustcredits` (admin)
- `/addstock` (admin)
- `/removestock` (admin)
