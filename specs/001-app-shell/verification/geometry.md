# 元素几何偏差

偏差是 CSS 像素，不是还原率；布局可测量不证明未遮挡、字体正确或交互可用。

| 区域 | 状态 | Δx | Δy | Δ宽 | Δ高 |
| --- | --- | --- | --- | --- | --- |
| profile | visual_only | — | — | — | — |
| music-card | measured | 0.703 | -0.062 | -0.047 | 0.0 |
| create | measured | 0.062 | -0.062 | -0.031 | -0.031 |
| navigation | measured | 0.0 | 0.047 | 0.0 | -0.016 |

## 相对前轮的最大绝对偏差

| 区域 | 前轮 | 本轮 | 变化 |
| --- | --- | --- | --- |
| profile | None | None | unavailable |
| music-card | 8.203 | 0.703 | reduced |
| create | 6.047 | 0.062 | reduced |
| navigation | 18.453 | 0.047 | reduced |
