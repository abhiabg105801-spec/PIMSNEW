import React, { useState, useEffect } from "react";
import axios from "axios";

export default function MessageBoard({ auth }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const api = axios.create({
    baseURL: "http://localhost:8080/messages",
    headers: { Authorization: auth },
  });

  const loadMessages = async () => {
    try {
      const res = await api.get("/");
      setMessages(res.data);
    } catch (err) {
      console.error("Message load failed", err);
    }
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    try {
      await api.post("/", { content: text });
      setText("");
      loadMessages();
    } catch (err) {
      console.error("Post failed", err);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  return (
    <div className="bg-white border rounded-lg p-4 shadow-md mt-6 max-w-3xl mx-auto">
      <h2 className="text-lg font-bold text-orange-600 mb-3">📢 Notice Board</h2>

      {/* Input Box */}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message to all users..."
          className="flex-1 border px-3 py-2 rounded"
        />
        <button
          onClick={sendMessage}
          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
        >
          Post
        </button>
      </div>

      {/* Message List */}
      <div className="mt-4 max-h-80 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className="border-b py-2 text-sm text-gray-700 flex justify-between"
          >
            <div>
              <b className="text-orange-700">{m.username}</b>: {m.content}
              <div className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
