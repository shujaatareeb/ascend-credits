import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { ensureUser, query, withTransaction } from './database.js';

export async function syncCatalogToStock(catalog) {
  for (const product of catalog.products) {
    for (const denomination of product.denominations) {
      await query(
        `INSERT INTO stock_items (
          item_id, game, description, denomination_label,
          original_price_inr_numeric, discounted_price_inr_numeric,
          cost_ac, stock_quantity, active_boolean
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT stock_quantity FROM stock_items WHERE item_id = $1), 100), true)
        ON CONFLICT (item_id) DO UPDATE SET
          game = EXCLUDED.game,
          description = EXCLUDED.description,
          denomination_label = EXCLUDED.denomination_label,
          original_price_inr_numeric = EXCLUDED.original_price_inr_numeric,
          discounted_price_inr_numeric = EXCLUDED.discounted_price_inr_numeric,
          cost_ac = EXCLUDED.cost_ac,
          active_boolean = true,
          updated_at = NOW()`,
        [
          denomination.itemId,
          product.game,
          product.description,
          denomination.amount,
          denomination.originalPriceInr,
          denomination.discountedPriceInr,
          denomination.costAc
        ]
      );
    }
  }
}

function compactName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
}

export async function createPurchaseTicket({ guild, user, item, gameName, ticketCategoryId }) {
  await ensureUser(user.id);

  const txResult = await withTransaction(async (client) => {
    const userResult = await client.query('SELECT ac_balance FROM users WHERE user_id = $1 FOR UPDATE', [user.id]);
    const stockResult = await client.query(
      'SELECT item_id, stock_quantity, active_boolean FROM stock_items WHERE item_id = $1 FOR UPDATE',
      [item.itemId]
    );

    const balance = Number(userResult.rows[0]?.ac_balance ?? 0);
    const stock = stockResult.rows[0];

    if (!stock || !stock.active_boolean || Number(stock.stock_quantity) <= 0) {
      throw new Error('Selected stock is unavailable.');
    }

    if (balance < item.costAc) {
      throw new Error(`Insufficient balance. You have ${balance} AC, required ${item.costAc} AC.`);
    }

    await client.query(
      `UPDATE users
       SET ac_balance = ac_balance - $2,
           ac_pending_locked = ac_pending_locked + $2,
           updated_at = NOW()
       WHERE user_id = $1`,
      [user.id, item.costAc]
    );

    await client.query(
      `UPDATE stock_items
       SET stock_quantity = stock_quantity - 1,
           updated_at = NOW()
       WHERE item_id = $1`,
      [item.itemId]
    );

    const ticketInsert = await client.query(
      `INSERT INTO redemption_tickets (
        discord_channel_id, user_id, item_id, cost_ac, status, notes_text
      ) VALUES ('pending-channel', $1, $2, $3, 'confirmed', $4)
      RETURNING ticket_id`,
      [user.id, item.itemId, item.costAc, `${gameName} | ${item.amount}`]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, source, amount_ac, reference_id, status)
       VALUES ($1, 'redeem', 'mod', $2, $3, 'pending')`,
      [user.id, item.costAc, String(ticketInsert.rows[0].ticket_id)]
    );

    const balanceAfter = await client.query('SELECT ac_balance, ac_pending_locked FROM users WHERE user_id = $1', [user.id]);
    return { ticketId: ticketInsert.rows[0].ticket_id, balance: balanceAfter.rows[0] };
  });

  const ticketCode = `t${txResult.ticketId}`;
  const channelName = `ticket-${compactName(user.username)}-${compactName(item.amount)}-${ticketCode}`.slice(0, 90);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: ticketCategoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      {
        id: config.adminRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      }
    ]
  });

  await query('UPDATE redemption_tickets SET discord_channel_id = $2 WHERE ticket_id = $1', [txResult.ticketId, channel.id]);
  return { channel, ticketId: txResult.ticketId, balance: txResult.balance };
}

export async function getTicketDetails(ticketId) {
  const { rows } = await query(
    `SELECT t.ticket_id, t.discord_channel_id, t.user_id, t.item_id, t.cost_ac, t.status, t.notes_text,
            s.game, s.denomination_label
     FROM redemption_tickets t
     LEFT JOIN stock_items s ON s.item_id = t.item_id
     WHERE t.ticket_id = $1`,
    [ticketId]
  );
  return rows[0] ?? null;
}

export async function refundTicket(ticketId, actorId) {
  return withTransaction(async (client) => {
    const ticketResult = await client.query('SELECT * FROM redemption_tickets WHERE ticket_id = $1 FOR UPDATE', [ticketId]);
    const ticket = ticketResult.rows[0];
    if (!ticket || ticket.status !== 'confirmed') {
      throw new Error('Only active confirmed tickets can be refunded.');
    }

    await client.query(
      `UPDATE users
       SET ac_balance = ac_balance + $2,
           ac_pending_locked = GREATEST(0, ac_pending_locked - $2),
           updated_at = NOW()
       WHERE user_id = $1`,
      [ticket.user_id, ticket.cost_ac]
    );

    await client.query('UPDATE stock_items SET stock_quantity = stock_quantity + 1, updated_at = NOW() WHERE item_id = $1', [ticket.item_id]);

    await client.query(
      `UPDATE redemption_tickets
       SET status = 'denied', decided_at = NOW(), decided_by_user_id = $2
       WHERE ticket_id = $1`,
      [ticketId, actorId]
    );

    await client.query(
      `UPDATE transactions
       SET status = 'failed'
       WHERE reference_id = $1 AND type = 'redeem' AND status = 'pending'`,
      [String(ticketId)]
    );

    const balance = await client.query('SELECT ac_balance, ac_pending_locked FROM users WHERE user_id = $1', [ticket.user_id]);
    return { ticket, balance: balance.rows[0] };
  });
}

export async function markCodeDelivered(ticketId, actorId) {
  return withTransaction(async (client) => {
    const ticketResult = await client.query('SELECT * FROM redemption_tickets WHERE ticket_id = $1 FOR UPDATE', [ticketId]);
    const ticket = ticketResult.rows[0];
    if (!ticket || ticket.status !== 'confirmed') {
      throw new Error('Only active confirmed tickets can be marked delivered.');
    }

    await client.query(
      `UPDATE users
       SET ac_pending_locked = GREATEST(0, ac_pending_locked - $2),
           updated_at = NOW()
       WHERE user_id = $1`,
      [ticket.user_id, ticket.cost_ac]
    );

    await client.query(
      `UPDATE redemption_tickets
       SET status = 'approved', decided_at = NOW(), decided_by_user_id = $2
       WHERE ticket_id = $1`,
      [ticketId, actorId]
    );

    await client.query(
      `UPDATE transactions
       SET status = 'success'
       WHERE reference_id = $1 AND type = 'redeem' AND status = 'pending'`,
      [String(ticketId)]
    );

    const balance = await client.query('SELECT ac_balance, ac_pending_locked FROM users WHERE user_id = $1', [ticket.user_id]);
    return { ticket, balance: balance.rows[0] };
  });
}

export async function closeTicket(ticketId, actorId) {
  await query(
    `UPDATE redemption_tickets
     SET status = 'closed', decided_at = NOW(), decided_by_user_id = $2
     WHERE ticket_id = $1`,
    [ticketId, actorId]
  );
}
