import { useEffect, useState } from 'react'

/** 定时返回当前时间戳，用于「已进行 1h 20m」这类实时文案。 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
