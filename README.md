# Ascend Credits Discord Redemption Bot

A wallet + stock redemption Discord bot for Ascend Credits (AC).

## What this bot does
- Maintains user wallets (AC balance + locked AC during active orders)
- Reads stock from `data/shop.json` and converts INR prices using `1 INR = 10 AC`
- Posts a redemption panel in `#redeem` with buttons:
  - **Redeem Ascend Credits**
  - **View Balance**
- Creates ticket channels inside one category and lets admins manage orders with:
  - **Cancel & Refund**
  - **Code Delivered**
  - **Close Ticket**
- Posts successful redemptions in `#redeem-history`
- Logs every request/action in private `#admin-log`

## Channel layout
All channels are in one category (`ascend-redemptions`):
1. `redeem`
2. `redeem-history`
3. `tickets`
4. `admin-log` (private to admin role)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env`:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `ADMIN_ROLE_ID`
   - `DATABASE_URL`
   - Optional: `REDEMPTION_CATEGORY_ID`
3. Run SQL migration(s):
   - `migrations/001_init.sql`
   - `migrations/002_wallet_redeem_only.sql`
4. Start:
   ```bash
   npm start
   ```

## Admin slash commands
- `/setup` (bootstrap panel/channel/category)
- `/adjustcredits`
- `/addstock`
- `/removestock`

User redemption is button-driven from `#redeem` (no user slash commands needed).
