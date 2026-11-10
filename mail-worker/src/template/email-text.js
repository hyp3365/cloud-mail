export default function emailTextTemplate(text) {
	// 纯文本也要转义：text/plain 里也能藏 <img onerror> 这类 HTML，直接插进页面会执行
	const escaped = String(text || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
	return `<!DOCTYPE html>
<html lang='en' >
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        html {
            margin: 0;
            padding: 0;
            background: #FFF;
        }

        body {
        		box-sizing: border-box;
        		margin: 0;
        		padding: 10px 10px;
            width: 100%;
            height: 100%;
            overflow: auto; /* 改为 auto 允许滚动 */
        }

        span {
        		font-family: inherit;
						white-space: pre-wrap;
						word-break: break-word;
        }

    </style>
</head>
<body>
<span>${escaped}</span>
</body>
</html>`
}
