(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var fail = style.getPropertyValue('--bad').trim();

  var charts = [];

  // --- Chart: 14 维结果分布 ---
  var dimNames = [
    '答案正确', '唯一性', '条件充分性', '图形一致性', '数学表达',
    'X1 年级适配', 'X2 知识点对齐', 'X3 干扰项质量', 'X4 解析质量',
    'X5 题型-答案形式', 'X6 单位与量纲', 'X7 数据自洽',
    'X8 难度一致性', 'X9 语言与格式'
  ];
  var pass = [1485, 1555, 1563, 624, 1561, 1556, 458, 329, 1263, 1058, 182, 1547, 1553, 1547];
  var watch = [0, 7, 3, 26, 0, 10, 11, 46, 294, 7, 0, 19, 13, 19];
  var failed = [0, 0, 0, 59, 5, 0, 0, 0, 9, 0, 0, 0, 0, 0];
  var other = [81, 4, 0, 857, 0, 0, 1097, 1191, 0, 501, 1384, 0, 0, 0];

  var chartDims = echarts.init(document.getElementById('chart-dims'), null, { renderer: 'svg' });
  chartDims.setOption({
    animation: false,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
    legend: { top: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: ink, fontSize: 12 } },
    grid: { left: 136, right: 24, top: 40, bottom: 24 },
    xAxis: {
      type: 'value',
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } },
      axisLine: { lineStyle: { color: rule } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: dimNames,
      axisLabel: { color: ink, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    series: [
      {
        name: 'PASS', type: 'bar', stack: 'total', data: pass,
        itemStyle: { color: accent },
        emphasis: { itemStyle: { color: accent } }
      },
      {
        name: 'WATCH', type: 'bar', stack: 'total', data: watch,
        itemStyle: { color: accent2 },
        emphasis: { itemStyle: { color: accent2 } }
      },
      {
        name: 'FAIL', type: 'bar', stack: 'total', data: failed,
        itemStyle: { color: fail },
        emphasis: { itemStyle: { color: fail } }
      },
      {
        name: 'NA / UNVERIFIED', type: 'bar', stack: 'total', data: other,
        itemStyle: { color: rule },
        emphasis: { itemStyle: { color: rule } }
      }
    ]
  });
  charts.push(chartDims);

  // --- Chart: 各年级题量与硬缺陷行 ---
  var chartGrade = echarts.init(document.getElementById('chart-grade'), null, { renderer: 'svg' });
  chartGrade.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    legend: { top: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: ink, fontSize: 12 } },
    grid: { left: 44, right: 44, top: 40, bottom: 28 },
    xAxis: {
      type: 'category',
      data: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value', name: '题量', nameTextStyle: { color: muted, fontSize: 10 },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule } },
        axisLine: { show: false }
      },
      {
        type: 'value', name: '硬缺陷行', nameTextStyle: { color: muted, fontSize: 10 },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { show: false },
        axisLine: { show: false }
      }
    ],
    series: [
      {
        name: '题量', type: 'bar', barWidth: '46%',
        data: [155, 249, 299, 296, 336, 231],
        itemStyle: { color: accent },
        emphasis: { itemStyle: { color: accent } }
      },
      {
        name: '硬缺陷行', type: 'line', yAxisIndex: 1, symbolSize: 7,
        data: [12, 9, 6, 8, 11, 5],
        lineStyle: { color: accent2, width: 2 },
        itemStyle: { color: accent2 }
      }
    ]
  });
  charts.push(chartGrade);

  // --- Chart: 七类题型分布 ---
  var chartType = echarts.init(document.getElementById('chart-type'), null, { renderer: 'svg' });
  chartType.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: ink, fontSize: 11 } },
    color: [accent, accent2, accent + '99', accent2 + '99', muted, accent + '55', accent2 + '55'],
    series: [{
      name: '题型',
      type: 'pie',
      radius: ['38%', '62%'],
      center: ['50%', '44%'],
      label: { color: ink, fontSize: 11, formatter: '{b}\n{c}' },
      data: [
        { name: 'fill 填空', value: 375 },
        { name: 'choice 选择', value: 375 },
        { name: 'apply 应用', value: 375 },
        { name: 'calc 计算', value: 193 },
        { name: 'judge 判断', value: 122 },
        { name: 'geometry 几何', value: 101 },
        { name: 'classify 分类', value: 25 }
      ]
    }]
  });
  charts.push(chartType);

  // --- Chart: 选择题正确选项位置分布 ---
  var chartChoice = echarts.init(document.getElementById('chart-choice'), null, { renderer: 'svg' });
  chartChoice.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true },
    grid: { left: 48, right: 24, top: 24, bottom: 28 },
    xAxis: {
      type: 'category',
      data: ['A（索引 0）', 'B（索引 1）', 'C（索引 2）', 'D（索引 3）', '其他（索引 5）'],
      axisLabel: { color: muted, fontSize: 11 },
      axisLine: { lineStyle: { color: rule } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } },
      axisLine: { show: false }
    },
    series: [{
      name: '题量', type: 'bar', barWidth: '48%',
      data: [
        { value: 80, itemStyle: { color: accent + '80' } },
        { value: 90, itemStyle: { color: accent + '80' } },
        { value: 87, itemStyle: { color: accent + '80' } },
        { value: 116, itemStyle: { color: accent } },
        { value: 2, itemStyle: { color: accent2 } }
      ],
      label: { show: true, position: 'top', color: ink, fontSize: 11 }
    }]
  });
  charts.push(chartChoice);

  window.addEventListener('resize', function () {
    charts.forEach(function (c) { c.resize(); });
  });
})();
