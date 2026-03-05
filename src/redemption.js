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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 999999, true)
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

export async function createPurchaseTicket({ guild, user, item }) {
  await ensureUser(user.id);

  const result = await withTransaction(async (client) => {
    const userResult = await client.query('SELECT ac_balance FROM users WHERE user_id = $1 FOR UPDATE', [user.id]);
    const balance = Number(userResult.rows[0]?.ac_balance ?? 0);
    if (balance < item.costAc) {
      throw new Error('Insufficient balance');
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
      `INSERT INTO transactions (user_id, type, source, amount_ac, reference_id, status)
       VALUES ($1, 'redeem', 'mod', $2, $3, 'pending')`,
      [user.id, item.costAc, item.itemId]
    );

    return client.query(
      `INSERT INTO redemption_tickets (
        discord_channel_id, user_id, item_id, cost_ac, status
      ) VALUES ('pending-channel', $1, $2, $3, 'confirmed') RETURNING ticket_id`,
      [user.id, item.itemId, item.costAc]
    );
  });

  const ticketId = result.rows[0].ticket_id;

  const channel = await guild.channels.create({
    name: `ticket-${user.username}-${item.itemId}`.slice(0, 90),
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

  await query('UPDATE redemption_tickets SET discord_channel_id = $2 WHERE ticket_id = $1', [ticketId, channel.id]);
  return { channel, ticketId };
}

export async function approveTicket(ticketId, actorId) {
  await query(
    `UPDATE redemption_tickets
     SET status = 'approved', decided_at = NOW(), decided_by_user_id = $2
     WHERE ticket_id = $1 AND status = 'confirmed'`,
    [ticketId, actorId]
  );
}

export async function denyTicketWithRefund(ticketId, actorId) {
  await withTransaction(async (client) => {
    const ticketResult = await client.query('SELECT * FROM redemption_tickets WHERE ticket_id = $1 FOR UPDATE', [ticketId]);
    const ticket = ticketResult.rows[0];
    if (!ticket || !['confirmed', 'requested'].includes(ticket.status)) {
      throw new Error('Ticket not refundable');
    }

    await client.query(
      `UPDATE users
       SET ac_balance = ac_balance + $2,
           ac_pending_locked = GREATEST(0, ac_pending_locked - $2),
           updated_at = NOW()
       WHERE user_id = $1`,
      [ticket.user_id, ticket.cost_ac]
    );

    await client.query(
      `UPDATE transactions
       SET status = 'failed'
       WHERE user_id = $1 AND type = 'redeem' AND amount_ac = $2 AND status = 'pending'`,
      [ticket.user_id, ticket.cost_ac]
    );

    await client.query(
      `UPDATE redemption_tickets
       SET status = 'denied', decided_at = NOW(), decided_by_user_id = $2
       WHERE ticket_id = $1`,
      [ticketId, actorId]
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
