# anthropic-ipo-monitor

Anthropic IPO 认购看板（非官方）：实时统计币安钱包 ANTx（xStocks）认购的 BSC 链上数据，包括认购总额与速度、地址认购额分布、额度档位分布、币安 ANTUSDT 合约价与隐含市值、定价与上市倒计时。

线上地址：https://juiceless.cn/anthropic-ipo-monitor/antx-monitor/

部署方式沿用 [pages-deploy-template](https://github.com/bibi45c/pages-deploy-template)（`scripts/build.mjs` + `.github/workflows/pages.yml`），推送到 `main` 即自动发布。

## 目录

| 路径 | 说明 |
|---|---|
| `antx-monitor/` | 看板页面（单个 `index.html`，无构建步骤） |
| `scripts/antx-snapshot.mjs` | 认购快照：Pages 构建时运行，输出 `_site/antx-monitor/snapshot.json` |
| `scripts/build.mjs` | 模板自带的站点构建脚本 |

## 数据来源

- 认购合约：`0xd1f715a5cbde8aae6592b2ce44e1e26fdc7595b0`（BSC，ERC1967 代理），项目 ID 1050，只统计 USDC
- 链上数据：`bsc-rpc.publicnode.com`（支持大范围 `eth_getLogs`）
- 合约价格：币安 U 本位合约 `ANTUSDT`（盘前永续）公开接口
- 隐含市值：按公告「70–78 USDC ↔ 1.26–1.41 万亿美元」反推约 180.5 亿股折算

## 快照

页面打开时先读 `snapshot.json`，再用 RPC 只补快照之后的区块，首次加载约 0.6 MB（gzip）。

认购已于 2026-11-18 北京时间 18:03 满额结束，最终数据已归档为 [`antx-monitor/snapshot.json`](antx-monitor/snapshot.json)（截至区块 134314245，全量重扫核对）：

| 指标 | 数值 |
|---|---|
| 认购总额 | 500,002,764.10 USDC |
| 参与地址 | 44,045 |
| 认购笔数 | 52,041 |
| 首笔 → 满额 | 14:00 → 18:03（第 243 分钟） |
| 首分钟认购 | 8,430.87 万 USDC |

定时重建已停用；构建时 `scripts/antx-snapshot.mjs` 发现仓库内有快照就原样输出，不再请求链上数据。需要重新生成时删除该文件后运行脚本。

## 本地预览

```bash
node scripts/build.mjs
node scripts/antx-snapshot.mjs _site/antx-monitor/snapshot.json
npx serve _site
```
