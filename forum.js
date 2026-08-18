import { db, auth } from "./firebase.js";
import { esc, toast, initials, avatarColor, formatDate, linkify, compressImageToBase64 } from "./utils.js";
import {
  collection, query, orderBy, limit, where,
  onSnapshot, addDoc, serverTimestamp,
  doc, updateDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

let currentUser = null;
let unsubscribeAuth = null;
let unsubscribePosts = null;
let unsubscribeProfile = null;
let isInitialized = false;

let currentSort = "recent";
let userForumMasques = {};
let forumSelectedFile = null;
let currentPreviewUrl = null;

let popstateWired = false;
let escHandler = null;

function getElement(id) {
  return document.getElementById(id);
}

function showToast(message) {
  toast(message);
}

function startListening(sort = "recent") {
  if (unsubscribePosts) unsubscribePosts();
  
  const feed = getElement("forum-feed");
  if (!feed) return;

  const q = query(
    collection(db, "forum_posts"),
    orderBy(sort === "recent" ? "timestamp" : "votes", sort === "recent" ? "desc" : "desc"),
    limit(50)
  );

  unsubscribePosts = onSnapshot(q, (snapshot) => {
    feed.innerHTML = "";
    const docs = snapshot.docs;

    if (sort === "popular") {
      docs.sort((a, b) => {
        const scoreA = (a.data().votes?.up ?? 0) - (a.data().votes?.down ?? 0);
        const scoreB = (b.data().votes?.up ?? 0) - (b.data().votes?.down ?? 0);
        return scoreB - scoreA;
      });
    }

    docs.forEach((docSnap) => {
      feed.appendChild(buildPostCard(docSnap.id, docSnap.data()));
    });
  });
}

function buildPostCard(postId, postData) {
  const card = document.createElement("div");
  card.className = "post-card";

  const authorName = postData.authorName || "Anonymous";
  const timestamp = postData.timestamp ? formatDate(postData.timestamp) : "";
  const voteUp = postData.votes?.up ?? 0;
  const voteDown = postData.votes?.down ?? 0;

  card.innerHTML = `
    <div class="post-voting">
      <button class="vote-btn vote-up" data-post-id="${postId}">↑</button>
      <span class="vote-score">${voteUp - voteDown}</span>
      <button class="vote-btn vote-down" data-post-id="${postId}">↓</button>
    </div>
    <div class="post-content">
      <div class="post-header">
        <span class="post-author-name">${esc(authorName)}</span>
        <span class="post-author-time">${timestamp}</span>
      </div>
      <h3 class="post-title">${esc(postData.title)}</h3>
      <div class="post-body">${linkify(esc(postData.body))}</div>
      ${postData.imageUrl ? `<img src="${postData.imageUrl}" class="post-image">` : ""}
      <div class="post-actions">
        <button class="post-action-btn reply-btn" data-post-id="${postId}">Reply</button>
        ${currentUser?.uid === postData.userId ? `<button class="post-action-btn delete-btn" data-post-id="${postId}">Delete</button>` : ""}
      </div>
    </div>
  `;

  card.addEventListener("click", (e) => {
    if (e.target.classList.contains("reply-btn")) {
      openRepliesModal(postId, postData);
    } else if (e.target.classList.contains("delete-btn")) {
      deletePost(postId);
    } else if (e.target.classList.contains("vote-up")) {
      votePost(postId, "up");
    } else if (e.target.classList.contains("vote-down")) {
      votePost(postId, "down");
    }
  });

  return card;
}

function openRepliesModal(postId, postData) {
  const modal = getElement("modal-forum-replies");
  if (!modal) return;

  const header = modal.querySelector(".modal__title");
  const repliesList = modal.querySelector(".forum-replies-list");

  if (header) {
    header.textContent = postData.title;
  }

  if (repliesList) {
    repliesList.innerHTML = "";
    loadReplies(postId, repliesList);
  }

  modal.classList.add("open");
}

function loadReplies(postId, container) {
  const q = query(
    collection(db, "forum_replies"),
    where("postId", "==", postId),
    orderBy("timestamp", "asc")
  );

  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const reply = docSnap.data();
      const replyEl = document.createElement("div");
      replyEl.className = "reply-bubble";
      replyEl.innerHTML = `
        <div class="reply-bubble__content">
          <div class="reply-bubble__header">
            <span class="reply-bubble__author">${esc(reply.authorName)}</span>
            <span class="reply-bubble__time">${formatDate(reply.timestamp)}</span>
          </div>
          <p class="reply-bubble__text">${linkify(esc(reply.text))}</p>
        </div>
      `;
      container.appendChild(replyEl);
    });
  });
}

function closeReplies() {
  const modal = getElement("modal-forum-replies");
  if (modal) modal.classList.remove("open");
}

function setupEventListeners() {
  const newPostBtn = getElement("fab-new-post");
  const submitBtn = getElement("forum-submit-btn");
  const cancelBtn = getElement("forum-cancel-btn");
  const attachBtn = getElement("forum-attach-btn");
  const fileInput = getElement("forum-file-input");
  const titleInput = getElement("forum-title");
  const bodyInput = getElement("forum-body");

  if (newPostBtn) {
    newPostBtn.addEventListener("click", () => {
      const modal = getElement("modal-new-post");
      if (modal) modal.classList.add("open");
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      const modal = getElement("modal-new-post");
      if (modal) modal.classList.remove("open");
      titleInput.value = "";
      bodyInput.value = "";
      forumSelectedFile = null;
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", submitPost);
  }

  if (attachBtn) {
    attachBtn.addEventListener("click", () => fileInput?.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith("image/") || 
                     file.name.match(/\.(heic|heif|jpg|jpeg|png|gif|webp)$/i);

      if (!isImage || file.size > 20 * 1024 * 1024) {
        showToast("Only images (max 20MB) are allowed");
        return;
      }

      forumSelectedFile = file;
      const preview = getElement("forum-preview-img");
      if (preview) {
        if (preview.src && preview.src.startsWith("blob:")) {
          URL.revokeObjectURL(preview.src);
        }
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";
      }

      const wrap = getElement("forum-image-preview-wrap");
      if (wrap) wrap.style.display = "block";
    });
  }
}

async function submitPost() {
  const titleInput = getElement("forum-title");
  const bodyInput = getElement("forum-body");
  const submitBtn = getElement("forum-submit-btn");

  const title = titleInput?.value?.trim() || "";
  const body = bodyInput?.value?.trim() || "";

  if (!title || !body || !currentUser) {
    showToast("Please fill in all fields");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  let imageUrl = null;
  if (forumSelectedFile) {
    try {
      imageUrl = await compressImageToBase64(forumSelectedFile);
    } catch (error) {
      console.error("Image compression error:", error);
      showToast("Error uploading image");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
  }

  const postData = {
    title: title,
    body: body,
    authorName: currentUser.displayName || "Anonymous",
    userId: currentUser.uid,
    timestamp: serverTimestamp(),
    imageUrl: imageUrl,
    votes: { up: 0, down: 0 }
  };

  try {
    await addDoc(collection(db, "forum_posts"), postData);
    
    titleInput.value = "";
    bodyInput.value = "";
    forumSelectedFile = null;
    
    const modal = getElement("modal-new-post");
    if (modal) modal.classList.remove("open");
    
    showToast("Post published successfully");
  } catch (error) {
    console.error("Error publishing post:", error);
    showToast("Error publishing post");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function votePost(postId, direction) {
  if (!currentUser) return;

  const postRef = doc(db, "forum_posts", postId);
  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) return;

  const votes = postSnap.data().votes || { up: 0, down: 0 };
  
  if (direction === "up") {
    votes.up += 1;
  } else {
    votes.down += 1;
  }

  await updateDoc(postRef, { votes });
}

async function deletePost(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;

  try {
    await deleteDoc(doc(db, "forum_posts", postId));
    showToast("Post deleted");
  } catch (error) {
    console.error("Error deleting post:", error);
    showToast("Error deleting post");
  }
}

export function initForum() {
  setupEventListeners();

  if (unsubscribeAuth) unsubscribeAuth();
  currentUser = null;
  unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    currentUser = user;
    startListening();
  });
}

export function destroyForum() {
  if (unsubscribePosts) { 
    unsubscribePosts(); 
    unsubscribePosts = null; 
  }
  if (unsubscribeAuth) { 
    unsubscribeAuth(); 
    unsubscribeAuth = null; 
  }
  if (unsubscribeProfile) { 
    unsubscribeProfile(); 
    unsubscribeProfile = null; 
  }
  if (escHandler) { 
    document.removeEventListener("keydown", escHandler); 
    escHandler = null; 
  }
  isInitialized = false;
}
