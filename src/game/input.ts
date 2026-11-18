export const defaultBindings = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', interact: 'KeyE', aim: 'KeyR', quick: 'KeyF', dash: 'ShiftLeft', punch: 'KeyG', up: 'ArrowUp', down: 'ArrowDown', hint: 'KeyH' };
export type Action = keyof typeof defaultBindings;
export type Bindings = Record<Action, string>;
export function rebind(bindings: Bindings, action: Action, key: string): Bindings {
  const next = { ...bindings }, previous = next[action];
  for (const a of Object.keys(next) as Action[]) if (next[a] === key) next[a] = previous;
  next[action] = key; return next;
}
export function canonicalCode(code: string, bindings: Bindings) {
  const action = (Object.keys(bindings) as Action[]).find(a => bindings[a] === code);
  return action ? defaultBindings[action] : '';
}
