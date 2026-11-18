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

页面打开时先读 `snapshot.json`，再用 RPC 只补快照之后的区块，首次加载约 0.5 MB。快照由 Pages 工作流定时重建（仅 2026-11-18 北京时间 14:00–23:59，每 5 分钟，GitHub 定时任务可能延迟）。

认购结束后：把最终快照提交为 `antx-monitor/snapshot.json`，并删除 `pages.yml` 中的 `schedule`。

## 本地预览

```bash
node scripts/build.mjs
node scripts/antx-snapshot.mjs _site/antx-monitor/snapshot.json
npx serve _site
```
