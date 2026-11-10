import PostalMime from 'postal-mime';
import emailService from '../service/email-service';
import accountService from '../service/account-service';
import settingService from '../service/setting-service';
import attService from '../service/att-service';
import constant from '../const/constant';
import fileUtils from '../utils/file-utils';
import { emailConst, isDel, settingConst } from '../const/entity-const';
import emailUtils from '../utils/email-utils';
import roleService from '../service/role-service';
import userService from '../service/user-service';
import telegramService from '../service/telegram-service';
import aiService from '../service/ai-service';
import webhookService from '../service/webhook-service';

export async function email(message, env, ctx) {

	try {

		const {
			receive,
			tgChatId,
			tgBotStatus,
			forwardStatus,
			forwardEmail,
			webhookStatus,
			webhookUrl,
			webhookRetry,
			webhookSecret,
			ruleEmail,
			ruleType,
			r2Domain,
			noRecipient,
			blackSubject,
			blackContent,
			blackFrom,
			aiCode,
			aiCodeFilter
		} = await settingService.query({ env });

		if (receive === settingConst.receive.CLOSE) {
			message.setReject('Service suspended');
			return;
		}

		const reader = message.raw.getReader();
		let content = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			content += new TextDecoder().decode(value);
		}

		const email = await PostalMime.parse(content);


		const blockFlag = checkBlock(blackSubject, blackContent, blackFrom, email);

		if (blockFlag) {
			message.setReject('Message rejected');
			return;
		}

		// 发件人鉴权：From 是本站域名时，必须有对齐的认证通过，否则拒收
		const authReject = checkSenderAuth(email, env);

		if (authReject) {
			message.setReject(authReject);
			return;
		}

		let account = await accountService.selectByEmailIncludeDel({ env: env }, message.to);

		if (!account) {
			const baseEmail = emailUtils.getBaseEmail(message.to);
			if (baseEmail && baseEmail !== message.to) {
				account = await accountService.selectByEmailIncludeDel({ env: env }, baseEmail);
			}
		}

		if (!account && noRecipient === settingConst.noRecipient.CLOSE) {
			message.setReject('Recipient not found');
			return;
		}

		let userRow = {}

		if (account) {
			 userRow = await userService.selectByIdIncludeDel({ env: env }, account.userId);
		}

		if (account && userRow.email !== env.admin) {

			let { banEmail, availDomain } = await roleService.selectByUserId({ env: env }, account.userId);

			if (!roleService.hasAvailDomainPerm(availDomain, message.to)) {
				message.setReject('The recipient is not authorized to use this domain.');
				return;
			}

			if(roleService.isBanEmail(banEmail, email.from.address)) {
				message.setReject('The recipient is disabled from receiving emails.');
				return;
			}

		}


		if (!email.to) {
			email.to = [{ address: message.to, name: emailUtils.getName(message.to)}]
		}

		const toName = email.to.find(item => item.address === message.to)?.name || '';
		const code = await aiService.extractCode({ env }, email, { aiCode, aiCodeFilter });
		const fromAddress = email.from?.address || '';

		const params = {
			toEmail: message.to,
			toName: toName,
			sendEmail: fromAddress,
			name: email.from?.name || emailUtils.getName(fromAddress),
			senderEmail: message.from || '',
			subject: email.subject,
			code,
			authResult: parseAuthResults(email),
			content: email.html,
			text: email.text,
			cc: email.cc ? JSON.stringify(email.cc) : '[]',
			bcc: email.bcc ? JSON.stringify(email.bcc) : '[]',
			recipient: JSON.stringify(email.to),
			inReplyTo: email.inReplyTo,
			relation: email.references,
			messageId: email.messageId,
			userId: account ? account.userId : 0,
			accountId: account ? account.accountId : 0,
			isDel: isDel.DELETE,
			status: emailConst.status.SAVING
		};

		const attachments = [];
		const cidAttachments = [];

		for (let item of email.attachments) {
			let attachment = { ...item };
			attachment.key = constant.ATTACHMENT_PREFIX + await fileUtils.getBuffHash(attachment.content) + fileUtils.getExtFileName(item.filename);
			attachment.size = item.content.length ?? item.content.byteLength;
			attachments.push(attachment);
			if (attachment.contentId) {
				cidAttachments.push(attachment);
			}
		}

		let emailRow = await emailService.receive({ env }, params, cidAttachments, r2Domain);

		attachments.forEach(attachment => {
			attachment.emailId = emailRow.emailId;
			attachment.userId = emailRow.userId;
			attachment.accountId = emailRow.accountId;
		});

		try {
			if (attachments.length > 0) {
				await attService.addAtt({ env }, attachments);
			}
		} catch (e) {
			console.error(e);
		}

		emailRow = await emailService.completeReceive({ env }, account ? emailConst.status.RECEIVE : emailConst.status.NOONE, emailRow.emailId);


		if (ruleType === settingConst.ruleType.RULE) {

			const emails = ruleEmail.split(',');

			if (!emails.includes(message.to)) {
				return;
			}

		}

		//转发到TG
		if (tgBotStatus === settingConst.tgBotStatus.OPEN && tgChatId) {
			await telegramService.sendEmailToBot({ env }, emailRow)
		}

		//转发到其他邮箱
		if (forwardStatus === settingConst.forwardStatus.OPEN && forwardEmail) {

			const emails = forwardEmail.split(',');

			await Promise.all(emails.map(async email => {

				try {
					await message.forward(email);
				} catch (e) {
					console.error(`转发邮箱 ${email} 失败：`, e);
				}

			}));

		}

		//转发到 Webhook
		if (webhookStatus === settingConst.webhookStatus.OPEN && webhookUrl) {
			await webhookService.sendEmail({ env }, emailRow, webhookUrl, webhookRetry, webhookSecret);
		}

	} catch (e) {
		console.error('邮件接收异常: ', e);
		throw e
	}
}

// Cloudflare Email Routing 在信头加的 Authentication-Results 里找 SPF/DKIM/DMARC 结果，
// 顺带取各结果对应的域名（smtp.mailfrom / header.d / header.from），供发件人鉴权判断对齐
function parseAuthDetails(email) {
	try {
		const ar = email.headers?.find(h => h.key === 'authentication-results')?.value || ''
		if (!ar) return { hasHeader: false, spf: '', dkim: '', dmarc: '', spfMailFrom: '', dkimDomain: '', dmarcFrom: '' }
		const pick = (name) => {
			const m = ar.match(new RegExp(name + '=(\\w+)', 'i'))
			return m ? m[1].toLowerCase() : ''
		}
		const pickDomain = (name) => {
			const m = ar.match(new RegExp(name + '=([^\\s;]+)', 'i'))
			return m ? m[1].toLowerCase() : ''
		}
		return {
			hasHeader: true,
			spf: pick('spf'),
			dkim: pick('dkim'),
			dmarc: pick('dmarc'),
			spfMailFrom: pickDomain('smtp.mailfrom'),
			dkimDomain: pickDomain('header.d'),
			dmarcFrom: pickDomain('header.from'),
		}
	} catch (e) {
		return { hasHeader: false, spf: '', dkim: '', dmarc: '', spfMailFrom: '', dkimDomain: '', dmarcFrom: '' }
	}
}

function parseAuthResults(email) {
	const d = parseAuthDetails(email)
	if (!d.hasHeader || (!d.spf && !d.dkim && !d.dmarc)) return ''
	return JSON.stringify({ spf: d.spf, dkim: d.dkim, dmarc: d.dmarc })
}

// 自有域名发来的信必须有对齐的认证通过，否则拒收：攻击者伪造本站域名时，
// SPF/DKIM 都对不上本站域名（DMARC 也就过不了）。非本站域名的信只记徽章，不拒收。
// 注意：经 Resend 从本站域名发出的信，DKIM 的 header.d 必须是本站域名才算通过；
// Resend 里没验证本站域名的话，自己发的信也会被拒——先去 Resend 确认域名 Verified。
function checkSenderAuth(email, env) {
	const fromAddress = email.from?.address || '';
	const fromDomain = emailUtils.getDomain(fromAddress)?.toLowerCase();
	if (!fromDomain) return null;
	let ownDomains = env.domain;
	if (typeof ownDomains === 'string') {
		try { ownDomains = JSON.parse(ownDomains); } catch (e) { ownDomains = []; }
	}
	ownDomains = (Array.isArray(ownDomains) ? ownDomains : []).map(d => String(d).replace(/^@/, '').toLowerCase());
	const isOwn = ownDomains.some(d => fromDomain === d || fromDomain.endsWith('.' + d));
	if (!isOwn) return null;

	const d = parseAuthDetails(email);
	if (!d.hasHeader) {
		return 'Missing Authentication-Results for own domain';
	}
	const alignedPass =
		(d.spf === 'pass' && d.spfMailFrom === fromDomain) ||
		(d.dkim === 'pass' && d.dkimDomain === fromDomain) ||
		(d.dmarc === 'pass' && d.dmarcFrom === fromDomain);
	if (alignedPass) return null;
	return 'Sender authentication failed for own domain';
}

function checkBlock(blackSubjectStr, blackContentStr, blackFromStr, email) {

	const blackFromList = blackFromStr ? blackFromStr.split(',') : []
	const blackContentList = blackContentStr ? blackContentStr.split(',') : []
	const blackSubjectList = blackSubjectStr ? blackSubjectStr.split(',') : []

	for (const blackSubject of blackSubjectList) {
		if (email.subject?.includes(blackSubject)) {
			return true
		}
	}

	for (const blackContent of blackContentList) {
		if (email.html?.includes(blackContent) || email.text?.includes(blackContent)) {
			return true
		}
	}

	for (const blackFrom of blackFromList) {
		if (email.from.address === blackFrom || emailUtils.getDomain(email.from.address) === blackFrom) {
			return true
		}
	}

	return false

}
