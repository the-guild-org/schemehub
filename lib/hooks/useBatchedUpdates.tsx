import * as React from "react";

/**
 * Batch multiple setState into one batch in order to prevent unnecessary re-renders in async callbacks.
 */
export const useBatchedUpdates = () => {
  const [, setState] = React.useState();

  return React.useCallback((transaction: () => void) => {
    setState(() => {
      transaction();
      return undefined;
    });
  }, []);
};
