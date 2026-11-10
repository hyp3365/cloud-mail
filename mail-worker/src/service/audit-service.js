import orm from '../entity/orm';
import auditLog from '../entity/audit';
import reqUtils from '../utils/req-utils';
import { desc, count } from 'drizzle-orm';

// 审计日志：登录、改密、用户/角色/注册码等敏感操作记一条。
// 只记事实不记密码；写失败也不影响主操作（try/catch 吞掉）
const auditService = {

	async record(c, { userId, email, action, detail = '' }) {
		try {
			if (!c?.env?.db) return;
			await orm(c).insert(auditLog).values({
				userId: userId || 0,
				email: email || '',
				action,
				detail: String(detail || '').slice(0, 500),
				ip: reqUtils.getIp(c),
			}).run();
		} catch (e) {
			console.error('写审计日志失败：', e);
		}
	},

	// 当前操作人的身份（security 中间件已放进 c.get('user')）
	actor(c) {
		const user = c.get?.('user');
		return { userId: user?.userId || 0, email: user?.email || '' };
	},

	async list(c, params) {
		let { num = 1, size = 50 } = params;
		num = Number(num) || 1;
		size = Math.min(Number(size) || 50, 100);
		const offset = (num - 1) * size;
		const list = await orm(c).select().from(auditLog)
			.orderBy(desc(auditLog.auditId))
			.limit(size).offset(offset).all();
		const totalRow = await orm(c).select({ total: count() }).from(auditLog).get();
		return { list, total: totalRow?.total || 0 };
	},

};

export default auditService;
