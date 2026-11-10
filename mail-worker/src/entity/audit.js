import { sqliteTable, text, integer} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const auditLog = sqliteTable('audit_log', {
	auditId: integer('audit_id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	email: text('email').default('').notNull(),
	action: text('action').default('').notNull(),
	detail: text('detail').default('').notNull(),
	ip: text('ip').default('').notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
});
export default auditLog
