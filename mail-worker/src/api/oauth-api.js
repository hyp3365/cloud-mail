import app from '../hono/hono';
import result from "../model/result";
import oauthService from "../service/oauth-service";
import cookieUtils from "../utils/cookie-utils";

// OAuth 登录成功也把 token 写进 HttpOnly Cookie，不返回给前端 JS；
// 用 loggedIn 告诉前端是否已登录（以前是靠 data.token 是否存在判断）
function withAuthCookie(c, loginInfo) {
	if (loginInfo?.token) {
		cookieUtils.setAuthCookie(c, loginInfo.token);
		return { userInfo: loginInfo?.userInfo, loggedIn: true };
	}
	return { ...loginInfo, loggedIn: false };
}

app.post('/oauth/linuxDo/login', async (c) => {
	const loginInfo = await oauthService.linuxDoLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo?.token ? withAuthCookie(c, loginInfo) : loginInfo))
});

app.post('/oauth/github/login', async (c) => {
	const loginInfo = await oauthService.githubLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo?.token ? withAuthCookie(c, loginInfo) : loginInfo))
});

app.post('/oauth/google/login', async (c) => {
	const loginInfo = await oauthService.googleLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo?.token ? withAuthCookie(c, loginInfo) : loginInfo))
});

app.put('/oauth/bindUser', async (c) => {
	const loginInfo = await oauthService.bindUser(c, await c.req.json());
	return c.json(result.ok(withAuthCookie(c, loginInfo)))
})
