import app from '../hono/hono';
import auditService from '../service/audit-service';
import result from '../model/result';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n.js';

// 审计日志只有管理员能看
app.get('/audit/list', async (c) => {
	const user = c.get('user');
	if (!user || user.email !== c.env.admin) {
		throw new BizError(t('unauthorized'), 403);
	}
	const data = await auditService.list(c, c.req.query());
	return c.json(result.ok(data));
});
