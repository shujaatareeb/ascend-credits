import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { query, withTransaction } from './database.js';

export async function listShopItems() {
  const { rows } = await query(
    `SELECT item_id, game, denomination_label, cost_ac, stock_quantity, active_boolean
     FROM stock_items
     WHERE active_boolean = true
     ORDER BY game ASC, cost_ac ASC`
  );
  return rows;
}

export async function createRedemptionTicket({ guild, user, itemId }) {
  const itemResult = await query(
    `SELECT item_id, denomination_label, cost_ac, stock_quantity, active_boolean
     FROM stock_items WHERE item_id = $1`,
    [itemId]
  );
  const item = itemResult.rows[0];
  if (!item || !item.active_boolean || item.stock_quantity <= 0) {
    throw new Error('Item unavailable');
  }

  const userResult = await query('SELECT ac_balance FROM users WHERE user_id = $1', [user.id]);
  if (!userResult.rows[0] || Number(userResult.rows[0].ac_balance) < Number(item.cost_ac)) {
    throw new Error('Insufficient balance');
  }

  const channel = await guild.channels.create({
    name: `ticket-${user.username}-${item.item_id}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: config.moderatorRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: config.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]
  });

  const ticket = await query(
    `INSERT INTO redemption_tickets (
      discord_channel_id, user_id, item_id, cost_ac, status
    ) VALUES ($1, $2, $3, $4, 'requested') RETURNING ticket_id`,
    [channel.id, user.id, item.item_id, item.cost_ac]
  );

  return { channel, ticketId: ticket.rows[0].ticket_id, item };
}

export async function confirmTicket(ticketId, userId) {
  await withTransaction(async (client) => {
    const ticketResult = await client.query(
      `SELECT * FROM redemption_tickets WHERE ticket_id = $1 FOR UPDATE`,
      [ticketId]
    );
    const ticket = ticketResult.rows[0];
    if (!ticket || ticket.user_id !== userId || ticket.status !== 'requested') {
      throw new Error('Ticket invalid');
    }

    await client.query(
      `UPDATE users
       SET ac_balance = ac_balance - $2,
           ac_pending_locked = ac_pending_locked + $2,
           updated_at = NOW()
       WHERE user_id = $1 AND ac_balance >= $2`,
      [userId, ticket.cost_ac]
    );

    await client.query(
      `UPDATE redemption_tickets
       SET status = 'confirmed', confirmed_at = NOW()
       WHERE ticket_id = $1`,
      [ticketId]
    );
  });
}
