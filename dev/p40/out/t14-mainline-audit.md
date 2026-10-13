# P40-T-14 三主线全链抽查（加法 / 分数 / 面积，G1-G6）

> 维度：①familyId 一致 ②stageOrder 递增 ③难度不倒挂（needs-review） ④解释衔接 ⑤组合合规。

## 加法（加减运算）（`fam_addsub`，26 KP）

| 维度 | 结果 |
|---|---|
| ① familyId 一致 | ✓ |
| ② stageOrder 递增 | ✓ |
| ③ 难度不倒挂 | needs-review 7 处（挂人工，T-07 口径） |
| ④ 解释衔接 | ✓ 22/26 有同族前序桥接 |
| ⑤ 组合合规 | ✓ 5/5 跨族前置组合可满足 |

```
[g1-up]
   1. 1-5数的认识  (diff=4)
   2. 5以内的加减法  (diff=5, ↑math-g1-up-u01-k001)
   3. 0的认识和加减法  (diff=4, ↑math-g1-up-u01-k002)
   4. 6和10的认识  (diff=4, ↑math-g1-up-u01-k003)
   5. 10以内连加连减  (diff=4, ↑math-g1-up-u02-k001)
   6. 凑十法  (diff=2)
   7. 加法口算  (diff=2, ↑math-g1-up-u05-k001)
   8. 解决问题  (diff=3, ↑math-g1-up-u05-k002)
[g1-down]
   9. 运算方法（平十、破十）  (diff=2, ↑math-g1-up-u05-k001)
  10. 减法口算  (diff=2, ↑math-g1-down-u02-k001)
  11. 解决问题  (diff=5, ↑math-g1-down-u02-k002)
  12. 两位数不进位加法  (diff=4, ↑math-g1-down-u02-k001)
  13. 两位数进位加法  (diff=4, ↑math-g1-down-u04-k001)
  14. 两位数不退位减法  (diff=4, ↑math-g1-down-u04-k002)
  15. 两位数退位减法  (diff=4, ↑math-g1-down-u04-k003)
  16. 解决问题  (diff=3, ↑math-g1-down-u04-k004)
  17. 两位数加（竖式计算）  (diff=4, ↑math-g1-down-u04-k005)
  18. 两位数减（竖式计算）  (diff=4, ↑math-g1-down-u05-k001)
  19. 整理和复习  (diff=2, ↑math-g1-down-u05-k002)
[g2-down]
  20. 三位数加法竖式  (diff=5, ↑math-g1-down-u05-k001)
  21. 三位数减法竖式  (diff=5, ↑math-g2-down-u05-k001)
  22. 加减法各部分名称与关系  (diff=5, ↑math-g2-down-u05-k002)
  23. 解决问题  (diff=6, ↑math-g2-down-u05-k003)
[g4-down]
  24. 加减法的意义和各部分间的关系  (diff=7)
  25. 加法运算律  (diff=5)
  26. 减法运算律  (diff=5, ↑math-g4-down-u03-k001)
```

## 分数（`fam_fraction`，30 KP）

| 维度 | 结果 |
|---|---|
| ① familyId 一致 | ✓ |
| ② stageOrder 递增 | ✓ |
| ③ 难度不倒挂 | needs-review 2 处（挂人工，T-07 口径） |
| ④ 解释衔接 | ✓ 28/30 有同族前序桥接 |
| ⑤ 组合合规 | ✓ 5/5 跨族前置组合可满足 |

```
[g3-up]
   1. 初步认识分数  (diff=7)
   2. 分数的读写  (diff=7, ↑math-g3-up-u08-k001)
   3. 比较分数大小  (diff=7, ↑math-g3-up-u08-k002)
   4. 分数的简单计算  (diff=7, ↑math-g3-up-u08-k003)
   5. 进一步认识分数  (diff=8, ↑math-g3-up-u08-k004)
[g5-down]
   6. 分数的意义  (diff=9, ↑math-g3-up-u08-k001)
   7. 分数与除法的关系  (diff=9, ↑math-g5-down-u04-k001)
   8. 真分数和假分数  (diff=9, ↑math-g5-down-u04-k002)
   9. 分数的基本性质  (diff=9, ↑math-g5-down-u04-k003)
  10. 约分与通分  (diff=9, ↑math-g5-down-u04-k004)
  11. 分数和小数的互化  (diff=9, ↑math-g5-down-u04-k005)
  12. 同分母分数加减法  (diff=9, ↑math-g5-down-u04-k001)
  13. 异分母分数加减法  (diff=9, ↑math-g5-down-u06-k001)
  14. 分数加减混合运算  (diff=9, ↑math-g5-down-u06-k002)
  15. 整数加法运算律推广到分数  (diff=9, ↑math-g5-down-u06-k003)
  16. 解决问题  (diff=10, ↑math-g5-down-u06-k004)
[g6-up]
  17. 分数乘整数  (diff=10, ↑math-g5-down-u06-k001)
  18. 一个数乘分数  (diff=10, ↑math-g6-up-u02-k001)
  19. 分数、小数混合运算及运算律  (diff=10, ↑math-g6-up-u02-k002)
  20. 解决问题  (diff=10, ↑math-g6-up-u02-k003)
  21. 倒数的认识  (diff=10, ↑math-g6-up-u02-k004)
  22. 分数除以整数  (diff=10, ↑math-g6-up-u03-k001)
  23. 一个数除以分数  (diff=10, ↑math-g6-up-u03-k002)
  24. 分数混合运算  (diff=10, ↑math-g6-up-u03-k003)
  25. 解决问题  (diff=10, ↑math-g6-up-u03-k004)
[g6-down]
  26. 折扣  (diff=8)
  27. 成数  (diff=10, ↑math-g6-down-u02-k001)
  28. 税率  (diff=7, ↑math-g6-down-u02-k002)
  29. 利率  (diff=7, ↑math-g6-down-u02-k003)
  30. 生活与百分数  (diff=10, ↑math-g6-down-u02-k004)
```

## 面积（测量）（`fam_measure`，24 KP）

| 维度 | 结果 |
|---|---|
| ① familyId 一致 | ✓ |
| ② stageOrder 递增 | ✓ |
| ③ 难度不倒挂 | needs-review 4 处（挂人工，T-07 口径） |
| ④ 解释衔接 | ✓ 22/24 有同族前序桥接 |
| ⑤ 组合合规 | ✓ 3/3 跨族前置组合可满足 |

```
[g2-up]
   1. 认识厘米和米  (diff=3)
   2. 测量物体长度的方法  (diff=3, ↑math-g2-up-u05-k001)
   3. 认识线段  (diff=3, ↑math-g2-up-u05-k002)
   4. 画线段的方法  (diff=3, ↑math-g2-up-u05-k003)
   5. 选择合适的长度单位  (diff=5, ↑math-g2-up-u05-k004)
[g3-up]
   6. 常用长度单位（从小到大）  (diff=4, ↑math-g2-up-u05-k001)
   7. 单位进率  (diff=4, ↑math-g3-up-u03-k001)
   8. 适用场景  (diff=4, ↑math-g3-up-u03-k002)
   9. 解决问题  (diff=5, ↑math-g3-up-u03-k003)
  10. 等量代换  (diff=4)
  11. 认识质量单位及换算  (diff=4, ↑math-g3-up-u04-k001)
  12. 单位适用场景  (diff=4, ↑math-g3-up-u04-k002)
  13. 称重实践  (diff=6, ↑math-g3-up-u04-k003)
[g3-down]
  14. 面积的认识  (diff=4, ↑math-g3-up-u03-k001)
  15. 常用面积单位  (diff=4, ↑math-g3-down-u04-k001)
  16. 长方形和正方形的面积计算  (diff=4, ↑math-g3-down-u04-k002)
  17. 面积单位间的进率  (diff=4, ↑math-g3-down-u04-k003)
  18. 周长与面积的联系与区分  (diff=4, ↑math-g3-down-u04-k004)
[g5-up]
  19. 平行四边形的面积  (diff=6, ↑math-g3-down-u04-k001)
  20. 三角形的面积  (diff=6, ↑math-g5-up-u06-k001)
  21. 梯形的面积  (diff=6, ↑math-g5-up-u06-k002)
  22. 组合图形的面积  (diff=6, ↑math-g5-up-u06-k003)
  23. 格点多边形的面积（选学）  (diff=8, ↑math-g5-up-u06-k004)
  24. 等底等高的图形面积关系  (diff=6, ↑math-g5-up-u06-k005)
```

## 全量结论

- 结构三维（familyId/序/衔接）+ 组合合规：**PASS**
- 难度不倒挂：needs-review 13 处（登记人工，不自动改数）
- 全量门禁证据见 change-log P40-T-14 条目（npm test / check-all）。

