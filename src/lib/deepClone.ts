/**
 * 深拷贝工具，包装 structuredClone。
 * structuredClone 是 ES2022 标准 API，所有现代浏览器 + Node 17+ 原生支持。
 */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}
