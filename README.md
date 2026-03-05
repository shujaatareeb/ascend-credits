# Ascend Credits Discord Redemption Bot

Discord bot that tracks Ascend Credits (AC), exposes a JSON-based redemption catalog, and creates moderator-managed purchase tickets.

## Core flow
1. User runs `/redeem`.
2. Bot shows game dropdown.
3. User selects game, then package.
4. Bot converts INR prices to AC using `1 INR = 10 AC` (from JSON catalog).
5. If balance is enough, credits are deducted and locked.
6. A private ticket channel is created for moderators/admins.
7. Admin can approve, deny+refund, or close the ticket.

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
4. Edit `data/shop.json` for product inventory.
5. Start bot:
   ```bash
   npm start
   ```

## Commands
- `/balance`
- `/shop`
- `/redeem`
- `/leaderboard`
- `/adjustcredits` (admin)
- `/addstock` (admin)
- `/removestock` (admin)
