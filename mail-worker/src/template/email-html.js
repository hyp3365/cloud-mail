import { parseHTML } from 'linkedom';
import domainUtils from '../utils/domain-uitls';
import { sanitizeEmailHtml } from '../utils/html-sanitize';

// Telegram View 页：正文先经白名单清洗（只留安全标签/属性，脚本、事件、javascript: 链接全删），
// 再放进沙箱 iframe（sandbox="allow-same-origin allow-popups"，不给脚本权限）渲染——
// 即使清洗被绕过，里面的脚本也跑不起来，读不到主站的 Cookie / localStorage。
// 旧版只删 <script> 再用 Shadow DOM innerHTML 渲染，img onerror / svg onload / iframe srcdoc 都能跑脚本。
export default function emailHtmlTemplate(html, domain) {

	const sanitized = sanitizeEmailHtml(html || '');
	const { document } = parseHTML(sanitized);
	const headStyles = [...document.querySelectorAll('head style')].map(el => el.outerHTML).join('');
	const bodyHtml = document.body ? document.body.innerHTML : sanitized;
	const bodyWithDomain = bodyHtml.replace(/{{domain}}/g, domainUtils.toOssDomain(domain) + '/');
	const bodyJson = JSON.stringify(bodyWithDomain).replace(/</g, '\\u003C');
	const stylesJson = JSON.stringify(headStyles).replace(/</g, '\\u003C');

	return `<!DOCTYPE html>
<html lang='en' >
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            background: #FFF;
        }

        .content-box {
        		padding: 15px 10px;
            width: 100%;
            height: 100%;
            overflow: auto;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .content-frame {
            width: 100%;
            border: 0;
            display: block;
            background: #FFFFFF;
        }
    </style>
</head>
<body>
    <div class='content-box'>
        <iframe id='content-frame' class='content-frame' sandbox='allow-same-origin allow-popups' title='email content'></iframe>
    </div>

    <script>
        // 正文以 srcdoc 交给沙箱 iframe；iframe 里没有脚本权限，父页面只读高度来自适应
        const bodyHtml = ${bodyJson};
        const headStyles = ${stylesJson};
        const doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">' +
            '<style>' +
            'body{margin:0;padding:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.5;color:#13181D;word-break:break-word;background:#FFFFFF;}' +
            'h1,h2,h3,h4{font-size:18px;font-weight:700;}' +
            'p{margin:0;}' +
            'a{text-decoration:none;color:#0E70DF;}' +
            'img:not(table img){max-width:100%;height:auto !important;}' +
            '</style>' + headStyles + '</head><body>' + bodyHtml + '</body></html>';

        const frame = document.getElementById('content-frame');
        frame.srcdoc = doc;

        function updateHeight() {
            try {
                const d = frame.contentDocument;
                if (!d) return;
                const h = Math.max(d.documentElement.scrollHeight || 0, d.body.scrollHeight || 0);
                if (h > 0) frame.style.height = h + 'px';
            } catch (e) {
                // 拿不到高度时保持默认，iframe 内部自己滚动
            }
        }

        frame.addEventListener('load', () => {
            updateHeight();
            requestAnimationFrame(updateHeight);
        });
    </script>
</body>
</html>`
}
