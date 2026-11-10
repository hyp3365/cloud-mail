import { Hono } from 'hono';
const app = new Hono();

import result from '../model/result';
import { cors } from 'hono/cors';

// 凭证模式：Cookie 靠浏览器自动带，跨域开发时需要回显请求来源；
// 生产是同源（/api），CORS 不起作用。SameSite=Strict 的 Cookie 本来就不会被跨站请求带上，
// 所以这里回显来源不是安全边界，只是让开发环境能用
app.use('*', cors({ origin: (origin) => origin || '', credentials: true }));

// API 响应也加 nosniff，防止浏览器把 JSON 猜成 HTML 执行
app.use('*', async (c, next) => {
	await next();
	c.header('X-Content-Type-Options', 'nosniff');
	c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.onError((err, c) => {
	if (err.name === 'BizError') {
		console.log(err.message);
	} else {
		console.error(err);
	}

	if (err.message === `Cannot read properties of undefined (reading 'get')`) {
		return c.json(result.fail('KV数据库未绑定<br/>KV database not bound',502));
	}

	if (err.message === `Cannot read properties of undefined (reading 'put')`) {
		return c.json(result.fail('KV数据库未绑定<br/>KV database not bound',502));
	}

	if (err.message === `Cannot read properties of undefined (reading 'prepare')`) {
		return c.json(result.fail('D1数据库未绑定<br/>D1 database not bound',502));
	}

	if (err.message?.includes('D1_ERROR: no such column')) {
		return c.json(result.fail('请按照文档更新数据库<br/>Please update the database as documented',502));
	}

	return c.json(result.fail(err.message, err.code));
});

export default app;


