// antx-monitor 认购快照：在 Pages 构建时运行，把链上认购事件聚合成精简 JSON，
// 让页面首次打开时先读快照，再用 RPC 只补快照之后的少量区块。
//
// 基准快照优先级：仓库内 antx-monitor/snapshot.json（认购结束后提交的最终版）> 线上已部署的快照 > 从头扫描。
// 用法：node scripts/antx-snapshot.mjs <输出路径>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] || '_site/antx-monitor/snapshot.json';
const REPO_SNAP = 'antx-monitor/snapshot.json';
const LIVE_SNAP = 'https://juiceless.cn/anthropic-ipo-monitor/antx-monitor/snapshot.json';

// 与 antx-monitor/index.html 保持一致
const CONTRACT = '0xd1f715a5cbde8aae6592b2ce44e1e26fdc7595b0';
const TOPIC = '0x0ab7333171e736365c6ff550576dc649564b99156b7fbb195d0d4b55bc966e49';
const PROJECT = '0x' + (1050).toString(16).padStart(64, '0');
const USDC = '8ac76a51cc950d9822d68b83fe1ad97b32cd580d';
const START_BLOCK = 134259600;
const START_TS = 1794981600;
const END_TS = 1795010400;
const RPC = 'https://bsc-rpc.publicnode.com';
const CHUNK = 2000, CONCURRENCY = 4, CONFIRM = 3;
const V = 3;

const hex = (n) => '0x' + n.toString(16);
const isLimit = (e) => /exceed|limit|range/i.test((e && e.message) || '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  let err;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(60000) });
      const j = await r.json();
      if (j.error) { err = new Error(j.error.message || 'rpc error'); if (isLimit(err)) throw err; }
      else return j.result;
    } catch (e) { err = e; if (isLimit(e)) throw e; }
    await sleep(800 * (i + 1));
  }
  throw err;
}

async function getLogs(from, to) {
  try {
    return await rpc('eth_getLogs', [{ address: CONTRACT, fromBlock: hex(from), toBlock: hex(to), topics: [TOPIC, PROJECT] }]);
  } catch (e) {
    if (to > from && isLimit(e)) {
      const mid = Math.floor((from + to) / 2);
      return [...await getLogs(from, mid), ...await getLogs(mid + 1, to)];
    }
    throw e;
  }
}

// ---- 状态 <-> 快照 JSON（列式存储，地址只保留前 16 位十六进制作为键） ----
const empty = () => ({ last: START_BLOCK - 1, lastTs: 0, orders: 0, total: 0, addr: new Map(), cap: new Map(), min: new Map() });
function fromJson(j) {
  const S = empty();
  Object.assign(S, { last: j.last, lastTs: j.lastTs, orders: j.orders, total: j.total });
  j.ak.forEach((k, i) => { S.addr.set(k, j.aa[i]); S.cap.set(k, j.ac[i] * 1e4); });
  j.min.forEach(([m, v]) => S.min.set(m, v));
  return S;
}
function toJson(S) {
  const ak = [...S.addr.keys()];
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    v: V, project: 1050, generatedAt: Math.floor(Date.now() / 1000),
    last: S.last, lastTs: S.lastTs, orders: S.orders, total: r2(S.total),
    min: [...S.min.entries()].sort((a, b) => a[0] - b[0]).map(([m, v]) => [m, r2(v)]),
    ak, aa: ak.map((k) => r2(S.addr.get(k))), ac: ak.map((k) => Math.round((S.cap.get(k) || 0) / 1e4)),
  };
}

function apply(S, log, refBlock, refTs) {
  const d = log.data.slice(2); const w = (i) => d.slice(64 * i, 64 * i + 64);
  const tOff = parseInt(w(1), 16) / 32, aOff = parseInt(w(2), 16) / 32, n = parseInt(w(tOff), 16);
  let amt = 0;
  for (let k = 0; k < n; k++) {
    if (w(tOff + 1 + k).slice(24).toLowerCase() !== USDC) continue;
    amt += Number(BigInt('0x' + w(aOff + 1 + k)) / 10n ** 12n) / 1e6;
  }
  const key = '0x' + log.topics[3].slice(26, 42);
  const bn = parseInt(log.blockNumber, 16);
  const ts = log.blockTimestamp ? parseInt(log.blockTimestamp, 16) : Math.round(refTs - (refBlock - bn) * 0.45);
  const m = Math.floor((ts - START_TS) / 60);
  S.orders++; S.total += amt;
  S.addr.set(key, (S.addr.get(key) || 0) + amt);
  S.cap.set(key, parseInt(w(3), 16) / 1e8);
  S.min.set(m, (S.min.get(m) || 0) + amt);
  if (ts > S.lastTs) S.lastTs = ts;
}

async function loadBase() {
  if (existsSync(REPO_SNAP)) {
    const j = JSON.parse(readFileSync(REPO_SNAP, 'utf8'));
    if (j.v === V) { console.log(`base: repo snapshot @${j.last}`); return fromJson(j); }
  }
  try {
    const r = await fetch(LIVE_SNAP + '?t=' + Date.now(), { signal: AbortSignal.timeout(20000) });
    if (r.ok) { const j = await r.json(); if (j.v === V) { console.log(`base: live snapshot @${j.last}`); return fromJson(j); } }
  } catch (e) { console.log('base: live snapshot unavailable:', e.message); }
  console.log('base: full scan from start');
  return empty();
}

function write(S) {
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(toJson(S));
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT}: block ${S.last}, ${S.orders} orders, ${S.addr.size} addrs, ${(json.length / 1e6).toFixed(2)} MB`);
}

const S = await loadBase();
try {
  // 认购结束 10 分钟后快照即为最终版，不再拉链
  if (S.lastTs < END_TS + 600) {
    const head = parseInt(await rpc('eth_blockNumber', []), 16);
    const headTs = parseInt((await rpc('eth_getBlockByNumber', [hex(head), false])).timestamp, 16);
    const target = head - CONFIRM;
    const ranges = [];
    for (let b = S.last + 1; b <= target; b += CHUNK) ranges.push([b, Math.min(b + CHUNK - 1, target)]);
    const results = new Array(ranges.length); let next = 0, applied = 0;
    const flush = () => { while (applied < ranges.length && results[applied]) {
      for (const l of results[applied]) apply(S, l, head, headTs); S.last = ranges[applied][1]; applied++; } };
    const worker = async () => { while (next < ranges.length) { const i = next++; results[i] = await getLogs(...ranges[i]); flush(); } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ranges.length) }, worker));
    flush();
    console.log(`fetched ${ranges.length} ranges up to ${target}`);
  }
} catch (e) {
  // 拉链失败时仍写出已连续应用的部分，避免这次部署把线上快照弄丢
  console.log('fetch error, writing partial/base snapshot:', e.message);
}
write(S);
