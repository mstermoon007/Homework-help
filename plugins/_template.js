// @ts-check
/// <reference path="../shared/plugin-types.js" />
// 依赖 shared/common.js 提供的全局 PluginUtil（随机/标准化），请先加载。

/**
 * @type {ExercisePlugin}
 */
const plugin = {
  id: 'template-demo',
  name: '样板插件（5以内加法）',
  grades: [1],
  subject: 'math',

  generate(options = {}) {
    // 随机数统一走 shared/common.js 的 PluginUtil（CONTRIBUTING.md 规则）
    const count = options.count || 10;
    const questions = [];
    for (let i = 0; i < count; i++) {
      const a = PluginUtil.randInt(1, 5);
      const b = PluginUtil.randInt(1, 6 - a); // 确保和 <=5
      // 标准题目对象：必须包含 render() 与 answer，容器可统一渲染/判定任意题型
      questions.push({
        type: 'template-demo',
        a,
        b,
        answer: a + b,
        render: function (idx) {
          return `
            <div class="question-card" data-index="${idx}">
              <span class="q-num">${idx + 1}.</span>
              <span>${this.a} + ${this.b} = </span>
              <input type="number" class="answer-input" data-index="${idx}">
            </div>`;
        },
        check: function (userAnswers, idx) {
          return Number(userAnswers[idx]) === this.a + this.b;
        }
      });
    }
    return {
      questions,
      meta: { grade: 1, count }
    };
  },

  render(exerciseSet) {
    let html = '<div class="questions-grid">';
    exerciseSet.questions.forEach((q, idx) => {
      html += q.render(idx);
    });
    html += '</div>';
    return html;
  },

  check(exerciseSet, userAnswers) {
    let correct = 0;
    const results = [];
    const correctAnswers = [];
    exerciseSet.questions.forEach((q, idx) => {
      const isRight = q.check ? q.check(userAnswers, idx) : (Number(userAnswers[idx]) === q.answer);
      if (isRight) correct++;
      results.push(isRight);
      correctAnswers.push(String(q.answer));
    });
    const score = Math.round((correct / exerciseSet.questions.length) * 100);
    let message = '继续加油！';
    if (score === 100) message = '太棒了！全对！';
    else if (score >= 80) message = '很不错！';
    return {
      score,
      total: exerciseSet.questions.length,
      correct,
      message,
      results,
      correctAnswers
    };
  }
};

// 若支持模块导出，可在此处导出；否则直接挂载到全局
if (typeof module !== 'undefined' && module.exports) {
  module.exports = plugin;
} else {
  window.__currentPlugin = plugin;
}