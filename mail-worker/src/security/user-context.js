import JwtUtils from '../utils/jwt-utils';
import cookieUtils from '../utils/cookie-utils';

const userContext = {
	getUserId(c) {
		return c.get('user').userId;
	},

	getUser(c) {
		return c.get('user');
	},

	async getToken(c) {
		const jwt = cookieUtils.getAuthToken(c);
		const result = await JwtUtils.verifyToken(c,jwt);
		return result?.token;
	},
};
export default userContext;
