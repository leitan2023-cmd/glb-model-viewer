import React from 'react';

export interface PickDebugState {
  pickablesCount: number;
  lastDownX: number;
  lastDownY: number;
  lastNDCX: number;
  lastNDCY: number;
  hitsCount: number;
  hitName: string;
  hitUUID: string;
  mappedTreeId: string;
}

interface PickDebugHUDProps {
  state: PickDebugState;
}

const PickDebugHUD: React.FC<PickDebugHUDProps> = ({ state }) => {
  return (
    <div
      className="fixed top-4 right-4 bg-black/80 text-cyan-400 font-mono text-xs p-3 rounded border border-cyan-500 pointer-events-none z-50"
      style={{
        maxWidth: '300px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        lineHeight: '1.4',
      }}
    >
      <div className="text-cyan-300 font-bold mb-2">Pick Debug HUD</div>
      <div>pickables: <span className={state.pickablesCount > 0 ? 'text-green-400' : 'text-red-400'}>{state.pickablesCount}</span></div>
      <div>lastDown: ({state.lastDownX}, {state.lastDownY})</div>
      <div>lastNDC: ({state.lastNDCX.toFixed(2)}, {state.lastNDCY.toFixed(2)})</div>
      <div>hits: <span className={state.hitsCount > 0 ? 'text-green-400' : 'text-red-400'}>{state.hitsCount}</span></div>
      {state.hitName && (
        <>
          <div>hitName: {state.hitName}</div>
          <div>hitUUID: {state.hitUUID.slice(0, 8)}...</div>
        </>
      )}
      {state.mappedTreeId && (
        <div>treeId: <span className="text-yellow-400">{state.mappedTreeId}</span></div>
      )}
    </div>
  );
};

export default PickDebugHUD;
