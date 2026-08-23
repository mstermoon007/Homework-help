/**
 * shared/knowledge-bank.js — 数学知识库（统一结构，1-6 年级）
 *
 * 数据结构：
 *   KnowledgeBank = [
 *     {
 *       grade: 1,
 *       modules: [
 *         {
 *           moduleId: 'M0',                 // 对应 shared/module-catalog.js 中的题型模块 ID
 *           knowledgePoints: [
 *             { id, name, pluginId, weight, type }
 *             // weight：抽题比例权重（综合练习按此分配题量），也用于题型选择页排序
 *             // type：推荐传给插件 generate 的 opts.type（细分子题型），省略则用插件默认
 *           ]
 *         }
 *       ]
 *     },
 *     // grade 2, 3, ... 后续自动追加
 *   ]
 *
 * 浏览器：<script src="shared/knowledge-bank.js"></script> -> 全局 KnowledgeBank（数组）
 * Node：  const KnowledgeBank = require('./shared/knowledge-bank.js')
 *
 * 便捷查询（挂在数组对象上）：
 *   KnowledgeBank.findGrade(g)                    -> 该年级对象（{grade, modules}）或 null
 *   KnowledgeBank.getEntries(subject, grade)      -> 扁平知识点数组 [{id,name,pluginId,moduleId,weight,type}]
 *   KnowledgeBank.getCoverage(subject, grade, ids)-> 覆盖统计（ids 为已注册且适用该年级的插件 id 集合）
 *   KnowledgeBank.coverageFromRegistry(...)       -> 同上，但自动从注册表提取覆盖插件 id
 *
 * weight 由旧数据结构中的 importance 映射得到：
 *   importance 5 / 4 -> weight 3，3 / 2 -> weight 2，1 -> weight 1
 *   （importance 代表课时占比/重要度，weight 用于抽题比例，取小量级便于展示与排序）
 */
(function (global) {
  'use strict';

  var KnowledgeBank = [
    // ========== 年级1 ==========
    {
      grade: 1,
      modules: [
        {
          moduleId: "M0",
          knowledgePoints: [
            {
              id: "g1-m0-make-ten",
              name: "凑十法",
              pluginId: "math-make-ten",
              weight: 1,
              type: "cushi",
              description: "把一个数拆成两部分，使其中一部分与另一个数凑成10，再用10加剩下的数。",
              example: "计算 9+5：把5分成1和4，9+1=10，10+4=14。",
              prerequisites: [],
              related: ["g1-m0-make-ten-ping","g1-m0-make-ten-po","g1-m1-addsub-20","g1-m4-compose-digit"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m0-make-ten-ping",
              name: "平十法",
              pluginId: "math-make-ten",
              weight: 1,
              type: "pingshi",
              description: "减法中把减数分成两部分，先用被减数减去与个位相同的部分得整十，再减剩余部分。",
              example: "15-8：把8分成5和3，15-5=10，10-3=7。",
              prerequisites: ["g1-m0-make-ten"],
              related: ["g1-m0-make-ten","g1-m0-make-ten-po"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m0-make-ten-po",
              name: "破十法",
              pluginId: "math-make-ten",
              weight: 1,
              type: "poshi",
              description: "减法中把被减数分成10和几，先用10减去减数，再加上剩下的部分。",
              example: "13-5：把13分成10和3，10-5=5，5+3=8。",
              prerequisites: ["g1-m0-make-ten"],
              related: ["g1-m0-make-ten","g1-m0-make-ten-ping"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M1",
          knowledgePoints: [
            {
              id: "g1-m1-addsub-20",
              name: "20 以内加减法",
              pluginId: "math-oral",
              weight: 3,
              type: "addsub",
              description: "在20以内进行不进位、不退位的加减计算，是口算的基础。",
              example: "13+4=?（答案：17）",
              prerequisites: ["g1-m4-count","g1-m4-compose-digit"],
              related: ["g1-m0-make-ten","g1-m7-picture-equations","g1-m8-chain-mixed","g1-m8-solve-problems"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M4",
          knowledgePoints: [
            {
              id: "g1-m4-count",
              name: "数数与顺序",
              pluginId: "math-number-sense",
              weight: 2,
              type: "count",
              description: "正确数出物体的个数，并理解数的先后顺序。",
              example: "从1数到20，第5个数是几？（答案：5）",
              prerequisites: [],
              related: ["g1-m4-compose-digit","g1-m4-compare"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m4-compose-digit",
              name: "数的组成与数位",
              pluginId: "math-number-sense",
              weight: 2,
              type: "compose",
              description: "理解一个数由几个十和几个一组成，认识个位与十位。",
              example: "17由几个十和几个一组成？（答案：1个十和7个一）",
              prerequisites: ["g1-m4-count"],
              related: ["g1-m4-count","g1-m4-compare","g1-m1-addsub-20"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m4-compare",
              name: "比大小",
              pluginId: "math-number-sense",
              weight: 2,
              type: "compare",
              description: "会比较100以内数的大小，用符号 >、<、= 表示。",
              example: "比较 15 和 12。（答案：15 > 12）",
              prerequisites: ["g1-m4-count","g1-m4-compose-digit"],
              related: ["g1-m4-compose-digit","g1-m1-addsub-20"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m4-clock-hour",
              name: "认识钟表（整时）",
              pluginId: "math-clock",
              weight: 2,
              type: "read",
              description: "能认读钟表上的整时，知道时针、分针的指向。",
              example: "分针指向12、时针指向3是几时？（答案：3时）",
              prerequisites: ["g1-m4-count"],
              related: ["g1-m4-count","g3-m4-g3-time"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m4-patterns",
              name: "找规律",
              pluginId: "math-patterns",
              weight: 2,
              type: "mix",
              description: "观察图形或数字的排列，发现并接着填出规律。",
              example: "1, 3, 5, 7, （  ）。（答案：9）",
              prerequisites: ["g1-m4-count"],
              related: ["g2-m10-logic-reasoning"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m4-money",
              name: "认识人民币",
              pluginId: "math-money",
              weight: 2,
              type: "mix",
              description: "认识元、角、分及它们之间的进率，会进行简单换算。",
              example: "1元 = ?角（答案：10角）",
              prerequisites: ["g1-m4-count","g1-m1-addsub-20"],
              related: ["g1-m1-addsub-20","g1-m4-compare"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M6",
          knowledgePoints: [
            {
              id: "g1-m6-solid-shapes",
              name: "认识立体图形",
              pluginId: "math-shapes",
              weight: 2,
              type: "solid",
              description: "认识长方体、正方体、圆柱、球等立体图形及其特征。",
              example: "下列立体图形中滚得最快的是？（答案：球）",
              prerequisites: [],
              related: ["g1-m6-flat-shapes","g1-m6-position"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m6-flat-shapes",
              name: "认识平面图形",
              pluginId: "math-shapes",
              weight: 2,
              type: "flat",
              description: "认识长方形、正方形、三角形、圆等平面图形。",
              example: "红领巾的形状是？（答案：三角形）",
              prerequisites: ["g1-m6-solid-shapes"],
              related: ["g1-m6-solid-shapes","g1-m6-shape-compose"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m6-shape-compose",
              name: "图形拼组",
              pluginId: "math-shapes",
              weight: 2,
              type: "count",
              description: "用简单图形拼出新的图形，理解图形之间的关系。",
              example: "两个完全一样的三角形可以拼成一个？（答案：平行四边形）",
              prerequisites: ["g1-m6-flat-shapes"],
              related: ["g1-m6-flat-shapes","g1-m6-solid-shapes"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m6-position",
              name: "上下左右位置",
              pluginId: "math-shapes",
              weight: 2,
              type: "position",
              description: "用上、下、左、右、前、后描述物体的相对位置。",
              example: "书本在桌子的（  ）面。（答案：上）",
              prerequisites: [],
              related: ["g1-m6-flat-shapes"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M7",
          knowledgePoints: [
            {
              id: "g1-m7-picture-equations",
              name: "看图列式",
              pluginId: "math-picture-equations",
              weight: 2,
              type: "mix",
              description: "根据图中物体的数量列出加减法算式。",
              example: "图中有3个苹果又画了2个，列式：3+2=5。",
              prerequisites: ["g1-m1-addsub-20"],
              related: ["g1-m1-addsub-20","g1-m8-chain-mixed","g1-m8-solve-problems"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M8",
          knowledgePoints: [
            {
              id: "g1-m8-chain-mixed",
              name: "连加连减与加减混合",
              pluginId: "math-word-problems",
              weight: 2,
              type: "mix",
              description: "进行连续相加或相减以及加减混合的计算。",
              example: "2+3+4=?（答案：9）",
              prerequisites: ["g1-m1-addsub-20"],
              related: ["g1-m1-addsub-20","g1-m8-solve-problems","g1-m7-picture-equations"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m8-solve-problems",
              name: "解决问题",
              pluginId: "math-word-problems",
              weight: 3,
              type: "mix",
              description: "读懂简单情境，列出算式解决一步计算的数学问题。",
              example: "小明有5支笔，又买来3支，现在有几支？（答案：8支）",
              prerequisites: ["g1-m1-addsub-20"],
              related: ["g1-m1-addsub-20","g1-m8-chain-mixed","g2-m8-solve-problems"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M9",
          knowledgePoints: [
            {
              id: "g1-m9-classify",
              name: "分类与整理",
              pluginId: "math-statistics",
              weight: 2,
              type: "classify",
              description: "按一定标准把物体分类并数出每类数量。",
              example: "把下列图形按颜色分成两类并计数。",
              prerequisites: [],
              related: ["g1-m9-stats-table","g1-m9-pictograph"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m9-stats-table",
              name: "填写简单统计表",
              pluginId: "math-statistics",
              weight: 2,
              type: "table",
              description: "把分类的结果用简单的表格记录下来。",
              example: "统计全班同学喜欢的水果并填入统计表。",
              prerequisites: ["g1-m9-classify"],
              related: ["g1-m9-classify","g1-m9-pictograph"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g1-m9-pictograph",
              name: "象形统计图",
              pluginId: "math-statistics",
              weight: 2,
              type: "picto",
              description: "用一个图形代表一个数量，画出象形统计图。",
              example: "用○表示人数，3个○表示3人。",
              prerequisites: ["g1-m9-classify","g1-m9-stats-table"],
              related: ["g1-m9-stats-table","g2-m9-data-tally"],
              difficulty: 1,
              status: "active"
            }
          ]
        }
      ]
    },
    // ========== 年级2 ==========
    {
      grade: 2,
      modules: [
        {
          moduleId: "M1",
          knowledgePoints: [
            {
              id: "g2-m1-addsub-100",
              name: "100 以内加减法",
              pluginId: "math-oral",
              weight: 3,
              type: "addsub",
              description: "掌握100以内的进位加法与退位减法。",
              example: "35+28=?（答案：63）",
              prerequisites: ["g1-m1-addsub-20"],
              related: ["g2-m1-mixed","g2-m1-muldiv","g1-m1-addsub-20"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m1-muldiv",
              name: "表内乘除法",
              pluginId: "math-oral",
              weight: 3,
              type: "muldiv",
              description: "熟记乘法口诀，进行表内乘除法计算。",
              example: "6×7=?（答案：42）",
              prerequisites: ["g1-m1-addsub-20"],
              related: ["g2-m1-addsub-100","g2-m1-mixed","g2-m1-remainder"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m1-remainder",
              name: "有余数除法",
              pluginId: "math-oral",
              weight: 3,
              type: "remainder",
              description: "理解平均分后有剩余，认识余数及有余数除法。",
              example: "10÷3=3……1，余数是？（答案：1）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g2-m1-muldiv","g2-m1-mixed","g3-m1-g3-div1"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m1-mixed",
              name: "混合运算",
              pluginId: "math-oral",
              weight: 3,
              type: "mixed",
              description: "掌握没有括号的同级或两级混合运算顺序。",
              example: "3+4×2=?（答案：11）",
              prerequisites: ["g2-m1-addsub-100","g2-m1-muldiv"],
              related: ["g2-m1-addsub-100","g2-m1-muldiv","g3-m1-g3-mul-multi1"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M4",
          knowledgePoints: [
            {
              id: "g2-m4-readwrite",
              name: "万以内数的读写",
              pluginId: "math-number-sense",
              weight: 2,
              type: "readwrite",
              description: "能正确读、写万以内的数。",
              example: "写作：三千零五。（答案：3005）",
              prerequisites: ["g1-m4-compose-digit"],
              related: ["g2-m4-compose-digit","g2-m4-approx","g4-m4-g4-fill-bignum"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m4-compose-digit",
              name: "数的组成与数位",
              pluginId: "math-number-sense",
              weight: 2,
              type: "compose",
              description: "理解万以内数的组成及个、十、百、千数位。",
              example: "4567里有几个千、几个百、几个十、几个一？",
              prerequisites: ["g1-m4-compose-digit"],
              related: ["g2-m4-readwrite","g1-m4-compose-digit"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m4-approx",
              name: "近似数",
              pluginId: "math-number-sense",
              weight: 2,
              type: "approx",
              description: "会用“约”“大概”表示接近整十、整百的数。",
              example: "298约是多少？（答案：约300）",
              prerequisites: ["g2-m4-readwrite"],
              related: ["g2-m4-readwrite"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m4-unit-convert",
              name: "单位换算",
              pluginId: "math-unit-convert",
              weight: 2,
              type: "convert",
              description: "进行长度单位间的换算。",
              example: "1米 = ?厘米（答案：100厘米）",
              prerequisites: ["g1-m4-count"],
              related: ["g2-m4-fill-unit","g3-m4-g3-measure","g6-m4-unit-convert"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m4-fill-unit",
              name: "填合适单位",
              pluginId: "math-unit-convert",
              weight: 2,
              type: "fillUnit",
              description: "根据情境选择合适的长度单位。",
              example: "课桌高约70（  ）。（答案：厘米）",
              prerequisites: ["g2-m4-unit-convert"],
              related: ["g2-m4-unit-convert"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M6",
          knowledgePoints: [
            {
              id: "g2-m6-shapes-2",
              name: "认识图形",
              pluginId: "math-shapes",
              weight: 2,
              type: "mix",
              description: "认识角、长方形、正方形等并分辨其特征。",
              example: "正方形有几条边？（答案：4条）",
              prerequisites: ["g1-m6-flat-shapes"],
              related: ["g2-m6-angles","g2-m6-motion","g2-m6-grid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m6-angles",
              name: "角的初步认识",
              pluginId: "math-geometry",
              weight: 2,
              type: "angleClass",
              description: "认识角，知道角的顶点和边等各部分名称。",
              example: "一个角有（  ）个顶点和（  ）条边。（答案：1个顶点，2条边）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g2-m6-shapes-2","g2-m6-grid","g4-m4-g4-fill-angle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m6-motion",
              name: "图形的运动",
              pluginId: "math-geometry",
              weight: 2,
              type: "motion",
              description: "认识平移和旋转等图形运动现象。",
              example: "推拉窗户属于（  ）现象。（答案：平移）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g2-m6-grid","g4-m6-g4-draw-move","g4-m6-g4-draw-sym","g5-m6-g5-draw-rotate"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m6-grid",
              name: "方格纸",
              pluginId: "math-geometry",
              weight: 2,
              type: "grid",
              description: "在方格纸上数图形或画图形。",
              example: "数出方格纸上长方形的个数。",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g2-m6-shapes-2","g2-m6-angles"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M8",
          knowledgePoints: [
            {
              id: "g2-m8-solve-problems",
              name: "解决问题",
              pluginId: "math-word-problems",
              weight: 3,
              type: "mix",
              description: "解决两步计算的实际问题。",
              example: "每盒有6块糖，3盒共几块？吃掉4块还剩几块？（答案：14块）",
              prerequisites: ["g1-m8-solve-problems","g2-m1-addsub-100"],
              related: ["g2-m1-muldiv","g2-m1-mixed","g1-m8-solve-problems"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M9",
          knowledgePoints: [
            {
              id: "g2-m9-data-tally",
              name: "数据收集与整理",
              pluginId: "math-data-stats",
              weight: 2,
              type: "tally",
              description: "用“正”字等方法收集数据并整理。",
              example: "用画“正”字的方法统计喜欢的水果。",
              prerequisites: ["g1-m9-classify"],
              related: ["g2-m9-data-question","g3-m9-g3-stats-table"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m9-data-question",
              name: "根据统计结果回答问题",
              pluginId: "math-data-stats",
              weight: 2,
              type: "result",
              description: "读取统计表或统计图，回答简单问题。",
              example: "根据统计结果，哪一类人数最多？",
              prerequisites: ["g2-m9-data-tally"],
              related: ["g2-m9-data-tally"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M10",
          knowledgePoints: [
            {
              id: "g2-m10-logic-reasoning",
              name: "简单逻辑推理",
              pluginId: "math-logic-reasoning",
              weight: 2,
              type: "bookGuess",
              description: "根据已知条件进行简单逻辑推理。",
              example: "甲比乙高，乙比丙高，谁最矮？（答案：丙）",
              prerequisites: ["g1-m4-patterns"],
              related: ["g2-m10-sudoku3","g4-m10-logic-reasoning","g5-m10-g5-reason-seq"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g2-m10-sudoku3",
              name: "3×3 数独",
              pluginId: "math-logic-reasoning",
              weight: 1,
              type: "sudoku3",
              description: "在3×3格中填入1-3，使每行、每列数字不重复。",
              example: "完成给定部分数字的3×3数独。",
              prerequisites: ["g2-m10-logic-reasoning"],
              related: ["g2-m10-logic-reasoning"],
              difficulty: 1,
              status: "active"
            }
          ]
        }
      ]
    },
    // ========== 年级3 ==========
    {
      grade: 3,
      modules: [
        {
          moduleId: "M1",
          knowledgePoints: [
            {
              id: "g3-m1-g3-add-sub-wan",
              name: "万以内的加减法",
              pluginId: "math-oral",
              weight: 3,
              type: "addsub",
              description: "掌握万以内的进位加法与退位减法。",
              example: "3456+2789=?（答案：6245）",
              prerequisites: ["g2-m1-addsub-100"],
              related: ["g3-m1-g3-mul-multi1","g3-m1-g3-mul-2digit","g4-m1-g4-oral-big"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m1-g3-mul-multi1",
              name: "多位数乘一位数",
              pluginId: "math-oral",
              weight: 3,
              type: "multi1",
              description: "掌握多位数乘一位数的笔算方法。",
              example: "234×3=?（答案：702）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g3-m1-g3-mul-2digit","g3-m1-g3-div1"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m1-g3-div1",
              name: "除数是一位数的除法",
              pluginId: "math-oral",
              weight: 3,
              type: "div1",
              description: "掌握一位数除多位数的笔算方法。",
              example: "96÷3=?（答案：32）",
              prerequisites: ["g2-m1-muldiv","g2-m1-remainder"],
              related: ["g3-m1-g3-mul-multi1","g4-m2-g4-v-div2"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m1-g3-mul-2digit",
              name: "两位数乘两位数",
              pluginId: "math-oral",
              weight: 3,
              type: "twodigit",
              description: "掌握两位数乘两位数的笔算方法。",
              example: "23×12=?（答案：276）",
              prerequisites: ["g3-m1-g3-mul-multi1"],
              related: ["g3-m1-g3-mul-multi1","g4-m2-g4-v-mul3x2"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M4",
          knowledgePoints: [
            {
              id: "g3-m4-g3-fraction",
              name: "分数的初步认识",
              pluginId: "math-fraction",
              weight: 3,
              type: "shard",
              description: "认识几分之一和几分之几，会读会写分数。",
              example: "把一个披萨平均分成4份，每份是它的（  ）。（答案：1/4）",
              prerequisites: ["g2-m1-muldiv","g2-m1-remainder"],
              related: ["g3-m4-g3-decimal","g5-m4-g5-fill-fracmean","g4-m5-g4-match-decfrac"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m4-g3-decimal",
              name: "小数的初步认识",
              pluginId: "math-decimal",
              weight: 3,
              type: "read",
              description: "认识小数，会读写小数并与元角分联系。",
              example: "0.5元 = ?角（答案：5角）",
              prerequisites: ["g2-m1-addsub-100"],
              related: ["g3-m4-g3-fraction","g4-m4-g4-fill-dec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m4-g3-time",
              name: "时、分、秒",
              pluginId: "math-time-date",
              weight: 2,
              type: "clockFace",
              description: "认识时间单位时、分、秒及其进率。",
              example: "1分 = ?秒（答案：60秒）",
              prerequisites: ["g1-m4-clock-hour"],
              related: ["g3-m4-g3-year-month"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m4-g3-year-month",
              name: "年、月、日",
              pluginId: "math-time-date",
              weight: 2,
              type: "ym",
              description: "认识年、月、日，知道大月小月及天数。",
              example: "一年有几个月？（答案：12个月）",
              prerequisites: ["g3-m4-g3-time"],
              related: ["g3-m4-g3-time"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m4-g3-measure",
              name: "测量",
              pluginId: "math-unit-convert",
              weight: 2,
              type: "mix",
              description: "用毫米、分米、千米等长度单位进行测量。",
              example: "字典厚约4（  ）。（答案：厘米或毫米）",
              prerequisites: ["g2-m4-unit-convert"],
              related: ["g2-m4-fill-unit","g4-m4-g4-fill-hectare"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M6",
          knowledgePoints: [
            {
              id: "g3-m6-g3-perimeter",
              name: "长方形正方形的周长",
              pluginId: "math-geometry",
              weight: 2,
              type: "perimeter",
              description: "理解周长的含义，会计算长方形、正方形的周长。",
              example: "边长5厘米的正方形周长是多少？（答案：20厘米）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g3-m6-g3-area","g4-c4-c4-pa"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m6-g3-area",
              name: "面积",
              pluginId: "math-area",
              weight: 3,
              type: "rect",
              description: "认识面积，会用面积单位度量平面图形大小。",
              example: "边长为1厘米的正方形面积是？（答案：1平方厘米）",
              prerequisites: ["g3-m6-g3-perimeter"],
              related: ["g3-m6-g3-perimeter","g5-m4-g5-fill-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m6-g3-position",
              name: "位置与方向",
              pluginId: "math-position-direction",
              weight: 2,
              type: "compass",
              description: "认识东、南、西、北等方向并描述位置。",
              example: "太阳从（  ）方升起。（答案：东）",
              prerequisites: ["g1-m6-position"],
              related: ["g6-m6-g6-op-position"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M8",
          knowledgePoints: [
            {
              id: "g3-m8-g3-times",
              name: "倍的认识",
              pluginId: "math-word-problems",
              weight: 2,
              type: "mix",
              description: "理解“倍”的含义，求一个数是另一个数的几倍。",
              example: "6是2的几倍？（答案：3倍）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g3-m1-g3-mul-multi1","g4-m7-g4-pic-segment"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M9",
          knowledgePoints: [
            {
              id: "g3-m9-g3-stats-table",
              name: "复式统计表",
              pluginId: "math-data-stats",
              weight: 2,
              type: "multiTable",
              description: "把多组数据合并记录在一张复式统计表里。",
              example: "把男女生喜欢的运动填进同一张复式统计表。",
              prerequisites: ["g2-m9-data-tally"],
              related: ["g4-m9-g4-stats-bar","g4-m9-g4-stats-double"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M10",
          knowledgePoints: [
            {
              id: "g3-m10-g3-combination",
              name: "搭配问题",
              pluginId: "math-combination-set",
              weight: 2,
              type: "dress",
              description: "用搭配、连线等方法有序找出全部组合。",
              example: "2件上衣和3条裤子有几种搭配？（答案：6种）",
              prerequisites: ["g2-m10-logic-reasoning"],
              related: ["g3-m10-g3-set","g4-c3-c3-am"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g3-m10-g3-set",
              name: "集合思想",
              pluginId: "math-combination-set",
              weight: 2,
              type: "set",
              description: "用集合（韦恩图）表示重叠关系并计数。",
              example: "会游泳5人，会骑车4人，两项都会2人，至少会一项的几人？（答案：7人）",
              prerequisites: ["g3-m10-g3-combination"],
              related: ["g3-m10-g3-combination"],
              difficulty: 1,
              status: "active"
            }
          ]
        }
      ]
    },
    // ========== 年级4 ==========
    {
      grade: 4,
      modules: [
        {
          moduleId: "M1",
          knowledgePoints: [
            {
              id: "g4-m1-g4-oral-big",
              name: "大数加减口算",
              pluginId: "math-g4-oral",
              weight: 3,
              type: "big-addsub",
              description: "对万以上的大数进行加减法口算。",
              example: "50000+3000=?（答案：53000）",
              prerequisites: ["g3-m1-g3-add-sub-wan"],
              related: ["g4-m1-g4-oral-mul3x1","g4-m1-g4-oral-divt","g4-m4-g4-fill-bignum"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m1-g4-oral-mul3x1",
              name: "三位数乘一位数口算",
              pluginId: "math-g4-oral",
              weight: 3,
              type: "mul3x1",
              description: "整百、整千数乘一位数的口算。",
              example: "300×4=?（答案：1200）",
              prerequisites: ["g3-m1-g3-mul-multi1"],
              related: ["g4-m1-g4-oral-mul2t","g4-m2-g4-v-mul3x2"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m1-g4-oral-mul2t",
              name: "两位数乘整十数口算",
              pluginId: "math-g4-oral",
              weight: 3,
              type: "mul2tens",
              description: "两位数乘整十数的口算。",
              example: "12×30=?（答案：360）",
              prerequisites: ["g3-m1-g3-mul-2digit"],
              related: ["g4-m1-g4-oral-mul3x1","g4-m1-g4-oral-mul3x1"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m1-g4-oral-divt",
              name: "除数是整十数的口算",
              pluginId: "math-g4-oral",
              weight: 3,
              type: "div-tens",
              description: "几百几十除以整十数的口算。",
              example: "240÷60=?（答案：4）",
              prerequisites: ["g3-m1-g3-div1"],
              related: ["g4-m2-g4-v-div2","g4-m1-g4-oral-mul2t"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m1-g4-oral-dec",
              name: "小数加减法口算",
              pluginId: "math-g4-oral",
              weight: 3,
              type: "dec-addsub",
              description: "简单的小数加减法口算。",
              example: "0.3+0.5=?（答案：0.8）",
              prerequisites: ["g3-m4-g3-decimal"],
              related: ["g4-m2-g4-v-dec","g4-m3-g4-mix-dec","g4-m4-g4-fill-dec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m1-g4-oral-law",
              name: "运用运算律简便口算",
              pluginId: "math-g4-oral",
              weight: 2,
              type: "law-oral",
              description: "用加法交换律、结合律进行简便口算。",
              example: "25+37+75=?（答案：137）",
              prerequisites: ["g3-m1-g3-add-sub-wan"],
              related: ["g4-m3-g4-mix-addlaw","g4-m3-g4-mix-mullaw","g4-m3-g4-mix-dist"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M2",
          knowledgePoints: [
            {
              id: "g4-m2-g4-v-mul3x2",
              name: "三位数乘两位数",
              pluginId: "math-g4-vertical",
              weight: 3,
              type: "mul3x2",
              description: "三位数乘两位数的笔算。",
              example: "123×45=?（答案：5535）",
              prerequisites: ["g3-m1-g3-mul-2digit"],
              related: ["g4-m2-g4-v-mulzero","g4-m8-g4-word-speed","g4-m12-g4-choice-est"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m2-g4-v-mulzero",
              name: "因数中间或末尾有 0 的乘法",
              pluginId: "math-g4-vertical",
              weight: 3,
              type: "mul-zero",
              description: "因数中间或末尾有0的乘法笔算。",
              example: "203×40=?（答案：8120）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g4-m2-g4-v-mul3x2","g4-m4-g4-fill-quotient"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m2-g4-v-div2",
              name: "除数是两位数的除法",
              pluginId: "math-g4-vertical",
              weight: 3,
              type: "div-2digit",
              description: "两位数除多位数的笔算。",
              example: "144÷12=?（答案：12）",
              prerequisites: ["g3-m1-g3-div1"],
              related: ["g4-m2-g4-v-div2q","g4-m8-g4-word-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m2-g4-v-div2q",
              name: "商是两位数的除法",
              pluginId: "math-g4-vertical",
              weight: 3,
              type: "div-2quotient",
              description: "被除数是三位数、商是两位数的除法笔算。",
              example: "252÷14=?（答案：18）",
              prerequisites: ["g4-m2-g4-v-div2"],
              related: ["g4-m2-g4-v-div2"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m2-g4-v-dec",
              name: "小数加减法竖式",
              pluginId: "math-g4-vertical",
              weight: 3,
              type: "dec-vertical",
              description: "小数加减法列竖式计算（小数点对齐）。",
              example: "3.5+2.75=?（答案：6.25）",
              prerequisites: ["g4-m1-g4-oral-dec"],
              related: ["g4-m1-g4-oral-dec","g4-m3-g4-mix-dec","g4-m8-g4-word-dec"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M3",
          knowledgePoints: [
            {
              id: "g4-m3-g4-mix-order",
              name: "四则混合运算顺序",
              pluginId: "math-g4-mixed",
              weight: 3,
              type: "order",
              description: "掌握先乘除后加减及带括号的四则混合运算顺序。",
              example: "12+8×3=?（答案：36）",
              prerequisites: ["g2-m1-mixed"],
              related: ["g4-m3-g4-mix-addlaw","g4-m3-g4-mix-mullaw","g4-m4-g4-fill-op"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m3-g4-mix-addlaw",
              name: "加法运算律简便计算",
              pluginId: "math-g4-mixed",
              weight: 3,
              type: "add-law",
              description: "用加法交换律、结合律进行简便计算。",
              example: "167+358+33=?（答案：558）",
              prerequisites: ["g4-m3-g4-mix-order"],
              related: ["g4-m3-g4-mix-mullaw","g4-m5-g4-match-law","g4-m11-g4-judge-law"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m3-g4-mix-mullaw",
              name: "乘法运算律简便计算",
              pluginId: "math-g4-mixed",
              weight: 3,
              type: "mul-law",
              description: "用乘法交换律、结合律进行简便计算。",
              example: "25×7×4=?（答案：700）",
              prerequisites: ["g4-m3-g4-mix-order"],
              related: ["g4-m3-g4-mix-dist","g4-m5-g4-match-law"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m3-g4-mix-dist",
              name: "乘法分配律简便计算",
              pluginId: "math-g4-mixed",
              weight: 3,
              type: "dist-law",
              description: "运用乘法分配律 a×(b+c)=a×b+a×c 简便计算。",
              example: "25×(4+8)=?（答案：300）",
              prerequisites: ["g4-m3-g4-mix-mullaw"],
              related: ["g4-m3-g4-mix-mullaw","g4-m12-g4-choice-law"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m3-g4-mix-dec",
              name: "小数加减简便计算",
              pluginId: "math-g4-mixed",
              weight: 2,
              type: "dec-simple",
              description: "运用运算律进行小数加减简便计算。",
              example: "4.6+3.2+5.4=?（答案：13.2）",
              prerequisites: ["g4-m1-g4-oral-dec"],
              related: ["g4-m2-g4-v-dec","g4-m8-g4-word-dec"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M4",
          knowledgePoints: [
            {
              id: "g4-m4-g4-fill-bignum",
              name: "大数的认识",
              pluginId: "math-g4-fill",
              weight: 3,
              type: "big-num",
              description: "认识亿以内的数，会读、写、比较大数。",
              example: "读作：三千零四十万零五百。（答案：30400500）",
              prerequisites: ["g2-m4-readwrite","g2-m4-compose-digit"],
              related: ["g4-m5-g4-match-read","g4-m11-g4-judge-read","g4-m12-g4-choice-big","g4-m8-g4-word-big"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-hectare",
              name: "公顷和平方千米",
              pluginId: "math-g4-fill",
              weight: 2,
              type: "hectare",
              description: "认识土地面积单位公顷、平方千米及换算。",
              example: "1公顷 = ?平方米（答案：10000平方米）",
              prerequisites: ["g3-m6-g3-area","g3-m4-g3-measure"],
              related: ["g4-m8-g4-word-area","g3-m6-g3-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-line",
              name: "线段、射线、直线",
              pluginId: "math-g4-fill",
              weight: 2,
              type: "line-ray",
              description: "认识线段、射线、直线及它们之间的区别。",
              example: "有2个端点的是？（答案：线段）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g4-m6-g4-draw-para","g4-m11-g4-judge-line","g4-m6-g4-draw-grid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-angle",
              name: "角的度量与分类",
              pluginId: "math-g4-fill",
              weight: 3,
              type: "angle-metric",
              description: "用量角器量角，区分锐角、直角、钝角。",
              example: "90°的角是？（答案：直角）",
              prerequisites: ["g2-m6-angles"],
              related: ["g4-m6-g4-draw-protractor","g4-m5-g4-match-angle","g4-m12-g4-choice-angle","g4-m11-g4-judge-angle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-quad",
              name: "平行四边形和梯形",
              pluginId: "math-g4-fill",
              weight: 2,
              type: "quad",
              description: "认识平行四边形和梯形及其特征。",
              example: "平行四边形的对边（  ）。（答案：平行且相等）",
              prerequisites: ["g4-m4-g4-fill-line","g4-m4-g4-fill-angle"],
              related: ["g4-m6-g4-draw-grid","g4-m5-g4-match-shape","g4-m12-g4-choice-shape"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-op",
              name: "四则运算的意义与关系、0 的运算",
              pluginId: "math-g4-fill",
              weight: 2,
              type: "op-meaning",
              description: "理解加减乘除的互逆关系及0的运算性质。",
              example: "0除以非0的数得？（答案：0）",
              prerequisites: ["g2-m1-mixed"],
              related: ["g4-m3-g4-mix-order","g4-m1-g4-oral-law"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-quotient",
              name: "商不变规律",
              pluginId: "math-g4-fill",
              weight: 2,
              type: "quotient-law",
              description: "被除数和除数同时乘或除以相同数（0除外），商不变。",
              example: "48÷6=(48×2)÷(6×?)（答案：×2）",
              prerequisites: ["g4-m2-g4-v-div2"],
              related: ["g4-m11-g4-judge-quotient","g4-m2-g4-v-div2q"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-dec",
              name: "小数",
              pluginId: "math-g4-fill",
              weight: 3,
              type: "decimal",
              description: "认识小数的意义、数位和读写方法。",
              example: "0.06表示几个百分之一？（答案：6个）",
              prerequisites: ["g3-m4-g3-decimal"],
              related: ["g4-m2-g4-v-dec","g4-m12-g4-choice-dec","g4-m11-g4-judge-dec","g4-m5-g4-match-decfrac"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-tri",
              name: "三角形",
              pluginId: "math-g4-fill",
              weight: 3,
              type: "triangle",
              description: "认识三角形特性，按角或边分类。",
              example: "三角形的内角和是？（答案：180°）",
              prerequisites: ["g4-m4-g4-fill-line","g4-m4-g4-fill-angle"],
              related: ["g4-m11-g4-judge-tri","g4-m12-g4-choice-shape","g4-m5-g4-match-shape"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m4-g4-fill-avg",
              name: "平均数",
              pluginId: "math-g4-fill",
              weight: 2,
              type: "average",
              description: "理解平均数的意义及求法。",
              example: "三科成绩90、80、70的平均分？（答案：80）",
              prerequisites: ["g4-m2-g4-v-div2","g3-m9-g3-stats-table"],
              related: ["g4-m9-g4-stats-avg","g4-m8-g4-word-avg","g4-m9-g4-stats-bar"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M5",
          knowledgePoints: [
            {
              id: "g4-m5-g4-match-read",
              name: "大数与读法连线",
              pluginId: "math-g4-match",
              weight: 2,
              type: "read",
              description: "把大数与正确的读法连线。",
              example: "连线：3050000 —— 三百零五万。",
              prerequisites: ["g4-m4-g4-fill-bignum"],
              related: ["g4-m4-g4-fill-bignum","g4-m11-g4-judge-read"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m5-g4-match-angle",
              name: "角与度数连线",
              pluginId: "math-g4-match",
              weight: 2,
              type: "angle-degree",
              description: "把角与其度数或名称连线。",
              example: "连线：直角 —— 90°。",
              prerequisites: ["g4-m4-g4-fill-angle"],
              related: ["g4-m4-g4-fill-angle","g4-m6-g4-draw-protractor"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m5-g4-match-shape",
              name: "图形与特征连线",
              pluginId: "math-g4-match",
              weight: 2,
              type: "shape-feature",
              description: "把图形与其特征描述连线。",
              example: "连线：平行四边形 —— 对边平行且相等。",
              prerequisites: ["g4-m4-g4-fill-quad"],
              related: ["g4-m4-g4-fill-quad","g4-m4-g4-fill-tri","g4-m12-g4-choice-shape"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m5-g4-match-law",
              name: "运算律与字母表达式连线",
              pluginId: "math-g4-match",
              weight: 2,
              type: "law-formula",
              description: "把运算律与其字母表达式连线。",
              example: "连线：乘法分配律 —— a(b+c)=ab+ac。",
              prerequisites: ["g4-m3-g4-mix-addlaw"],
              related: ["g4-m3-g4-mix-addlaw","g4-m3-g4-mix-mullaw","g4-m11-g4-judge-law"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m5-g4-match-decfrac",
              name: "小数与分数连线",
              pluginId: "math-g4-match",
              weight: 2,
              type: "dec-frac",
              description: "把小数与相等的分数连线。",
              example: "连线：0.5 —— 1/2。",
              prerequisites: ["g3-m4-g3-fraction","g3-m4-g3-decimal"],
              related: ["g4-m4-g4-fill-dec","g5-m5-g5-match-fracdec"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M6",
          knowledgePoints: [
            {
              id: "g4-m6-g4-draw-protractor",
              name: "用量角器量角、画角",
              pluginId: "math-g4-draw",
              weight: 3,
              type: "protractor",
              description: "会用量角器量角和画指定度数的角。",
              example: "画一个60°的角。",
              prerequisites: ["g4-m4-g4-fill-angle"],
              related: ["g4-m4-g4-fill-angle","g4-m5-g4-match-angle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m6-g4-draw-para",
              name: "画平行线、垂线",
              pluginId: "math-g4-draw",
              weight: 3,
              type: "parallel-perp",
              description: "用直尺和三角板画平行线和垂线。",
              example: "过直线外一点画它的垂线。",
              prerequisites: ["g4-m4-g4-fill-line"],
              related: ["g4-m4-g4-fill-line","g4-m6-g4-draw-grid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m6-g4-draw-grid",
              name: "在方格纸上画平行四边形、梯形",
              pluginId: "math-g4-draw",
              weight: 2,
              type: "grid-quad",
              description: "在方格纸上按要求画平行四边形、梯形。",
              example: "在方格纸上画一个平行四边形。",
              prerequisites: ["g4-m4-g4-fill-quad"],
              related: ["g4-m4-g4-fill-quad","g4-m6-g4-draw-para"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m6-g4-draw-view",
              name: "观察物体",
              pluginId: "math-g4-draw",
              weight: 2,
              type: "observe",
              description: "从不同方向观察同一物体并画出视图。",
              example: "画出正方体从正面看到的形状。",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g5-m6-g5-draw-observe","g6-m6-g6-op-position"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m6-g4-draw-sym",
              name: "画轴对称图形",
              pluginId: "math-g4-draw",
              weight: 2,
              type: "symmetry",
              description: "补全或画出轴对称图形。",
              example: "画出给定图形的另一半，使它成为轴对称图形。",
              prerequisites: ["g2-m6-motion"],
              related: ["g5-m6-g5-draw-sym","g4-m6-g4-draw-move"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m6-g4-draw-move",
              name: "图形平移",
              pluginId: "math-g4-draw",
              weight: 2,
              type: "translate",
              description: "按要求把图形平移若干格。",
              example: "把三角形向右平移5格。",
              prerequisites: ["g2-m6-motion"],
              related: ["g5-m6-g5-draw-rotate","g4-m6-g4-draw-sym"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M7",
          knowledgePoints: [
            {
              id: "g4-m7-g4-pic-segment",
              name: "线段图列式（倍数问题）",
              pluginId: "math-g4-picture",
              weight: 3,
              type: "segment-multiple",
              description: "画线段图分析倍数关系并列式。",
              example: "甲是乙的3倍，乙是4，甲是多少？（答案：12）",
              prerequisites: ["g3-m8-g3-times"],
              related: ["g4-m8-g4-word-big","g4-m7-g4-pic-brace","g5-m7-g5-pic-segment"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m7-g4-pic-brace",
              name: "大括号图列式（加减）",
              pluginId: "math-g4-picture",
              weight: 2,
              type: "brace-addsub",
              description: "用大括号图表示总数与部分的关系。",
              example: "两部分共9，一部分是5，另一部分是？（答案：4）",
              prerequisites: ["g1-m7-picture-equations"],
              related: ["g4-m8-g4-word-div","g4-m7-g4-pic-segment"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m7-g4-pic-speed",
              name: "速度时间路程图",
              pluginId: "math-g4-picture",
              weight: 2,
              type: "speed-distance",
              description: "用线段图表示速度×时间=路程。",
              example: "速度60、时间2，路程？（答案：120）",
              prerequisites: ["g4-m1-g4-oral-mul3x1"],
              related: ["g4-m8-g4-word-speed","g4-c5-c5-basic"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m7-g4-pic-dec",
              name: "小数加减情境图",
              pluginId: "math-g4-picture",
              weight: 2,
              type: "dec-scene",
              description: "看图列出小数加减算式。",
              example: "图：苹果3.5元、梨2元，一共？（答案：5.5元）",
              prerequisites: ["g4-m1-g4-oral-dec"],
              related: ["g4-m8-g4-word-dec"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M8",
          knowledgePoints: [
            {
              id: "g4-m8-g4-word-big",
              name: "大数应用",
              pluginId: "math-g4-word",
              weight: 2,
              type: "big-app",
              description: "对大数进行读写与实际应用。",
              example: "某省人口约9043万，把它写出来。",
              prerequisites: ["g4-m4-g4-fill-bignum"],
              related: ["g4-m4-g4-fill-bignum","g4-m7-g4-pic-segment"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-speed",
              name: "乘法问题（速度×时间=路程）",
              pluginId: "math-g4-word",
              weight: 3,
              type: "mul-travel",
              description: "用速度×时间=路程解决乘法问题。",
              example: "速度50千米/时，行3时，路程？（答案：150千米）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g4-m7-g4-pic-speed","g4-c5-c5-basic","g4-c5-c5-meet"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-div",
              name: "除法问题（总量÷份数=每份数）",
              pluginId: "math-g4-word",
              weight: 3,
              type: "div-share",
              description: "把总数平均分，用除法解决问题。",
              example: "120颗糖分给4人，每人？（答案：30颗）",
              prerequisites: ["g4-m2-g4-v-div2"],
              related: ["g4-m8-g4-word-price","g4-m8-g4-word-speed","g4-m7-g4-pic-brace"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-price",
              name: "单价、数量、总价问题",
              pluginId: "math-g4-word",
              weight: 3,
              type: "price-qty",
              description: "用单价×数量=总价解决购物问题。",
              example: "每本8元，买5本共？（答案：40元）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g4-m8-g4-word-div","g4-m8-g4-word-speed"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-area",
              name: "面积问题（公顷/平方千米）",
              pluginId: "math-g4-word",
              weight: 2,
              type: "area-hectare",
              description: "用土地面积单位解决面积问题。",
              example: "边长100米的正方形地面积是？（答案：1公顷）",
              prerequisites: ["g4-m4-g4-fill-hectare"],
              related: ["g4-m4-g4-fill-hectare"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-opt",
              name: "优化问题",
              pluginId: "math-g4-word",
              weight: 2,
              type: "optimize",
              description: "合理安排工序，使总时间最少。",
              example: "煮饭的同时炒菜，怎样安排最省时？",
              prerequisites: ["g4-m8-g4-word-div"],
              related: ["g4-m10-g4-reason-opt","g4-m8-g4-word-cr","g4-c8-c8-extreme"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-cr",
              name: "鸡兔同笼",
              pluginId: "math-g4-word",
              weight: 2,
              type: "chicken-rabbit",
              description: "用假设法解决鸡兔同笼问题。",
              example: "头10、脚28，鸡兔各几只？（答案：鸡6兔4）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g4-m10-g4-reason-cr","g4-m8-g4-word-opt"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-dec",
              name: "小数加减问题",
              pluginId: "math-g4-word",
              weight: 3,
              type: "dec-pay",
              description: "解决小数加减法的实际问题。",
              example: "买笔花3.5元、本子2.8元，共？（答案：6.3元）",
              prerequisites: ["g4-m2-g4-v-dec"],
              related: ["g4-m7-g4-pic-dec","g4-m2-g4-v-dec","g4-m3-g4-mix-dec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m8-g4-word-avg",
              name: "平均数问题",
              pluginId: "math-g4-word",
              weight: 2,
              type: "avg-score",
              description: "用平均数解决实际问题。",
              example: "4天分别读10、15、20、15页，平均每天？（答案：15页）",
              prerequisites: ["g4-m4-g4-fill-avg"],
              related: ["g4-m9-g4-stats-avg","g4-m4-g4-fill-avg"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M9",
          knowledgePoints: [
            {
              id: "g4-m9-g4-stats-bar",
              name: "条形统计图（1 格表示多个单位）",
              pluginId: "math-g4-stats",
              weight: 3,
              type: "bar-chart",
              description: "绘制并读取一格代表多个单位的条形统计图。",
              example: "一格代表5，画出表示20的直条。",
              prerequisites: ["g3-m9-g3-stats-table"],
              related: ["g4-m9-g4-stats-double","g4-m8-g4-word-avg","g5-m9-g5-stats-line1"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m9-g4-stats-double",
              name: "复式条形统计图",
              pluginId: "math-g4-stats",
              weight: 2,
              type: "double-bar",
              description: "在同一图中表示两组数据的复式条形统计图。",
              example: "画出男女生身高的复式条形图。",
              prerequisites: ["g4-m9-g4-stats-bar"],
              related: ["g4-m9-g4-stats-bar","g5-m9-g5-stats-line2"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m9-g4-stats-avg",
              name: "平均数与统计",
              pluginId: "math-g4-stats",
              weight: 2,
              type: "avg-stats",
              description: "结合平均数分析统计数据。",
              example: "两组平均成绩谁更高？",
              prerequisites: ["g4-m4-g4-fill-avg"],
              related: ["g4-m8-g4-word-avg","g4-m4-g4-fill-avg","g4-m9-g4-stats-bar"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M10",
          knowledgePoints: [
            {
              id: "g4-m10-g4-reason-opt",
              name: "优化问题（沏茶、烙饼）",
              pluginId: "math-g4-reason",
              weight: 3,
              type: "pancake",
              description: "用统筹方法使时间最少（沏茶、烙饼）。",
              example: "烙3张饼最少要几分钟（每面1分）？（答案：3分）",
              prerequisites: ["g4-m8-g4-word-opt"],
              related: ["g4-m8-g4-word-opt","g4-c8-c8-extreme","g4-m10-g4-reason-cr"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m10-g4-reason-cr",
              name: "鸡兔同笼（假设法）",
              pluginId: "math-g4-reason",
              weight: 3,
              type: "assume",
              description: "用假设法系统地解决鸡兔同笼。",
              example: "假设全是鸡，再调整求出兔的只数。",
              prerequisites: ["g4-m8-g4-word-cr"],
              related: ["g4-m8-g4-word-cr","g4-m10-g4-reason-opt"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m10-logic-reasoning",
              name: "简单逻辑推理",
              pluginId: "math-g4-reason",
              weight: 2,
              type: "logic",
              description: "用列表法等进行简单逻辑推理。",
              example: "甲、乙、丙各擅长不同项目，推理谁会什么。",
              prerequisites: ["g2-m10-logic-reasoning"],
              related: ["g5-m10-logic-reasoning","g5-m10-g5-reason-seq","g2-m10-logic-reasoning"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M11",
          knowledgePoints: [
            {
              id: "g4-m11-g4-judge-read",
              name: "大数读写",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "read",
              description: "判断大数的读、写是否正确。",
              example: "判断：3000500读作三百万零五百。（对）",
              prerequisites: ["g4-m4-g4-fill-bignum"],
              related: ["g4-m4-g4-fill-bignum","g4-m5-g4-match-read","g4-m12-g4-choice-big"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-g4-judge-law",
              name: "运算律",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "law",
              description: "判断对运算律的应用是否正确。",
              example: "判断：25×4×25×8=25×(4+8)。（错）",
              prerequisites: ["g4-m3-g4-mix-addlaw"],
              related: ["g4-m3-g4-mix-addlaw","g4-m5-g4-match-law","g4-m12-g4-choice-law"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-g4-judge-angle",
              name: "几何概念",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "angle",
              description: "判断角的有关概念。",
              example: "判断：钝角大于90°。（对）",
              prerequisites: ["g4-m4-g4-fill-angle"],
              related: ["g4-m4-g4-fill-angle","g4-m12-g4-choice-angle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-g4-judge-line",
              name: "线段、射线、直线",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "line-ray",
              description: "判断线段、射线、直线的特征。",
              example: "判断：射线有一个端点。（对）",
              prerequisites: ["g4-m4-g4-fill-line"],
              related: ["g4-m4-g4-fill-line","g4-m6-g4-draw-para"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-g4-judge-quotient",
              name: "商不变规律",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "quotient",
              description: "判断商不变规律的表述。",
              example: "判断：被除数、除数同乘5，商变。（错）",
              prerequisites: ["g4-m4-g4-fill-quotient"],
              related: ["g4-m4-g4-fill-quotient","g4-m2-g4-v-div2q"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-g4-judge-dec",
              name: "小数性质",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "dec",
              description: "判断小数的性质。",
              example: "判断：0.3=0.30。（对）",
              prerequisites: ["g4-m4-g4-fill-dec"],
              related: ["g4-m4-g4-fill-dec","g4-m12-g4-choice-dec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-g4-judge-tri",
              name: "三角形",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "triangle",
              description: "判断三角形的分类与性质。",
              example: "判断：等边三角形是锐角三角形。（对）",
              prerequisites: ["g4-m4-g4-fill-tri"],
              related: ["g4-m4-g4-fill-tri","g4-m12-g4-choice-shape"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m11-stats",
              name: "统计",
              pluginId: "math-g4-judge",
              weight: 2,
              type: "stats",
              description: "判断统计图相关的说法。",
              example: "判断：条形图能比较数量多少。（对）",
              prerequisites: ["g4-m9-g4-stats-bar"],
              related: ["g4-m9-g4-stats-bar","g4-m9-g4-stats-avg","g5-m11-stats"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M12",
          knowledgePoints: [
            {
              id: "g4-m12-g4-choice-big",
              name: "大数比较",
              pluginId: "math-g4-choice",
              weight: 3,
              type: "big-compare",
              description: "比较亿以内数的大小。",
              example: "比较304050与340050。（答案：304050<340050）",
              prerequisites: ["g4-m4-g4-fill-bignum"],
              related: ["g4-m4-g4-fill-bignum","g4-m11-g4-judge-read"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m12-g4-choice-est",
              name: "乘除法估算",
              pluginId: "math-g4-choice",
              weight: 2,
              type: "est-muldiv",
              description: "对乘除法进行估算。",
              example: "估算：298×4≈？（答案：约1200）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g4-m2-g4-v-mul3x2","g4-m2-g4-v-div2"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m12-g4-choice-angle",
              name: "角的认识",
              pluginId: "math-g4-choice",
              weight: 2,
              type: "angle",
              description: "选择角的类型或度数。",
              example: "钟面3时，分针与时针的夹角是？（答案：直角）",
              prerequisites: ["g4-m4-g4-fill-angle"],
              related: ["g4-m4-g4-fill-angle","g4-m11-g4-judge-angle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m12-g4-choice-shape",
              name: "图形特征",
              pluginId: "math-g4-choice",
              weight: 2,
              type: "shape",
              description: "选择图形的特征描述。",
              example: "trapezoid 的中文是？（答案：梯形）",
              prerequisites: ["g4-m4-g4-fill-quad"],
              related: ["g4-m4-g4-fill-quad","g4-m4-g4-fill-tri","g4-m5-g4-match-shape"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m12-g4-choice-dec",
              name: "小数意义",
              pluginId: "math-g4-choice",
              weight: 2,
              type: "dec-meaning",
              description: "选择小数表示的意义。",
              example: "0.7表示？（答案：7个0.1）",
              prerequisites: ["g4-m4-g4-fill-dec"],
              related: ["g4-m4-g4-fill-dec","g4-m11-g4-judge-dec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g4-m12-g4-choice-law",
              name: "运算律应用",
              pluginId: "math-g4-choice",
              weight: 2,
              type: "law",
              description: "选择运用运算律的简便算法。",
              example: "25×32最简便地写成？（答案：25×4×8）",
              prerequisites: ["g4-m3-g4-mix-addlaw"],
              related: ["g4-m3-g4-mix-addlaw","g4-m3-g4-mix-dist","g4-m11-g4-judge-law"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C1",
          knowledgePoints: [
            {
              id: "g4-c1-c1-vertical",
              name: "竖式数字谜",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 3,
              type: "vertical",
              description: "根据竖式中已知的部分数字，推理填出完整的竖式。",
              example: "□5+3□=82，求出两个□中的数字。",
              prerequisites: ["g4-m2-g4-v-mul3x2","g4-m2-g4-v-div2"],
              related: ["g4-c1-c1-horizontal","g4-c2-c2-place","g4-m2-g4-v-mul3x2"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c1-c1-horizontal",
              name: "横式数字谜",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "horizontal",
              description: "在横式中填入合适的数字，使等式成立。",
              example: "□+□=9，且两个□中的数字不同。",
              prerequisites: ["g4-m3-g4-mix-order"],
              related: ["g4-c1-c1-vertical","g4-c1-c1-symbol","g4-m3-g4-mix-order"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c1-c1-symbol",
              name: "符号代表数",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "symbol",
              description: "用图形或符号代表未知的數字进行推理。",
              example: "△+△=10，△=?（答案：5）",
              prerequisites: ["g4-m4-g4-fill-op"],
              related: ["g4-c2-c2-place","g4-c1-c1-horizontal","g2-m10-logic-reasoning"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c1-c1-array",
              name: "数阵图",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "array",
              description: "把数填入图中，使每行、每列的和相等。",
              example: "在三阶数阵中填1-9，使每行每列和都为15。",
              prerequisites: ["g4-m3-g4-mix-addlaw"],
              related: ["g4-c1-c1-magic","g4-c1-c1-symbol"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c1-c1-magic",
              name: "幻方",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "magic",
              description: "理解幻方的规律并填数。",
              example: "完成中间为5的三阶幻方。",
              prerequisites: ["g4-c1-c1-array"],
              related: ["g4-c1-c1-array"],
              difficulty: 3,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C2",
          knowledgePoints: [
            {
              id: "g4-c2-c2-parity",
              name: "奇偶性与运算规律",
              pluginId: "math-competition-c2-numbertheory",
              weight: 3,
              type: "parity",
              description: "利用奇偶性判断运算结果的奇偶。",
              example: "奇数+奇数=?（答案：偶数）",
              prerequisites: ["g2-m1-addsub-100"],
              related: ["g4-c2-c2-divisible","g4-c2-c2-remainder","g4-m3-g4-mix-order"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c2-c2-divisible",
              name: "整除特征（2/3/5/9）",
              pluginId: "math-competition-c2-numbertheory",
              weight: 3,
              type: "divisible",
              description: "掌握能被2、3、5、9整除的数的特征。",
              example: "下列各数中能被3整除的是？（答案：123）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g4-c2-c2-factor","g4-c2-c2-prime"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c2-c2-prime",
              name: "质数与合数",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "prime",
              description: "认识质数与合数，并能判断。",
              example: "下列各数中是质数的是？（答案：7）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g4-c2-c2-factor","g4-c2-c2-divisible","g5-m4-g5-fill-prime"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c2-c2-factor",
              name: "因数与倍数",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "factor",
              description: "理解因数与倍数相互依存的关系。",
              example: "6的因数有？（答案：1、2、3、6）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g4-c2-c2-prime","g4-c2-c2-divisible"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c2-c2-remainder",
              name: "余数问题",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "remainder",
              description: "解决带余除法的应用问题。",
              example: "□÷5=3……2，□=?（答案：17）",
              prerequisites: ["g3-m1-g3-div1"],
              related: ["g4-c2-c2-divisible","g4-c2-c2-factor","g3-m1-g3-div1"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c2-c2-place",
              name: "位值原理",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "place",
              description: "利用数字所在数位的值进行推理。",
              example: "一个两位数，十位是个位的2倍，它可能是哪些数？",
              prerequisites: ["g2-m4-readwrite"],
              related: ["g4-c1-c1-symbol","g2-m4-readwrite","g4-m4-g4-fill-bignum"],
              difficulty: 3,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C3",
          knowledgePoints: [
            {
              id: "g4-c3-c3-enum",
              name: "枚举法",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "enum",
              description: "有次序地一一列举出所有可能。",
              example: "用1、2、3能组成几个无重复数字的两位数？（答案：6个）",
              prerequisites: ["g2-m10-logic-reasoning"],
              related: ["g4-c3-c3-am","g4-c3-c3-worst","g2-m10-logic-reasoning"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c3-c3-am",
              name: "加法与乘法原理",
              pluginId: "math-competition-c3-counting",
              weight: 3,
              type: "am",
              description: "分类用加法原理，分步用乘法原理计数。",
              example: "上衣3件、裤子2件，共有几种穿法？（答案：6种）",
              prerequisites: ["g3-m10-g3-combination"],
              related: ["g4-c3-c3-perm","g4-c3-c3-enum","g3-m10-g3-combination"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c3-c3-perm",
              name: "排列组合初步",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "perm",
              description: "初步认识排列与组合的区别。",
              example: "从3人中选2人排成一排有几种？（答案：6种）",
              prerequisites: ["g4-c3-c3-am"],
              related: ["g4-c3-c3-am","g4-c3-c3-worst"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c3-c3-geomcount",
              name: "几何计数",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "geomcount",
              description: "数出图形中的线段、角、三角形个数。",
              example: "一条线段上有4个点，共有几条线段？（答案：10条）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g4-c4-c4-count","g4-c3-c3-enum","g2-m6-shapes-2"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c3-c3-worst",
              name: "最不利原则",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "worst",
              description: "考虑最坏情况，保证结论必然成立。",
              example: "两色球各若干，至少拿几个保证同色？（答案：3个）",
              prerequisites: ["g4-c3-c3-enum"],
              related: ["g4-c3-c3-enum","g4-c8-c8-drawer"],
              difficulty: 3,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C4",
          knowledgePoints: [
            {
              id: "g4-c4-c4-pa",
              name: "周长与面积",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "pa",
              description: "理解周长与面积的区别与联系。",
              example: "边长为4的正方形，周长和面积各是？（答案：周长16，面积16）",
              prerequisites: ["g3-m6-g3-area"],
              related: ["g4-c4-c4-cutfill","g3-m6-g3-area","g3-m6-g3-perimeter"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c4-c4-cutfill",
              name: "割补法",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "cutfill",
              description: "用割补法把不规则图形转化为规则图形求面积。",
              example: "把不规则图形割补成长方形求面积。",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g4-c4-c4-pa","g5-m4-g5-fill-area"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c4-c4-angle",
              name: "角度初步",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "angle",
              description: "认识角度的计算与和差关系。",
              example: "∠1+∠2=90°，∠1=30°，∠2=?（答案：60°）",
              prerequisites: ["g4-m4-g4-fill-angle"],
              related: ["g4-c4-c4-pa","g4-c4-c4-count","g4-m4-g4-fill-angle"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c4-c4-count",
              name: "图形计数",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "count",
              description: "有次序地数出图形的个数。",
              example: "数出图中三角形的个数。",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g4-c3-c3-geomcount","g4-c4-c4-angle"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c4-c4-transform",
              name: "平移旋转与对称",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "transform",
              description: "认识图形的对称、平移与旋转。",
              example: "判断下列图形是否轴对称。",
              prerequisites: ["g2-m6-motion"],
              related: ["g4-m6-g4-draw-sym","g4-m6-g4-draw-move","g5-m6-g5-draw-rotate"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c4-c4-solid",
              name: "立体图形初步",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "solid",
              description: "认识常见立体图形的特征与展开图。",
              example: "正方体有几个面？（答案：6个）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g5-m4-g5-fill-solid","g5-m6-g5-draw-net"],
              difficulty: 3,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C5",
          knowledgePoints: [
            {
              id: "g4-c5-c5-basic",
              name: "基本行程",
              pluginId: "math-competition-c5-journey",
              weight: 2,
              type: "basic",
              description: "用路程=速度×时间解决基本行程问题。",
              example: "速度4米/秒，走10秒，路程？（答案：40米）",
              prerequisites: ["g4-m8-g4-word-speed"],
              related: ["g4-c5-c5-meet","g4-c5-c5-chase","g4-m8-g4-word-speed"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c5-c5-meet",
              name: "相遇问题",
              pluginId: "math-competition-c5-journey",
              weight: 3,
              type: "meet",
              description: "两人相向而行，路程和=速度和×时间。",
              example: "相距100米，两人速度和10，几秒相遇？（答案：10秒）",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g4-c5-c5-chase","g4-c5-c5-train","g4-c5-c5-basic"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c5-c5-chase",
              name: "追及问题",
              pluginId: "math-competition-c5-journey",
              weight: 3,
              type: "chase",
              description: "同向而行，追及时间=路程差÷速度差。",
              example: "甲速6、乙速4，相差20米，几秒追上？（答案：10秒）",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g4-c5-c5-meet","g4-c5-c5-train","g4-c5-c5-basic"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c5-c5-train",
              name: "火车过桥",
              pluginId: "math-competition-c5-journey",
              weight: 2,
              type: "train",
              description: "考虑车长，路程=桥长+车长。",
              example: "车长100米过200米桥，完全通过要走？（答案：300米）",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g4-c5-c5-meet","g4-c5-c5-river","g4-c5-c5-basic"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c5-c5-river",
              name: "流水行船",
              pluginId: "math-competition-c5-journey",
              weight: 2,
              type: "river",
              description: "顺速=静水速+水速，逆速=静水速-水速。",
              example: "静水速10、水速2，顺水速度？（答案：12）",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g4-c5-c5-meet","g4-c5-c5-basic"],
              difficulty: 3,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C8",
          knowledgePoints: [
            {
              id: "g4-c8-c8-extreme",
              name: "最值问题",
              pluginId: "math-competition-c8-logic",
              weight: 2,
              type: "extreme",
              description: "求某个量的最大值或最小值。",
              example: "用1-9各用一次，组成最大的三位数是？（答案：987）",
              prerequisites: ["g4-m10-logic-reasoning"],
              related: ["g4-c8-c8-drawer","g4-m10-g4-reason-opt","g4-c3-c3-worst"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c8-c8-drawer",
              name: "抽屉原理",
              pluginId: "math-competition-c8-logic",
              weight: 2,
              type: "drawer",
              description: "物体数比抽屉数多时，必有抽屉含多个物体。",
              example: "5个苹果放4个抽屉，必有抽屉至少几个？（答案：2个）",
              prerequisites: ["g4-m10-logic-reasoning"],
              related: ["g4-c8-c8-logic","g4-c3-c3-worst","g4-m10-logic-reasoning"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g4-c8-c8-logic",
              name: "逻辑推理",
              pluginId: "math-competition-c8-logic",
              weight: 3,
              type: "logic",
              description: "综合多个条件进行逻辑推理。",
              example: "三人各说一句话，只有一人说真话，推理出真相。",
              prerequisites: ["g4-m10-logic-reasoning"],
              related: ["g4-c8-c8-drawer","g5-m10-logic-reasoning","g4-m10-logic-reasoning"],
              difficulty: 3,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C9",
          knowledgePoints: [
            {
              id: "g4-c9-c9-integrated",
              name: "综合应用题",
              pluginId: "math-competition-placeholder",
              weight: 3,
              type: "integrated",
              description: "综合多个知识点解决较复杂的应用题。",
              example: "结合分数、比例、几何的综合应用题。",
              prerequisites: [],
              related: [],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g4-c9-c9-misc",
              name: "杂题选讲（统筹/操作）",
              pluginId: "math-competition-placeholder",
              weight: 2,
              type: "misc",
              description: "统筹优化与操作类趣味题选讲。",
              example: "怎样用天平最省次数找出次品？",
              prerequisites: [],
              related: [],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g4-c9-c9-mock",
              name: "模拟竞赛卷",
              pluginId: "math-competition-placeholder",
              weight: 2,
              type: "mock",
              description: "按竞赛风格组卷进行模拟练习。",
              example: "完成一份模拟竞赛卷。",
              prerequisites: [],
              related: [],
              difficulty: 3,
              status: "placeholder"
            }
          ]
        }
      ]
    },
    // ========== 年级5 ==========
    {
      grade: 5,
      modules: [
        {
          moduleId: "M1",
          knowledgePoints: [
            {
              id: "g5-m1-g5-oral-decmul",
              name: "小数乘法口算",
              pluginId: "math-g5-oral",
              weight: 3,
              type: "dec-mul-oral",
              description: "小数乘整数或小数的口算。",
              example: "0.3×4=?（答案：1.2）",
              prerequisites: ["g4-m1-g4-oral-dec"],
              related: ["g5-m2-g5-v-decmul","g5-m8-g5-word-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m1-g5-oral-decdiv",
              name: "小数除法口算",
              pluginId: "math-g5-oral",
              weight: 3,
              type: "dec-div-oral",
              description: "小数除以整数等简单口算。",
              example: "0.8÷2=?（答案：0.4）",
              prerequisites: ["g4-m2-g4-v-div2"],
              related: ["g5-m2-g5-v-divint","g5-m8-g5-word-decdiv"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m1-g5-oral-fracadd",
              name: "同分母分数加减法口算",
              pluginId: "math-g5-oral",
              weight: 3,
              type: "frac-addsub-oral",
              description: "同分母分数加减法，分母不变分子相加减。",
              example: "1/5+2/5=?（答案：3/5）",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-m3-g5-mix-fracmixed","g5-m8-g5-word-frac"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m1-g5-oral-equ",
              name: "简易方程口算",
              pluginId: "math-g5-oral",
              weight: 2,
              type: "equation-oral",
              description: "口算简单方程中的未知数。",
              example: "x+3=8，x=?（答案：5）",
              prerequisites: ["g4-m4-g4-fill-op"],
              related: ["g5-m4-g5-fill-equation","g5-m8-g5-word-equ"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m1-g5-oral-fm",
              name: "因数倍数特征快速判断",
              pluginId: "math-g5-oral",
              weight: 2,
              type: "factor-multiple",
              description: "快速判断2、3、5的倍数特征。",
              example: "下列各数中能被2整除的是？（答案：48）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g5-m4-g5-fill-fm","g5-m4-g5-fill-prime"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M2",
          knowledgePoints: [
            {
              id: "g5-m2-g5-v-decmul",
              name: "小数乘法竖式",
              pluginId: "math-g5-vertical",
              weight: 3,
              type: "dec-mul-vertical",
              description: "小数乘小数的竖式计算（数清小数位数）。",
              example: "0.12×0.3=?（答案：0.036）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g5-m1-g5-oral-decmul","g5-m8-g5-word-decmul","g5-m11-g5-judge-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m2-g5-v-divint",
              name: "除数是整数的小数除法竖式",
              pluginId: "math-g5-vertical",
              weight: 3,
              type: "dec-div-int",
              description: "小数除以整数的竖式计算。",
              example: "1.5÷3=?（答案：0.5）",
              prerequisites: ["g4-m2-g4-v-div2"],
              related: ["g5-m1-g5-oral-decdiv","g5-m2-g5-v-ddivdec","g5-m8-g5-word-decdiv"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m2-g5-v-ddivdec",
              name: "除数是小数的小数除法竖式",
              pluginId: "math-g5-vertical",
              weight: 3,
              type: "dec-div-dec",
              description: "把除数化成整数后再除的小数除法。",
              example: "1.2÷0.3=?（答案：4）",
              prerequisites: ["g5-m2-g5-v-divint"],
              related: ["g5-m2-g5-v-divint","g5-m4-g5-fill-repeating"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m2-g5-v-repeating",
              name: "循环小数竖式表示",
              pluginId: "math-g5-vertical",
              weight: 2,
              type: "repeating-dec",
              description: "认识循环小数并用简便记法表示。",
              example: "1÷3=?（答案：0.3…）",
              prerequisites: ["g5-m2-g5-v-ddivdec"],
              related: ["g5-m4-g5-fill-repeating","g5-m2-g5-v-ddivdec"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M3",
          knowledgePoints: [
            {
              id: "g5-m3-g5-mix-decmixed",
              name: "小数四则混合运算",
              pluginId: "math-g5-mixed",
              weight: 3,
              type: "dec-mixed",
              description: "按运算顺序进行小数四则混合运算。",
              example: "0.5+0.3×2=?（答案：1.1）",
              prerequisites: ["g4-m3-g4-mix-order"],
              related: ["g5-m3-g5-mix-decsimple","g5-m1-g5-oral-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m3-g5-mix-fracmixed",
              name: "分数加减混合运算",
              pluginId: "math-g5-mixed",
              weight: 3,
              type: "frac-mixed",
              description: "异分母分数通分后进行加减混合。",
              example: "1/2+1/3=?（答案：5/6）",
              prerequisites: ["g5-m1-g5-oral-fracadd"],
              related: ["g5-m3-g5-mix-fracsimple","g5-m1-g5-oral-fracadd"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m3-g5-mix-decsimple",
              name: "运算律推广到小数简便计算",
              pluginId: "math-g5-mixed",
              weight: 3,
              type: "dec-simple",
              description: "用运算律对小数进行简便计算。",
              example: "0.25×4.8×4=?（答案：4.8）",
              prerequisites: ["g4-m3-g4-mix-addlaw"],
              related: ["g5-m3-g5-mix-fracsimple","g5-m3-g5-mix-decmixed"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m3-g5-mix-fracsimple",
              name: "运算律推广到分数简便计算",
              pluginId: "math-g5-mixed",
              weight: 3,
              type: "frac-simple",
              description: "用运算律对分数进行简便计算。",
              example: "1/4+2/3+3/4=?（答案：1又2/3）",
              prerequisites: ["g5-m3-g5-mix-fracmixed"],
              related: ["g5-m3-g5-mix-fracmixed","g5-m3-g5-mix-decsimple"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M4",
          knowledgePoints: [
            {
              id: "g5-m4-g5-fill-decloc",
              name: "小数的计数单位与数位",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "dec-place",
              description: "认识小数的十分位、百分位及计数单位。",
              example: "0.07的计数单位是？（答案：0.01）",
              prerequisites: ["g4-m4-g4-fill-dec"],
              related: ["g5-m4-g5-fill-deccmp","g5-m1-g5-oral-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-deccmp",
              name: "小数大小比较",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "dec-compare",
              description: "按数位比较小数的大小。",
              example: "比较0.3和0.29。（答案：0.3>0.29）",
              prerequisites: ["g5-m4-g5-fill-decloc"],
              related: ["g5-m4-g5-fill-decloc"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-prodrule",
              name: "积的变化规律",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "product-rule",
              description: "理解一个因数扩大引起积的变化规律。",
              example: "一个因数×10，另一个不变，积（  ）。（答案：×10）",
              prerequisites: ["g4-m2-g4-v-mul3x2"],
              related: ["g5-m4-g5-fill-fm","g5-m2-g5-v-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-repeating",
              name: "循环小数与简便记法",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "repeating-note",
              description: "认识循环节并用循环点表示循环小数。",
              example: "5.2323…的简便记法是？（答案：在23上加点）",
              prerequisites: ["g5-m2-g5-v-repeating"],
              related: ["g5-m2-g5-v-repeating","g5-m2-g5-v-ddivdec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-equation",
              name: "方程概念与等式的性质",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "equation-prop",
              description: "理解方程的定义及等式的性质。",
              example: "下列是方程的是？（答案：x+2=5）",
              prerequisites: ["g4-m4-g4-fill-op"],
              related: ["g5-m8-g5-word-equ","g5-m5-g5-match-equ","g5-m7-g5-pic-balance"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-fm",
              name: "因数与倍数的概念",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "factor-multiple",
              description: "理解因数与倍数相互依存的关系。",
              example: "12是3的（  ）。（答案：倍数）",
              prerequisites: ["g2-m1-muldiv"],
              related: ["g5-m4-g5-fill-prime","g5-m11-g5-judge-fm","g5-m8-g5-word-fm","g5-m1-g5-oral-fm"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-prime",
              name: "质数与合数",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "prime-composite",
              description: "按因数个数区分质数与合数。",
              example: "最小的质数是？（答案：2）",
              prerequisites: ["g5-m4-g5-fill-fm"],
              related: ["g5-m4-g5-fill-fm","g4-c2-c2-prime","g5-m11-g5-judge-fm"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-fracmean",
              name: "分数的意义与分数单位",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "frac-meaning",
              description: "理解单位“1”平均分的分数意义。",
              example: "3/4的分数单位是？（答案：1/4）",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-m4-g5-fill-fracprop","g5-m8-g5-word-frac","g3-m4-g3-fraction"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-fracprop",
              name: "分数的基本性质（约分、通分）",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "frac-property",
              description: "分子分母同乘同除，分数大小不变。",
              example: "2/3=（  ）/9。（答案：6）",
              prerequisites: ["g5-m4-g5-fill-fracmean"],
              related: ["g5-m4-g5-fill-fracmean","g5-m4-g5-fill-fracdec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-fracdec",
              name: "分数与小数的互化",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "frac-decimal",
              description: "分数与小数相互转化。",
              example: "1/4=?（答案：0.25）",
              prerequisites: ["g5-m4-g5-fill-fracprop"],
              related: ["g5-m5-g5-match-fracdec","g5-m4-g5-fill-fracprop"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-coord",
              name: "数对的含义",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "coordinate",
              description: "用（列，行）这样有序数对确定位置。",
              example: "第3列第2行记作？（答案：(3,2)）",
              prerequisites: ["g2-m6-grid"],
              related: ["g5-m6-g5-draw-coord","g6-m6-g6-op-position"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-area",
              name: "多边形面积公式",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "area-formula",
              description: "掌握平行四边形、三角形、梯形的面积计算。",
              example: "底5、高4的三角形面积？（答案：10）",
              prerequisites: ["g3-m6-g3-area"],
              related: ["g5-m5-g5-match-areaf","g5-m6-g5-draw-height","g5-m8-g5-word-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-solid",
              name: "长方体正方体特征与公式",
              pluginId: "math-g5-fill",
              weight: 3,
              type: "solid-formula",
              description: "认识长方体、正方体特征及表面积、体积公式。",
              example: "棱长2的正方体体积？（答案：8）",
              prerequisites: ["g2-m6-shapes-2"],
              related: ["g5-m5-g5-match-solid","g5-m6-g5-draw-net","g5-m8-g5-word-solid","g6-m4-g6-fill-cylinder-cone"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-rotate",
              name: "旋转三要素",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "rotation-elem",
              description: "认识旋转的中心、方向、角度三要素。",
              example: "图形绕点O顺时针转90°，三要素是？（答案：中心、方向、角度）",
              prerequisites: ["g2-m6-motion"],
              related: ["g5-m6-g5-draw-rotate","g5-m11-motion","g5-m12-motion"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-possible",
              name: "可能性描述",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "possibility",
              description: "用一定、可能、不可能描述事件。",
              example: "太阳从西边升起是？（答案：不可能）",
              prerequisites: ["g2-m10-logic-reasoning"],
              related: ["g5-m9-g5-stats-possib","g5-m8-g5-word-possib","g5-m5-g5-match-possib"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m4-g5-fill-linechart",
              name: "折线统计图特点",
              pluginId: "math-g5-fill",
              weight: 2,
              type: "linechart-feature",
              description: "认识折线统计图反映增减变化的特点。",
              example: "要表示气温变化用（  ）统计图。（答案：折线）",
              prerequisites: ["g4-m9-g4-stats-bar"],
              related: ["g5-m9-g5-stats-line1","g5-m8-g5-word-linechart","g5-m9-g5-stats-line2"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M5",
          knowledgePoints: [
            {
              id: "g5-m5-g5-match-areaf",
              name: "图形与面积公式连线",
              pluginId: "math-g5-match",
              weight: 3,
              type: "area-formula",
              description: "把图形与面积公式连线。",
              example: "连线：三角形 —— 底×高÷2。",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g5-m4-g5-fill-area","g5-m6-g5-draw-height"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m5-g5-match-solid",
              name: "立体图形特征连线",
              pluginId: "math-g5-match",
              weight: 2,
              type: "solid-feature",
              description: "把立体图形与特征连线。",
              example: "连线：正方体 —— 6个完全相同的正方形面。",
              prerequisites: ["g5-m4-g5-fill-solid"],
              related: ["g5-m4-g5-fill-solid","g5-m6-g5-draw-net"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m5-g5-match-possib",
              name: "事件与可能性描述连线",
              pluginId: "math-g5-match",
              weight: 2,
              type: "possibility-desc",
              description: "把事件与可能性词语连线。",
              example: "连线：抛硬币正面 —— 可能。",
              prerequisites: ["g5-m4-g5-fill-possible"],
              related: ["g5-m4-g5-fill-possible","g5-m9-g5-stats-possib"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m5-g5-match-equ",
              name: "方程与解连线",
              pluginId: "math-g5-match",
              weight: 3,
              type: "equation-solve",
              description: "把方程与它的解连线。",
              example: "连线：x+1=3 —— x=2。",
              prerequisites: ["g5-m4-g5-fill-equation"],
              related: ["g5-m4-g5-fill-equation","g5-m8-g5-word-equ"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m5-g5-match-fracdec",
              name: "分数与小数连线",
              pluginId: "math-g5-match",
              weight: 2,
              type: "frac-decimal",
              description: "把分数与相等的小数连线。",
              example: "连线：3/10 —— 0.3。",
              prerequisites: ["g5-m4-g5-fill-fracdec"],
              related: ["g5-m4-g5-fill-fracdec","g4-m5-g4-match-decfrac"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M6",
          knowledgePoints: [
            {
              id: "g5-m6-g5-draw-rotate",
              name: "画旋转后的图形",
              pluginId: "math-g5-draw",
              weight: 3,
              type: "rotation-draw",
              description: "按要求画出图形旋转后的位置。",
              example: "把三角形绕点O顺时针旋转90°。",
              prerequisites: ["g5-m4-g5-fill-rotate"],
              related: ["g5-m4-g5-fill-rotate","g5-m6-g5-draw-sym","g5-m11-motion"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m6-g5-draw-observe",
              name: "观察物体（三）",
              pluginId: "math-g5-draw",
              weight: 3,
              type: "observe-3d",
              description: "从三视图想象并画出立体图形。",
              example: "给出三视图，还原小正方体的搭法。",
              prerequisites: ["g4-m6-g4-draw-view"],
              related: ["g4-m6-g4-draw-view","g5-m6-g5-draw-net"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m6-g5-draw-height",
              name: "画多边形的高",
              pluginId: "math-g5-draw",
              weight: 2,
              type: "polygon-height",
              description: "从顶点向对边画垂线段作高。",
              example: "画出平行四边形的高。",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g5-m4-g5-fill-area","g5-m5-g5-match-areaf","g5-m8-g5-word-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m6-g5-draw-sym",
              name: "补全轴对称图形",
              pluginId: "math-g5-draw",
              weight: 2,
              type: "symmetry",
              description: "根据对称轴补全另一半图形。",
              example: "补全给定的轴对称图形。",
              prerequisites: ["g4-m6-g4-draw-sym"],
              related: ["g5-m6-g5-draw-rotate","g4-m6-g4-draw-sym"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m6-g5-draw-coord",
              name: "用数对表示位置",
              pluginId: "math-g5-draw",
              weight: 2,
              type: "coordinate-plot",
              description: "在方格图上用数对标出位置。",
              example: "标出（4,3）所在的位置。",
              prerequisites: ["g5-m4-g5-fill-coord"],
              related: ["g5-m4-g5-fill-coord","g6-m6-g6-op-position"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m6-g5-draw-net",
              name: "长方体展开图",
              pluginId: "math-g5-draw",
              weight: 2,
              type: "solid-net",
              description: "认识并画出长方体的展开图。",
              example: "判断哪个是长方体的展开图。",
              prerequisites: ["g5-m4-g5-fill-solid"],
              related: ["g5-m4-g5-fill-solid","g5-m5-g5-match-solid","g6-m4-g6-fill-cylinder-cone"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M7",
          knowledgePoints: [
            {
              id: "g5-m7-g5-pic-balance",
              name: "天平平衡图（列方程）",
              pluginId: "math-g5-picture",
              weight: 3,
              type: "balance-equation",
              description: "根据天平平衡列出等量方程。",
              example: "天平左为x、右为5，方程是？（答案：x=5）",
              prerequisites: ["g5-m4-g5-fill-equation"],
              related: ["g5-m8-g5-word-equ","g5-m4-g5-fill-equation"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m7-g5-pic-area",
              name: "多边形面积图",
              pluginId: "math-g5-picture",
              weight: 3,
              type: "area-picture",
              description: "看图求组合图形的面积。",
              example: "看图计算阴影部分的面积。",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g5-m8-g5-word-area","g5-m4-g5-fill-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m7-g5-pic-segment",
              name: "线段图（小数倍数）",
              pluginId: "math-g5-picture",
              weight: 3,
              type: "segment-multiple",
              description: "用线段图分析小数倍数关系。",
              example: "甲是乙的1.5倍，乙是4，甲？（答案：6）",
              prerequisites: ["g4-m7-g4-pic-segment"],
              related: ["g5-m8-g5-word-decmul","g4-m7-g4-pic-segment"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m7-g5-pic-tree",
              name: "植树问题示意图",
              pluginId: "math-g5-picture",
              weight: 2,
              type: "tree-planting",
              description: "用示意图分析植树问题的间隔。",
              example: "路长20米、每5米一棵，两端都种共几棵？（答案：5棵）",
              prerequisites: ["g3-m8-g3-times"],
              related: ["g5-m8-g5-word-tree","g5-m10-g5-reason-tree3"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M8",
          knowledgePoints: [
            {
              id: "g5-m8-g5-word-decmul",
              name: "小数乘法应用题",
              pluginId: "math-g5-word",
              weight: 3,
              type: "dec-mul-app",
              description: "解决小数乘法的实际问题。",
              example: "每千克2.5元，买3千克需？（答案：7.5元）",
              prerequisites: ["g5-m2-g5-v-decmul"],
              related: ["g5-m2-g5-v-decmul","g5-m8-g5-word-decdiv","g5-m1-g5-oral-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-decdiv",
              name: "小数除法应用题（进一法、去尾法）",
              pluginId: "math-g5-word",
              weight: 3,
              type: "dec-div-app",
              description: "用进一法或去尾法取小数除法的近似值。",
              example: "每瓶0.4升，2升可装几瓶？（答案：5瓶，进一法）",
              prerequisites: ["g5-m2-g5-v-divint"],
              related: ["g5-m8-g5-word-decmul","g5-m2-g5-v-divint"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-equ",
              name: "列方程解决问题",
              pluginId: "math-g5-word",
              weight: 3,
              type: "equation-app",
              description: "设未知数，列方程解应用题。",
              example: "一个数的3倍多2是11，求这个数。（答案：3）",
              prerequisites: ["g5-m4-g5-fill-equation"],
              related: ["g5-m4-g5-fill-equation","g5-m7-g5-pic-balance","g6-m3-g6-mixed-solve-equation"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-fm",
              name: "因数与倍数简单应用",
              pluginId: "math-g5-word",
              weight: 2,
              type: "factor-app",
              description: "用因数与倍数解决简单问题。",
              example: "每组6人正好分完，总人数可能是多少？（答案：6的倍数）",
              prerequisites: ["g5-m4-g5-fill-fm"],
              related: ["g5-m4-g5-fill-fm","g5-m8-g5-word-frac"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-frac",
              name: "分数加减法应用题",
              pluginId: "math-g5-word",
              weight: 3,
              type: "frac-app",
              description: "解决分数加减法的实际问题。",
              example: "一根绳用去1/3，还剩几分之几？（答案：2/3）",
              prerequisites: ["g5-m4-g5-fill-fracmean"],
              related: ["g5-m4-g5-fill-fracmean","g5-m8-g5-word-fm","g5-m1-g5-oral-fracadd"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-area",
              name: "多边形面积应用题",
              pluginId: "math-g5-word",
              weight: 3,
              type: "area-app",
              description: "用面积公式解决实际问题。",
              example: "梯形上底3、下底5、高4，面积？（答案：16）",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g5-m4-g5-fill-area","g5-m7-g5-pic-area","g5-m8-g5-word-solid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-solid",
              name: "长方体正方体应用题",
              pluginId: "math-g5-word",
              weight: 3,
              type: "solid-app",
              description: "解决长方体、正方体表面积体积实际问题。",
              example: "棱长3的正方体表面积？（答案：54）",
              prerequisites: ["g5-m4-g5-fill-solid"],
              related: ["g5-m4-g5-fill-solid","g5-m8-g5-word-area","g6-m8-g6-app-cyl-cone"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-possib",
              name: "可能性问题",
              pluginId: "math-g5-word",
              weight: 2,
              type: "possibility-app",
              description: "计算简单事件发生的可能性。",
              example: "袋中3红1白，摸到红球的可能性？（答案：3/4）",
              prerequisites: ["g5-m4-g5-fill-possible"],
              related: ["g5-m4-g5-fill-possible","g5-m9-g5-stats-possib"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-linechart",
              name: "折线统计图分析",
              pluginId: "math-g5-word",
              weight: 2,
              type: "linechart-app",
              description: "读取折线统计图并回答变化问题。",
              example: "根据气温折线图回答最高气温。",
              prerequisites: ["g5-m4-g5-fill-linechart"],
              related: ["g5-m4-g5-fill-linechart","g5-m9-g5-stats-line1"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-tree",
              name: "植树问题",
              pluginId: "math-g5-word",
              weight: 3,
              type: "tree-app",
              description: "掌握植树问题的三种情形。",
              example: "环形路上栽树，棵数=？（答案：段数）",
              prerequisites: ["g5-m7-g5-pic-tree"],
              related: ["g5-m7-g5-pic-tree","g5-m10-g5-reason-tree3","g5-m8-g5-word-fm"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m8-g5-word-defect",
              name: "找次品",
              pluginId: "math-g5-word",
              weight: 2,
              type: "defective",
              description: "用天平最少次数找出次品。",
              example: "9个物品中有1个较轻，至少称几次？（答案：2次）",
              prerequisites: ["g5-m8-g5-word-decdiv"],
              related: ["g5-m10-g5-reason-defect","g5-m8-g5-word-decdiv"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M9",
          knowledgePoints: [
            {
              id: "g5-m9-g5-stats-possib",
              name: "可能性大小比较",
              pluginId: "math-g5-stats",
              weight: 3,
              type: "possibility-compare",
              description: "比较不同事件发生可能性的大小。",
              example: "哪种颜色的球多，摸到它的可能性就大。",
              prerequisites: ["g5-m4-g5-fill-possible"],
              related: ["g5-m8-g5-word-possib","g6-m9-g6-stat-possibility","g5-m4-g5-fill-possible"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m9-g5-stats-line1",
              name: "单式折线统计图",
              pluginId: "math-g5-stats",
              weight: 3,
              type: "linechart-single",
              description: "绘制单条折线统计图。",
              example: "根据月销量数据画折线图。",
              prerequisites: ["g5-m4-g5-fill-linechart"],
              related: ["g5-m9-g5-stats-line2","g5-m8-g5-word-linechart","g5-m4-g5-fill-linechart"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m9-g5-stats-line2",
              name: "复式折线统计图",
              pluginId: "math-g5-stats",
              weight: 3,
              type: "linechart-double",
              description: "在同一图中画两组数据的复式折线统计图。",
              example: "画出甲、乙两人成绩的复式折线图。",
              prerequisites: ["g5-m9-g5-stats-line1"],
              related: ["g5-m9-g5-stats-line1","g6-m9-g6-stat-pie-chart"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M10",
          knowledgePoints: [
            {
              id: "g5-m10-g5-reason-tree3",
              name: "植树问题（三种情况）",
              pluginId: "math-g5-reason",
              weight: 3,
              type: "tree-three",
              description: "区分植树问题两端都种、只种一端、两端不种。",
              example: "两端都不种时，棵数=段数-1。",
              prerequisites: ["g5-m8-g5-word-tree"],
              related: ["g5-m8-g5-word-tree","g5-m10-g5-reason-seq","g5-m7-g5-pic-tree"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m10-g5-reason-defect",
              name: "找次品（天平称量）",
              pluginId: "math-g5-reason",
              weight: 3,
              type: "defective-scale",
              description: "用天平分组称量找出次品。",
              example: "从8个物品中找1个次品，至少称几次？（答案：2次）",
              prerequisites: ["g5-m8-g5-word-defect"],
              related: ["g5-m8-g5-word-defect","g5-m10-g5-reason-seq"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m10-logic-reasoning",
              name: "逻辑推理",
              pluginId: "math-g5-reason",
              weight: 2,
              type: "logic",
              description: "用列表等方法进行逻辑推理。",
              example: "三人各爱好不同，推理各自的爱好。",
              prerequisites: ["g4-m10-logic-reasoning"],
              related: ["g4-m10-logic-reasoning","g5-m10-g5-reason-seq","g5-m10-g5-reason-tree3"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m10-g5-reason-seq",
              name: "数字推理",
              pluginId: "math-g5-reason",
              weight: 2,
              type: "sequence",
              description: "寻找数列的规律并填数。",
              example: "2, 4, 8, 16, （  ）。（答案：32）",
              prerequisites: ["g1-m4-patterns"],
              related: ["g5-m10-logic-reasoning","g6-m10-g6-reason-number-shape"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M11",
          knowledgePoints: [
            {
              id: "g5-m11-g5-judge-decmul",
              name: "小数乘除法",
              pluginId: "math-g5-judge",
              weight: 3,
              type: "dec",
              description: "判断小数乘除的计算正误。",
              example: "判断：0.2×0.3=0.6。（错，应为0.06）",
              prerequisites: ["g5-m2-g5-v-decmul"],
              related: ["g5-m12-g5-choice-decmul","g5-m2-g5-v-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-g5-judge-equ",
              name: "方程概念",
              pluginId: "math-g5-judge",
              weight: 2,
              type: "equation",
              description: "判断哪些式子是方程。",
              example: "判断：3+5=8是方程。（错）",
              prerequisites: ["g5-m4-g5-fill-equation"],
              related: ["g5-m12-g5-choice-equ","g5-m4-g5-fill-equation"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-g5-judge-fm",
              name: "因数与倍数",
              pluginId: "math-g5-judge",
              weight: 3,
              type: "factor-multiple",
              description: "判断因数与倍数相关的说法。",
              example: "判断：1是所有非零自然数的因数。（对）",
              prerequisites: ["g5-m4-g5-fill-fm"],
              related: ["g5-m12-g5-choice-fm","g5-m4-g5-fill-fm"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-g5-judge-frac",
              name: "分数的意义与性质",
              pluginId: "math-g5-judge",
              weight: 3,
              type: "fraction",
              description: "判断分数的意义与基本性质。",
              example: "判断：2/3=4/6。（对）",
              prerequisites: ["g5-m4-g5-fill-fracmean"],
              related: ["g5-m12-g5-choice-frac","g5-m4-g5-fill-fracmean"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-g5-judge-area",
              name: "多边形面积",
              pluginId: "math-g5-judge",
              weight: 3,
              type: "area",
              description: "判断面积公式与计算。",
              example: "判断：三角形面积=底×高。（错，应÷2）",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g5-m12-g5-choice-area","g5-m4-g5-fill-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-g5-judge-solid",
              name: "长方体正方体",
              pluginId: "math-g5-judge",
              weight: 3,
              type: "solid",
              description: "判断立体图形的特征。",
              example: "判断：正方体是特殊的长方体。（对）",
              prerequisites: ["g5-m4-g5-fill-solid"],
              related: ["g5-m12-g5-choice-solid","g5-m4-g5-fill-solid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-motion",
              name: "图形的运动",
              pluginId: "math-g5-judge",
              weight: 2,
              type: "rotation",
              description: "判断图形的运动方式。",
              example: "判断：风车转动是旋转。（对）",
              prerequisites: ["g5-m4-g5-fill-rotate"],
              related: ["g5-m12-motion","g5-m6-g5-draw-rotate","g5-m4-g5-fill-rotate"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-g5-judge-possib",
              name: "可能性",
              pluginId: "math-g5-judge",
              weight: 2,
              type: "possibility",
              description: "判断可能性的描述正误。",
              example: "判断：明天一定下雨。（错）",
              prerequisites: ["g5-m4-g5-fill-possible"],
              related: ["g5-m12-g5-choice-possib","g5-m4-g5-fill-possible"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m11-stats",
              name: "统计",
              pluginId: "math-g5-judge",
              weight: 2,
              type: "stats",
              description: "判断统计图表相关的说法。",
              example: "判断：折线图能看变化趋势。（对）",
              prerequisites: ["g5-m4-g5-fill-linechart"],
              related: ["g5-m12-stats","g4-m11-stats"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M12",
          knowledgePoints: [
            {
              id: "g5-m12-g5-choice-decmul",
              name: "小数乘除法",
              pluginId: "math-g5-choice",
              weight: 3,
              type: "dec",
              description: "选择小数乘除的正确结果。",
              example: "0.4×0.2=?（答案：0.08）",
              prerequisites: ["g5-m2-g5-v-decmul"],
              related: ["g5-m11-g5-judge-decmul","g5-m2-g5-v-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-g5-choice-equ",
              name: "方程",
              pluginId: "math-g5-choice",
              weight: 3,
              type: "equation",
              description: "选择正确方程或其解。",
              example: "x-2=5，x=?（答案：7）",
              prerequisites: ["g5-m4-g5-fill-equation"],
              related: ["g5-m11-g5-judge-equ","g5-m4-g5-fill-equation"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-g5-choice-fm",
              name: "因数与倍数",
              pluginId: "math-g5-choice",
              weight: 3,
              type: "factor-multiple",
              description: "选择因数与倍数的正确结论。",
              example: "下列各数是合数的是？（答案：9）",
              prerequisites: ["g5-m4-g5-fill-fm"],
              related: ["g5-m11-g5-judge-fm","g5-m4-g5-fill-fm"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-g5-choice-frac",
              name: "分数的意义与性质",
              pluginId: "math-g5-choice",
              weight: 3,
              type: "fraction",
              description: "选择分数相关的正确表述。",
              example: "与2/5相等的是？（答案：4/10）",
              prerequisites: ["g5-m4-g5-fill-fracmean"],
              related: ["g5-m11-g5-judge-frac","g5-m4-g5-fill-fracmean"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-g5-choice-area",
              name: "多边形的面积",
              pluginId: "math-g5-choice",
              weight: 3,
              type: "area",
              description: "选择面积计算的正确结果。",
              example: "底6、高3的平行四边形面积？（答案：18）",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g5-m11-g5-judge-area","g5-m4-g5-fill-area"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-g5-choice-solid",
              name: "长方体正方体容积",
              pluginId: "math-g5-choice",
              weight: 3,
              type: "solid",
              description: "选择长方体、正方体体积（容积）的正确计算。",
              example: "长、宽、高2、3、4的长方体体积？（答案：24）",
              prerequisites: ["g5-m4-g5-fill-solid"],
              related: ["g5-m11-g5-judge-solid","g5-m4-g5-fill-solid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-motion",
              name: "图形的运动",
              pluginId: "math-g5-choice",
              weight: 2,
              type: "rotation",
              description: "选择图形的运动方式判断。",
              example: "电梯上下运动是？（答案：平移）",
              prerequisites: ["g5-m4-g5-fill-rotate"],
              related: ["g5-m11-motion","g5-m6-g5-draw-rotate","g5-m4-g5-fill-rotate"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-g5-choice-possib",
              name: "可能性",
              pluginId: "math-g5-choice",
              weight: 2,
              type: "possibility",
              description: "选择可能性大小的判断。",
              example: "抛硬币正面朝上的可能性？（答案：1/2）",
              prerequisites: ["g5-m4-g5-fill-possible"],
              related: ["g5-m11-g5-judge-possib","g5-m4-g5-fill-possible"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g5-m12-stats",
              name: "统计",
              pluginId: "math-g5-choice",
              weight: 2,
              type: "stats",
              description: "选择合适的统计图类型。",
              example: "比较各月销量用？（答案：条形统计图）",
              prerequisites: ["g5-m4-g5-fill-linechart"],
              related: ["g5-m11-stats","g4-m11-stats"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C1",
          knowledgePoints: [
            {
              id: "g5-c1-digit-puzzle-vertical",
              name: "竖式谜",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "vertical",
              description: "在加减乘除竖式的 □ 中填数字使竖式成立，练习位值与进位借位推理。",
              example: "在 □ 中填数字使竖式成立：3□＋□5＝88。",
              prerequisites: ["g4-c1-c1-vertical"],
              related: ["g5-c1-digit-puzzle-horizontal"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c1-digit-puzzle-horizontal",
              name: "横式谜",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "horizontal",
              description: "在等式 □ 中填入合适的数或运算符号，使等式成立。",
              example: "在 □ 填数字使等式成立：□×3＋4＝25。",
              prerequisites: ["g4-c1-c1-horizontal"],
              related: ["g5-c1-digit-puzzle-vertical","g5-c1-digit-puzzle-symbol"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c1-digit-puzzle-symbol",
              name: "字母符号代表数",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "symbol",
              description: "用图形或字母代表数字，通过等式关系推出各符号代表的数（位值原理）。",
              example: "已知 a×b＝18，a＋b＝9（a＞b），求 a、b。",
              prerequisites: ["g4-c1-c1-symbol"],
              related: ["g5-c1-digit-puzzle-vertical","g5-c2-place-value"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c1-number-array-closed",
              name: "封闭型数阵",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "array-closed",
              description: "将数填入封闭图形（三角形、四边形）的各交点上，使每条边上的和相等。",
              example: "把 1~6 填入六边形每条边的 3 个点，使每条边的和相等。",
              prerequisites: ["g4-c1-c1-array"],
              related: ["g5-c1-number-array-radial"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c1-number-array-radial",
              name: "辐射型数阵",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "array-radial",
              description: "将数填入辐射型数阵，使各条线上的和相等，确定中心数与配对数。",
              example: "把 1~7 填入辐射型数阵，使每条线上的三数和相等。",
              prerequisites: ["g4-c1-c1-array"],
              related: ["g5-c1-number-array-closed","g5-c1-number-array-composite"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c1-number-array-composite",
              name: "复合型数阵",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "array-composite",
              description: "综合封闭型与辐射型的复合数阵，多条件约束下填数求最优解。",
              example: "复合数阵中确定使各线和相等的最小中心数。",
              prerequisites: ["g4-c1-c1-array"],
              related: ["g5-c1-number-array-closed","g5-c1-magic-square-3"],
              difficulty: 5,
              status: "placeholder"
            },
            {
              id: "g5-c1-magic-square-3",
              name: "三阶幻方",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "magic3",
              description: "将 1~9 填入 3×3 方格，使每行、每列、两条对角线的和相等（＝15）。",
              example: "补全三阶幻方，使每行每列对角线和为 15。",
              prerequisites: ["g4-c1-c1-magic"],
              related: ["g5-c1-number-array-composite","g5-c1-magic-square-4"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c1-magic-square-4",
              name: "四阶幻方初步",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "magic4",
              description: "将连续自然数填入 4×4 方格构成幻方，认识幻和与构造方法。",
              example: "将 1~16 填入 4×4 方格，使每行每列对角线和相等。",
              prerequisites: ["g4-c1-c1-magic"],
              related: ["g5-c1-magic-square-3"],
              difficulty: 4,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C2",
          knowledgePoints: [
            {
              id: "g5-c2-divisibility",
              name: "整除特征",
              pluginId: "math-competition-g5-c2",
              weight: 1,
              type: "divisibility",
              description: "掌握 2、3、5、9 等常见整数的整除特征，快速判断整除性。",
              example: "判断 12345 能否被 3 整除。",
              prerequisites: ["g4-c2-c2-divisible"],
              related: ["g5-c2-gcd-lcm","g5-c2-factor-count-sum"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c2-parity-analysis",
              name: "奇偶分析",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "parity",
              description: "利用奇偶性（奇＋奇＝偶等）推理运算结果或锁定答案范围。",
              example: "三个连续自然数之积是奇数还是偶数？",
              prerequisites: ["g4-c2-c2-parity"],
              related: ["g5-c2-remainder-congruence"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c2-prime-composite",
              name: "质数与合数",
              pluginId: "math-competition-g5-c2",
              weight: 1,
              type: "prime",
              description: "认识质数与合数，掌握 100 以内质数表与判断方法。",
              example: "判断 91 是质数还是合数。",
              prerequisites: ["g4-c2-c2-prime"],
              related: ["g5-c2-prime-factorization"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c2-prime-factorization",
              name: "分解质因数",
              pluginId: "math-competition-g5-c2",
              weight: 1,
              type: "prime-factor",
              description: "用短除法把合数分解为质因数乘积（如 60＝2²×3×5）。",
              example: "分解质因数：72＝？",
              prerequisites: ["g4-c2-c2-prime"],
              related: ["g5-c2-factor-count-sum","g5-c2-gcd-lcm","g5-c2-perfect-square"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c2-factor-count-sum",
              name: "因数个数与因数和",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "factor-count",
              description: "由标准分解式求因数个数（指数＋1 连乘）与因数和公式。",
              example: "72 有多少个因数？",
              prerequisites: ["g4-c2-c2-factor"],
              related: ["g5-c2-perfect-square","g5-c2-number-theory-extreme"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c2-gcd-lcm",
              name: "最大公因数与最小公倍数",
              pluginId: "math-competition-g5-c2",
              weight: 1,
              type: "gcd-lcm",
              description: "用短除法 / 分解质因数求最大公因数与最小公倍数。",
              example: "求 24 和 36 的最大公因数与最小公倍数。",
              prerequisites: ["g4-c2-c2-factor"],
              related: ["g5-c2-divisibility"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c2-remainder-congruence",
              name: "余数与同余",
              pluginId: "math-competition-g5-c2",
              weight: 1,
              type: "remainder",
              description: "带余除法与同余概念，解「除以某数余几」类问题。",
              example: "一个数除以 7 余 3、除以 9 余 3，最小是几？",
              prerequisites: ["g4-c2-c2-remainder"],
              related: ["g5-c2-parity-analysis","g5-c2-number-theory-extreme"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c2-place-value",
              name: "位值原理",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "place",
              description: "利用数字所在数位的值（位值）进行推理与代换。",
              example: "一个两位数，十位与个位互换后比原数大 18，求原数。",
              prerequisites: ["g4-c2-c2-place"],
              related: ["g5-c1-digit-puzzle-symbol"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c2-perfect-square",
              name: "完全平方数",
              pluginId: "math-competition-g5-c2",
              weight: 1,
              type: "perfect-square",
              description: "识别完全平方数，利用质因数指数均为偶数判断。",
              example: "判断 144 是完全平方数吗？",
              prerequisites: ["g4-c2-c2-factor"],
              related: ["g5-c2-prime-factorization","g5-c2-number-theory-extreme"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c2-number-theory-extreme",
              name: "数论最值",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "nt-extreme",
              description: "综合数论知识求最大 / 最小值（如因数个数、和一定积最大等）。",
              example: "n 恰有 6 个因数且 n 最小，求 n。",
              prerequisites: ["g4-c2-c2-factor"],
              related: ["g5-c2-perfect-square","g5-c9-diophantine-equation"],
              difficulty: 5,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C3",
          knowledgePoints: [
            {
              id: "g5-c3-addition-principle",
              name: "加法原理",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "add-principle",
              description: "分类完成一件事，方法数＝各类方法数之和。",
              example: "从书架任取一本书，语文 5 本数学 3 本，共几种取法？",
              prerequisites: ["g4-c3-c3-am"],
              related: ["g5-c3-multiplication-principle"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c3-multiplication-principle",
              name: "乘法原理",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "mult-principle",
              description: "分步完成一件事，方法数＝各步方法数之积。",
              example: "穿 3 件上衣 ×2 条裤子，共几种搭配？",
              prerequisites: ["g4-c3-c3-am"],
              related: ["g5-c3-addition-principle","g5-c3-permutation"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c3-permutation",
              name: "排列数",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "permutation",
              description: "从 n 个不同元素取出 m 个按顺序排列，方法数＝P(n,m)。",
              example: "3 人站成一排，有几种站法？",
              prerequisites: ["g4-c3-c3-perm"],
              related: ["g5-c3-combination","g5-c3-bundling-method"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c3-combination",
              name: "组合数",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "combination",
              description: "从 n 个不同元素取出 m 个不分顺序成组，方法数＝C(n,m)。",
              example: "从 5 人中选 2 人组成小组，有几种选法？",
              prerequisites: ["g4-c3-c3-perm"],
              related: ["g5-c3-permutation","g5-c3-stars-bars"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c3-enumeration-counting",
              name: "枚举计数",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "enumeration",
              description: "有序列举所有可能，做到不重不漏（分类讨论）。",
              example: "用 1、2、3 组成无重复数字的两位数有几种？",
              prerequisites: ["g4-c3-c3-enum"],
              related: ["g5-c9-chicken-rabbit"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c3-bundling-method",
              name: "捆绑法",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "bundling",
              description: "要求某些元素相邻时，把它们看作一个整体（捆绑）再排列。",
              example: "甲乙相邻排成一排（共 4 人），有几种排法？",
              prerequisites: ["g4-c3-c3-perm"],
              related: ["g5-c3-insertion-method"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c3-insertion-method",
              name: "插空法",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "insertion",
              description: "要求某些元素不相邻时，先排其余元素再用空位插空。",
              example: "4 男 2 女，女生不相邻，有几种排法？",
              prerequisites: ["g4-c3-c3-perm"],
              related: ["g5-c3-bundling-method"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c3-stars-bars",
              name: "隔板法",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "stars-bars",
              description: "将 n 个相同物品分给 k 个不同对象（每份至少一个），用隔板隔开计数。",
              example: "把 5 个相同苹果分给 3 个小朋友，每人至少 1 个，有几种分法？",
              prerequisites: ["g4-c3-c3-perm"],
              related: ["g5-c3-combination","g5-c9-diophantine-equation"],
              difficulty: 5,
              status: "placeholder"
            },
            {
              id: "g5-c3-pigeonhole-principle",
              name: "抽屉原理",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "pigeonhole",
              description: "n＋1 个物体放 n 个抽屉必有一个至少 2 个，并推广至更一般形式。",
              example: "13 人中必有两个生日在同一个月，为什么？",
              prerequisites: ["g4-c3-c3-worst"],
              related: ["g5-c3-worst-case-principle"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c3-worst-case-principle",
              name: "最不利原则",
              pluginId: "math-competition-g5-c3",
              weight: 1,
              type: "worst-case",
              description: "考虑最坏情况（尽量平均 / 不利）再＋1，保证结论成立。",
              example: "袋中有红黄蓝球各 5 个，至少取几个保证有两球同色？",
              prerequisites: ["g4-c3-c3-worst"],
              related: ["g5-c3-pigeonhole-principle"],
              difficulty: 4,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C4",
          knowledgePoints: [
            {
              id: "g5-c4-area-basic",
              name: "基本面积公式",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "area-basic",
              description: "熟练三角形、平行四边形、梯形等基本面积公式与底高对应。",
              example: "底 8 高 5 的三角形面积＝？",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-equal-area-transform"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c4-equal-area-transform",
              name: "等积变形",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "equal-area",
              description: "利用同底等高（等底等高）变换面积关系解题。",
              example: "等底等高的三角形面积一定相等，据此求面积。",
              prerequisites: ["g4-c4-c4-cutfill"],
              related: ["g5-c4-half-model","g5-c4-bird-head-model"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-bird-head-model",
              name: "鸟头模型",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "bird-head",
              description: "两个三角形有一角相等或互补，面积比等于夹该角两边乘积之比。",
              example: "三角形 ABC 中 AD:DB＝2:3，AE:EC＝1:4，求 S△ADE:S△ABC。",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-butterfly-model","g5-c4-half-model"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-butterfly-model",
              name: "蝴蝶模型",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "butterfly",
              description: "梯形 / 任意四边形对角线分出的面积关系（蝴蝶定理）。",
              example: "梯形中两对角线分出的上下三角形面积之积＝左右面积之积。",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-swallow-tail-model","g5-c4-bird-head-model"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-swallow-tail-model",
              name: "燕尾模型",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "swallow-tail",
              description: "三角形内一点连线分割，利用面积比与线段比互推（燕尾定理）。",
              example: "由燕尾定理求面积比或线段比。",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-butterfly-model","g5-c4-half-model"],
              difficulty: 5,
              status: "placeholder"
            },
            {
              id: "g5-c4-half-model",
              name: "一半模型",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "half",
              description: "利用「面积一半」模型（如平行四边形中三角形占一半）求面积。",
              example: "平行四边形内任取一点连到四顶点，中间三角形占总面积多少？",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-bird-head-model"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-circle-sector",
              name: "圆与扇形",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "circle",
              description: "圆周长 / 面积与扇形弧长 / 面积公式，及组合图形应用。",
              example: "r＝3 的圆面积＝？（π 取 3.14）",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-angle-calculation"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c4-solid-geometry",
              name: "立体图形表面积与体积",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "solid",
              description: "长方体、正方体、圆柱、圆锥的表面积与体积计算。",
              example: "棱长 3 的正方体体积＝？",
              prerequisites: ["g4-c4-c4-solid"],
              related: ["g5-c4-painted-cube"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-painted-cube",
              name: "表面涂色问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "painted-cube",
              description: "正方体表面涂色后切分，分类计数三面 / 两面 / 一面 / 无色小正方体。",
              example: "3×3×3 涂色后切开，一面涂色的有几个？",
              prerequisites: ["g4-c4-c4-solid"],
              related: ["g5-c4-solid-geometry"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-pythagorean-theorem",
              name: "勾股定理",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "pythagorean",
              description: "直角三角形两直角边平方和等于斜边平方（a²＋b²＝c²）。",
              example: "直角边 3、4，斜边＝？",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-lattice-area","g5-c4-angle-calculation"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c4-lattice-area",
              name: "格点面积",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "lattice",
              description: "在方格纸上用割补 / 公式求格点多边形面积。",
              example: "数格子求格点多边形面积。",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g5-c4-pythagorean-theorem"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c4-angle-calculation",
              name: "角度计算",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "angle",
              description: "利用三角形内角和、角平分线、外角等关系求角度。",
              example: "三角形两角为 40°、70°，第三角＝？",
              prerequisites: ["g4-c4-c4-angle"],
              related: ["g5-c4-circle-sector"],
              difficulty: 3,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C5",
          knowledgePoints: [
            {
              id: "g5-c5-basic-motion",
              name: "基本行程",
              pluginId: "math-competition-g5-c5",
              weight: 1,
              type: "basic",
              description: "路程＝速度×时间三者互求，注意单位统一。",
              example: "速度 5 米/秒走 20 秒，路程＝？",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g5-c5-meet-problem","g5-c5-chase-problem"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c5-meet-problem",
              name: "相遇问题",
              pluginId: "math-competition-g5-c5",
              weight: 1,
              type: "meet",
              description: "相向而行，相遇时间＝路程和÷速度和。",
              example: "相距 120 米，速度和 12 米/秒，几秒相遇？",
              prerequisites: ["g4-c5-c5-meet"],
              related: ["g5-c5-chase-problem","g5-c5-circular-track"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c5-chase-problem",
              name: "追及问题",
              pluginId: "math-competition-g5-c5",
              weight: 1,
              type: "chase",
              description: "同向而行，追及时间＝路程差÷速度差。",
              example: "速度差 3 米/秒、路程差 60 米，几秒追上？",
              prerequisites: ["g4-c5-c5-chase"],
              related: ["g5-c5-meet-problem","g5-c5-clock-problem"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c5-train-bridge",
              name: "火车过桥",
              pluginId: "math-competition-g5-c5",
              weight: 1,
              type: "train",
              description: "过桥 / 隧道总路程＝桥长＋车长。",
              example: "车长 100 米过 300 米桥，速度 20 米/秒，需几秒？",
              prerequisites: ["g4-c5-c5-train"],
              related: ["g5-c5-boat-stream"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c5-boat-stream",
              name: "流水行船",
              pluginId: "math-competition-g5-c5",
              weight: 1,
              type: "boat",
              description: "顺水速＝船速＋水速，逆水速＝船速−水速。",
              example: "船速 10 水速 2，顺水速度＝？",
              prerequisites: ["g4-c5-c5-river"],
              related: ["g5-c5-circular-track"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c5-circular-track",
              name: "环形跑道",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "circular",
              description: "环形跑道相遇 / 追及，考虑同向与反向。",
              example: "环形跑道 400 米，同向速度差下追及一圈的时间。",
              prerequisites: ["g4-c5-c5-meet"],
              related: ["g5-c5-meet-problem","g5-c5-ratio-motion"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c5-clock-problem",
              name: "时钟问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "clock",
              description: "时针分针视为追及运动（分针 6°/分，时针 0.5°/分）。",
              example: "3 点后时针分针首次重合是几分钟后？",
              prerequisites: ["g4-c5-c5-chase"],
              related: ["g5-c5-circular-track"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c5-average-speed",
              name: "平均速度",
              pluginId: "math-competition-g5-c5",
              weight: 1,
              type: "avg-speed",
              description: "平均速度＝总路程÷总时间（≠速度求平均）。",
              example: "去 4 米/秒回 6 米/秒，全程平均速度＝？",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g5-c5-ratio-motion"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c5-ratio-motion",
              name: "比例行程",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "ratio",
              description: "利用速度比＝时间反比等比例关系解行程。",
              example: "时间比 3:2，速度比＝？",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g5-c5-average-speed","g5-c9-fraction-percent-application"],
              difficulty: 5,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C6",
          knowledgePoints: [
            {
              id: "g5-c6-work-problem",
              name: "工程问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "work",
              description: "把总工作量看作单位 1，效率＝1÷时间，合作效率＝效率和。",
              example: "甲 6 天完成、乙 3 天完成，合作几天完成？",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c6-concentration-problem","g5-c5-basic-motion"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c6-concentration-problem",
              name: "浓度问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "concentration",
              description: "溶质 / 溶液 / 浓度关系，混合后浓度＝溶质总量÷溶液总量。",
              example: "10% 盐水 200g，加多少水变 5%？",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c6-work-problem","g5-c9-fraction-percent-application"],
              difficulty: 4,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C7",
          knowledgePoints: [
            {
              id: "g5-c7-extract-common-factor",
              name: "提取公因数",
              pluginId: "math-competition-g5-c7",
              weight: 1,
              type: "extract-factor",
              description: "提取相同因数，逆用乘法分配律简化计算。",
              example: "3.5×4＋3.5×6＝？",
              prerequisites: ["g4-m3-g4-mix-dist"],
              related: ["g5-c7-rounding-calc","g5-c7-fraction-splitting"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c7-rounding-calc",
              name: "凑整巧算",
              pluginId: "math-competition-g5-c7",
              weight: 1,
              type: "rounding",
              description: "把数凑成整十整百再计算（如 99＋57＝100＋56）。",
              example: "用凑整法计算 98＋57。",
              prerequisites: ["g4-m3-g4-mix-order"],
              related: ["g5-c7-extract-common-factor"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c7-fraction-splitting",
              name: "分数裂项",
              pluginId: "math-competition-g5-c7",
              weight: 1,
              type: "frac-split",
              description: "把分数拆成两分数之差，相邻项相消（裂项相消）。",
              example: "1/2＋1/6＋1/12＋…＋1/90＝？",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c7-integer-splitting","g5-c7-complex-fraction"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c7-integer-splitting",
              name: "整数裂项",
              pluginId: "math-competition-g5-c7",
              weight: 1,
              type: "int-split",
              description: "把整数 / 整数积拆项相消（差分形式）。",
              example: "1×2＋2×3＋…＋9×10＝？",
              prerequisites: ["g4-m3-g4-mix-dist"],
              related: ["g5-c7-fraction-splitting"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c7-arithmetic-series",
              name: "等差数列",
              pluginId: "math-competition-g5-c7",
              weight: 1,
              type: "series",
              description: "等差数列通项与求和：末项＝首项＋(n−1)d，和＝(首＋末)×n÷2。",
              example: "求 1＋3＋5＋…＋19。",
              prerequisites: ["g1-m4-patterns"],
              related: ["g5-c9-periodic-problem"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c7-recurring-decimal-frac",
              name: "循环小数化分数",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "recurring",
              description: "循环小数化分数：纯循环 / 混循环的分子分母规则。",
              example: "0.3（3 循环）＝？",
              prerequisites: ["g3-m4-g3-decimal"],
              related: ["g5-c7-complex-fraction"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c7-define-operation",
              name: "定义新运算",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "define-op",
              description: "按新定义运算规则代入计算（如 a*b＝a×b−a＋b）。",
              example: "定义 a*b＝a×b＋a＋b，求 2*3。",
              prerequisites: ["g4-m3-g4-mix-order"],
              related: ["g5-c7-estimate-bounds"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c7-compare-size",
              name: "比较大小",
              pluginId: "math-competition-g5-c7",
              weight: 1,
              type: "compare",
              description: "分数 / 小数 / 算式比较大小：通分、交叉相乘或估算。",
              example: "比较 5/8 与 3/5 的大小。",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c7-estimate-bounds"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c7-estimate-bounds",
              name: "估算与放缩",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "estimate",
              description: "用估值与放缩确定范围，用于比较与证明。",
              example: "估计若干真分数之和的范围。",
              prerequisites: ["g4-m12-g4-choice-est"],
              related: ["g5-c7-complex-fraction","g5-c7-compare-size"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c7-complex-fraction",
              name: "繁分数化简",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "complex-frac",
              description: "多层分数的化简：从最内层逐层通分，除以分数乘其倒数。",
              example: "化简 1/(1＋1/2)。",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c7-fraction-splitting","g5-c7-recurring-decimal-frac"],
              difficulty: 4,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C8",
          knowledgePoints: [
            {
              id: "g5-c8-extremum-problem",
              name: "最值问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "extremum",
              description: "求最大 / 最小值：和一定积最大、差越小积越大等。",
              example: "两数和为 10，积最大是多少？",
              prerequisites: ["g4-c8-c8-extreme"],
              related: ["g5-c2-number-theory-extreme","g5-c3-worst-case-principle"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c8-logic-inference",
              name: "逻辑推理",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "logic",
              description: "列表法、假设法、排除法综合多个条件推理。",
              example: "甲乙丙三人中只有一人说真话，推理谁是作案者。",
              prerequisites: ["g4-c8-c8-logic"],
              related: ["g5-c9-inclusion-exclusion"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c8-winning-strategy",
              name: "必胜策略",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "winning",
              description: "对策论：找制胜点与必胜策略（对称、取余等）。",
              example: "取石子游戏（每次 1~3 颗，取最后一颗胜），先手必胜策略？",
              prerequisites: ["g4-c8-c8-logic"],
              related: ["g5-c3-pigeonhole-principle","g5-c8-extremum-problem"],
              difficulty: 5,
              status: "placeholder"
            }
          ]
        },
        {
          moduleId: "C9",
          knowledgePoints: [
            {
              id: "g5-c9-sum-diff-problem",
              name: "和差倍问题",
              pluginId: "math-competition-g5-c9",
              weight: 1,
              type: "sum-diff",
              description: "已知和与差（或倍）求各数：大数＝(和＋差)÷2。",
              example: "两数和 30 差 6，各是几？",
              prerequisites: ["g4-m8-g4-word-div"],
              related: ["g5-c9-age-problem","g5-c9-chicken-rabbit"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c9-age-problem",
              name: "年龄问题",
              pluginId: "math-competition-g5-c9",
              weight: 1,
              type: "age",
              description: "年龄差不变，利用差倍关系求各年龄。",
              example: "父 35 岁子 5 岁，几年后父亲年龄是子的 3 倍？",
              prerequisites: ["g4-m8-g4-word-div"],
              related: ["g5-c9-sum-diff-problem"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c9-profit-loss-problem",
              name: "盈亏问题",
              pluginId: "math-competition-g5-c9",
              weight: 1,
              type: "profit-loss",
              description: "两种分配方案盈亏相抵，求人数与总数。",
              example: "每人 5 个多 3 个，每人 7 个少 5 个，共几人？",
              prerequisites: ["g4-m8-g4-word-div"],
              related: ["g5-c9-chicken-rabbit","g5-c9-average-problem"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c9-chicken-rabbit",
              name: "鸡兔同笼",
              pluginId: "math-competition-g5-c9",
              weight: 1,
              type: "chicken-rabbit",
              description: "已知头数与脚数求鸡兔数（假设法）。",
              example: "笼中共 35 头 94 脚，鸡兔各几只？",
              prerequisites: ["g4-m8-g4-word-cr"],
              related: ["g5-c9-sum-diff-problem","g5-c9-profit-loss-problem"],
              difficulty: 4,
              status: "active"
            },
            {
              id: "g5-c9-average-problem",
              name: "平均数问题",
              pluginId: "math-competition-g5-c9",
              weight: 1,
              type: "average",
              description: "总数÷份数＝平均数，移多补少思想。",
              example: "三个数和为 60，平均数＝？",
              prerequisites: ["g4-m8-g4-word-avg"],
              related: ["g5-c9-profit-loss-problem"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c9-planting-problem",
              name: "植树问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "planting",
              description: "两端都栽 / 只栽一端 / 两端不栽时棵数与间隔数关系。",
              example: "100 米每隔 5 米种一棵（两端都栽），种几棵？",
              prerequisites: ["g1-m4-patterns"],
              related: ["g5-c9-phalanx-problem"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c9-phalanx-problem",
              name: "方阵问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "phalanx",
              description: "实心 / 空心方阵：每层边数差 2，实心总数＝边数²。",
              example: "5×5 实心方阵共多少人？",
              prerequisites: ["g4-m8-g4-word-div"],
              related: ["g5-c9-planting-problem"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c9-periodic-problem",
              name: "周期问题",
              pluginId: "math-competition-g5-c9",
              weight: 1,
              type: "periodic",
              description: "找周期与余数，确定第 n 个 / 某位置的状态。",
              example: "红黄蓝循环排列，第 20 个是什么颜色？",
              prerequisites: ["g1-m4-patterns"],
              related: ["g5-c7-arithmetic-series"],
              difficulty: 3,
              status: "active"
            },
            {
              id: "g5-c9-grass-problem",
              name: "牛吃草问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "grass",
              description: "草每天匀速生长，牛吃草与生长量共同变化（总量＝原有＋生长）。",
              example: "牛吃草问题中求原有草量或可养牛头数。",
              prerequisites: [],
              related: ["g5-c6-work-problem","g5-c9-fraction-percent-application"],
              difficulty: 5,
              status: "placeholder"
            },
            {
              id: "g5-c9-fraction-percent-application",
              name: "分数百分数应用题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "frac-percent",
              description: "求一个数的几分之几 / 百分之几，已知部分求整体，及增减变化。",
              example: "一件衣服原价 100 元打八折后多少元？",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c6-work-problem","g5-c6-concentration-problem","g5-c5-ratio-motion"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c9-economics-problem",
              name: "经济问题",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "economics",
              description: "进价 / 售价 / 利润 / 利润率与折扣关系。",
              example: "进价 80 售价 100，利润率＝？",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g5-c9-fraction-percent-application","g5-c9-equation-linear-1"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c9-inclusion-exclusion",
              name: "容斥原理",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "inclusion-exclusion",
              description: "两集合 / 三集合容斥：总数＝A∪B＝A＋B−A∩B。",
              example: "喜欢数学 30 人、语文 25 人、两科都喜 10 人，至少喜一科几人？",
              prerequisites: ["g4-c3-c3-enum"],
              related: ["g5-c3-addition-principle","g5-c8-logic-inference"],
              difficulty: 5,
              status: "placeholder"
            },
            {
              id: "g5-c9-equation-linear-1",
              name: "一元一次方程（工具）",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "eq1",
              description: "设未知数列一元一次方程并求解（工具知识点）。",
              example: "解方程 2x＋3＝11。",
              prerequisites: ["g4-m4-g4-fill-op"],
              related: ["g5-c9-equation-linear-2","g5-c5-ratio-motion"],
              difficulty: 3,
              status: "placeholder"
            },
            {
              id: "g5-c9-equation-linear-2",
              name: "二元一次方程组（工具）",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "eq2",
              description: "消元法（代入 / 加减）解二元一次方程组（工具知识点）。",
              example: "解方程组 x＋y＝5，x−y＝1。",
              prerequisites: ["g4-m4-g4-fill-op"],
              related: ["g5-c9-diophantine-equation"],
              difficulty: 4,
              status: "placeholder"
            },
            {
              id: "g5-c9-diophantine-equation",
              name: "不定方程整数解（C9/C2）",
              pluginId: "math-competition-placeholder",
              weight: 1,
              type: "diophantine",
              description: "不定方程的整数解（枚举试解 / 整除分析），用于数论最值（与 C2 共用）。",
              example: "求 2x＋3y＝11 的正整数解。",
              prerequisites: ["g4-m4-g4-fill-op"],
              related: ["g5-c2-number-theory-extreme","g5-c3-stars-bars"],
              difficulty: 5,
              status: "placeholder"
            }
          ]
        }
      ]
    },
    // ========== 年级6 ==========
    {
      grade: 6,
      modules: [
        {
          moduleId: "M1",
          knowledgePoints: [
            {
              id: "g6-m1-g6-oral-frac-mult-int",
              name: "分数乘整数",
              pluginId: "math-g6-oral",
              weight: 3,
              type: "frac-mult-int",
              description: "分数乘整数，分子乘整数、分母不变。",
              example: "2/3×4=?（答案：8/3）",
              prerequisites: ["g5-m1-g5-oral-fracadd"],
              related: ["g6-m1-g6-oral-frac-mult-frac","g6-m8-g6-app-frac-mult"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m1-g6-oral-frac-mult-frac",
              name: "分数乘分数",
              pluginId: "math-g6-oral",
              weight: 3,
              type: "frac-mult-frac",
              description: "分数乘分数，分子乘分子、分母乘分母。",
              example: "1/2×1/3=?（答案：1/6）",
              prerequisites: ["g6-m1-g6-oral-frac-mult-int"],
              related: ["g6-m1-g6-oral-frac-mult-int","g6-m2-g6-calc-frac-mult-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m1-g6-oral-frac-div-int",
              name: "分数除以整数",
              pluginId: "math-g6-oral",
              weight: 2,
              type: "frac-div-int",
              description: "分数除以整数等于乘这个整数的倒数。",
              example: "2/3÷2=?（答案：1/3）",
              prerequisites: ["g5-m1-g5-oral-fracadd"],
              related: ["g6-m1-g6-oral-frac-div-frac","g6-m8-g6-app-frac-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m1-g6-oral-frac-div-frac",
              name: "一个数除以分数",
              pluginId: "math-g6-oral",
              weight: 3,
              type: "frac-div-frac",
              description: "一个数除以分数等于乘这个分数的倒数。",
              example: "2/3÷1/2=?（答案：4/3）",
              prerequisites: ["g6-m1-g6-oral-frac-div-int"],
              related: ["g6-m1-g6-oral-frac-div-int","g6-m8-g6-app-frac-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m1-g6-oral-dec-perc",
              name: "小数与百分数互化",
              pluginId: "math-g6-oral",
              weight: 2,
              type: "dec-perc",
              description: "小数化百分数乘100加%，反之除以100。",
              example: "0.25=?（答案：25%）",
              prerequisites: ["g5-m4-g5-fill-decloc"],
              related: ["g6-m4-g6-fill-percent","g6-m12-g6-choice-percent"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m1-g6-oral-ratio-simp",
              name: "求比值与化简比",
              pluginId: "math-g6-oral",
              weight: 2,
              type: "ratio-simp",
              description: "求比值用前项除以后项，化简比化为最简整数比。",
              example: "2:4化简是？（答案：1:2）",
              prerequisites: ["g5-m2-g5-v-divint"],
              related: ["g6-m4-g6-fill-ratio","g6-m5-g6-match-proportion"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m1-g6-oral-neg-add-sub",
              name: "负数加减",
              pluginId: "math-g6-oral",
              weight: 1,
              type: "neg-add-sub",
              description: "在直线上理解正负数的加减。",
              example: "-3+5=?（答案：2）",
              prerequisites: ["g6-m4-g6-fill-negative"],
              related: ["g6-m4-g6-fill-negative","g6-m11-g6-judge-negative"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M2",
          knowledgePoints: [
            {
              id: "g6-m2-g6-calc-dec-mult",
              name: "小数乘法笔算",
              pluginId: "math-g6-calc",
              weight: 2,
              type: "dec-mult",
              description: "小数乘小数的笔算（正确点小数点）。",
              example: "0.25×0.4=?（答案：0.1）",
              prerequisites: ["g5-m2-g5-v-decmul"],
              related: ["g6-m2-g6-calc-dec-div","g5-m2-g5-v-decmul"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m2-g6-calc-dec-div",
              name: "小数除法笔算",
              pluginId: "math-g6-calc",
              weight: 2,
              type: "dec-div",
              description: "小数除法的笔算方法。",
              example: "4.2÷0.6=?（答案：7）",
              prerequisites: ["g5-m2-g5-v-ddivdec"],
              related: ["g6-m2-g6-calc-dec-mult","g5-m2-g5-v-ddivdec"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m2-g6-calc-frac-mult-div",
              name: "分数乘除笔算",
              pluginId: "math-g6-calc",
              weight: 2,
              type: "frac-mult-div",
              description: "分数乘除法的计算。",
              example: "3/4÷2/3=?（答案：9/8）",
              prerequisites: ["g6-m1-g6-oral-frac-mult-frac"],
              related: ["g6-m3-g6-mixed-frac-order","g6-m1-g6-oral-frac-mult-frac"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m2-g6-calc-solve-proportion",
              name: "解比例",
              pluginId: "math-g6-calc",
              weight: 2,
              type: "solve-proportion",
              description: "用比例的基本性质解未知项。",
              example: "2:3=x:6，x=?（答案：4）",
              prerequisites: ["g6-m4-g6-fill-ratio"],
              related: ["g6-m8-g6-app-ratio-prop","g6-m4-g6-fill-ratio"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M3",
          knowledgePoints: [
            {
              id: "g6-m3-g6-mixed-frac-order",
              name: "分数四则混合运算",
              pluginId: "math-g6-calc",
              weight: 3,
              type: "frac-order",
              description: "分数加减乘除混合按运算顺序计算。",
              example: "1/2+1/3×3=?（答案：1.5）",
              prerequisites: ["g6-m2-g6-calc-frac-mult-div"],
              related: ["g6-m3-g6-mixed-frac-simple","g6-m2-g6-calc-frac-mult-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m3-g6-mixed-frac-simple",
              name: "分数简便运算（乘法分配律等）",
              pluginId: "math-g6-calc",
              weight: 2,
              type: "frac-simple",
              description: "用运算律对分数进行简便计算。",
              example: "1/2×3+1/2×5=?（答案：4）",
              prerequisites: ["g5-m3-g5-mix-fracsimple"],
              related: ["g6-m3-g6-mixed-frac-order","g5-m3-g5-mix-fracsimple"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m3-g6-mixed-solve-equation",
              name: "解方程（含分数系数）",
              pluginId: "math-g6-calc",
              weight: 3,
              type: "solve-equation",
              description: "解含分数系数的方程。",
              example: "x/2=3，x=?（答案：6）",
              prerequisites: ["g5-m8-g5-word-equ"],
              related: ["g6-m2-g6-calc-solve-proportion","g5-m8-g5-word-equ"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M4",
          knowledgePoints: [
            {
              id: "g6-m4-g6-fill-negative",
              name: "负数的意义与读写",
              pluginId: "math-g6-fill",
              weight: 1,
              type: "negative",
              description: "认识负数表示相反意义的量。",
              example: "-5读作？（答案：负五）",
              prerequisites: ["g5-m4-g5-fill-decloc"],
              related: ["g6-m1-g6-oral-neg-add-sub","g6-m11-g6-judge-negative","g6-m12-g6-choice-negative"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m4-g6-fill-percent",
              name: "百分数的意义、互化与折扣",
              pluginId: "math-g6-fill",
              weight: 3,
              type: "percent",
              description: "理解百分数、与分数小数互化及折扣。",
              example: "八折=?（答案：80%）",
              prerequisites: ["g6-m1-g6-oral-dec-perc"],
              related: ["g6-m8-g6-app-percent-discount","g6-m12-g6-choice-percent","g6-m11-g6-judge-percent-ratio"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m4-g6-fill-ratio",
              name: "比和比例的基本性质",
              pluginId: "math-g6-fill",
              weight: 3,
              type: "ratio",
              description: "比的前项后项同乘除值不变；比例两内项积=两外项积。",
              example: "3:4=6:（  ）。（答案：8）",
              prerequisites: ["g6-m1-g6-oral-ratio-simp"],
              related: ["g6-m8-g6-app-ratio-prop","g6-m5-g6-match-proportion","g6-m2-g6-calc-solve-proportion"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m4-g6-fill-circle",
              name: "圆的周长与面积公式",
              pluginId: "math-g6-fill",
              weight: 3,
              type: "circle",
              description: "掌握圆的周长 C=πd=2πr 与面积 S=πr²。",
              example: "r=1的圆面积？（答案：π）",
              prerequisites: ["g5-m4-g5-fill-area"],
              related: ["g6-m6-g6-op-circle","g6-m8-g6-app-circle","g6-m11-g6-judge-circle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m4-g6-fill-cylinder-cone",
              name: "圆柱侧面积、表面积、体积与圆锥体积",
              pluginId: "math-g6-fill",
              weight: 3,
              type: "cylinder-cone",
              description: "掌握圆柱表面积与体积、圆锥体积公式。",
              example: "r=1、h=3的圆柱体积？（答案：3π）",
              prerequisites: ["g5-m4-g5-fill-solid"],
              related: ["g6-m8-g6-app-cyl-cone","g6-m11-g6-judge-cyl-cone","g6-m12-g6-choice-cyl-cone"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m4-g6-fill-pie-chart",
              name: "扇形统计图的特点",
              pluginId: "math-g6-fill",
              weight: 1,
              type: "pie-chart",
              description: "用扇形表示各部分占总体的百分比。",
              example: "扇形统计图能看出？（答案：各部分占比）",
              prerequisites: ["g5-m9-g5-stats-line1"],
              related: ["g6-m9-g6-stat-pie-chart","g6-m7-g6-pic-pie-chart","g6-m5-g6-match-chart"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m4-unit-convert",
              name: "单位换算",
              pluginId: "math-g6-fill",
              weight: 2,
              type: "unit-convert",
              description: "进行常用单位间的换算。",
              example: "2米=?厘米（答案：200厘米）",
              prerequisites: ["g2-m4-unit-convert"],
              related: ["g2-m4-unit-convert","g6-m8-g6-app-ratio-prop"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M5",
          knowledgePoints: [
            {
              id: "g6-m5-g6-match-proportion",
              name: "正比例与反比例判断",
              pluginId: "math-g6-matching",
              weight: 2,
              type: "proportion",
              description: "比值一定为正比例，乘积一定为反比例。",
              example: "速度一定，路程与时间成？（答案：正比例）",
              prerequisites: ["g6-m4-g6-fill-ratio"],
              related: ["g6-m4-g6-fill-ratio","g6-m8-g6-app-ratio-prop"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m5-g6-match-formula",
              name: "图形与公式配对",
              pluginId: "math-g6-matching",
              weight: 2,
              type: "formula",
              description: "把图形与面积公式配对。",
              example: "连线：圆 —— πr²。",
              prerequisites: ["g6-m4-g6-fill-circle"],
              related: ["g6-m4-g6-fill-circle","g6-m4-g6-fill-cylinder-cone"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m5-g6-match-chart",
              name: "统计图类型与特点配对",
              pluginId: "math-g6-matching",
              weight: 1,
              type: "chart",
              description: "把统计图与特点配对。",
              example: "连线：扇形图 —— 表示占比。",
              prerequisites: ["g6-m4-g6-fill-pie-chart"],
              related: ["g6-m4-g6-fill-pie-chart","g6-m9-g6-stat-pie-chart"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M6",
          knowledgePoints: [
            {
              id: "g6-m6-g6-op-circle",
              name: "画圆与圆的认识",
              pluginId: "math-g6-operation",
              weight: 1,
              type: "circle",
              description: "用圆规画圆，认识圆心、半径、直径。",
              example: "圆规两脚间的距离是？（答案：半径）",
              prerequisites: ["g6-m4-g6-fill-circle"],
              related: ["g6-m4-g6-fill-circle","g6-m6-g6-op-rotate-scale"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m6-g6-op-symmetry",
              name: "画对称轴",
              pluginId: "math-g6-operation",
              weight: 1,
              type: "symmetry",
              description: "画出轴对称图形的对称轴。",
              example: "圆有（  ）条对称轴。（答案：无数条）",
              prerequisites: ["g5-m6-g5-draw-sym"],
              related: ["g6-m6-g6-op-rotate-scale","g5-m6-g5-draw-sym"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m6-g6-op-rotate-scale",
              name: "图形旋转与放大缩小",
              pluginId: "math-g6-operation",
              weight: 1,
              type: "rotate-scale",
              description: "按要求旋转或按比例放大、缩小图形。",
              example: "把图形放大2倍。",
              prerequisites: ["g5-m6-g5-draw-rotate"],
              related: ["g6-m6-g6-op-circle","g6-m6-g6-op-position"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m6-g6-op-position",
              name: "用方向和距离确定位置",
              pluginId: "math-g6-operation",
              weight: 1,
              type: "position",
              description: "用方向（角度）加距离描述位置。",
              example: "北偏东30°方向500米处。",
              prerequisites: ["g5-m4-g5-fill-coord"],
              related: ["g6-m7-g6-pic-scale","g5-m4-g5-fill-coord"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M7",
          knowledgePoints: [
            {
              id: "g6-m7-g6-pic-frac-line",
              name: "分数应用题线段图",
              pluginId: "math-g6-picture-equation",
              weight: 2,
              type: "frac-line",
              description: "用线段图分析分数乘除法问题。",
              example: "甲比乙多1/3，乙是6，甲？（答案：8）",
              prerequisites: ["g6-m8-g6-app-frac-mult"],
              related: ["g6-m8-g6-app-frac-mult","g6-m8-g6-app-frac-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m7-g6-pic-pie-chart",
              name: "扇形统计图看图计算",
              pluginId: "math-g6-picture-equation",
              weight: 2,
              type: "pie-chart",
              description: "根据扇形统计图求部分数量。",
              example: "总数200、占25%的部分是？（答案：50）",
              prerequisites: ["g6-m4-g6-fill-pie-chart"],
              related: ["g6-m9-g6-stat-pie-chart","g6-m4-g6-fill-pie-chart"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m7-g6-pic-scale",
              name: "比例尺图",
              pluginId: "math-g6-picture-equation",
              weight: 1,
              type: "scale",
              description: "理解比例尺=图上距离:实际距离。",
              example: "比例尺1:1000，图上1厘米代表实际？（答案：10米）",
              prerequisites: ["g6-m4-g6-fill-ratio"],
              related: ["g6-m8-g6-app-ratio-prop","g6-m6-g6-op-position"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M8",
          knowledgePoints: [
            {
              id: "g6-m8-g6-app-frac-mult",
              name: "求一个数的几分之几是多少（分数乘法）",
              pluginId: "math-g6-word-problems",
              weight: 3,
              type: "frac-mult",
              description: "用乘法求一个数的几分之几是多少。",
              example: "100的1/4是？（答案：25）",
              prerequisites: ["g6-m1-g6-oral-frac-mult-frac"],
              related: ["g6-m8-g6-app-frac-div","g6-m7-g6-pic-frac-line","g6-m1-g6-oral-frac-mult-frac"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-frac-div",
              name: "已知一个数的几分之几求这个数（分数除法）",
              pluginId: "math-g6-word-problems",
              weight: 3,
              type: "frac-div",
              description: "用除法求单位“1”（已知几分之几求原数）。",
              example: "一个数的1/3是4，这个数？（答案：12）",
              prerequisites: ["g6-m1-g6-oral-frac-div-frac"],
              related: ["g6-m8-g6-app-frac-mult","g6-m7-g6-pic-frac-line","g6-m8-g6-app-travel-work"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-percent-discount",
              name: "折扣、成数、税率、利率百分数应用",
              pluginId: "math-g6-word-problems",
              weight: 4,
              type: "percent-discount",
              description: "解决折扣、成数、税率、利率等百分数问题。",
              example: "打八折、原价100，实付？（答案：80）",
              prerequisites: ["g6-m4-g6-fill-percent"],
              related: ["g6-m4-g6-fill-percent","g6-m12-g6-choice-percent"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-ratio-prop",
              name: "比和比例的应用（比例尺、按比例分配、用比例解）",
              pluginId: "math-g6-word-problems",
              weight: 3,
              type: "ratio-prop",
              description: "用比和比例解决实际问题（按比例分配、用比例解）。",
              example: "按2:3分100，两份各是？（答案：40和60）",
              prerequisites: ["g6-m4-g6-fill-ratio"],
              related: ["g6-m4-g6-fill-ratio","g6-m7-g6-pic-scale","g6-m5-g6-match-proportion"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-circle",
              name: "圆的周长和面积应用",
              pluginId: "math-g6-word-problems",
              weight: 2,
              type: "circle",
              description: "解决圆的实际问题。",
              example: "半径2的圆周长？（答案：4π）",
              prerequisites: ["g6-m4-g6-fill-circle"],
              related: ["g6-m4-g6-fill-circle","g6-m6-g6-op-circle","g6-m12-g6-choice-circle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-cyl-cone",
              name: "圆柱圆锥体积与表面积应用",
              pluginId: "math-g6-word-problems",
              weight: 3,
              type: "cyl-cone",
              description: "解决圆柱、圆锥的实际问题。",
              example: "r=1、h=3的圆锥体积？（答案：π）",
              prerequisites: ["g6-m4-g6-fill-cylinder-cone"],
              related: ["g6-m4-g6-fill-cylinder-cone","g6-m12-g6-choice-cyl-cone","g5-m8-g5-word-solid"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-travel-work",
              name: "行程、工程问题（分数除法应用）",
              pluginId: "math-g6-word-problems",
              weight: 2,
              type: "travel-work",
              description: "用分数除法解决行程、工程问题。",
              example: "甲效1/10、乙效1/15，合作需？（答案：6天）",
              prerequisites: ["g6-m8-g6-app-frac-div"],
              related: ["g4-c5-c5-meet","g3-m4-g3-fraction","g6-m8-g6-app-frac-div"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m8-g6-app-pigeonhole",
              name: "鸽巢问题简单应用",
              pluginId: "math-g6-word-problems",
              weight: 1,
              type: "pigeonhole",
              description: "用抽屉原理说明必有重复。",
              example: "5个人分4种血型，至少有2人同血型。",
              prerequisites: ["g5-m10-g5-reason-tree3"],
              related: ["g6-m10-g6-reason-pigeonhole","g5-m10-g5-reason-tree3"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M9",
          knowledgePoints: [
            {
              id: "g6-m9-g6-stat-pie-chart",
              name: "扇形统计图的选择与读图",
              pluginId: "math-g6-stats",
              weight: 2,
              type: "pie-chart",
              description: "会选择并读取扇形统计图的信息。",
              example: "读出各部分所占的百分比。",
              prerequisites: ["g6-m4-g6-fill-pie-chart"],
              related: ["g6-m7-g6-pic-pie-chart","g6-m5-g6-match-chart","g6-m4-g6-fill-pie-chart"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m9-g6-stat-possibility",
              name: "可能性大小判断",
              pluginId: "math-g6-stats",
              weight: 1,
              type: "possibility",
              description: "判断事件发生可能性的大小。",
              example: "必然事件的可能性是？（答案：1）",
              prerequisites: ["g5-m9-g5-stats-possib"],
              related: ["g5-m9-g5-stats-possib","g5-m8-g5-word-possib"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M10",
          knowledgePoints: [
            {
              id: "g6-m10-g6-reason-number-shape",
              name: "数与形规律（连续奇数求和、图形规律）",
              pluginId: "math-g6-reasoning",
              weight: 2,
              type: "number-shape",
              description: "发现数与形结合的规律。",
              example: "1+3+5+7=?（答案：16，即4²）",
              prerequisites: ["g5-m10-g5-reason-seq"],
              related: ["g6-m10-g6-reason-pigeonhole","g5-m10-g5-reason-seq"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m10-g6-reason-pigeonhole",
              name: "鸽巢问题（抽屉原理）",
              pluginId: "math-g6-reasoning",
              weight: 2,
              type: "pigeonhole",
              description: "运用抽屉原理进行证明。",
              example: "13个人中至少有几人生肖相同？（答案：2人）",
              prerequisites: ["g6-m8-g6-app-pigeonhole"],
              related: ["g6-m8-g6-app-pigeonhole","g6-c3-c3-worst"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M11",
          knowledgePoints: [
            {
              id: "g6-m11-g6-judge-circle",
              name: "圆的概念辨析",
              pluginId: "math-g6-judge",
              weight: 2,
              type: "circle",
              description: "判断圆的相关概念。",
              example: "判断：半径是直径的一半。（对）",
              prerequisites: ["g6-m4-g6-fill-circle"],
              related: ["g6-m12-g6-choice-circle","g6-m4-g6-fill-circle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m11-g6-judge-cyl-cone",
              name: "圆柱圆锥体积关系",
              pluginId: "math-g6-judge",
              weight: 2,
              type: "cyl-cone",
              description: "判断等底等高圆柱与圆锥的体积关系。",
              example: "判断：圆锥体积是圆柱的1/3。（对）",
              prerequisites: ["g6-m4-g6-fill-cylinder-cone"],
              related: ["g6-m12-g6-choice-cyl-cone","g6-m4-g6-fill-cylinder-cone"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m11-g6-judge-negative",
              name: "负数大小比较",
              pluginId: "math-g6-judge",
              weight: 1,
              type: "negative",
              description: "比较负数的大小（绝对值大的反而小）。",
              example: "比较-3和-5。（答案：-3>-5）",
              prerequisites: ["g6-m4-g6-fill-negative"],
              related: ["g6-m12-g6-choice-negative","g6-m4-g6-fill-negative"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m11-g6-judge-percent-ratio",
              name: "百分数与比的性质",
              pluginId: "math-g6-judge",
              weight: 2,
              type: "percent-ratio",
              description: "判断百分数与比的性质。",
              example: "判断：20%=1:5。（对）",
              prerequisites: ["g6-m4-g6-fill-percent"],
              related: ["g6-m12-g6-choice-percent","g6-m4-g6-fill-percent"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m11-g6-judge-chart",
              name: "统计图特点辨析",
              pluginId: "math-g6-judge",
              weight: 1,
              type: "chart",
              description: "判断各统计图的特点。",
              example: "判断：条形图表示变化趋势。（错，应为折线图）",
              prerequisites: ["g6-m4-g6-fill-pie-chart"],
              related: ["g6-m12-g6-choice-chart","g6-m4-g6-fill-pie-chart"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "M12",
          knowledgePoints: [
            {
              id: "g6-m12-g6-choice-negative",
              name: "负数比较与数轴",
              pluginId: "math-g6-choice",
              weight: 1,
              type: "negative",
              description: "在数轴上比较负数的大小。",
              example: "-2在-1的（  ）边。（答案：左）",
              prerequisites: ["g6-m4-g6-fill-negative"],
              related: ["g6-m11-g6-judge-negative","g6-m4-g6-fill-negative"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m12-g6-choice-percent",
              name: "分数百分数互化与比较",
              pluginId: "math-g6-choice",
              weight: 2,
              type: "percent",
              description: "比较分数与百分数。",
              example: "25%与1/4比较？（答案：相等）",
              prerequisites: ["g6-m4-g6-fill-percent"],
              related: ["g6-m11-g6-judge-percent-ratio","g6-m4-g6-fill-percent"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m12-g6-choice-circle",
              name: "圆的计算选择题",
              pluginId: "math-g6-choice",
              weight: 2,
              type: "circle",
              description: "选择圆的计算正确结果。",
              example: "d=2的圆周长？（答案：2π）",
              prerequisites: ["g6-m4-g6-fill-circle"],
              related: ["g6-m11-g6-judge-circle","g6-m4-g6-fill-circle"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m12-g6-choice-cyl-cone",
              name: "圆柱圆锥计算选择题",
              pluginId: "math-g6-choice",
              weight: 2,
              type: "cyl-cone",
              description: "选择圆柱、圆锥计算正确结果。",
              example: "r=1、h=3的圆柱体积？（答案：3π）",
              prerequisites: ["g6-m4-g6-fill-cylinder-cone"],
              related: ["g6-m11-g6-judge-cyl-cone","g6-m4-g6-fill-cylinder-cone"],
              difficulty: 1,
              status: "active"
            },
            {
              id: "g6-m12-g6-choice-chart",
              name: "统计图选择",
              pluginId: "math-g6-choice",
              weight: 1,
              type: "chart",
              description: "选择合适的统计图。",
              example: "表示各部分占比用？（答案：扇形统计图）",
              prerequisites: ["g6-m4-g6-fill-pie-chart"],
              related: ["g6-m11-g6-judge-chart","g6-m4-g6-fill-pie-chart"],
              difficulty: 1,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C1",
          knowledgePoints: [
            {
              id: "g6-c1-c1-vertical",
              name: "竖式数字谜",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 3,
              type: "vertical",
              description: "根据竖式中已知的部分数字，推理填出完整的竖式。",
              example: "□5+3□=82，求出两个□中的数字。",
              prerequisites: ["g4-c1-c1-vertical"],
              related: ["g6-c1-c1-horizontal","g6-c2-c2-place"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c1-c1-horizontal",
              name: "横式数字谜",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "horizontal",
              description: "在横式中填入合适的数字，使等式成立。",
              example: "□+□=9，且两个□中的数字不同。",
              prerequisites: ["g4-c1-c1-horizontal"],
              related: ["g6-c1-c1-vertical","g6-c1-c1-symbol"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c1-c1-symbol",
              name: "符号代表数",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "symbol",
              description: "用图形或符号代表未知的數字进行推理。",
              example: "△+△=10，△=?（答案：5）",
              prerequisites: ["g4-c1-c1-symbol"],
              related: ["g6-c2-c2-place","g6-c1-c1-horizontal"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c1-c1-array",
              name: "数阵图",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "array",
              description: "把数填入图中，使每行、每列的和相等。",
              example: "在三阶数阵中填1-9，使每行每列和都为15。",
              prerequisites: ["g4-c1-c1-array"],
              related: ["g6-c1-c1-magic","g6-c1-c1-symbol"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c1-c1-magic",
              name: "幻方",
              pluginId: "math-competition-c1-numberpuzzle",
              weight: 2,
              type: "magic",
              description: "理解幻方的规律并填数。",
              example: "完成中间为5的三阶幻方。",
              prerequisites: ["g6-c1-c1-array"],
              related: ["g6-c1-c1-array"],
              difficulty: 5,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C2",
          knowledgePoints: [
            {
              id: "g6-c2-c2-parity",
              name: "奇偶性与运算规律",
              pluginId: "math-competition-c2-numbertheory",
              weight: 3,
              type: "parity",
              description: "利用奇偶性判断运算结果的奇偶。",
              example: "奇数+奇数=?（答案：偶数）",
              prerequisites: ["g4-c2-c2-parity"],
              related: ["g6-c2-c2-divisible","g6-c2-c2-remainder"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c2-c2-divisible",
              name: "整除特征（2/3/5/9）",
              pluginId: "math-competition-c2-numbertheory",
              weight: 3,
              type: "divisible",
              description: "掌握能被2、3、5、9整除的数的特征。",
              example: "下列各数中能被3整除的是？（答案：123）",
              prerequisites: ["g4-c2-c2-divisible"],
              related: ["g6-c2-c2-factor","g6-c2-c2-prime"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c2-c2-prime",
              name: "质数与合数",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "prime",
              description: "认识质数与合数，并能判断。",
              example: "下列各数中是质数的是？（答案：7）",
              prerequisites: ["g4-c2-c2-prime"],
              related: ["g6-c2-c2-factor","g6-c2-c2-divisible"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c2-c2-factor",
              name: "因数与倍数",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "factor",
              description: "理解因数与倍数相互依存的关系。",
              example: "6的因数有？（答案：1、2、3、6）",
              prerequisites: ["g4-c2-c2-factor"],
              related: ["g6-c2-c2-prime","g6-c2-c2-divisible"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c2-c2-remainder",
              name: "余数问题",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "remainder",
              description: "解决带余除法的应用问题。",
              example: "□÷5=3……2，□=?（答案：17）",
              prerequisites: ["g4-c2-c2-remainder"],
              related: ["g6-c2-c2-divisible","g6-c2-c2-factor"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c2-c2-place",
              name: "位值原理",
              pluginId: "math-competition-c2-numbertheory",
              weight: 2,
              type: "place",
              description: "利用数字所在数位的值进行推理。",
              example: "一个两位数，十位是个位的2倍，它可能是哪些数？",
              prerequisites: ["g4-c2-c2-place"],
              related: ["g6-c1-c1-symbol","g6-m4-g6-fill-ratio"],
              difficulty: 5,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C3",
          knowledgePoints: [
            {
              id: "g6-c3-c3-enum",
              name: "枚举法",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "enum",
              description: "有次序地一一列举出所有可能。",
              example: "用1、2、3能组成几个无重复数字的两位数？（答案：6个）",
              prerequisites: ["g4-c3-c3-enum"],
              related: ["g6-c3-c3-am","g6-c3-c3-worst"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c3-c3-am",
              name: "加法与乘法原理",
              pluginId: "math-competition-c3-counting",
              weight: 3,
              type: "am",
              description: "分类用加法原理，分步用乘法原理计数。",
              example: "上衣3件、裤子2件，共有几种穿法？（答案：6种）",
              prerequisites: ["g4-c3-c3-am"],
              related: ["g6-c3-c3-perm","g6-c3-c3-enum"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c3-c3-perm",
              name: "排列组合初步",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "perm",
              description: "初步认识排列与组合的区别。",
              example: "从3人中选2人排成一排有几种？（答案：6种）",
              prerequisites: ["g6-c3-c3-am"],
              related: ["g6-c3-c3-am","g6-c3-c3-worst"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c3-c3-geomcount",
              name: "几何计数",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "geomcount",
              description: "数出图形中的线段、角、三角形个数。",
              example: "一条线段上有4个点，共有几条线段？（答案：10条）",
              prerequisites: ["g4-c3-c3-geomcount"],
              related: ["g6-c4-c4-count","g6-c3-c3-enum"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c3-c3-worst",
              name: "最不利原则",
              pluginId: "math-competition-c3-counting",
              weight: 2,
              type: "worst",
              description: "考虑最坏情况，保证结论必然成立。",
              example: "两色球各若干，至少拿几个保证同色？（答案：3个）",
              prerequisites: ["g6-c3-c3-enum"],
              related: ["g6-c3-c3-enum","g6-m10-g6-reason-pigeonhole"],
              difficulty: 5,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C5",
          knowledgePoints: [
            {
              id: "g6-c5-c5-basic",
              name: "基本行程",
              pluginId: "math-competition-c5-journey",
              weight: 2,
              type: "basic",
              description: "用路程=速度×时间解决基本行程问题。",
              example: "速度4米/秒，走10秒，路程？（答案：40米）",
              prerequisites: ["g4-c5-c5-basic"],
              related: ["g6-c5-c5-meet","g6-c5-c5-chase","g6-m8-g6-app-travel-work"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c5-c5-meet",
              name: "相遇问题",
              pluginId: "math-competition-c5-journey",
              weight: 3,
              type: "meet",
              description: "两人相向而行，路程和=速度和×时间。",
              example: "相距100米，两人速度和10，几秒相遇？（答案：10秒）",
              prerequisites: ["g6-c5-c5-basic"],
              related: ["g6-c5-c5-chase","g6-c5-c5-train"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c5-c5-chase",
              name: "追及问题",
              pluginId: "math-competition-c5-journey",
              weight: 3,
              type: "chase",
              description: "同向而行，追及时间=路程差÷速度差。",
              example: "甲速6、乙速4，相差20米，几秒追上？（答案：10秒）",
              prerequisites: ["g6-c5-c5-basic"],
              related: ["g6-c5-c5-meet","g6-c5-c5-train"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c5-c5-train",
              name: "火车过桥",
              pluginId: "math-competition-c5-journey",
              weight: 2,
              type: "train",
              description: "考虑车长，路程=桥长+车长。",
              example: "车长100米过200米桥，完全通过要走？（答案：300米）",
              prerequisites: ["g6-c5-c5-basic"],
              related: ["g6-c5-c5-meet","g6-c5-c5-river"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c5-c5-river",
              name: "流水行船",
              pluginId: "math-competition-c5-journey",
              weight: 2,
              type: "river",
              description: "顺速=静水速+水速，逆速=静水速-水速。",
              example: "静水速10、水速2，顺水速度？（答案：12）",
              prerequisites: ["g6-c5-c5-basic"],
              related: ["g6-c5-c5-meet"],
              difficulty: 5,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C4",
          knowledgePoints: [
            {
              id: "g6-c4-c4-pa",
              name: "周长与面积",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "pa",
              description: "理解周长与面积的区别与联系。",
              example: "边长为4的正方形，周长和面积各是？（答案：周长16，面积16）",
              prerequisites: ["g4-c4-c4-pa"],
              related: ["g6-c4-c4-cutfill","g6-m4-g6-fill-circle"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c4-c4-cutfill",
              name: "割补法",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "cutfill",
              description: "用割补法把不规则图形转化为规则图形求面积。",
              example: "把不规则图形割补成长方形求面积。",
              prerequisites: ["g6-c4-c4-pa"],
              related: ["g6-c4-c4-pa","g6-m4-g6-fill-circle"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c4-c4-angle",
              name: "角度初步",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "angle",
              description: "认识角度的计算与和差关系。",
              example: "∠1+∠2=90°，∠1=30°，∠2=?（答案：60°）",
              prerequisites: ["g4-c4-c4-angle"],
              related: ["g6-c4-c4-pa","g6-c4-c4-count"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c4-c4-count",
              name: "图形计数",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "count",
              description: "有次序地数出图形的个数。",
              example: "数出图中三角形的个数。",
              prerequisites: ["g4-c4-c4-count"],
              related: ["g6-c3-c3-geomcount","g6-c4-c4-angle"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c4-c4-transform",
              name: "平移旋转与对称",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "transform",
              description: "认识图形的对称、平移与旋转。",
              example: "判断下列图形是否轴对称。",
              prerequisites: ["g4-c4-c4-transform"],
              related: ["g6-m6-g6-op-rotate-scale","g6-m6-g6-op-symmetry"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c4-c4-solid",
              name: "立体图形初步",
              pluginId: "math-competition-c4-geometry",
              weight: 2,
              type: "solid",
              description: "认识常见立体图形的特征与展开图。",
              example: "正方体有几个面？（答案：6个）",
              prerequisites: ["g4-c4-c4-solid"],
              related: ["g6-m4-g6-fill-cylinder-cone","g6-m4-g6-fill-circle"],
              difficulty: 5,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C6",
          knowledgePoints: [
            {
              id: "g6-c6-c6-work",
              name: "工程问题",
              pluginId: "math-competition-c6-engineering",
              weight: 3,
              type: "work",
              description: "把总工作量看成单位1，合作效率=效率和，合作时间=1÷效率和。",
              example: "甲6天、乙3天完成，合作几天？（答案：2天）",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g6-c6-c6-concentration","g6-m8-g6-app-travel-work","g6-c5-c5-basic"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c6-c6-concentration",
              name: "浓度问题",
              pluginId: "math-competition-c6-engineering",
              weight: 3,
              type: "concentration",
              description: "含盐率=盐重÷盐水总重，混合与稀释均按此计算。",
              example: "100克10%盐水加100克水，含盐率？（答案：5%）",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g6-c6-c6-work","g6-c7-c7-clever","g6-m8-g6-app-percent-discount"],
              difficulty: 5,
              status: "active"
            }
          ]
        },
        {
          moduleId: "C7",
          knowledgePoints: [
            {
              id: "g6-c7-c7-telescope",
              name: "裂项相消",
              pluginId: "math-competition-c7-fraction",
              weight: 3,
              type: "telescope",
              description: "把每一项拆成两个分数之差，相加时首尾相消。",
              example: "1/(1×2)+1/(2×3)+…+1/(9×10)=?（答案：9/10）",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g6-c7-c7-complex","g6-c7-c7-clever"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c7-c7-complex",
              name: "繁分数化简",
              pluginId: "math-competition-c7-fraction",
              weight: 2,
              type: "complex",
              description: "多层分式从最里层逐层通分，除以分数等于乘它的倒数。",
              example: "1÷(2+1/3)=?（答案：3/7）",
              prerequisites: ["g3-m4-g3-fraction"],
              related: ["g6-c7-c7-telescope","g6-c7-c7-clever"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c7-c7-clever",
              name: "分数巧算",
              pluginId: "math-competition-c7-fraction",
              weight: 3,
              type: "clever",
              description: "提取公因数、连乘约分、等比凑整等速算技巧。",
              example: "(1-1/2)×(1-1/3)×…×(1-1/10)=?（答案：1/10）",
              prerequisites: ["g4-m3-g4-mix-dist"],
              related: ["g6-c7-c7-telescope","g6-c7-c7-complex"],
              difficulty: 5,
              status: "active"
            },
            {
              id: "g6-c7-c7-pattern",
              name: "分数数列规律",
              pluginId: "math-competition-c7-fraction",
              weight: 2,
              type: "pattern",
              description: "由前几项归纳通项公式，再求指定项。",
              example: "1/2、2/3、3/4、4/5…第10项是?（答案：10/11）",
              prerequisites: ["g1-m4-patterns"],
              related: ["g6-c7-c7-telescope","g6-m10-g6-reason-number-shape"],
              difficulty: 5,
              status: "active"
            }
          ]
        }
      ]
    }
  ];

  // ============ 便捷查询（挂在数组对象上） ============

  /** 取某年级对象（{grade, modules}），不存在返回 null */
  KnowledgeBank.findGrade = function (grade) {
    for (var i = 0; i < this.length; i++) {
      if (this[i].grade === grade) return this[i];
    }
    return null;
  };

  /** 兼容旧名 getGrade（返回与 findGrade 相同的年级对象），便于旧代码/文档过渡 */
  KnowledgeBank.getGrade = function (grade) {
    return this.findGrade(grade);
  };

  /** 扁平化某年级全部知识点：[{id,name,pluginId,moduleId,weight,type}]；非数学科目返回空数组 */
  KnowledgeBank.getEntries = function (subject, grade) {
    if (subject && subject !== 'math') return [];
    var g = this.findGrade(grade);
    if (!g) return [];
    var out = [];
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        out.push({
          id: kp.id,
          name: kp.name,
          pluginId: kp.pluginId,
          moduleId: m.moduleId,
          weight: kp.weight,
          type: kp.type
        });
      });
    });
    return out;
  };

  /**
   * 知识点覆盖统计。
   * @param {string} subject 科目（仅 'math' 有数据）
   * @param {number} grade 年级
   * @param {string[]} coveredPluginIds 已注册且适用该年级的插件 id 集合
   * @returns {{total:number,covered:number,ratio:number,missing:Array,next:Object|null}}
   */
  KnowledgeBank.getCoverage = function (subject, grade, coveredPluginIds) {
    var entries = this.getEntries(subject, grade);
    if (!entries.length) {
      return { total: 0, covered: 0, ratio: 0, missing: [], next: null };
    }
    var set = {};
    (coveredPluginIds || []).forEach(function (id) { set[id] = true; });
    var missing = entries.filter(function (e) { return !set[e.pluginId]; });
    var covered = entries.length - missing.length;
    return {
      total: entries.length,
      covered: covered,
      ratio: entries.length ? Math.round(covered / entries.length * 100) : 0,
      missing: missing,
      next: missing.length ? missing[0] : null
    };
  };

  /** 从注册表（[{id,subject,grades}]）计算覆盖（自动提取适用该年级的插件 id；排除占位插件） */
  KnowledgeBank.coverageFromRegistry = function (subject, grade, registry) {
    var ids = [];
    (registry || []).forEach(function (p) {
      if (p.subject === subject && p.grades && p.grades.indexOf(grade) !== -1 && !p.isPlaceholder) ids.push(p.id);
    });
    return this.getCoverage(subject, grade, ids);
  };

  /** 建议下一个应开发的插件：{pluginId,name} 或 null（已全部覆盖） */
  KnowledgeBank.suggestNext = function (subject, grade, coveredPluginIds) {
    var cov = this.getCoverage(subject, grade, coveredPluginIds);
    return cov.next ? { pluginId: cov.next.pluginId, name: cov.next.name } : null;
  };

  global.KnowledgeBank = KnowledgeBank;

  if (typeof module !== 'undefined' && module.exports) module.exports = global.KnowledgeBank;

})(typeof window !== 'undefined' ? window : globalThis);