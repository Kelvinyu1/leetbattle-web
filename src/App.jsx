import { useEffect, useState } from 'react';
import { useSocket } from './lib/useSocket';
import Editor from '@monaco-editor/react';

export default function App() {
  const { socket, connected } = useSocket();
  const [view, setView] = useState('lobby');
  const [state, setState] = useState({});
  const [code, setCode] = useState('');
  const [name, setName] = useState('Player');
  const [selfUserId, setSelfUserId] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [rematchStatus, setRematchStatus] = useState(null);

  const [theme, setTheme] = useState('light');
  const [section, setSection] = useState('code');

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };


  const handleEditorWillMount = (monaco) => {
    monaco.editor.defineTheme('lightTheme', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#D9D9D9', // background
        'editor.foreground': '#000000',
        'editorLineNumber.foreground': '#000000', // line number color
        'editorLineNumber.activeForeground': '#FFFFFF', // current line
        'editorGutter.background': '#C2C2C2', // the line number background
        'editorCursor.foreground': '#000000', // the cursor | color
        'editor.lineHighlightBorder': '#D5D5D5', // the rectangle around the current line
        'scrollbar.shadow': '#00000000', // removes the shadow on the scrollbar
        'scrollbarSlider.border': '#00000000', // removes the border on scroll bar
        'editor.selectionBackground': '#ADD6FF44', // Highlight background
        'editor.inactiveSelectionBackground': '#ADD6FF00', // The rest of these remove a bug with highlighting where it remains dark
        'editor.selectionHighlightBackground': '#00000000',
        'editor.wordHighlightStrongBackground': '#00000000'
      },
    });


    monaco.editor.defineTheme('darkTheme', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#404040', // background
        'editor.foreground': '#FFFFFF',
        'editorLineNumber.foreground': '#FFFFFF', // line number color
        'editorLineNumber.activeForeground': '#000000', // current line
        'editorGutter.background': '#2A2A2A', // the line number background
        'editorCursor.foreground': '#FFFFFF', // the cursor | color
        'editor.lineHighlightBorder': '#363636', // the rectangle around the current line
        'scrollbar.shadow': '#00000000', // removes the shadow on the scrollbar
        'scrollbarSlider.border': '#00000000', // removes the border on scroll bar
        'editor.selectionBackground': '#ADD6FF44', // Highlight background
        'editor.inactiveSelectionBackground': '#ADD6FF00', // The rest of these remove a bug with highlighting where it remains dark
        'editor.selectionHighlightBackground': '#00000000',
        'editor.wordHighlightStrongBackground': '#00000000'
      },
    });
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('session', ({ userId }) => setSelfUserId(userId));
    socket.on('scoreboard.update', (list) => setScoreboard(list));

    socket.on('queue.status', (p) => setState((s) => ({ ...s, queue: p.status })));

    // First round for a newly formed room (server now emits match.start)
    socket.on('match.start', (p) => {
      // reset per-round state
      setState(p);
      setCode(p.problem.starter_code.javascript || 'module.exports = () => {};');
      setRematchStatus(null);
      setView('room');
    });

    // Back-compat if server still sends match.found (shouldn’t after this patch)
    socket.on('match.found', (p) => {
      setState(p);
      setCode(p.problem.starter_code.python || 'module.exports = () => {};');
      setRematchStatus(null);
      setView('room');
    });

    socket.on('timer.tick', (t) => setState((s) => ({ ...s, remaining: t.remaining })));
    socket.on('submission.result', (r) => setState((s) => ({ ...s, lastResult: r })));
    socket.on('match.over', (m) => setState((s) => ({ ...s, over: m })));

    socket.on('rematch.status', ({ readyCount, total }) => {
      setRematchStatus({ readyCount, total });
    });

    return () => {
      socket.off('session');
      socket.off('scoreboard.update');
      socket.off('queue.status');
      socket.off('match.start');
      socket.off('match.found');
      socket.off('timer.tick');
      socket.off('submission.result');
      socket.off('match.over');
      socket.off('rematch.status');
    };
  }, [socket]);

  function findMatch() {
    socket?.emit('queue.join', { name: name || 'Player' });
  }

  function submit() {
    socket?.emit('room.submit', { matchId: state.matchId, code, lang: 'python' });
  }

  function requestRematch() {
    socket?.emit('rematch.request');
  }

  if (view === 'lobby') {
    return (
      <div className="wrap">
        <h1>Leet Battle</h1>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <button className="bg-[#444444]" disabled={!connected} onClick={findMatch}>
            {connected ? 'Find Match' : 'Connecting...'}
          </button>
        </div>

        {/* Scoreboard shown on lobby too */}
        {scoreboard.length > 0 && (
          <>
            <h3 style={{ marginTop: 24 }}>🏆 Leaderboard</h3>
            <ol>
              {scoreboard.slice(0, 10).map((p) => (
                <li key={p.userId}>
                  {p.name} — {p.wins}W/{p.losses}L
                </li>
              ))}
            </ol>
          </>
        )}

        {state.queue === 'waiting' && <p>⏳ Waiting for an opponent… open a second window to test.</p>}
      </div>
    );
  }

  const youWin = state.over?.winnerId && selfUserId && state.over.winnerId === selfUserId;

  return (
    <div className={`w-screen h-screen ${theme === 'light' ? 'bg-[#EDECF2]' : 'bg-[#2E2E31]'}`}>

      {/* Title */}
      <div className={`w-screen h-1/16 rounded-b-lg  ${theme === 'light' ? 'bg-[#D9D9D9] text-[#8897AA] shadow-[0_4px_0_0_#777777]' : 'bg-[#404040] text-[#D1E8EE] shadow-[0_4px_0_0_#000000]'} items-center flex justify-between`}>
        <p className="text-font text-shadow text-5xl ml-5">Leet Battle</p>
        <p className="text-font text-5xl mr-5 select-none" onClick={toggleTheme}>{theme === 'light' ? "☽" : "☼"}</p>
      </div>

      {/* Bottom Half */}
      <div className="w-screen h-5/6 mt-10 flex flex-row gap-10">

        {/* Problem Section */}
        <div className={`h-full w-1/3 ml-10 rounded-lg ${theme === 'light' ? 'bg-[#D9D9D9] text-[#8897AA]' : 'bg-[#404040] text-[#D1E8EE]'} text-font pt-3 p-5 overflow-auto`}>
          <h1 className="text-5xl">{state.problem?.title}</h1>
          <p className="text-2xl">Difficulty: {state.problem?.difficulty}</p>

          <pre className={`statement ${theme === 'light' ? 'bg-[#f7f7f9]' : 'bg-[#5d5d5e]'} text-2xl mt-2 text-font`}>{state.problem?.statement}</pre>
          {/* <p className="text-2xl mt-2">"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."</p>
              <p className="text-2xl mt-2">"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."</p>
              <p className="text-2xl mt-2">"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."</p>
              <p className="text-2xl mt-2">"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."</p> */}
        </div>

        {/* Right Side */}
        <div className="flex flex-col w-3/5 gap-10">
          {/* Score/Time */}
          <div className={`w-full h-1/12 rounded-lg ${theme === 'light' ? 'bg-[#D9D9D9] text-[#8897AA] shadow-[0_4px_0_0_#777777]' : 'bg-[#404040] text-[#D1E8EE] shadow-[0_4px_0_0_#000000]'} text-font text-5xl items-center flex flex-row justify-between`}>
            <p className="ml-5">{state.players?.[0]?.name ?? 'User1'}: {state.players?.[0]?.score ?? '0'}</p>
            <p>Time Left: {state.remaining ?? state.countdownSeconds}s</p>
            <p className="mr-5">{state.players?.[1]?.name ?? 'User2'}: {state.players?.[1]?.score ?? '0'}</p>
          </div>


          {/* Code Section */}
          <div className={`w-full h-full ${theme === 'light' ? 'bg-[#C2C2C2]' : 'bg-[#2A2A2A]'}`}>
            <div className={`w-full h-1/14 rounded-b-lg ${theme === 'light' ? 'bg-[#D9D9D9] text-[#8897AA] shadow-[0_4px_0_0_#777777]' : 'bg-[#404040] text-[#D1E8EE] shadow-[0_4px_0_0_#000000]'} items-center flex text-font`}>
              <p className="text-4xl ml-3"> {'</>'} Code</p>
            </div>

            <div className="flex flex-row gap-2">
              <div className={`${theme === 'light' ? 'text-[#8897AA]' : 'text-[#D1E8EE]'} ${section === 'code' ? 'bg-[#444444]' : 'bg-[#666666]'} select-none flex items-center w-24 justify-center rounded-t-lg`} style={{ marginTop: 8 + "px", marginLeft: 77 + "px" }} onClick={() => setSection('code')}>
                <p className="text-font text-2xl">Python</p>
              </div>

              <div className={`${theme === 'light' ? 'text-[#D75E5E]' : 'text-[#D75E5E]'} ${section === 'code' ? 'bg-[#666666]' : 'bg-[#444444]'} select-none flex items-center w-24 justify-center rounded-t-lg`} style={{ marginTop: 8 + "px", marginLeft: 5 + "px" }} onClick={() => setSection('result')}>
                <p className="text-font text-2xl">Result</p>
              </div>
            </div>


            {/* Editor/Submit Button */}
            {section === 'code' &&
              <div className={`h-4/5 w-full ${theme === 'light' ? 'bg-[#D9D9D9]' : 'bg-[#404040]'} relative`}>
                <div className="h-full">
                  < Editor
                    height="100%"
                    defaultLanguage="python"
                    value={code}
                    onChange={(v) => setCode(v || '')}
                    theme={theme === 'light' ? 'lightTheme' : 'darkTheme'}
                    options={{
                      minimap: { enabled: false },
                      fontFamily: '"Jersey 10", sans-serif',
                      fontSize: 24,
                      scrollBeyondLastLine: false, // fixes a weird new line bug when it starts scrolling 15 lines down instead of the whole thing
                      quickSuggestions: false, // get rid of suggestions
                      overviewRulerLanes: 0, // removes a weird black line on the scroll bar
                    }}
                    beforeMount={handleEditorWillMount}
                    className="flex-1 editor-left-pad"
                  />
                </div>

                <button className={`submit my-2 w-full ${theme === 'light' ? 'bg-[#444444]' : 'bg-[#666666]'}`} onClick={() => (submit(), setSection('result'))} disabled={!!state.over}>Submit</button>
              </div>
            }

            {section === 'result' && state.lastResult &&
              <div className={`w-6/7 h-4/5 verdict ${state.lastResult.verdict === 'Accepted' ? 'ok' : 'bad'} text-font text-2xl`} style={{ marginLeft: 77 + "px" }}>
                Last verdict: {state.lastResult.verdict} ({state.lastResult.passCount}/{state.lastResult.total}) · {state.lastResult.timeMs} ms
                {state.lastResult.error && <div className="err">{String(state.lastResult.error)}</div>}
              </div>
            }

            {section === 'result' && !state.lastResult &&
              <div className={`w-6/7 h-4/5 verdict bad text-font text-2xl`} style={{ marginLeft: 77 + "px" }}>
                No Submissions Yet
              </div>
            }

          </div>

        </div>
      </div>

      {state.over && (
        <div className="w-screen h-screen fixed inset-0 flex justify-center items-center bg-black/50 z-50">
          <div className={`w-1/3 h-1/4 text-font text-center flex flex-col justify-center rounded-lg ${theme === 'light' ? 'bg-[#D9D9D9] text-[#8897AA] shadow-[0_4px_0_0_#777777]' : 'bg-[#404040] text-[#D1E8EE] shadow-[0_4px_0_0_#000000]'}`}>
            <p className="text-5xl mt-5">🏁 {state.over.winnerId ? (youWin ? 'You win!' : 'You lose.') : 'Time up!'} 🏁</p>
            {rematchStatus && (
              <p className="text-4xl">Rematch ready: {rematchStatus.readyCount}/{rematchStatus.total}</p>
            )}
            <button className="text-2xl mx-10 mt-5 bg-[#444444] hover:bg-[#333333]" onClick={requestRematch}>🔁 Rematch?</button>
          </div>
        </div>
      )}

    </div>
  )

  //   return (
  //     <div className="grid">
  //       <div className="left">
  //         <h2>{state.problem?.title}</h2>
  //         <p className="meta">
  //           Difficulty: {state.problem?.difficulty}{' '}
  //           {state.problem?.url && (
  //             <>
  //               · <a href={state.problem.url} target="_blank" rel="noreferrer">Open on LeetCode</a>
  //             </>
  //           )}
  //         </p>
  //         <pre className="statement">{state.problem?.statement}</pre>

  //         <p>⏱️ Time left: {state.remaining ?? state.countdownSeconds}s</p>

  //         {state.lastResult && (
  //           <div className={`verdict ${state.lastResult.verdict === 'Accepted' ? 'ok' : 'bad'}`}>
  //             Last verdict: {state.lastResult.verdict} ({state.lastResult.passCount}/{state.lastResult.total}) · {state.lastResult.timeMs} ms
  //             {state.lastResult.error && <div className="err">{String(state.lastResult.error)}</div>}
  //           </div>
  //         )}

  //         {state.over && (
  //           <>
  //             <h3>🏁 {state.over.winnerId ? (youWin ? 'You win!' : 'You lose.') : 'Time up!'}</h3>
  //             <button className="submit" onClick={requestRematch}>🔁 Rematch</button>
  //             {rematchStatus && (
  //               <p>Rematch ready: {rematchStatus.readyCount}/{rematchStatus.total}</p>
  //             )}
  //           </>
  //         )}

  //         {/* Leaderboard in-room */}
  //         {scoreboard.length > 0 && (
  //           <>
  //             <h3 style={{ marginTop: 24 }}>🏆 Leaderboard</h3>
  //             <ol>
  //               {scoreboard.slice(0, 10).map((p) => (
  //                 <li key={p.userId}>
  //                   {p.name} — {p.wins}W/{p.losses}L
  //                 </li>
  //               ))}
  //             </ol>
  //           </>
  //         )}
  //       </div>

  //       <div className="right">
  //         <Editor
  //           height="70vh"
  //           defaultLanguage="python"
  //           value={code}
  //           onChange={(v) => setCode(v || '')}
  //           options={{ minimap: { enabled: false } }}
  //         />
  //         <button className="submit" onClick={submit} disabled={!!state.over}>Submit</button>
  //       </div>
  //     </div>
  //   );
}