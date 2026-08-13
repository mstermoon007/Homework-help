/**
 * shared/math-knowledge.js — 数学知识点知识库（内部结构）
 *
 * 将各年级数学知识点按三大领域组织，供题型选择页、插件开发与
 * 练习设计参考。领域 id 与插件 category 对齐：
 *   number（数与代数）/ geometry（图形与几何）/ statistics（统计与概率）
 *
 * 数据结构：
 *   MATH_KNOWLEDGE.grades[n] -> { name, domains: [ { id, name, icon, topics: [...] } ] }
 *   topic: { name, points: string[] }  （points 为该知识点下的细分条目）
 *
 * 浏览器：<script src="shared/math-knowledge.js"></script>  -> 全局 MathKnowledge
 * Node：  const MathKnowledge = require('./shared/math-knowledge.js')
 */
(function (global) {
  'use strict';

  var GRADES = {

    // ============ 一年级 ============
    1: {
      name: '一年级',
      domains: [
        {
          id: 'number',
          name: '数与代数',
          icon: '🔢',
          topics: [
            { name: '数的认识', points: ['数数', '顺序', '组成', '数位', '比大小'] },
            { name: '20 以内加减法', points: [] },
            { name: '凑十法', points: ['凑十法', '平十法', '破十法'] },
            { name: '连加连减', points: [] },
            { name: '加减混合', points: [] },
            { name: '认识钟表', points: ['整时'] },
            { name: '认识人民币', points: ['认识面值', '元角分换算', '简单计算'] },
            { name: '找规律', points: ['数字规律', '图形规律'] },
            { name: '看图列式', points: [] },
            { name: '解决问题', points: ['加法', '减法', '相差', '连加连减', '多余条件'] }
          ]
        },
        {
          id: 'geometry',
          name: '图形与几何',
          icon: '📐',
          topics: [
            { name: '认识立体图形', points: ['长方体', '正方体', '圆柱', '球'] },
            { name: '认识平面图形', points: [] },
            { name: '图形拼组', points: [] },
            { name: '上下左右位置', points: [] }
          ]
        },
        {
          id: 'statistics',
          name: '统计与概率',
          icon: '📊',
          topics: [
            { name: '分类与整理', points: ['按形状分类', '按颜色分类', '按用途分类'] },
            { name: '填写简单统计表', points: [] },
            { name: '象形统计图', points: ['涂色制作象形统计图'] }
          ]
        }
      ]
    },

    // ============ 二年级 ============
    2: {
      name: '二年级',
      domains: [
        {
          id: 'number',
          name: '数与代数',
          icon: '🔢',
          topics: [
            { name: '100 以内加减法', points: ['进位加法', '退位减法', '竖式计算'] },
            { name: '表内乘除法', points: ['乘法口诀', '表内乘法', '表内除法', '用乘法口诀求商'] },
            { name: '混合运算', points: ['加减混合', '乘加乘减', '两步运算'] },
            { name: '有余数除法', points: ['有余数的除法', '余数与除数的关系'] },
            { name: '万以内数的认识', points: ['读写', '组成', '近似数', '数位顺序'] },
            { name: '整百整千数加减', points: [] },
            { name: '克与千克', points: ['认识质量单位', '克与千克换算'] },
            { name: '常见的量', points: ['时间', '长度单位应用'] },
            { name: '找规律', points: ['数字规律'] }
          ]
        },
        {
          id: 'geometry',
          name: '图形与几何',
          icon: '📐',
          topics: [
            { name: '长度单位', points: ['厘米', '米', '毫米', '分米', '千米', '单位换算'] },
            { name: '角的初步认识', points: ['锐角', '直角', '钝角'] },
            { name: '图形的运动', points: ['平移', '旋转'] },
            { name: '在方格纸上画简单图形', points: [] },
            { name: '从不同方向观察物体', points: ['简单三视图雏形'] }
          ]
        },
        {
          id: 'statistics',
          name: '统计与概率',
          icon: '📊',
          topics: [
            { name: '数据收集与整理', points: ['正字统计法', '简单统计表'] },
            { name: '根据统计结果提出建议', points: [] },
            { name: '数学广角', points: ['简单逻辑推理', '数独启蒙'] }
          ]
        }
      ]
    },

    // ============ 三年级 ============
    3: {
      name: '三年级',
      domains: [
        {
          id: 'number',
          name: '数与代数',
          icon: '🔢',
          topics: [
            { name: '时分秒', points: ['时间单位', '经过时间计算'] },
            { name: '万以内的加减法', points: ['不进位/进位加法', '不退位/退位减法', '验算'] },
            { name: '倍的认识', points: ['求一个数是另一个数的几倍', '求一个数的几倍是多少'] },
            { name: '多位数乘一位数', points: ['口算', '笔算', '估算'] },
            { name: '分数的初步认识', points: ['认识几分之一/几分之几', '分数比大小', '同分母分数加减'] },
            { name: '除数是一位数的除法', points: ['口算除法', '笔算除法', '商中间/末尾有0'] },
            { name: '两位数乘两位数', points: ['口算乘法', '笔算乘法'] },
            { name: '小数的初步认识', points: ['读写小数', '比较大小', '简单加减'] },
            { name: '年月日', points: ['大月小月', '平年闰年', '日历阅读', '经过天数计算'] },
            { name: '搭配问题', points: ['数学广角：排列组合'] }
          ]
        },
        {
          id: 'geometry',
          name: '图形与几何',
          icon: '📐',
          topics: [
            { name: '测量', points: ['长度单位：毫米、分米、千米', '质量单位：吨', '单位换算与填单位'] },
            { name: '长方形和正方形的周长', points: ['周长含义', '周长计算', '靠墙围栏等实际问题'] },
            { name: '面积', points: ['面积单位', '长方形、正方形面积计算'] },
            { name: '位置与方向', points: ['东、南、西、北', '东南、西南、东北、西北'] }
          ]
        },
        {
          id: 'statistics',
          name: '统计与概率',
          icon: '📊',
          topics: [
            { name: '简单的数据统计', points: ['复式统计表阅读与填写'] },
            { name: '集合思想', points: ['数学广角：集合重叠问题'] }
          ]
        }
      ]
    }

    // ============ 后续年级：4 年级及以后在此追加 ============
  };

  global.MathKnowledge = {
    subject: 'math',
    grades: GRADES,
    /** 获取指定年级的知识结构，无则返回 null */
    getGrade: function (g) { return GRADES[g] || null; },
    /** 获取某领域下的知识点列表（topic 名） */
    topicNames: function (g, domainId) {
      var gd = GRADES[g];
      if (!gd) return [];
      var d = gd.domains.filter(function (x) { return x.id === domainId; })[0];
      return d ? d.topics.map(function (t) { return t.name; }) : [];
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.MathKnowledge;

})(typeof window !== 'undefined' ? window : globalThis);
