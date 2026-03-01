export { WorktreeManager, type WorktreeInfo, type CreateWorktreeOptions } from "./manager.js";
export {
  readWorktreeState,
  writeWorktreeState,
  registerWorktree,
  unregisterWorktree,
  assignAgent,
  getWorktreeState,
  type WorktreeState,
} from "./registry.js";
