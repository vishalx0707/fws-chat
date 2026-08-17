import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, LayoutDashboard, MessageSquarePlus, Settings, History, Activity, Mic, Sidebar, Edit2, Copy, RefreshCw, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './index.css';

const stripThinking = (text) => {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
};

const greetings = [
  "How can I help you today?",
  "What's on your mind?",
  "Ready to explore?",
  "What can I assist you with?",
  "How can I make your day better?"
];

function App() {
  const [sessions, setSessions] = useState(() => {
    return [{ id: Date.now(), title: "New Chat", messages: [] }];
  });
  const [currentSessionId, setCurrentSessionId] = useState(sessions[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [heroGreeting, setHeroGreeting] = useState(greetings[0]);

  // Edit state
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession.messages;
  const isHeroView = messages.length === 0;

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(isRecording);
  const currentSessionIdRef = useRef(currentSessionId);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    if (messages.length === 0) {
      setHeroGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    }
    setEditingIdx(null); // reset edit state on switch
  }, [currentSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isHeroView) {
      scrollToBottom();
    }
  }, [messages, isHeroView]);

  const setMessagesForCurrentSession = (newMessages) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionIdRef.current) {
         let title = s.title;
         const firstUserMsg = newMessages.find(m => m.role === 'user');
         if ((title === "New Chat") && firstUserMsg) {
           title = firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? '...' : '');
         }
         return { ...s, messages: newMessages, title };
      }
      return s;
    }));
  };

  const createNewChat = () => {
    const newId = Date.now();
    setSessions([{ id: newId, title: "New Chat", messages: [] }, ...sessions]);
    setCurrentSessionId(newId);
  };

  const toggleRecording = useCallback(async () => {
    if (isRecordingRef.current) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interim += event.results[i][0].transcript;
            }
            setInterimText(interim);
          };
          recognition.start();
          recognitionRef.current = recognition;
        }

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setInterimText(' (Transcribing via Whisper...)');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          
          try {
            const res = await fetch('/transcribe', {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            if (data.text) {
               setInput(prev => prev + (prev ? " " : "") + data.text.trim());
            }
          } catch(err) {
            console.error("Transcription error:", err);
          } finally {
            setInterimText('');
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing mic:", err);
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  const handleSend = async (e, overrideMessages = null) => {
    if (e) e.preventDefault();
    if (isTyping) return;

    let newMessages;
    if (overrideMessages) {
       newMessages = overrideMessages;
    } else {
       if (!input.trim()) return;
       const userMessage = { role: 'user', content: input.trim() };
       newMessages = [...messages, userMessage];
       setInput('');
    }

    setMessagesForCurrentSession(newMessages);
    setIsTyping(true);

    setMessagesForCurrentSession([...newMessages, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let assistantResponse = "";
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) {
          done = true;
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                console.error(data.error);
                continue;
              }
              if (data.content) {
                assistantResponse += data.content;
                setSessions((prevSessions) => {
                  return prevSessions.map(s => {
                    if (s.id === currentSessionIdRef.current) {
                      const updatedMessages = [...s.messages];
                      updatedMessages[updatedMessages.length - 1] = { role: 'assistant', content: assistantResponse };
                      return { ...s, messages: updatedMessages };
                    }
                    return s;
                  });
                });
              }
            } catch (err) {}
          }
        }
      }
    } catch (error) {
      console.error("Error communicating with backend:", error);
      setSessions((prevSessions) => {
        return prevSessions.map(s => {
          if (s.id === currentSessionIdRef.current) {
            const updatedMessages = [...s.messages];
            updatedMessages[updatedMessages.length - 1] = { role: 'assistant', content: 'Error communicating with backend.' };
            return { ...s, messages: updatedMessages };
          }
          return s;
        });
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleRegenerate = (idx) => {
    const newMessages = messages.slice(0, idx);
    handleSend(null, newMessages);
  };

  const startEditing = (idx, content) => {
    setEditingIdx(idx);
    setEditText(content);
  };

  const handleSaveEdit = (idx) => {
    const newContent = editText.trim();
    if (!newContent) return;
    setEditingIdx(null);
    
    const sliced = messages.slice(0, idx);
    const updatedUserMsg = { role: 'user', content: newContent };
    handleSend(null, [...sliced, updatedUserMsg]);
  };

  const clearChat = () => {
    setMessagesForCurrentSession([]);
  };

  const userMessageCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="app-container">
      <div className="main-ui-overlay">
        
        <div className={`sidebar-container ${isSidebarOpen ? 'open' : 'closed'}`}>
          <aside className="dashboard-sidebar">
             <div className="sidebar-header">
                <h2 className="sidebar-text">FWS Chat</h2>
                <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Sidebar">
                  <Sidebar size={20} />
                </button>
             </div>

             <button onClick={createNewChat} className="new-chat-btn">
                <MessageSquarePlus size={18} style={{flexShrink: 0}} />
                <span className="sidebar-text">New Chat</span>
             </button>

             <div className={`sidebar-section ${isSidebarOpen ? '' : 'hidden'}`}>
                <h3>Recent Chats</h3>
                <ul className="history-list">
                   {sessions.map(session => (
                     <li 
                       key={session.id} 
                       className={session.id === currentSessionId ? 'active' : ''}
                       onClick={() => setCurrentSessionId(session.id)}
                     >
                       <History size={16} style={{flexShrink: 0}} /> 
                       <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                         {session.title}
                       </span>
                     </li>
                   ))}
                </ul>
             </div>

             <div className="sidebar-footer">
                <button className="dashboard-stats-btn" title={`Prompts Sent: ${userMessageCount}`}>
                   <Activity size={18} style={{flexShrink: 0}} />
                   <span className="sidebar-text">Prompts Sent: {userMessageCount}</span>
                </button>
                <button className="settings-btn" title="Settings">
                   <Settings size={18} style={{flexShrink: 0}} />
                   <span className="sidebar-text">Settings</span>
                </button>
             </div>
          </aside>
        </div>

        <div className="chat-window">
          
          <div className="chat-header">
            {/* The open button is no longer needed here since the mini-sidebar always shows the toggle */}
            <button onClick={clearChat} className="btn-clear" aria-label="Clear chat">
              <Trash2 size={16} />
              Clear
            </button>
          </div>

          <div className="chat-messages" style={{ opacity: isHeroView ? 0 : 1, pointerEvents: isHeroView ? 'none' : 'auto' }}>
            {messages.map((msg, idx) => {
              const displayContent = msg.role === 'assistant' ? stripThinking(msg.content) : msg.content;
              const showThinking = msg.role === 'assistant' && isTyping && idx === messages.length - 1 && !displayContent;
              
              if (editingIdx === idx) {
                return (
                  <div key={idx} className="edit-box">
                    <textarea 
                      className="edit-textarea" 
                      value={editText} 
                      onChange={e => setEditText(e.target.value)} 
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button className="btn-cancel" onClick={() => setEditingIdx(null)}>Cancel</button>
                      <button className="btn-save" onClick={() => handleSaveEdit(idx)}>Save</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="message-container">
                  <div className={`message ${msg.role}`}>
                    <div className="message-content">
                      {showThinking ? (
                        <span style={{ opacity: 0.6, fontStyle: 'italic' }}>Thinking...</span>
                      ) : (
                         <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({node, inline, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                return !inline && match ? (
                                  <div className="code-block-wrapper">
                                    <div className="code-block-header">
                                      <span className="code-block-lang">{match[1]}</span>
                                      <button type="button" className="code-block-copy" onClick={() => handleCopy(codeString, `code-${idx}-${match[1]}`)}>
                                        {copiedIdx === `code-${idx}-${match[1]}` ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                                      </button>
                                    </div>
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{ margin: 0, borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', background: '#1e1e1e' }}
                                      {...props}
                                    >
                                      {codeString}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                         >
                            {displayContent}
                         </ReactMarkdown>
                      )}
                    </div>
                  </div>
                  
                  {!isTyping && (
                    <div className={`message-actions ${msg.role === 'user' ? 'user-actions' : 'assistant-actions'}`}>
                      {msg.role === 'user' && (
                        <button className="action-btn" title="Edit prompt" onClick={() => startEditing(idx, msg.content)}>
                          <Edit2 size={14} />
                        </button>
                      )}
                      
                      {msg.role === 'assistant' && (
                        <>
                          <button className="action-btn" title="Copy text" onClick={() => handleCopy(displayContent, idx)}>
                            {copiedIdx === idx ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                          </button>
                          <button className="action-btn" title="Regenerate response" onClick={() => handleRegenerate(idx)}>
                            <RefreshCw size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className={`chat-input-area ${isHeroView ? 'hero' : 'bottom'}`}>
            {isHeroView && (
              <div className="hero-greeting">
                <h2>{heroGreeting}</h2>
              </div>
            )}
            <form onSubmit={(e) => handleSend(e)} className="chat-input-container">
              <button 
                type="button" 
                onClick={toggleRecording} 
                className={`btn-mic ${isRecording ? 'recording' : ''}`}
                title={isRecording ? "Stop recording (Ctrl+Shift+D)" : "Dictate message"}
              >
                <Mic size={18} color={isRecording ? '#ff4444' : '#ffffff'} />
              </button>
              <input 
                type="text" 
                value={isRecording ? (input + (input ? " " : "") + interimText).trim() : input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isTyping ? "AI is typing..." : isRecording ? "Listening..." : "Ask anything..."} 
                className="chat-input"
                readOnly={isTyping || isRecording}
              />
              <button type="submit" className="btn-send" aria-label="Send message" disabled={isTyping}>
                <Send size={18} />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
