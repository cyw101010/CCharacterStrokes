#!/usr/bin/env node
// 批量生成激活码，写入 licenses.json（卡密库存用 git 管理）
//
// 用法：
//   node gen-licenses.mjs              # 追加 10 条
//   node gen-licenses.mjs 50           # 追加 50 条
//   node gen-licenses.mjs 20 --start 101   # 从 VIP000101 开始生成 20 条
//
// 注意：SALT / ALPHABET 必须与 index.html 中的常量保持一致，
// 否则生成出来的卡密在页面上会校验失败。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SALT = 'cchar-strokes-2026';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PREFIX = 'VIP';
const SERIAL_LEN = 6;
const MAX_SERIAL = 10 ** SERIAL_LEN - 1;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(HERE, 'licenses.json');

function checksum(data) {
  let h = 2166136261;
  const s = data + SALT;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[h % 32];
    h = Math.floor(h / 32);
  }
  return out;
}

function buildCode(serial) {
  const data = PREFIX + String(serial).padStart(SERIAL_LEN, '0');
  return `CCS-${data}-${checksum(data)}`;
}

function readStore() {
  if (!fs.existsSync(STORE_FILE)) {
    return { total: 0, updatedAt: null, codes: [] };
  }
  const store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  if (!Array.isArray(store.codes)) throw new Error('licenses.json 结构异常：缺少 codes 数组');
  return store;
}

function writeStore(store) {
  store.total = store.codes.length;
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2) + '\n');
}

function parseArgs(argv) {
  let count = 10;
  let start = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--start') {
      start = Number(argv[++i]);
    } else if (arg.startsWith('--start=')) {
      start = Number(arg.slice('--start='.length));
    } else if (/^\d+$/.test(arg)) {
      count = Number(arg);
    } else {
      throw new Error(`无法识别的参数：${arg}`);
    }
  }
  if (!Number.isInteger(count) || count <= 0) throw new Error('数量必须是正整数');
  if (start !== null && (!Number.isInteger(start) || start <= 0)) throw new Error('起始序号必须是正整数');
  return { count, start };
}

function main() {
  const { count, start } = parseArgs(process.argv.slice(2));
  const store = readStore();
  const usedSerials = new Set(store.codes.map((item) => item.serial));

  let next = start ?? (store.codes.length ? Math.max(...usedSerials) + 1 : 1);
  if (next + count - 1 > MAX_SERIAL) {
    throw new Error(`序号超出上限（最大 ${PREFIX}${MAX_SERIAL}）`);
  }

  const created = [];
  const now = new Date().toISOString();
  while (created.length < count) {
    if (usedSerials.has(next)) {
      next += 1;
      continue;
    }
    usedSerials.add(next);
    created.push({
      code: buildCode(next),
      serial: next,
      status: 'unused',
      createdAt: now
    });
    next += 1;
  }

  store.codes.push(...created);
  writeStore(store);

  console.log(`已生成 ${created.length} 条，累计 ${store.codes.length} 条 → ${STORE_FILE}`);
  for (const item of created) console.log(`  ${item.code}`);
  console.log('\n记得 git add licenses.json && git commit 以纳入版本管理。');
}

main();
