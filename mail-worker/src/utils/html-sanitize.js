import { parseHTML } from 'linkedom';

// 服务端邮件正文清洗（白名单制）：Telegram View 页和任何服务端渲染入口都用它，
// 不要只删 <script>——img onerror、svg onload、javascript: 链接、iframe srcdoc 都能跑脚本。
// 做法：只留安全标签和安全属性，其余标签整段删，事件属性、危险 URL 一律去掉。
// 注意：这只是第一层，Telegram View 页还把正文放进沙箱 iframe（不给脚本权限）做第二层。

// 整段删掉的标签（里面的东西是代码或活动内容，不能留）
const REMOVE_TAGS = new Set([
	'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
	'select', 'textarea', 'meta', 'link', 'base', 'title', 'svg', 'math',
	'video', 'audio', 'source', 'track', 'noscript', 'template', 'frame',
	'frameset', 'applet', 'area', 'map', 'canvas', 'param',
]);

const ALLOWED_TAGS = new Set([
	'a', 'p', 'div', 'span', 'br', 'hr',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'ul', 'ol', 'li', 'dl', 'dt', 'dd',
	'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
	'img', 'strong', 'em', 'b', 'i', 'u', 's', 'strike',
	'blockquote', 'pre', 'code', 'small', 'sub', 'sup', 'center',
]);

// 每个标签允许的属性（class 之外）；没列出的属性（包括所有 on* 事件、style 里的危险写法）都删掉
const ALLOWED_ATTRS = {
	a: new Set(['href', 'title', 'class']),
	img: new Set(['src', 'alt', 'title', 'width', 'height', 'class']),
	table: new Set(['cellpadding', 'cellspacing', 'border', 'width', 'class']),
	td: new Set(['colspan', 'rowspan', 'align', 'valign', 'width', 'class']),
	th: new Set(['colspan', 'rowspan', 'align', 'valign', 'width', 'class']),
};

function cleanUrl(value, isImage) {
	if (typeof value !== 'string') return '';
	// 去掉首尾空白和不可见控制字符（"java\tscript:" 这类绕过就靠它们）
	const v = value.trim().replace(/[\u0000-\u0020]+/g, '');
	const lower = v.toLowerCase();
	if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html')) return '';
	if (isImage) {
		// 图片只允许 http(s)、站内相对路径、{{domain}} 占位、cid 内联引用和安全的 data:image（不含 svg，svg 里能藏脚本）
		if (/^data:image\/(png|jpeg|gif|webp);/i.test(v)) return v;
		if (/^cid:/i.test(v)) return v;
		if (/^(https?:)?\/\//i.test(v) || v.startsWith('/') || v.startsWith('{{domain}}')) return v;
		return '';
	}
	// 链接允许 http(s)、mailto、tel、站内相对路径和 {{domain}} 占位
	if (/^(https?:|mailto:|tel:)/i.test(v) || v.startsWith('/') || v.startsWith('{{domain}}')) return v;
	return '';
}

function cleanStyle(value) {
	if (typeof value !== 'string') return '';
	const lower = value.toLowerCase();
	if (lower.includes('javascript:') || lower.includes('vbscript:') || lower.includes('expression(') || lower.includes('behavior:')) return '';
	return value;
}

export function sanitizeEmailHtml(html) {
	if (!html) return '';
	// linkedom 的 parseHTML 处理片段时会把内容放到 body 外面（document.body 为空），
	// 所以片段先包一层完整文档再解析，保证清洗后的内容都在 body 里
	const wrapped = /<body[\s>]/i.test(html) ? html : `<!DOCTYPE html><html><head></head><body>${html}</body></html>`;
	const { document } = parseHTML(wrapped);

	// 删注释（条件注释里能藏东西）
	(function removeComments(node) {
		for (const child of [...node.childNodes]) {
			if (child.nodeType === 8) child.remove();
			else removeComments(child);
		}
	})(document);

	const elements = [...document.querySelectorAll('*')];
	for (const el of elements) {
		if (!el.parentNode) continue; // 父级已被整段删掉的，跳过
		const tag = el.tagName.toLowerCase();
		// html/head/body 是结构标签：保留，属性全清（body 的 style 不要）
		if (tag === 'html' || tag === 'head' || tag === 'body') {
			for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
			continue;
		}
		if (REMOVE_TAGS.has(tag)) {
			// 不在白名单且是活动/代码类标签：整段删掉（script/style/iframe 里面的东西不能留）
			el.remove();
			continue;
		}
		if (!ALLOWED_TAGS.has(tag)) {
			// 只是排版类标签（如 font/section/article）：剥掉标签留内容
			while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
			el.remove();
			continue;
		}
		const allowed = ALLOWED_ATTRS[tag] || new Set(['class']);
		for (const attr of [...el.attributes]) {
			const name = attr.name.toLowerCase();
			if (name.startsWith('on') || !allowed.has(name) && name !== 'style') {
				el.removeAttribute(attr.name);
				continue;
			}
			if (name === 'style') {
				const cleaned = cleanStyle(attr.value);
				if (cleaned) el.setAttribute(attr.name, cleaned);
				else el.removeAttribute(attr.name);
				continue;
			}
			if (name === 'href') {
				const cleaned = cleanUrl(attr.value, false);
				if (cleaned) el.setAttribute(attr.name, cleaned);
				else el.removeAttribute(attr.name);
				continue;
			}
			if (name === 'src') {
				const cleaned = cleanUrl(attr.value, true);
				if (cleaned) el.setAttribute(attr.name, cleaned);
				else el.removeAttribute(attr.name);
				continue;
			}
		}
		if (tag === 'a') {
			el.setAttribute('target', '_blank');
			el.setAttribute('rel', 'noopener noreferrer');
		}
	}

	return document.toString();
}

export default sanitizeEmailHtml;
