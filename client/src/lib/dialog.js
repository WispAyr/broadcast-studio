// Promise-based confirm dialog. One `<ConfirmHost />` lives at the app root
// and registers itself via `registerConfirm`. Any handler can then do:
//
//   if (!await confirmAsync({ title: 'Delete?', message: '...' })) return;
//
// No useState boilerplate per page, and the native `confirm()` calls scattered
// through the codebase get a single consistent replacement.

let showConfirm = null;

export function registerConfirm(fn) {
  showConfirm = fn;
}

export function confirmAsync(opts) {
  if (!showConfirm) {
    // Fall back to native confirm if the host hasn't mounted yet. Shouldn't
    // happen in practice because ConfirmHost is rendered at the router root.
    return Promise.resolve(window.confirm(opts.message || opts.title || 'Are you sure?'));
  }
  return new Promise((resolve) => {
    showConfirm({
      ...opts,
      onConfirm: () => resolve(true),
      onCancel:  () => resolve(false),
    });
  });
}
