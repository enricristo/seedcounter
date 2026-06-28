import { useReducer, useCallback } from 'react';
import type { AppView } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ViewState {
  current: AppView;
  previous: AppView | null;
  params: Record<string, unknown>;
}

type ViewAction =
  | { type: 'NAVIGATE'; view: AppView; params?: Record<string, unknown> }
  | { type: 'BACK' }
  | { type: 'REPLACE'; view: AppView; params?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'NAVIGATE':
      return {
        current: action.view,
        previous: state.current,
        params: action.params ?? {},
      };
    case 'REPLACE':
      // Navigate without adding to history (replaces current view)
      return {
        current: action.view,
        previous: state.previous,
        params: action.params ?? {},
      };
    case 'BACK':
      if (!state.previous) return state;
      return {
        current: state.previous,
        previous: null,
        params: {},
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useViewNavigation — manages multi-view navigation without React Router.
 *
 * Supports:
 * - navigate(view, params?) — push navigation with history
 * - replace(view, params?) — replace current view without history
 * - goBack()               — return to previous view
 * - params                 — typed params passed to the current view
 *
 * @example
 * const { currentView, navigate, goBack, params } = useViewNavigation('counter');
 * navigate('longitudinal', { experimentId: 'exp-123' });
 * navigate('stats');
 * goBack(); // back to 'longitudinal'
 */
export function useViewNavigation(initial: AppView = 'counter') {
  const [state, dispatch] = useReducer(viewReducer, {
    current: initial,
    previous: null,
    params: {},
  });

  const navigate = useCallback(
    (view: AppView, params?: Record<string, unknown>) =>
      dispatch({ type: 'NAVIGATE', view, params }),
    []
  );

  const replace = useCallback(
    (view: AppView, params?: Record<string, unknown>) =>
      dispatch({ type: 'REPLACE', view, params }),
    []
  );

  const goBack = useCallback(() => dispatch({ type: 'BACK' }), []);

  const canGoBack = state.previous !== null;

  return {
    currentView: state.current,
    previousView: state.previous,
    params: state.params,
    navigate,
    replace,
    goBack,
    canGoBack,
  };
}
