"use client";
import { useState } from "react";
import Link from "next/link";
import type { ComparisonGroup, RunComparison } from "@/lib/workbench/contract";
const groups: Record<ComparisonGroup, string> = {
  input: "测试输入",
  config: "配置与版本",
  memory: "记忆理解",
  musicProfile: "音乐意图",
  tools: "工具调用与结果",
  summary: "最终汇总",
};
const states = {
  equal: "相同",
  changed: "变化",
  missing_left: "左侧缺失",
  missing_right: "右侧缺失",
  pending: "未完成",
};
export function RunComparisonView({
  comparison,
}: {
  comparison: RunComparison;
}) {
  const [onlyChanges, setOnlyChanges] = useState(false);
  return (
    <>
      <Link className="wb-back" href="/internal/agent-workbench">
        返回工作台
      </Link>
      <header className="wb-heading">
        <div>
          <h1>运行对比</h1>
          <p>内部测试 · 历史快照只读</p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={onlyChanges}
            onChange={(event) => setOnlyChanges(event.target.checked)}
          />
          只看变化与缺失
        </label>
      </header>
      <section className="wb-panel wb-comparison-meta">
        <div>
          <h2>左侧运行</h2>
          <Link
            href={`/internal/agent-workbench/runs/${comparison.left.runId}`}
          >
            <code>{comparison.left.runId}</code>
          </Link>
          <p>
            理解 {comparison.left.configSnapshot.memoryModel.mode} / 配乐{" "}
            {comparison.left.configSnapshot.music.mode} / QQ Mock
          </p>
        </div>
        <div>
          <h2>右侧运行</h2>
          <Link
            href={`/internal/agent-workbench/runs/${comparison.right.runId}`}
          >
            <code>{comparison.right.runId}</code>
          </Link>
          <p>
            理解 {comparison.right.configSnapshot.memoryModel.mode} / 配乐{" "}
            {comparison.right.configSnapshot.music.mode} / QQ Mock
          </p>
        </div>
      </section>
      {(Object.keys(groups) as ComparisonGroup[]).map((group) => {
        const entries = comparison.differences[group].filter(
          (entry) => !onlyChanges || entry.state !== "equal",
        );
        return (
          <section className="wb-panel wb-diff" key={group}>
            <h2>{groups[group]}</h2>
            <p className="wb-muted">
              {
                comparison.differences[group].filter(
                  (entry) => entry.state !== "equal",
                ).length
              }{" "}
              项变化、缺失或未完成
            </p>
            {!entries.length ? (
              <p>没有需要显示的差异。</p>
            ) : (
              <section
                className="wb-table-scroll"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable table region supports keyboard horizontal scrolling.
                tabIndex={0}
                aria-label={`${groups[group]}字段对比`}
              >
                <table>
                  <thead>
                    <tr>
                      <th>字段 / 状态</th>
                      <th>左侧</th>
                      <th>右侧</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.path}>
                        <th scope="row">
                          <code>{entry.path}</code>
                          <small>{states[entry.state]}</small>
                        </th>
                        <td>
                          <details>
                            <summary>
                              {entry.left === undefined
                                ? "未提供"
                                : entry.left === null
                                  ? "空值"
                                  : typeof entry.left === "string"
                                    ? entry.left.slice(0, 80)
                                    : JSON.stringify(entry.left).slice(0, 80)}
                            </summary>
                            <pre>
                              {entry.left === undefined
                                ? "未提供"
                                : JSON.stringify(entry.left, null, 2)}
                            </pre>
                          </details>
                        </td>
                        <td>
                          <details>
                            <summary>
                              {entry.right === undefined
                                ? "未提供"
                                : entry.right === null
                                  ? "空值"
                                  : typeof entry.right === "string"
                                    ? entry.right.slice(0, 80)
                                    : JSON.stringify(entry.right).slice(0, 80)}
                            </summary>
                            <pre>
                              {entry.right === undefined
                                ? "未提供"
                                : JSON.stringify(entry.right, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </section>
        );
      })}
    </>
  );
}
