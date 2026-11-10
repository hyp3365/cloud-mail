import app from '../hono/hono';
import loginService from '../service/login-service';
import result from '../model/result';
import userContext from '../security/user-context';
import cookieUtils from '../utils/cookie-utils';

app.post('/login', async (c) => {
	const token = await loginService.login(c, await c.req.json());
	// token 只进 HttpOnly Cookie，不再返回给前端 JS
	cookieUtils.setAuthCookie(c, token);
	return c.json(result.ok({}));
});

app.post('/register', async (c) => {
	const jwt = await loginService.register(c, await c.req.json());
	return c.json(result.ok(jwt));
});

app.delete('/logout', async (c) => {
	await loginService.logout(c, userContext.getUserId(c));
	cookieUtils.clearAuthCookie(c);
	return c.json(result.ok());
});

