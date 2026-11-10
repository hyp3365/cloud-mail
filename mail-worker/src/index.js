import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import r2Service from './service/r2-service';
import oauthService from './service/oauth-service';
import analysisService from './service/analysis-service';

// 主站 CSP：脚本只允许同源 + Turnstile（index.html 已无内联脚本，theme-init.js 是外链文件）；
// 样式要留 'unsafe-inline'（Vue / Element Plus 大量用内联样式）；图片允许外链（邮件外链图、R2 图）
const APP_CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.github.com https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";

function withHeaders(resp, headers) {
	const h = new Headers(resp.headers);
	for (const [k, v] of Object.entries(headers)) h.set(k, v);
	return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		if (url.pathname.startsWith('/oss/')) {
			const key = url.pathname.slice('/oss/'.length);
			const resp = await r2Service.toObjResp({ env }, key);
			if (!resp) return new Response('Not Found', { status: 404 });
			// 附件 / 图片直链：Content-Security-Policy: sandbox 让浏览器直接打开 HTML 附件时也不跑脚本
			return withHeaders(resp, { 'Content-Security-Policy': 'sandbox', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
		}

		 if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
			 const resp = await r2Service.toObjResp({ env }, url.pathname.substring(1));
			 if (!resp) return new Response('Not Found', { status: 404 });
			 return withHeaders(resp, { 'Content-Security-Policy': 'sandbox', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
		 }

		return withHeaders(await env.assets.fetch(req), {
			'Content-Security-Policy': APP_CSP,
			'X-Content-Type-Options': 'nosniff',
			'Referrer-Policy': 'strict-origin-when-cross-origin',
		});
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await emailService.autoClean({ env })
		await analysisService.refreshEchartsCache({ env })
		await oauthService.clearNoBindOathUser({ env })
	},
};
