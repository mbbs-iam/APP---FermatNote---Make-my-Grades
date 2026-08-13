// ================================================================
//  chat.js — Lycée Skillforge · Hub de Classe
//  Version 2.1 — Reply System (WhatsApp)
// ================================================================

import { db, auth } from "./firebase.js";
import { esc, toast, initials, avatarColor, formatDate, linkify, compressImageToBase64 } from "./utils.js";
import {
  collection, query, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp,
  doc, updateDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// ── État ─────────────────────────────────────────────────────
let currentUser = null;
let unsubscribeChat = null;
let unsubscribeAuth = null;
let isInitialized = false;

// ── État Reply ───────────────────────────────────────────────
let replyState = null; // { msgId, auteurNom, snippet }


llpaper");
  if (c) c.scrollTop = c.scrollHeight;
}

// ── Reply : activer la barre de réponse ──────────────────────
function setReply(msgId, auteurNom, snippet) {
  replyState = { msgId, auteurNom, snippet };
  const preview = $("chat-reply-preview");
  const authorEl = $("chat-reply-author");
  const snippetEl = $("chat-reply-snippet");
  if (preview) preview.classList.add("active");
  if (authorEl) authorEl.textContent = auteurNom;
  if (snippetEl) snippetEl.textContent = snippet;
  $("chat-input")?.focus();
}

// ── API publique ──────────────────────────────────────────────
export function initChat() {
  wireEvents();



  if (unsubscribeAuth) unsubscribeAuth();
  currentUser = null;
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser = user;
    startListening();
  });
}

export function destroyChat() {
  if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
  if (unsubscribeAuth) { unsubscribeAuth(); unsubscribeAuth = null; }

  clearReply();
  isInitialized = false;
}
