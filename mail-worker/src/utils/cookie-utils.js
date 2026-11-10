import constant from '../const/constant';

// 登录凭证只存在 HttpOnly Cookie 里，前端 JS 读不到，XSS 偷不到 token。
// Cookie: HttpOnly + Secure（仅 https 时）+ SameSite=Strict + Path=/ + Max-Age=7 天
const cookieUtils = {

	getAuthToken(c) {
		const cookieHeader = c.req.header('Cookie') || '';
		for (const part of cookieHeader.split(';')) {
			const [name, ...rest] = part.trim().split('=');
			if (name === constant.AUTH_COOKIE_NAME) {
				return decodeURIComponent(rest.join('='));
			}
		}
		// 过渡期兼容：老客户端 / 非浏览器调用仍可用 Authorization 头；
		// 前端已不再发这个头，下一版可删掉这条回退
		return c.req.header(constant.TOKEN_HEADER) || '';
	},

	buildAuthCookie(c, token) {
		const secure = c.req.url.startsWith('https://') ? '; Secure' : '';
		return `${constant.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=${constant.JWT_EXPIRE}`;
	},

	buildClearCookie(c) {
		const secure = c.req.url.startsWith('https://') ? '; Secure' : '';
		return `${constant.AUTH_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`;
	},

	setAuthCookie(c, token) {
		c.header('Set-Cookie', this.buildAuthCookie(c, token));
	},

	clearAuthCookie(c) {
		c.header('Set-Cookie', this.buildClearCookie(c));
	},

};

export default cookieUtils;
