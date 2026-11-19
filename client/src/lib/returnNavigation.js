export function returnNavigationState(fromPath, fromLabel) {
  return {
    state: {
      from: fromPath,
      fromLabel,
    },
  };
}