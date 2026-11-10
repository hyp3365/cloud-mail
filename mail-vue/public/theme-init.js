// 在应用加载前按保存的主题设置深色模式，避免白屏闪烁。
// 单独放一个文件是为了让 CSP 可以去掉 script-src 'unsafe-inline'。
const uiStoreStr = localStorage.getItem('ui')
let isDark = false
if (uiStoreStr) {
  const uiStore = JSON.parse(uiStoreStr)
  isDark = uiStore.dark
  const root = document.documentElement
  root.setAttribute('class', isDark ? 'dark' : '');
}
const metaTag = document.getElementById('theme-color-meta');
const isMobile = !window.matchMedia("(pointer: fine) and (hover: hover)").matches;
metaTag.setAttribute('content', isDark ? (isMobile ? '#141414' : '#000000') : (isMobile ? '#191A23' : '#F1F1F1'))
