<template>
  <div class="content-box" ref="contentBox">
    <!-- 邮件正文跑在沙箱 iframe 里：不给 allow-scripts / allow-forms / allow-top-navigation，
         即使哪天 DOMPurify 被绕过，里面的脚本也跑不起来，读不到主站的 Cookie / localStorage。
         只给 allow-same-origin（父页面要读内容高度来自适应），不给脚本就仍然是安全的；
         allow-popups 是让正文里的链接能在新标签页打开 -->
    <iframe
      ref="iframeRef"
      class="content-frame"
      sandbox="allow-same-origin allow-popups"
      :srcdoc="srcdoc"
      :style="{ height: frameHeight + 'px' }"
      title="email content"
    ></iframe>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { sanitizeEmailHtml } from '@/utils/email-html.js'

const props = defineProps({
  html: {
    type: String,
    required: true
  }
})

const iframeRef = ref(null)
const contentBox = ref(null)
const frameHeight = ref(400)
let resizeObserver = null

// 再洗一次（调用方在 store 里已经洗过一次，这里是纵深防御），
// 然后用 DOMParser 拆出 <head> 里的 <style> 和 <body> 内容重组：
// <body> 的 style 属性直接丢掉——旧版把它拼进 <style> 块是注入点，现在不要了
const srcdoc = computed(() => {
  const sanitized = sanitizeEmailHtml(props.html || '')
  if (!sanitized) return ''
  const doc = new DOMParser().parseFromString(sanitized, 'text/html')
  const headStyles = [...doc.querySelectorAll('head style')].map(el => el.outerHTML).join('')
  const bodyHtml = doc.body ? doc.body.innerHTML : sanitized
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">` +
    `<style>` +
    `body{margin:0;padding:0;font-family:Inter,'Helvetica Neue',Helvetica,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','微软雅黑',Arial,sans-serif;font-size:14px;line-height:1.5;color:#13181D;word-break:break-word;background:#FFFFFF;}` +
    `h1,h2,h3,h4{font-size:18px;font-weight:700;}` +
    `p{margin:0;}` +
    `a{text-decoration:none;color:#0E70DF;}` +
    `img:not(table img){max-width:100%;height:auto !important;}` +
    `</style>${headStyles}</head><body>${bodyHtml}</body></html>`
})

function updateHeight() {
  const iframe = iframeRef.value
  if (!iframe) return
  try {
    const doc = iframe.contentDocument
    if (!doc) return
    const h = Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0)
    if (h > 0) frameHeight.value = h
  } catch (e) {
    // 跨域拿不到高度时保持默认高度，iframe 内部自己滚动
  }
}

function observeContent() {
  const iframe = iframeRef.value
  if (!iframe) return
  try {
    const doc = iframe.contentDocument
    if (!doc?.body) return
    resizeObserver?.disconnect()
    resizeObserver = new ResizeObserver(() => updateHeight())
    resizeObserver.observe(doc.body)
    resizeObserver.observe(doc.documentElement)
  } catch (e) {
    // 拿不到就只靠 load 时量一次
  }
}

function onFrameLoad() {
  updateHeight()
  observeContent()
  // 图片后加载会撑高，下一帧再量一次
  requestAnimationFrame(() => updateHeight())
}

onMounted(() => {
  iframeRef.value?.addEventListener('load', onFrameLoad)
  nextTick(() => updateHeight())
})

onBeforeUnmount(() => {
  iframeRef.value?.removeEventListener('load', onFrameLoad)
  resizeObserver?.disconnect()
})

watch(() => props.html, () => {
  nextTick(() => updateHeight())
})
</script>

<style scoped>
.content-box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: Inter, "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}

.content-frame {
  width: 100%;
  border: 0;
  display: block;
  background: #FFFFFF;
}
</style>
