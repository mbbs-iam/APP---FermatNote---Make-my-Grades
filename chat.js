import { db, auth } from "./firebase.js";
import { esc, toast, initials, avatarColor, formatDate, linkify, compressImageToBase64 } from "./utils.js";
import {
  collection, query, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp,
  doc, updateDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

let currentUser = null;
let unsubscribeChat = null;
let unsubscribeAuth = null;
let isInitialized = false;

let replyState = null;

function getElement(id) {
  return document.getElementById(id);
}

function scrollToBottom() {
  const container = getElement("chat-message-list-paper");
  if (container) container.scrollTop = container.scrollHeight;
}

function setReply(msgId, authorName, snippet) {
  replyState = { msgId, authorName, snippet };
  const preview = getElement("chat-reply-preview");
  const authorEl = getElement("chat-reply-author");
  const snippetEl = getElement("chat-reply-snippet");
  if (preview) preview.classList.add("active");
  if (authorEl) authorEl.textContent = authorName;
  if (snippetEl) snippetEl.textContent = snippet;
  const input = getElement("chat-input");
  if (input) input.focus();
}

function clearReply() {
  replyState = null;
  const preview = getElement("chat-reply-preview");
  if (preview) preview.classList.remove("active");
}

export function initChat() {
  setupEventListeners();

  if (unsubscribeAuth) unsubscribeAuth();
  currentUser = null;
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser = user;
    startListening();
  });
}

export function destroyChat() {
  if (unsubscribeChat) { 
    unsubscribeChat(); 
    unsubscribeChat = null; 
  }
  if (unsubscribeAuth) { 
    unsubscribeAuth(); 
    unsubscribeAuth = null; 
  }
  clearReply();
  isInitialized = false;
}

function setupEventListeners() {
  const input = getElement("chat-input");
  const sendBtn = getElement("chat-send-btn");
  const cancelReplyBtn = getElement("chat-reply-preview-cancel");

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", clearReply);
  }
}

function startListening() {
  if (!currentUser) return;

  if (unsubscribeChat) unsubscribeChat();

  const messageList = getElement("chat-message-list");
  if (!messageList) return;

  const q = query(
    collection(db, "chat_messages"),
    orderBy("timestamp", "asc"),
    limit(100)
  );

  unsubscribeChat = onSnapshot(q, (snapshot) => {
    messageList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const element = createMessageElement(docSnap.id, msg);
      messageList.appendChild(element);
    });
    scrollToBottom();
  });
}

function createMessageElement(msgId, msgData) {
  const container = document.createElement("div");
  container.className = "chat-message-container";
  container.setAttribute("data-msg-id", msgId);

  const isSender = msgData.userId === currentUser?.uid;
  const sender = msgData.senderName || "Unknown";
  const time = msgData.timestamp ? formatDate(msgData.timestamp) : "";

  let html = `<div class="chat-bubble ${isSender ? "sent" : "received"}">`;

  if (msgData.replyTo) {
    html += `<div class="chat-bubble__reply-quote">
      <span class="chat-bubble__reply-quote--author">${esc(msgData.replyTo.author)}</span>
      <span class="chat-bubble__reply-quote--text">${esc(msgData.replyTo.text)}</span>
    </div>`;
  }

  html += `<div class="chat-message-text">${linkify(esc(msgData.text))}</div>
    <div class="chat-message-meta">
      <span class="chat-message-time">${time}</span>
    </div>
  </div>`;

  if (!isSender) {
    html = `<div class="chat-sender-info">${esc(sender)}</div>` + html;
  }

  container.innerHTML = html;

  container.addEventListener("click", () => {
    const preview = msgData.text.substring(0, 50);
    setReply(msgId, sender, preview);
  });

  return container;
}

async function sendMessage() {
  const input = getElement("chat-input");
  const text = input?.value?.trim() || "";

  if (!text || !currentUser) return;

  input.value = "";

  const messageData = {
    text: text,
    userId: currentUser.uid,
    senderName: currentUser.displayName || "User",
    timestamp: serverTimestamp()
  };

  if (replyState) {
    messageData.replyTo = {
      msgId: replyState.msgId,
      author: replyState.authorName,
      text: replyState.snippet
    };
    clearReply();
  }

  try {
    await addDoc(collection(db, "chat_messages"), messageData);
  } catch (error) {
    console.error("Error sending message:", error);
    toast("Error sending message");
    input.value = text;
  }
}
