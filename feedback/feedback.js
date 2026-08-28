// feedback.js - 完全独立，GitHub Pages 兼容（无服务端函数依赖）
(function () {
  const form = document.getElementById('feedback-form');
  const subjectInput = document.getElementById('subject');
  const descInput = document.getElementById('description');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const submitBtn = document.getElementById('submit-btn');
  const submitStatus = document.getElementById('submit-status');

  // GitHub 兼容配置：
  //  - 留空 ''          → 使用 mailto 兜底（直接调起邮件客户端发到 FALLBACK_EMAIL，纯静态可用）
  //  - 填静态表单服务地址 → 通过 fetch POST 提交（如 Formspree: https://formspree.io/f/<ID>
  //                        Getform: https://getform.io/f/<ID>，均原生支持图片附件邮件）
  const FEEDBACK_ENDPOINT = '';
  const FALLBACK_EMAIL = '317411213@qq.com';

  const MAX_IMAGES = 5;
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  let imageFiles = []; // 存储待上传的图片文件

  // ========== 点击 drop-zone 触发文件选择 ==========
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(addImage);
    fileInput.value = ''; // 清空以便重复选择
  });

  // ========== 拖拽上传 ==========
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(addImage);
  });

  // ========== Ctrl+V 粘贴截图 ==========
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        blob.name = `paste-${Date.now()}.png`;
        addImage(blob);
      }
    }
  });

  // ========== 添加图片 ==========
  function addImage(file) {
    if (imageFiles.length >= MAX_IMAGES) {
      showStatus('最多上传 ' + MAX_IMAGES + ' 张图片', 'error');
      return;
    }
    if (file.size > MAX_SIZE) {
      showStatus('图片超过 2MB 限制', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showStatus('仅支持图片文件', 'error');
      return;
    }

    imageFiles.push(file);
    renderPreview(file, imageFiles.length - 1);
  }

  // ========== 渲染预览 ==========
  function renderPreview(file, index) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML = `
        <img src="${e.target.result}" alt="预览图">
        <button type="button" class="remove-btn" data-index="${index}">×</button>
      `;
      item.querySelector('.remove-btn').addEventListener('click', () => {
        removeImage(index);
      });
      previewContainer.appendChild(item);
    };
    reader.readAsDataURL(file);
  }

  // ========== 删除图片 ==========
  function removeImage(index) {
    imageFiles.splice(index, 1);
    refreshPreview();
  }

  function refreshPreview() {
    previewContainer.innerHTML = '';
    imageFiles.forEach((file, i) => renderPreview(file, i));
  }

  // ========== 构建表单数据 ==========
  function buildFormData(subject, description, page, timestamp) {
    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('description', description);
    formData.append('page', page);
    formData.append('timestamp', timestamp);
    imageFiles.forEach((file, i) => {
      formData.append(`images[${i}]`, file, file.name || `screenshot-${i}.png`);
    });
    return formData;
  }

  // ========== mailto 兜底 ==========
  function mailtoFallback(subject, description, page, timestamp) {
    const body = [
      '主题：' + subject,
      '页面：' + page,
      '时间：' + timestamp,
      '',
      '问题描述：',
      description || '(无)',
      '',
      '（如已在上方粘贴截图，请将其手动粘贴到本邮件中作为附件发送）'
    ].join('\n');
    const mail = 'mailto:' + FALLBACK_EMAIL +
      '?subject=' + encodeURIComponent('[问题反馈] ' + subject) +
      '&body=' + encodeURIComponent(body);
    window.location.href = mail;
  }

  // ========== 表单提交 ==========
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = subjectInput.value.trim();
    if (!subject) {
      showStatus('请填写主题', 'error');
      subjectInput.focus();
      return;
    }

    const description = descInput.value.trim();
    const page = location.href;
    const timestamp = new Date().toISOString();

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    showStatus('', '');

    if (FEEDBACK_ENDPOINT) {
      const formData = buildFormData(subject, description, page, timestamp);
      try {
        const response = await fetch(FEEDBACK_ENDPOINT, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: formData
        });
        let result = {};
        try { result = await response.json(); } catch (_) { /* 忽略非 JSON 响应 */ }

        if (response.ok && (result.ok || result.success)) {
          showStatus('✅ 反馈已提交，感谢您的帮助！', 'success');
          form.reset();
          imageFiles = [];
          previewContainer.innerHTML = '';
        } else {
          mailtoFallback(subject, description, page, timestamp);
          showStatus('在线提交失败，已为您打开邮件客户端，请发送', 'error');
        }
        return;
      } catch (err) {
        console.error('Feedback submit error:', err);
        mailtoFallback(subject, description, page, timestamp);
        showStatus('网络错误，已为您打开邮件客户端，请发送', 'error');
        return;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交反馈';
      }
    }

    // 无端点：直接 mailto 兜底
    mailtoFallback(subject, description, page, timestamp);
    showStatus('已为您打开邮件客户端，请发送反馈（截图请手动粘贴附件）', 'success');
    form.reset();
    imageFiles = [];
    previewContainer.innerHTML = '';
    submitBtn.disabled = false;
    submitBtn.textContent = '提交反馈';
  });

  // ========== 状态显示 ==========
  function showStatus(message, type) {
    submitStatus.textContent = message;
    submitStatus.className = 'submit-status' + (type ? ' ' + type : '');
  }
})();
