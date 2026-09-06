// Derived-state evaluator built from public exports only: memoizes report() of any Machine.
// Sound because Machine values are immutable; history stays the only authority.
import type { Machine, MachineConstructor } from "../machine/src/index.js"

export const memoizedMachine = (inner: MachineConstructor): MachineConstructor => {
  const wrap = (machine: Machine): Machine => {
    let report: ReturnType<Machine["report"]> | undefined
    return {
      append: (event) => wrap(machine.append(event)),
      next: (operationId, candidate, now) => machine.next(operationId, candidate, now),
      report: () => (report ??= machine.report())
    }
  }
  return (plan, events) => wrap(inner(plan, events))
}
