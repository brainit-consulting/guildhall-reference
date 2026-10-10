// The port this copy of the repo runs its end-to-end tests on. Code Dungeon's coders and tester each work in their own
// copy on one machine, so a fixed port would collide; the port comes from the folder, the same every run.
export function e2ePort(folder: string): number {
  let h = 0;
  for (const ch of folder.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 3100 + (h % 800);
}
