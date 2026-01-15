// src/components/FloatingMessageBox.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

/* ---------------- SETTINGS ---------------- */
const API_BASE = "http://localhost:8080";
const WS_BASE = "ws://localhost:8080";

/* ---------------- HELPERS ---------------- */
function initialsFromName(name = "") {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
function colorFromName(name = "") {
  // deterministic color palette
  const colors = [
    "bg-indigo-400 text-white",
    "bg-rose-400 text-white",
    "bg-emerald-400 text-white",
    "bg-sky-400 text-white",
    "bg-amber-400 text-white",
    "bg-fuchsia-400 text-white",
    "bg-lime-400 text-white",
    "bg-violet-400 text-white",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  const idx = Math.abs(h) % colors.length;
  return colors[idx];
}
function safeParseJWT(authHeader = "") {
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return {};
  }
}

/* ---------------- COMPONENT ---------------- */
export default function FloatingMessageBox({ auth }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // normal + pinned mixed; pinned displayed separately
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineMap, setOnlineMap] = useState({}); // username -> lastSeen(ms)
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const presenceIntervalRef = useRef(null);
  const audioRef = useRef(null);

  const api = axios.create({
    baseURL: `${API_BASE}/messages`,
    headers: { Authorization: auth },
  });

  // derive username from jwt
  const jwtPayload = safeParseJWT(auth || "");
  const me = jwtPayload.sub || jwtPayload.username || "User";
  const isAdmin = me === "admin";

  /* ---------------- SOUND ---------------- */
  useEffect(() => {
    audioRef.current = new Audio();
    // replace this placeholder with a real data URI or file path if you want
    audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBIAAA...";
    audioRef.current.load();
  }, []);

  /* ---------------- SCROLL TO BOTTOM ---------------- */
  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    // small delay to let DOM render
    requestAnimationFrame(() => {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

  /* ---------------- LOAD MESSAGES ---------------- */
  const loadMessages = async () => {
  try {
    const res = await api.get("/");

    const arr = res.data || [];

    // sort by timestamp
    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    setMessages(arr);
    if (open) setUnread(0);
  } catch (err) {
    console.error("load messages", err);
  }
};

  /* ---------------- PRESENCE / WS ---------------- */
  useEffect(() => {
  if (!auth) return;

  // CLOSE old socket before opening new one
  try { wsRef.current?.close(); } catch {}

  loadMessages();

  const wsUrl = `${WS_BASE.replace(/\/$/, "")}/messages/ws`;
  let ws;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => sendPresence("online");
      ws.onmessage = (ev) => {
        try { handleWsEvent(JSON.parse(ev.data)); } catch {}
      };
      ws.onclose = () => setTimeout(connect, 1500);
    } catch {
      setTimeout(connect, 2000);
    }
  }

  connect();

  presenceIntervalRef.current = setInterval(() => {
    sendPresence("online");
    const now = Date.now();
    setOnlineMap((prev) => {
      const next = {};
      for (const k in prev) if (now - prev[k] < 30000) next[k] = prev[k];
      return next;
    });
  }, 20000);

  return () => {
    clearInterval(presenceIntervalRef.current);
    try { wsRef.current?.close(); } catch {}
  };
}, [auth]);


  const sendPresence = (status = "online") => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "presence", username: me, status }));
  };

  /* ---------------- WS EVENT HANDLER ---------------- */
  const handleWsEvent = (payload) => {
    if (!payload || !payload.type) return;

    if (payload.type === "message:new") {
  const m = payload.message;

  // Ignore my own message (avoid double notify + double unread)
  if (m.username === me) {
    setMessages((prev) => {
      const exists = prev.some((x) => x.id === m.id);
      return exists ? prev : [...prev, m];
    });
    return;
  }

  // Add message (no duplicates)
  setMessages((prev) => {
    const exists = prev.some((x) => x.id === m.id);
    return exists ? prev : [...prev, m];
  });

  // Unread count + notification only for others
  if (!open) {
    setUnread((u) => u + 1);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }

    if (window.Notification && Notification.permission === "granted") {
      new Notification(`${m.username}`, {
        body: m.content.slice(0, 120)
      });
    }
  } else {
    setUnread(0);
  }
}


    if (payload.type === "message:deleted") {
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    }

    if (payload.type === "message:pin") {
      const pm = payload.message;
      setMessages((prev) =>
        prev
          .map((m) => (m.id === pm.id ? { ...m, pinned: pm.pinned, pinned_at: pm.pinned_at } : m))
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      );
    }

    if (payload.type === "typing") {
      const { username, typing } = payload;
      setTypingUsers((t) => {
        const copy = { ...t };
        if (typing) copy[username] = Date.now();
        else delete copy[username];
        return copy;
      });
      // prune typing after 4s
      setTimeout(() => {
        setTypingUsers((t) => {
          const now = Date.now();
          const next = {};
          for (const k in t) if (now - t[k] < 4000) next[k] = t[k];
          return next;
        });
      }, 4500);
    }

    if (payload.type === "presence") {
      const { username, status } = payload;
      setOnlineMap((prev) => {
        const next = { ...prev };
        if (status === "online") next[username] = Date.now();
        else delete next[username];
        return next;
      });
    }
  };

  /* ---------------- TYPING ---------------- */
  const sendTyping = (isTyping) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "typing", username: me, typing: !!isTyping }));
  };

  const onTextChange = (v) => {
    setText(v);
    sendTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 900);
  };

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      const res = await api.post("/", { content: text });
      // push to bottom
      
      setText("");
      sendTyping(false);
      setUnread(0);
    } catch (err) {
      console.error("post failed", err);
      alert("Post failed");
    }
  };

  /* ---------------- DELETE / PIN ---------------- */
  const deleteMsg = async (id) => {
    if (!confirm("Delete message?")) return;
    try {
      await api.delete(`/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  const togglePin = async (id, pin) => {
    try {
      await api.post(`/${id}/pin?pin=${pin}`);
      // server will broadcast update
    } catch (err) {
      console.error(err);
      alert("Pin failed");
    }
  };

  /* ---------------- NOTIFICATIONS PERMISSION ---------------- */
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  /* ---------------- TYPING / ONLINE TEXTS ---------------- */
  const typingList = Object.keys(typingUsers).filter((u) => u !== me);
  const typingText = typingList.length ? `${typingList.slice(0, 2).join(", ")} ${typingList.length > 1 ? "are" : "is"} typing...` : "";

  const onlineUsersList = Object.keys(onlineMap).filter(Boolean);

  /* ---------------- RENDER ---------------- */
  return (
    <>
      {/* Styles for animations (Tailwind + small custom keyframes) */}
      <style>{`
        @keyframes slideUpPanel {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
        .slide-up-panel { animation: slideUpPanel 240ms cubic-bezier(.2,.9,.3,1) both; }
        @keyframes msgIn {
          from { transform: translateY(6px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .msg-enter { animation: msgIn 300ms ease both; }
      `}</style>

      {/* Floating Button */}
      <button
  onClick={() => {
    setOpen((v) => !v);
    if (!open) setUnread(0);
    sendPresence("online");
  }}
  className={`
    fixed bottom-4 right-0 z-50
    text-white px-2 py-4
    rounded-l-xl shadow-lg
    flex flex-col items-center justify-center gap-1
    hover:bg-orange-700 transition-all duration-700
    ${open ? "right-80 bg-yellow-600" : "bg-orange-600"}
  `}
  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
>
  Message Box
  {unread > 0 && (
    <span className="mt-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full rotate-180">
      {unread}
    </span>
  )}
</button>



      {/* Panel */}
{/* Panel (always mounted, fully animated) */}
<div
  className={`
    fixed bottom-4 right-0 z-50
    w-80 h-[520px]
    bg-white
    shadow-2xl rounded-xl border border-gray-200/60
    flex flex-col overflow-hidden
    transition-all duration-700 ease-out

    ${open
      ? "translate-x-0 opacity-100 pointer-events-auto"
      : "translate-x-full opacity-0 pointer-events-none"
    }
  `}
>
  {/* Header */}
  <div className="bg-orange-600 text-white p-3 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="font-semibold">📢 Message Board</span>
        <span className="text-xs text-white/80">
          {messages.filter((m) => m.pinned).length} pinned • {onlineUsersList.length} online
        </span>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <div className="flex -space-x-1">
        {onlineUsersList.slice(0, 5).map((u) => (
          <div
            key={u}
            className="w-6 h-6 rounded-full ring-1 ring-white text-[10px] flex items-center justify-center text-white"
            title={u}
          >
            <span className={`${colorFromName(u)} w-6 h-6 flex items-center justify-center rounded-full text-xs`}>
              {initialsFromName(u)}
            </span>
          </div>
        ))}
      </div>

      <button onClick={() => loadMessages()} className="text-white/90 text-sm">Refresh</button>
      <button onClick={() => setOpen(false)} className="text-white text-xl font-bold">×</button>
    </div>
  </div>

  {/* Transparent + Frosted Background */}
  <div
    ref={scrollRef}
    className="
      flex-1 overflow-y-auto p-3
      bg-red/30 backdrop-blur-lg shadow-inner
      space-y-3
    "
  >
    {messages.filter(m => m.pinned).map(m => (
      <div key={`p${m.id}`} className="msg-enter">
        <MessageCard m={m} me={me} isAdmin={isAdmin} deleteMsg={deleteMsg} togglePin={togglePin} pinned />
      </div>
    ))}

    {messages.filter(m => !m.pinned).map(m => (
      <div key={m.id} className="msg-enter">
        <MessageCard m={m} me={me} isAdmin={isAdmin} deleteMsg={deleteMsg} togglePin={togglePin} />
      </div>
    ))}
  </div>

  {/* Typing */}
  <div className="px-3 text-xs text-gray-500 h-5">{typingText}</div>

  {/* Input */}
  <div className="p-3 border-t flex gap-2 items-center bg-white/80 backdrop-blur-sm">
    <EmojiPicker onSelect={(e) => onTextChange(text + e)} />

    <div className="flex-1 min-w-0">
      <input
        className="w-full min-w-0 border rounded px-2 py-1"
        placeholder="Write a message…"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
      />
    </div>

    <button
      onClick={sendMessage}
      className="flex-none bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
    >
      Send
    </button>
  </div>
</div>



    </>
  );
}

/* ---------------- Emoji Picker ---------------- */
function EmojiPicker({ onSelect }) {
  const emojis = ["😀","😃","😅","😂","😢","😡","👍","👎","⚠️","📢","📌","🔥","✅","❌"];
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded border bg-white"
      >
        😊
      </button>

      {open && (
        <div
          className="
            absolute bottom-10 left-0 bg-white border p-2 rounded shadow
            grid grid-cols-[repeat(auto-fit,minmax(32px,1fr))] gap-2 z-50
            min-w-[160px] max-w-[220px]
          "
        >
          {emojis.map((e) => (
            <button
              key={e}
              onClick={() => {
                onSelect(e);
                setOpen(false);
              }}
              className="text-xl"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



/* ---------------- Message Card with Avatar + presence indicator + animation ---------------- */
function MessageCard({ m, me, isAdmin, deleteMsg, togglePin, pinned }) {
  const mine = m.username === me;

  return (
    <div className={`w-full flex  ${mine ? "justify-end" : "justify-start"}`}>
      <div
  className={`
    w-[80%] 
    px-3 py-2 rounded-lg shadow-sm msg-enter
    ${mine ? "bg-orange-100 text-right" : "bg-white text-left border"}
  `}
>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <strong className={`${m.username === "admin" ? "text-red-600" : "text-orange-700"} mr-1`}>
              {m.username}
            </strong>
            <span className="text-[11px] text-gray-400">
              {new Date(m.created_at).toLocaleTimeString()}
            </span>
          </div>

          {pinned && <span className="text-xs text-yellow-600">📌</span>}
        </div>

        {/* Message text */}
        <div className={`mt-1 text-sm ${m.username === "admin" ? "text-red-800" : "text-gray-800"}`}>
          {m.content}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex gap-2 justify-end mt-2 text-xs">
            <button onClick={() => togglePin(m.id, !m.pinned)} className="text-gray-500 hover:text-gray-800">
              📌
            </button>
            <button onClick={() => deleteMsg(m.id)} className="text-gray-500 hover:text-gray-800">
              🗑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}