// ================================================================
//  forum.js — Composant Forum (style Reddit)
//  Lycée Skillforge · Hub de Classe
//  Clean, DRY & Scalable (Refactorisation de Nettoyage & Optimisation RAM)
// ========ien copié !");
  }
}

function startListening(sort = "recent") {
  if (unsubscribePosts) unsubscribePosts();
  const feed = $("forum-feed");
  if (!feed) return;
onst scoreA = (a.data().votes?.up ?? 0) - (a.data().votes?.down ?? 0);
          const scoreB = (b.data().votes?.up ?? 0) - (b.data().votes?.down ?? 0);
          return scoreB - scoreA;
        });
      }
      docs.forEach((docSnap) => feed.appendChild(buildPostCard(docSnap.id, docSnap.data())));
    },
    (err) => {
      console.error(err);
      if (feed) 
    toast("❌ Erreur, réessaie. (Peut-être image trop lourde)");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span class="material-symbols-outlined">send</span> Publier la question`;
    }
  }
});

document.getElementById("fab-new-post")?.addEventListener("click", openModal);
document.ge
      toasviewUrl = URL.createObjectURL(file);
      if (previewImg) { previewImg.src = currentPreviewUrl; previewImg.style.display = "block"; }
    } else {
      if (previewImg) { previewImg.src = ""; previewImg.style.display = "none"; }
   user;
    if (!user) { for (const k in userVotes) delete userVotes[k]; }
    if (firstResolve || (prevUser?.uid !== user?.uid)) {
      firstResolve = false;
      if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
      if (user) {
        unsubscribeProfile = onSnapshot(doc(db, "utilisateurs", user.uid), (snap) => {
          userForumMasques = snap.data()?.forumMasques || {};
          startListening(currentSort);
        });
      } else {
        userForumMasques = {};
        startListening(currentSort);
      }
    }
  });

  if (!popstateWired) {
    popstateWired = true;
    window.addEventListener("popstate", () => {
      if ($("modal-forum-replies")?.classList.contains("open")) {
        closeReplies();
      }
  if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
  if (escHandler) { document.removeEventListener("keydown", escHandler); escHandler = null; }
}

$("forum-attach-btn")?.addEventListener("click", () => $("forum-file-input")?.click());

$("forum-file-input")?.addEventListener("change", (e) => { 
    const file = e.target.files?.[0]; 
    if (!file) return; 
    const isImage = file.type.startsWith("image/") || file.name.match(/\.(heic|heif|jpg|jpeg|png|gif|webp)$/i); 
    if (!isImage || file.size > 20 * 1024 * 1024) { 
        toast("⚠️ Seules les images (max 20 Mo) sont autorisées."); 
        return; 
    } 
    forumSelectedFile = file; 
    const imgEl = $("forum-preview-img");
    if (imgEl) {
        if (imgEl.src && imgEl.src.startsWith("blob:")) URL.revokeObjectURL(imgEl.src);
        imgEl.src = URL.createObjectURL(file);
    } 
    if ($("forum-image-preview-wrap")) $("forum-image-preview-wrap").style.display = "block"; 
});
