import { Static } from "ink";
import React from "react";
import { type TurnActivity } from "../../core/activity.js";
import { TurnBlock } from "./TurnBlock.js";

interface ActivityFeedProps {
  readonly completedTurns: readonly TurnActivity[];
  readonly currentTurn?: TurnActivity | null;
}

/** Renders all turns with completed ones in <Static> to prevent re-renders */
export const ActivityFeed = React.memo(function ActivityFeed({
  completedTurns,
  currentTurn,
}: ActivityFeedProps) {
  return (
    <>
      <Static items={completedTurns.map((t, i) => ({ ...t, key: `turn-${i}` }))}>
        {(turn) => <TurnBlock key={turn.key} turn={turn} />}
      </Static>
      {currentTurn ? <TurnBlock turn={currentTurn} isLive /> : null}
    </>
  );
});
