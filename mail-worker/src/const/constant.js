const constant = {
	TOKEN_HEADER: 'Authorization',
	JWT_UID: 'user_id:',
	JWT_TOKEN: 'token:',
	TOKEN_EXPIRE: 60 * 60 * 24 * 30,
	// 登录 JWT 有效期 7 天；剩不到 JWT_RENEW_BEFORE 时由 security 中间件自动续发
	JWT_EXPIRE: 60 * 60 * 24 * 7,
	JWT_RENEW_BEFORE: 60 * 60 * 24,
	// 登录凭证的 HttpOnly Cookie 名；前端只存一个 loggedIn 标记，不存 token
	AUTH_COOKIE_NAME: 'cm_auth',
	ATTACHMENT_PREFIX: 'attachments/',
	BACKGROUND_PREFIX: 'static/background/',
	ADMIN_ROLE: {
		name: 'admin',
		sendCount: 0,
		sendType: 'count',
		accountCount: 0
	}
}

export default constant
