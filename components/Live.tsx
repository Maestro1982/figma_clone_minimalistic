import { useCallback, useEffect, useState } from 'react';

import {
  useBroadcastEvent,
  useEventListener,
  useMyPresence,
} from '@/liveblocks.config';
import { CursorMode, CursorState, Reaction } from '@/types/type';
import useInterval from '@/hooks/useInterval';
import { shortcuts } from '@/constants';

import LiveCursors from '@/components/cursor/LiveCursors';
import CursorChat from '@/components/cursor/CursorChat';
import ReactionSelector from '@/components/reaction/ReactionButton';
import FlyingReaction from '@/components/reaction/FlyingReaction';
import { Comments } from '@/components/comments/Comments';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

type Props = {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  undo: () => void;
  redo: () => void;
};

const Live = ({ canvasRef, undo, redo }: Props) => {
  /**
   * useMyPresence returns the presence of the current user in the room.
   * It also returns a function to update the presence of the current user.
   *
   * useMyPresence: https://liveblocks.io/docs/api-reference/liveblocks-react#useMyPresence
   */
  const [{ cursor }, updateMyPresence] = useMyPresence();

  /**
   * useBroadcastEvent is used to broadcast an event to all the other users in the room.
   *
   * useBroadcastEvent: https://liveblocks.io/docs/api-reference/liveblocks-react#useBroadcastEvent
   */
  const broadcast = useBroadcastEvent();

  // store the reactions created on mouse click
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // track the state of the cursor (hidden, chat, reaction, reaction selector)
  const [cursorState, setCursorState] = useState<CursorState>({
    mode: CursorMode.Hidden,
  });

  // set the reaction of the cursor
  const setReaction = useCallback((reaction: string) => {
    setCursorState({
      mode: CursorMode.Reaction,
      reaction,
      isPressed: false,
    });
  }, []);

  // Remove reactions that are not visible anymore (every 1 sec)
  useInterval(() => {
    setReactions((reactions) =>
      reactions.filter((reaction) => reaction.timestamp > Date.now() - 4000)
    );
  }, 1000);

  // Broadcast the reaction to other users (every 100ms)
  useInterval(() => {
    if (
      cursorState.mode === CursorMode.Reaction &&
      cursorState.isPressed &&
      cursor
    ) {
      // concat all the reactions created on mouse click
      setReactions((reactions) =>
        reactions.concat([
          {
            point: { x: cursor.x, y: cursor.y },
            value: cursorState.reaction,
            timestamp: Date.now(),
          },
        ])
      );

      // Broadcast the reaction to other users
      broadcast({
        x: cursor.x,
        y: cursor.y,
        value: cursorState.reaction,
      });
    }
  }, 100);

  /**
   * useEventListener is used to listen to events broadcasted by other
   * users.
   *
   * useEventListener: https://liveblocks.io/docs/api-reference/liveblocks-react#useEventListener
   */
  useEventListener((eventData) => {
    const event = eventData.event;
    setReactions((reactions) =>
      reactions.concat([
        {
          point: { x: event.x, y: event.y },
          value: event.value,
          timestamp: Date.now(),
        },
      ])
    );
  });

  // Listen to mouse events to change the cursor state
  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();

      // if cursor is not in reaction selector mode, update the cursor position
      if (cursor == null || cursorState.mode !== CursorMode.ReactionSelector) {
        // get the cursor position in the canvas
        const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
        const y = event.clientY - event.currentTarget.getBoundingClientRect().y;

        // broadcast the cursor position to other users
        updateMyPresence({
          cursor: {
            x,
            y,
          },
        });
      }
    },
    [updateMyPresence, cursor, cursorState.mode]
  );

  // Hide the cursor when the mouse leaves the canvas
  const handlePointerLeave = useCallback(() => {
    setCursorState({
      mode: CursorMode.Hidden,
    });
    updateMyPresence({
      cursor: null,
      message: null,
    });
  }, [updateMyPresence]);

  // Show the cursor when the mouse enters the canvas
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      // get the cursor position in the canvas
      const x = event.clientX - event.currentTarget.getBoundingClientRect().x;
      const y = event.clientY - event.currentTarget.getBoundingClientRect().y;

      updateMyPresence({
        cursor: {
          x,
          y,
        },
      });

      // if cursor is in reaction mode, set isPressed to true
      setCursorState((state: CursorState) =>
        cursorState.mode === CursorMode.Reaction
          ? { ...state, isPressed: true }
          : state
      );
    },
    [cursorState.mode, setCursorState, updateMyPresence]
  );

  // hide the cursor when the mouse is up
  const handlePointerUp = useCallback(() => {
    setCursorState((state: CursorState) =>
      cursorState.mode === CursorMode.Reaction
        ? { ...state, isPressed: false }
        : state
    );
  }, [cursorState.mode, setCursorState]);

  // trigger respective actions when the user clicks on the right menu
  const handleContextMenuClick = useCallback(
    (key: string) => {
      switch (key) {
        case 'Chat':
          setCursorState({
            mode: CursorMode.Chat,
            previousMessage: null,
            message: '',
          });
          break;

        case 'Reactions':
          setCursorState({ mode: CursorMode.ReactionSelector });
          break;

        case 'Undo':
          undo();
          break;

        case 'Redo':
          redo();
          break;

        default:
          break;
      }
    },
    [undo, redo]
  );

  // Listen to keyboard events to change the cursor state
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
    <ContextMenu>
      <ContextMenuTrigger
        id='canvas'
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className='relative h-full w-full flex flex-1 justify-center items-center'
        style={{
          cursor: cursorState.mode === CursorMode.Chat ? 'none' : 'auto',
        }}
      >
        <canvas ref={canvasRef} />

        {reactions.map((reaction) => (
          <FlyingReaction
            key={reaction.timestamp.toString()}
            x={reaction.point.x}
            y={reaction.point.y}
            timestamp={reaction.timestamp}
            value={reaction.value}
          />
        ))}

        {cursor && (
          <CursorChat
            cursor={cursor}
            cursorState={cursorState}
            setCursorState={setCursorState}
            updateMyPresence={updateMyPresence}
          />
        )}

        {/* If cursor is in reaction selector mode, show the reaction selector */}
        {cursorState.mode === CursorMode.ReactionSelector && (
          <ReactionSelector
            setReaction={(reaction) => {
              setReaction(reaction);
            }}
          />
        )}

        <LiveCursors />

        {/* Show the comments */}
        <Comments />
      </ContextMenuTrigger>

      <ContextMenuContent className='right-menu-content'>
        {shortcuts.map((item) => (
          <ContextMenuItem
            key={item.key}
            className='right-menu-item'
            onClick={() => handleContextMenuClick(item.name)}
          >
            <p>{item.name}</p>
            <p className='text-xs text-primary-grey-300'>{item.shortcut}</p>
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
};
export default Live;
