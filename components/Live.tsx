import { useCallback, useEffect, useState } from 'react';

import { useMyPresence, useOthers } from '@/liveblocks.config';
import { CursorMode, CursorState, Reaction } from '@/types/type';

import LiveCursors from '@/components/cursor/LiveCursors';
import CursorChat from '@/components/cursor/CursorChat';
import ReactionSelector from '@/components/reaction/ReactionButton';

const Live = () => {
  /**
   * useOthers returns the list of other users in the room.
   *
   * useOthers: https://liveblocks.io/docs/api-reference/liveblocks-react#useOthers
   */
  const others = useOthers();

  /**
   * useMyPresence returns the presence of the current user in the room.
   * It also returns a function to update the presence of the current user.
   *
   * useMyPresence: https://liveblocks.io/docs/api-reference/liveblocks-react#useMyPresence
   */
  const [{ cursor }, updateMyPresence] = useMyPresence() as any;

  // track the state of the cursor (hidden, chat, reaction, reaction selector)
  const [cursorState, setCursorState] = useState<CursorState>({
    mode: CursorMode.Hidden,
  });

  // store the reactions created on mouse click
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // Listen to mouse events to change the cursor state
  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();

      // if cursor is not in reaction selector mode, update the cursor position
      if (cursor == null || cursorState.mode === CursorMode.ReactionSelector) {
        // get the cursor position in the canvas
        const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
        const y = event.clientY - event.currentTarget.getBoundingClientRect().y;

        updateMyPresence({ cursor: { x, y } });
      }
    },
    [updateMyPresence, cursor, cursorState.mode]
  );

  // Hide the cursor when the mouse leaves the canvas
  const handlePointerLeave = useCallback(
    (event: React.PointerEvent) => {
      setCursorState({ mode: CursorMode.Hidden });

      updateMyPresence({ cursor: null, message: null });
    },
    [updateMyPresence]
  );

  // Show the cursor when the mouse enters the canvas
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      // get the cursor position in the canvas
      const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
      const y = event.clientY - event.currentTarget.getBoundingClientRect().y;

      updateMyPresence({ cursor: { x, y } });

      // if cursor is in reaction mode, set isPressed to true
      setCursorState((state: CursorState) =>
        cursorState.mode === CursorMode.Reaction
          ? { ...state, isPressed: true }
          : state
      );
    },
    [updateMyPresence, cursorState.mode, setCursorState]
  );

  // hide the cursor when the mouse is up
  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      // if cursor is in reaction mode, set isPressed to true
      setCursorState((state: CursorState) =>
        cursorState.mode === CursorMode.Reaction
          ? { ...state, isPressed: true }
          : state
      );
    },
    [cursorState.mode, setCursorState]
  );

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === '/') {
        setCursorState({
          mode: CursorMode.Chat,
          previousMessage: '',
          message: '',
        });
      } else if (event.key === 'Escape') {
        updateMyPresence({ message: '' });
        setCursorState({ mode: CursorMode.Hidden });
      } else if (event.key === 'e') {
        setCursorState({
          mode: CursorMode.ReactionSelector,
        });
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/') {
        event.preventDefault();
      }
    };

    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [updateMyPresence]);

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className='h-[100vh] w-full flex justify-center items-center text-center'
    >
      <h1 className='text-2xl text-white'>Liveblocks Figma Clone</h1>

      {cursor && (
        <CursorChat
          cursor={cursor}
          cursorState={cursorState}
          setCursorState={setCursorState}
          updateMyPresence={updateMyPresence}
        />
      )}

      {cursorState.mode === CursorMode.ReactionSelector && (
        <ReactionSelector
          setReaction={(reaction) => {
            setCursorState({
              mode: CursorMode.Reaction,
              reaction,
              isPressed: false,
            });
          }}
        />
      )}

      <LiveCursors others={others} />
    </div>
  );
};
export default Live;
